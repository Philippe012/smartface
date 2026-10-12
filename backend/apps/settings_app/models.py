from django.conf import settings
from django.db import models


def default_workdays():
    return [0, 1, 2, 3, 4]  # Monday-Friday (Python weekday numbers)


class SystemSettings(models.Model):
    """Single-row configuration for attendance policy, recognition, privacy and retention."""

    # Organisation
    organization_name = models.CharField(max_length=120, default="My Organization")

    # Attendance policy
    dedup_interval_seconds = models.PositiveIntegerField(
        default=120, help_text="Repeated uncertain/unknown sightings within this window are merged."
    )
    schedule_configured = models.BooleanField(
        default=False,
        help_text="Lateness and absence are only calculated once a schedule has been approved and configured.",
    )
    work_start_time = models.TimeField(null=True, blank=True)
    grace_minutes = models.PositiveIntegerField(default=10)
    workdays = models.JSONField(default=default_workdays)

    # Recognition thresholds (cosine similarity, SFace). Validate during the pilot.
    match_threshold = models.FloatField(default=0.50)
    uncertain_threshold = models.FloatField(default=0.36)
    match_margin = models.FloatField(
        default=0.06, help_text="Minimum gap between best and second-best employee to accept a match."
    )
    min_face_size_px = models.PositiveIntegerField(default=80)
    min_sharpness = models.FloatField(default=60.0, help_text="Variance of Laplacian on the face crop.")
    min_detection_score = models.FloatField(default=0.85)
    frame_sample_interval_ms = models.PositiveIntegerField(default=500)
    record_unknown_faces = models.BooleanField(
        default=True, help_text="Create review items for unknown faces (no images are stored)."
    )
    enrollment_min_samples = models.PositiveIntegerField(default=5)

    # Privacy
    privacy_notice = models.TextField(
        default=(
            "SmartFace uses facial recognition to record workplace attendance. A numerical template "
            "derived from your face is stored encrypted on a local server; photos are not kept. "
            "Templates are used only for attendance, are deleted when you leave or withdraw, and you "
            "may use the manual attendance alternative and request corrections at any time."
        )
    )
    privacy_notice_version = models.CharField(max_length=20, default="1.0")
    alternative_method = models.TextField(
        default="Ask an administrator to record your attendance manually at the front desk."
    )

    # Retention (days; 0 = keep until deleted manually)
    unresolved_event_retention_days = models.PositiveIntegerField(default=30)
    attendance_retention_days = models.PositiveIntegerField(default=0)
    audit_retention_days = models.PositiveIntegerField(default=0)
    inactive_template_retention_days = models.PositiveIntegerField(
        default=30, help_text="Delete biometric templates this many days after an employee is deactivated."
    )

    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )

    class Meta:
        verbose_name_plural = "system settings"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls) -> "SystemSettings":
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class ServiceHeartbeat(models.Model):
    """Liveness signal written by background services (e.g. the recognition worker)."""

    name = models.CharField(max_length=64, unique=True)
    last_seen_at = models.DateTimeField()
    details = models.JSONField(default=dict, blank=True)


class BackupRecord(models.Model):
    class Status(models.TextChoices):
        SUCCESS = "success", "Success"
        FAILED = "failed", "Failed"

    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices)
    file_name = models.CharField(max_length=255, blank=True)
    size_bytes = models.BigIntegerField(default=0)
    message = models.TextField(blank=True)
    triggered_by = models.CharField(max_length=150, blank=True)

    class Meta:
        ordering = ["-started_at"]
