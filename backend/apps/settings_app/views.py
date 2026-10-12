import platform

import cv2
import django
from django.conf import settings as dj_settings
from django.utils import timezone
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdmin, IsStaffMember
from apps.audit import services as audit
from apps.recognition.services import readiness

from . import services
from .models import BackupRecord, SystemSettings


class SystemSettingsSerializer(serializers.ModelSerializer):
    work_start_time = serializers.TimeField(format="%H:%M", allow_null=True, required=False)
    timezone = serializers.SerializerMethodField()
    updated_by = serializers.SlugRelatedField(slug_field="username", read_only=True)

    class Meta:
        model = SystemSettings
        exclude = ["id"]
        read_only_fields = ["updated_at", "updated_by"]

    def get_timezone(self, obj):
        return dj_settings.TIME_ZONE

    def validate_workdays(self, value):
        if not isinstance(value, list) or any(not isinstance(d, int) or d < 0 or d > 6 for d in value):
            raise serializers.ValidationError("Workdays must be a list of weekday numbers 0 (Mon) to 6 (Sun).")
        return sorted(set(value))

    def validate(self, attrs):
        def current(name):
            return attrs.get(name, getattr(self.instance, name))

        for name in ("match_threshold", "uncertain_threshold", "match_margin", "min_detection_score"):
            if not 0 <= current(name) <= 1:
                raise serializers.ValidationError({name: "Must be between 0 and 1."})
        if current("uncertain_threshold") > current("match_threshold"):
            raise serializers.ValidationError({"uncertain_threshold": "Must not exceed the match threshold."})
        if current("schedule_configured") and not current("work_start_time"):
            raise serializers.ValidationError({"work_start_time": "Set a work start time to enable lateness and absence."})
        if current("enrollment_min_samples") < 3 or current("enrollment_min_samples") > 7:
            raise serializers.ValidationError({"enrollment_min_samples": "Must be between 3 and 7."})
        if current("dedup_interval_seconds") < 10:
            raise serializers.ValidationError({"dedup_interval_seconds": "Must be at least 10 seconds."})
        return attrs


class SettingsView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        return Response(SystemSettingsSerializer(SystemSettings.load()).data)

    def patch(self, request):
        obj = SystemSettings.load()
        before = SystemSettingsSerializer(obj).data
        serializer = SystemSettingsSerializer(obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        obj = serializer.save(updated_by=request.user)
        after = SystemSettingsSerializer(obj).data
        before.pop("updated_at", None)
        after.pop("updated_at", None)
        audit.record("settings.update", request=request, entity_type="systemsettings", entity_id=1,
                     changes=audit.diff(dict(before), dict(after)))
        return Response(after)


class SystemStatusView(APIView):
    permission_classes = [IsStaffMember]

    def get(self, request):
        last_backup = BackupRecord.objects.filter(status=BackupRecord.Status.SUCCESS).first()
        return Response({
            "database": services.database_status(),
            "recognition": readiness(),
            "worker": services.worker_status(),
            "server_time": timezone.now(),
            "timezone": dj_settings.TIME_ZONE,
            "debug": dj_settings.DEBUG,
            "versions": {
                "python": platform.python_version(), "django": django.get_version(), "opencv": cv2.__version__,
            },
            "last_successful_backup": last_backup.finished_at if last_backup else None,
        })


class BackupSerializer(serializers.ModelSerializer):
    class Meta:
        model = BackupRecord
        fields = "__all__"


class BackupView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        return Response({
            "backup_dir": str(dj_settings.BACKUP_DIR),
            "records": BackupSerializer(BackupRecord.objects.all()[:20], many=True).data,
        })

    def post(self, request):
        record = services.run_backup(triggered_by=request.user.username)
        audit.record("backup.run", request=request, entity=record,
                     changes={"status": record.status, "file": record.file_name})
        return Response(BackupSerializer(record).data, status=201 if record.status == "success" else 500)


class RetentionView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        """Dry run: how many records would be deleted now."""
        return Response({"would_delete": services.apply_retention(dry_run=True)})

    def post(self, request):
        deleted = services.apply_retention(dry_run=False)
        audit.record("retention.apply", request=request, changes={"deleted": deleted})
        return Response({"deleted": deleted})


class HealthView(APIView):
    """Unauthenticated liveness probe; reveals no configuration details."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        db_ok = services.database_status()["state"] == "ok"
        return Response({"status": "ok" if db_ok else "degraded", "database": "ok" if db_ok else "error"},
                        status=200 if db_ok else 503)
