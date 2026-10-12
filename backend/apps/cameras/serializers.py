from urllib.parse import urlsplit

from rest_framework import serializers

from apps.security import EncryptionNotConfigured

from .models import Camera

AUDITED_FIELDS = [
    "name", "location", "direction", "source_type", "stream_url", "device_index",
    "stream_username", "is_active",
]


def snapshot(camera: Camera) -> dict:
    data = {f: getattr(camera, f) for f in AUDITED_FIELDS}
    data["has_password"] = camera.has_password
    return data


class CameraSerializer(serializers.ModelSerializer):
    # Write-only: a saved password is never returned. Empty string keeps the existing one.
    stream_password = serializers.CharField(
        write_only=True, required=False, allow_blank=True, style={"input_type": "password"}
    )
    clear_password = serializers.BooleanField(write_only=True, required=False, default=False)
    has_password = serializers.BooleanField(read_only=True)
    health = serializers.CharField(read_only=True)

    class Meta:
        model = Camera
        fields = [
            "id", "name", "location", "direction", "source_type", "stream_url", "device_index",
            "stream_username", "stream_password", "clear_password", "has_password", "is_active",
            "health", "last_frame_at", "last_checked_at", "last_error", "frame_width", "frame_height",
            "measured_fps", "created_at", "updated_at",
        ]
        read_only_fields = [
            "last_frame_at", "last_checked_at", "last_error", "frame_width", "frame_height",
            "measured_fps", "created_at", "updated_at",
        ]

    def validate_direction(self, value):
        if value == Camera.Direction.OUT:
            raise serializers.ValidationError(
                "This release records IN attendance only. OUT cameras are planned for a later release."
            )
        return value

    def validate(self, attrs):
        source_type = attrs.get("source_type", getattr(self.instance, "source_type", Camera.SourceType.RTSP))
        stream_url = attrs.get("stream_url", getattr(self.instance, "stream_url", ""))
        if source_type == Camera.SourceType.DEVICE:
            if attrs.get("device_index", getattr(self.instance, "device_index", None)) is None:
                attrs["device_index"] = 0
            attrs["stream_url"] = ""
        else:
            if not stream_url:
                raise serializers.ValidationError({"stream_url": "A stream URL is required."})
            parts = urlsplit(stream_url)
            expected = ("rtsp", "rtsps") if source_type == Camera.SourceType.RTSP else ("http", "https")
            if parts.scheme not in expected or not parts.hostname:
                raise serializers.ValidationError(
                    {"stream_url": f"Enter a valid {' or '.join(expected)} URL, e.g. {expected[0]}://192.168.1.20/stream"}
                )
            if parts.username or parts.password:
                raise serializers.ValidationError(
                    {"stream_url": "Do not put credentials in the URL. Use the username and password fields."}
                )
        return attrs

    def _apply_password(self, camera, password, clear):
        try:
            if clear:
                camera.set_password(None)
            elif password:
                camera.set_password(password)
        except EncryptionNotConfigured as exc:
            raise serializers.ValidationError({"stream_password": str(exc)}) from exc

    def create(self, validated_data):
        password = validated_data.pop("stream_password", "")
        clear = validated_data.pop("clear_password", False)
        camera = Camera(**validated_data)
        self._apply_password(camera, password, clear)
        camera.save()
        return camera

    def update(self, instance, validated_data):
        password = validated_data.pop("stream_password", "")
        clear = validated_data.pop("clear_password", False)
        connection_changed = any(
            k in validated_data and validated_data[k] != getattr(instance, k)
            for k in ("source_type", "stream_url", "device_index", "stream_username")
        ) or bool(password) or clear
        for key, value in validated_data.items():
            setattr(instance, key, value)
        self._apply_password(instance, password, clear)
        if connection_changed:
            # Old health information no longer describes the new connection.
            instance.last_frame_at = None
            instance.last_error = ""
        instance.save()
        return instance
