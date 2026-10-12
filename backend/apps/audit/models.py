from django.conf import settings
from django.db import models


class AuditEvent(models.Model):
    """Append-only record of privileged and security-relevant actions."""

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    actor_username = models.CharField(max_length=150, blank=True)
    action = models.CharField(max_length=64, db_index=True)
    entity_type = models.CharField(max_length=64, blank=True, db_index=True)
    entity_id = models.CharField(max_length=64, blank=True)
    occurred_at = models.DateTimeField(auto_now_add=True, db_index=True)
    reason = models.TextField(blank=True)
    changes = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        ordering = ["-occurred_at", "-id"]

    def save(self, *args, **kwargs):
        if self.pk is not None:
            raise ValueError("Audit events are append-only and cannot be modified.")
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.occurred_at:%Y-%m-%d %H:%M} {self.actor_username} {self.action}"
