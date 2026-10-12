"""
Attendance business rules.

MVP policy (SDLC 9.2 / 9.3):
  * Only IN events are created. A repeated sighting never becomes an OUT event.
  * At most one confirmed IN per employee per workplace day (database-enforced).
  * Later sightings of an already-recorded employee are suppressed; the existing event's
    sighting counter is updated as evidence.
  * Uncertain and unknown observations become review items, merged within the dedup interval.
"""

from datetime import datetime, timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.audit import services as audit
from apps.settings_app.models import SystemSettings

from .models import AttendanceEvent as Event
from .models import CorrectionRequest


def local_date_of(moment: datetime):
    return timezone.localtime(moment).date()


def record_observation(*, camera, outcome: str, employee_id: int | None, similarity: float,
                       quality: float | None, model_version: str, occurred_at: datetime | None = None) -> tuple[Event | None, str]:
    """
    Apply attendance rules to one recognition outcome from a camera.

    Returns (event, action) where action is one of
    ``created``, ``duplicate``, ``review_created``, ``review_merged``, ``ignored``.
    """
    occurred_at = occurred_at or timezone.now()
    day = local_date_of(occurred_at)
    direction = camera.direction
    if direction != Event.Direction.IN:
        return None, "ignored"  # OUT capture is a later release

    cfg = SystemSettings.load()
    window_start = occurred_at - timedelta(seconds=cfg.dedup_interval_seconds)

    if outcome == "matched":
        existing = Event.objects.filter(
            employee_id=employee_id, local_date=day, direction=direction, status=Event.Status.CONFIRMED
        ).first()
        if existing:
            _bump(existing, occurred_at)
            return existing, "duplicate"
        try:
            with transaction.atomic():
                event = Event.objects.create(
                    employee_id=employee_id, camera=camera, occurred_at=occurred_at, local_date=day,
                    direction=direction, source=Event.Source.CAMERA, match_status=Event.MatchStatus.MATCHED,
                    status=Event.Status.CONFIRMED, confidence=round(similarity, 4), quality=quality,
                    model_version=model_version, last_sighting_at=occurred_at,
                )
            return event, "created"
        except IntegrityError:
            # Concurrent insert for the same employee/day: the unique constraint keeps one record.
            existing = Event.objects.get(employee_id=employee_id, local_date=day, direction=direction,
                                         status=Event.Status.CONFIRMED)
            _bump(existing, occurred_at)
            return existing, "duplicate"

    if outcome == "uncertain":
        # Don't queue a review if this candidate already has attendance today.
        if employee_id and Event.objects.filter(employee_id=employee_id, local_date=day, direction=direction,
                                                status=Event.Status.CONFIRMED).exists():
            return None, "ignored"
        recent = Event.objects.filter(
            candidate_employee_id=employee_id, camera=camera, status=Event.Status.PENDING_REVIEW,
            match_status=Event.MatchStatus.UNCERTAIN, last_sighting_at__gte=window_start,
        ).first()
    elif outcome == "unknown":
        if not cfg.record_unknown_faces:
            return None, "ignored"
        recent = Event.objects.filter(
            camera=camera, status=Event.Status.PENDING_REVIEW, match_status=Event.MatchStatus.UNKNOWN,
            last_sighting_at__gte=window_start,
        ).first()
    else:
        return None, "ignored"

    if recent:
        if similarity > (recent.confidence or 0):
            recent.confidence = round(similarity, 4)
        _bump(recent, occurred_at, extra_fields=["confidence"])
        return recent, "review_merged"

    event = Event.objects.create(
        candidate_employee_id=employee_id if outcome == "uncertain" else None, camera=camera,
        occurred_at=occurred_at, local_date=day, direction=direction, source=Event.Source.CAMERA,
        match_status=outcome, status=Event.Status.PENDING_REVIEW, confidence=round(similarity, 4),
        quality=quality, model_version=model_version, last_sighting_at=occurred_at,
    )
    return event, "review_created"


def _bump(event: Event, when: datetime, extra_fields: list[str] | None = None) -> None:
    event.sighting_count += 1
    event.last_sighting_at = when
    event.save(update_fields=["sighting_count", "last_sighting_at", "updated_at", *(extra_fields or [])])


def _conflict_check(employee_id, day, direction, exclude_id=None):
    qs = Event.objects.filter(employee_id=employee_id, local_date=day, direction=direction, status=Event.Status.CONFIRMED)
    if exclude_id:
        qs = qs.exclude(pk=exclude_id)
    existing = qs.first()
    if existing:
        raise ValidationError({"detail": f"This employee already has a confirmed {direction} record for {day} "
                                         f"(record #{existing.id}). Correct that record instead."})


def create_manual_event(*, employee, occurred_at: datetime, reason: str, user, request=None) -> Event:
    """Manual fallback entry by an administrator."""
    if occurred_at > timezone.now() + timedelta(minutes=5):
        raise ValidationError({"occurred_at": "Attendance cannot be recorded in the future."})
    day = local_date_of(occurred_at)
    with transaction.atomic():
        _conflict_check(employee.id, day, Event.Direction.IN)
        event = Event.objects.create(
            employee=employee, occurred_at=occurred_at, local_date=day, direction=Event.Direction.IN,
            source=Event.Source.MANUAL, match_status=Event.MatchStatus.MANUAL, status=Event.Status.CONFIRMED,
            notes=reason, created_by=user, last_sighting_at=occurred_at,
        )
        CorrectionRequest.objects.create(
            employee=employee, event=event, kind=CorrectionRequest.Kind.MISSING, requested_time=occurred_at,
            reason=reason, status=CorrectionRequest.Status.APPROVED, requested_by=user, decided_by=user,
            decided_at=timezone.now(), before={}, after=event.snapshot(),
        )
    audit.record("attendance.manual_entry", request=request, entity=event, reason=reason,
                 changes={"after": event.snapshot()})
    return event


def review_event(*, event: Event, decision: str, employee=None, reason: str, user, request=None) -> Event:
    """Resolve a pending review item: confirm (assigning an employee) or reject."""
    if event.status != Event.Status.PENDING_REVIEW:
        raise ValidationError({"detail": "This item has already been reviewed."})
    before = event.snapshot()
    with transaction.atomic():
        if decision == "confirm":
            if employee is None:
                raise ValidationError({"employee_id": "Choose the employee shown in this observation."})
            _conflict_check(employee.id, event.local_date, event.direction)
            event.employee = employee
            event.status = Event.Status.CONFIRMED
            event.match_status = Event.MatchStatus.REVIEWED
        elif decision == "reject":
            event.status = Event.Status.REJECTED
        else:
            raise ValidationError({"decision": "Use 'confirm' or 'reject'."})
        event.reviewed_by = user
        event.reviewed_at = timezone.now()
        event.notes = reason
        event.save()
        if decision == "confirm":
            CorrectionRequest.objects.create(
                employee=employee, event=event, kind=CorrectionRequest.Kind.OTHER, reason=reason,
                status=CorrectionRequest.Status.APPROVED, requested_by=user, decided_by=user,
                decided_at=event.reviewed_at, before=before, after=event.snapshot(),
            )
    audit.record(f"attendance.review_{decision}", request=request, entity=event, reason=reason,
                 changes={"before": before, "after": event.snapshot()})
    return event


def correct_event(*, event: Event, occurred_at: datetime | None, void: bool, reason: str, user,
                  request=None, correction: CorrectionRequest | None = None) -> Event:
    """Administrator correction of a confirmed record (time change or void), fully audited."""
    if event.status != Event.Status.CONFIRMED:
        raise ValidationError({"detail": "Only confirmed records can be corrected. Use review for pending items."})
    before = event.snapshot()
    with transaction.atomic():
        if void:
            event.status = Event.Status.REJECTED
        elif occurred_at:
            if occurred_at > timezone.now() + timedelta(minutes=5):
                raise ValidationError({"occurred_at": "Attendance cannot be recorded in the future."})
            new_day = local_date_of(occurred_at)
            _conflict_check(event.employee_id, new_day, event.direction, exclude_id=event.id)
            event.occurred_at = occurred_at
            event.local_date = new_day
        else:
            raise ValidationError({"detail": "Provide a corrected time or void the record."})
        event.notes = reason
        event.save()
        after = event.snapshot()
        if correction is None:
            correction = CorrectionRequest.objects.create(
                employee_id=event.employee_id, event=event,
                kind=CorrectionRequest.Kind.NOT_ME if void else CorrectionRequest.Kind.WRONG_TIME,
                requested_time=occurred_at, reason=reason, status=CorrectionRequest.Status.APPROVED,
                requested_by=user, decided_by=user, decided_at=timezone.now(), before=before, after=after,
            )
        else:
            correction.before, correction.after = before, after
    audit.record("attendance.correct", request=request, entity=event, reason=reason,
                 changes={"before": before, "after": after, "correction_id": correction.id})
    return event


def decide_correction(*, correction: CorrectionRequest, approve: bool, note: str, user,
                      occurred_at: datetime | None = None, request=None) -> CorrectionRequest:
    """Approve (applying the change) or reject an employee's correction request."""
    if correction.status != CorrectionRequest.Status.PENDING:
        raise ValidationError({"detail": "This request has already been decided."})
    with transaction.atomic():
        if approve:
            when = occurred_at or correction.requested_time
            if correction.kind == CorrectionRequest.Kind.MISSING:
                if not when:
                    raise ValidationError({"occurred_at": "Provide the attendance time to record."})
                event = create_manual_event(employee=correction.employee, occurred_at=when,
                                            reason=f"Correction request #{correction.id}: {correction.reason}",
                                            user=user, request=request)
                correction.event = event
                correction.after = event.snapshot()
            elif correction.event is not None:
                correction.before = correction.event.snapshot()
                correct_event(event=correction.event, occurred_at=when,
                              void=correction.kind == CorrectionRequest.Kind.NOT_ME,
                              reason=f"Correction request #{correction.id}: {note or correction.reason}",
                              user=user, request=request, correction=correction)
                correction.after = correction.event.snapshot()
            correction.status = CorrectionRequest.Status.APPROVED
        else:
            correction.status = CorrectionRequest.Status.REJECTED
        correction.decided_by = user
        correction.decided_at = timezone.now()
        correction.decision_note = note
        correction.save()
    audit.record(f"correction.{'approve' if approve else 'reject'}", request=request, entity=correction,
                 reason=note, changes={"before": correction.before, "after": correction.after})
    return correction
