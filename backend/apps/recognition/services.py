import numpy as np
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import APIException, ValidationError

from apps.audit import services as audit
from apps.security import EncryptionNotConfigured, encryption_configured
from apps.settings_app.models import SystemSettings

from . import engine as face_engine
from .models import EnrollmentSession, FaceTemplate

POSES = [
    {"key": "front", "label": "Look straight at the camera"},
    {"key": "slight_left", "label": "Turn your head slightly to the left"},
    {"key": "slight_right", "label": "Turn your head slightly to the right"},
    {"key": "slight_up", "label": "Tilt your head slightly up"},
    {"key": "slight_down", "label": "Tilt your head slightly down"},
    {"key": "left", "label": "Turn further to the left"},
    {"key": "right", "label": "Turn further to the right"},
]
POSE_KEYS = {p["key"] for p in POSES}
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
SAME_PERSON_MIN_SIMILARITY = 0.30


class ServiceUnavailable(APIException):
    status_code = 503
    default_detail = "The recognition service is not available."


def readiness() -> dict:
    return {
        "models_installed": face_engine.models_installed(),
        "encryption_configured": encryption_configured(),
        "model_version": face_engine.MODEL_VERSION,
    }


def ensure_ready() -> None:
    state = readiness()
    if not state["encryption_configured"]:
        raise ServiceUnavailable(
            "SMARTFACE_ENCRYPTION_KEY is not configured, so biometric templates cannot be protected. "
            "Run `python manage.py generate_encryption_key` and add the key to backend/.env."
        )
    if not state["models_installed"]:
        raise ServiceUnavailable("Face models are not installed. Run `python scripts/download_models.py`.")


def enrollment_summary(employee) -> dict:
    active = [t for t in employee.face_templates.all() if t.is_active]
    return {
        "enrolled": bool(active),
        "template_count": len(active),
        "enrolled_at": max((t.created_at for t in active), default=None),
        "model_version": active[0].model_version if active else None,
        "has_session_in_progress": employee.enrollment_sessions.filter(
            status=EnrollmentSession.Status.IN_PROGRESS
        ).exists(),
    }


def start_session(employee, user, *, consent_method: str, identity_verified: bool, request=None) -> EnrollmentSession:
    ensure_ready()
    if not employee.is_active:
        raise ValidationError({"detail": "Only active employees can be enrolled."})
    cfg = SystemSettings.load()
    with transaction.atomic():
        # Only one open session per employee; abandon older ones and discard their samples.
        for old in employee.enrollment_sessions.select_for_update().filter(status=EnrollmentSession.Status.IN_PROGRESS):
            old.templates.all().delete()
            old.status = EnrollmentSession.Status.CANCELLED
            old.save(update_fields=["status"])
        session = EnrollmentSession.objects.create(
            employee=employee, started_by=user, consent_confirmed=True, consent_method=consent_method,
            identity_verified=identity_verified, notice_version=cfg.privacy_notice_version,
            model_version=face_engine.MODEL_VERSION,
        )
    audit.record(
        "enrollment.start", request=request, entity=session,
        changes={"employee_id": employee.id, "consent_method": consent_method, "notice_version": cfg.privacy_notice_version},
    )
    return session


def _require_open(session: EnrollmentSession) -> None:
    if session.status != EnrollmentSession.Status.IN_PROGRESS:
        raise ValidationError({"detail": "This enrollment session is no longer open."})


def add_sample(session: EnrollmentSession, frame, pose: str) -> dict:
    """Quality-check a frame and store an (inactive) encrypted template. The frame itself is discarded."""
    _require_open(session)
    ensure_ready()
    if pose not in POSE_KEYS:
        raise ValidationError({"pose": "Unknown pose."})
    if frame is None:
        raise ValidationError({"image": "The image could not be read. Use a JPEG or PNG image."})

    cfg = SystemSettings.load()
    thresholds = face_engine.QualityThresholds.from_settings(cfg)
    engine = face_engine.get_engine()
    faces = engine.analyse(frame, thresholds)

    def rejected(reasons, obs=None):
        return {"accepted": False, "problems": reasons, "quality": _quality_dict(obs) if obs else None}

    if not faces:
        return rejected(["No face detected - face the camera in good, even light"])
    if len(faces) > 1:
        return rejected(["More than one face detected - only the employee should be in view"])
    obs = faces[0]
    if not obs.acceptable:
        return rejected(obs.problems, obs)

    try:
        existing = list(session.templates.all())
        if existing:
            # Every sample in a session must come from the same person.
            ref = np.vstack([t.get_embedding() for t in existing])
            if float(np.max(ref @ obs.embedding)) < SAME_PERSON_MIN_SIMILARITY:
                return rejected(["This sample does not look like the earlier samples - is the same person in view?"], obs)

        others = face_engine.load_gallery(exclude_employee_id=session.employee_id)
        clash = others.match(obs.embedding, match_threshold=cfg.match_threshold,
                             uncertain_threshold=cfg.match_threshold, margin=0.0)
        if clash.outcome == "matched":
            from apps.employees.models import Employee

            other = Employee.objects.filter(pk=clash.employee_id).first()
            label = other.employee_number if other else "another employee"
            return rejected([f"This face closely matches an existing enrollment ({label}). Verify identity before continuing."], obs)

        with transaction.atomic():
            session.templates.filter(pose=pose).delete()  # retaking a pose replaces it
            template = FaceTemplate(
                employee_id=session.employee_id, session=session, model_version=face_engine.MODEL_VERSION,
                pose=pose, quality_score=obs.quality_score, is_active=False,
            )
            template.set_embedding(obs.embedding)
            template.save()
    except EncryptionNotConfigured as exc:
        raise ServiceUnavailable(str(exc)) from exc

    return {"accepted": True, "problems": [], "quality": _quality_dict(obs), "sample_id": template.id}


def _quality_dict(obs) -> dict:
    return {
        "score": obs.quality_score, "detection_score": obs.detection_score, "sharpness": obs.sharpness,
        "brightness": obs.brightness, "face_size": min(obs.box[2], obs.box[3]), "yaw": obs.yaw, "pitch": obs.pitch,
    }


def complete_session(session: EnrollmentSession, request=None) -> EnrollmentSession:
    _require_open(session)
    cfg = SystemSettings.load()
    count = session.templates.count()
    if count < cfg.enrollment_min_samples:
        raise ValidationError({"detail": f"At least {cfg.enrollment_min_samples} accepted samples are required ({count} so far)."})
    with transaction.atomic():
        # Re-enrollment: previous templates are deleted, not just hidden.
        previous = FaceTemplate.objects.filter(employee_id=session.employee_id).exclude(session=session)
        revoked = previous.count()
        previous.delete()
        session.templates.update(is_active=True)
        session.status = EnrollmentSession.Status.COMPLETED
        session.completed_at = timezone.now()
        session.save(update_fields=["status", "completed_at"])
    audit.record("enrollment.complete", request=request, entity=session,
                 changes={"employee_id": session.employee_id, "samples": count, "previous_templates_deleted": revoked})
    return session


def cancel_session(session: EnrollmentSession, request=None) -> EnrollmentSession:
    _require_open(session)
    with transaction.atomic():
        session.templates.all().delete()
        session.status = EnrollmentSession.Status.CANCELLED
        session.save(update_fields=["status"])
    audit.record("enrollment.cancel", request=request, entity=session, changes={"employee_id": session.employee_id})
    return session


def erase_biometrics(employee, *, reason: str, request=None) -> int:
    """Revoke enrollment: permanently delete every template for the employee."""
    with transaction.atomic():
        deleted = FaceTemplate.objects.filter(employee=employee).count()
        FaceTemplate.objects.filter(employee=employee).delete()
        employee.enrollment_sessions.filter(status=EnrollmentSession.Status.IN_PROGRESS).update(
            status=EnrollmentSession.Status.CANCELLED
        )
    audit.record("biometrics.erase", request=request, entity=employee, reason=reason,
                 changes={"templates_deleted": deleted})
    return deleted
