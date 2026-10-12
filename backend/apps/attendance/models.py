from django.conf import settings
from django.db import models
from django.db.models import Q


class AttendanceEvent(models.Model):
    """
    A camera observation or attendance record.

    * ``confirmed`` events are attendance records (automatic matches, manual entries, approved reviews).
    * ``pending_review`` events are uncertain/unknown observations awaiting a human decision.
    * ``rejected`` events were dismissed by a reviewer or voided by a correction.
    """

    class Direction(models.TextChoices):
        IN = "IN", "In"
        OUT = "OUT", "Out"

    class MatchStatus(models.TextChoices):
        MATCHED = "matched", "Matched"
        UNCERTAIN = "uncertain", "Uncertain"
        UNKNOWN = "unknown", "Unknown"
        MANUAL = "manual", "Manual entry"
        REVIEWED = "reviewed", "Reviewed"

    class Status(models.TextChoices):
        CONFIRMED = "confirmed", "Confirmed"
        PENDING_REVIEW = "pending_review", "Pending review"
        REJECTED = "rejected", "Rejected"

    class Source(models.TextChoices):
        CAMERA = "camera", "Camera"
        MANUAL = "manual", "Manual"

    employee = models.ForeignKey(
        "employees.Employee", on_delete=models.PROTECT, null=True, blank=True, related_name="attendance_events"
    )
    candidate_employee = models.ForeignKey(
        "employees.Employee", on_delete=models.SET_NULL, null=True, blank=True, related_name="+",
        help_text="Best (but insufficient) match for uncertain observations.",
    )
    camera = models.ForeignKey("cameras.Camera", on_delete=models.SET_NULL, null=True, blank=True, related_name="events")
    occurred_at = models.DateTimeField(db_index=True)
    local_date = models.DateField(db_index=True, help_text="Date in the workplace timezone.")
    direction = models.CharField(max_length=3, choices=Direction.choices, default=Direction.IN)
    source = models.CharField(max_length=8, choices=Source.choices)
    match_status = models.CharField(max_length=10, choices=MatchStatus.choices)
    status = models.CharField(max_length=16, choices=Status.choices, db_index=True)
    confidence = models.FloatField(null=True, blank=True, help_text="Cosine similarity of the best match.")
    quality = models.FloatField(null=True, blank=True)
    model_version = models.CharField(max_length=80, blank=True)
    sighting_count = models.PositiveIntegerField(default=1)
    last_sighting_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-occurred_at", "-id"]
        constraints = [
            # Idempotency: at most one confirmed IN (or OUT) per employee per workplace day.
            models.UniqueConstraint(
                fields=["employee", "local_date", "direction"],
                condition=Q(status="confirmed"),
                name="uniq_confirmed_event_per_employee_day_direction",
            ),
            models.CheckConstraint(condition=Q(direction__in=["IN", "OUT"]), name="attendance_valid_direction"),
            models.CheckConstraint(
                condition=~Q(status="confirmed") | Q(employee__isnull=False),
                name="attendance_confirmed_requires_employee",
            ),
        ]
        indexes = [models.Index(fields=["local_date", "status"])]

    def snapshot(self) -> dict:
        return {
            "employee_id": self.employee_id,
            "occurred_at": self.occurred_at.isoformat() if self.occurred_at else None,
            "direction": self.direction,
            "status": self.status,
            "match_status": self.match_status,
        }


class CorrectionRequest(models.Model):
    """A correction to attendance, requested by an employee or made directly by an administrator."""

    class Kind(models.TextChoices):
        MISSING = "missing", "Missing attendance"
        WRONG_TIME = "wrong_time", "Wrong time"
        NOT_ME = "not_me", "Record is not mine"
        OTHER = "other", "Other"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        CANCELLED = "cancelled", "Cancelled"

    employee = models.ForeignKey("employees.Employee", on_delete=models.CASCADE, related_name="correction_requests")
    event = models.ForeignKey(AttendanceEvent, on_delete=models.SET_NULL, null=True, blank=True, related_name="corrections")
    kind = models.CharField(max_length=16, choices=Kind.choices)
    requested_time = models.DateTimeField(null=True, blank=True)
    reason = models.TextField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING, db_index=True)
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+")
    decided_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    decided_at = models.DateTimeField(null=True, blank=True)
    decision_note = models.TextField(blank=True)
    before = models.JSONField(default=dict, blank=True)
    after = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
