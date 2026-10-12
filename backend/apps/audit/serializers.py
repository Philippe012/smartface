from rest_framework import serializers

from .models import AuditEvent


class AuditEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditEvent
        fields = [
            "id", "actor_username", "action", "entity_type", "entity_id",
            "occurred_at", "reason", "changes", "ip_address",
        ]
