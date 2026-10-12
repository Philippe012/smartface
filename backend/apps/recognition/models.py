import numpy as np
from django.conf import settings
from django.db import models

from apps.security import decrypt_bytes, encrypt_bytes


class EnrollmentSession(models.Model):
    class Status(models.TextChoices):
        IN_PROGRESS = "in_progress", "In progress"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    employee = models.ForeignKey("employees.Employee", on_delete=models.CASCADE, related_name="enrollment_sessions")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.IN_PROGRESS)
    started_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+")
    # Documented notice/consent step completed before any capture (SDLC 9.1 step 2).
    consent_confirmed = models.BooleanField(default=False)
    consent_method = models.CharField(max_length=120, blank=True)
    notice_version = models.CharField(max_length=20, blank=True)
    identity_verified = models.BooleanField(default=False)
    model_version = models.CharField(max_length=80, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]


class FaceTemplate(models.Model):
    """An encrypted face embedding. Source images are never stored."""

    employee = models.ForeignKey("employees.Employee", on_delete=models.CASCADE, related_name="face_templates")
    session = models.ForeignKey(EnrollmentSession, on_delete=models.CASCADE, related_name="templates")
    encrypted_embedding = models.BinaryField()
    model_version = models.CharField(max_length=80)
    pose = models.CharField(max_length=32, blank=True)
    quality_score = models.FloatField(default=0)
    is_active = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def set_embedding(self, vector: np.ndarray) -> None:
        self.encrypted_embedding = encrypt_bytes(np.asarray(vector, dtype=np.float32).tobytes())

    def get_embedding(self) -> np.ndarray:
        return np.frombuffer(decrypt_bytes(self.encrypted_embedding), dtype=np.float32)
