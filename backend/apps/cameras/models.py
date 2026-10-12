from datetime import timedelta
from urllib.parse import quote, urlsplit, urlunsplit

from django.db import models
from django.utils import timezone

from apps.security import decrypt_text, encrypt_text

# A camera is considered online only if the worker received a frame this recently.
ONLINE_WINDOW = timedelta(seconds=30)


class Camera(models.Model):
    class Direction(models.TextChoices):
        IN = "IN", "Entrance (IN)"
        OUT = "OUT", "Exit (OUT)"

    class SourceType(models.TextChoices):
        RTSP = "rtsp", "RTSP stream"
        HTTP = "http", "HTTP/MJPEG stream"
        DEVICE = "device", "Local video device (USB webcam)"

    name = models.CharField(max_length=80, unique=True)
    location = models.CharField(max_length=120, blank=True)
    direction = models.CharField(max_length=3, choices=Direction.choices, default=Direction.IN)
    source_type = models.CharField(max_length=8, choices=SourceType.choices, default=SourceType.RTSP)
    stream_url = models.CharField(
        max_length=500, blank=True,
        help_text="Stream URL without credentials, e.g. rtsp://192.168.1.20:554/stream1",
    )
    device_index = models.PositiveSmallIntegerField(null=True, blank=True)
    stream_username = models.CharField(max_length=120, blank=True)
    stream_password_encrypted = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    # Health, written by the recognition worker and connection tests. Never simulated.
    last_frame_at = models.DateTimeField(null=True, blank=True)
    last_checked_at = models.DateTimeField(null=True, blank=True)
    last_error = models.CharField(max_length=500, blank=True)
    frame_width = models.PositiveIntegerField(null=True, blank=True)
    frame_height = models.PositiveIntegerField(null=True, blank=True)
    measured_fps = models.FloatField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    # --- credentials --------------------------------------------------------
    @property
    def has_password(self) -> bool:
        return bool(self.stream_password_encrypted)

    def set_password(self, raw: str | None) -> None:
        self.stream_password_encrypted = encrypt_text(raw) if raw else ""

    def capture_source(self) -> str | int:
        """Connection target for OpenCV, with credentials injected server-side only."""
        if self.source_type == self.SourceType.DEVICE:
            return int(self.device_index or 0)
        url = self.stream_url
        if self.stream_username:
            parts = urlsplit(url)
            password = decrypt_text(self.stream_password_encrypted) if self.stream_password_encrypted else ""
            auth = quote(self.stream_username, safe="")
            if password:
                auth += ":" + quote(password, safe="")
            host = parts.hostname or ""
            if parts.port:
                host = f"{host}:{parts.port}"
            url = urlunsplit((parts.scheme, f"{auth}@{host}", parts.path, parts.query, parts.fragment))
        return url

    def redacted_source(self) -> str:
        if self.source_type == self.SourceType.DEVICE:
            return f"device:{self.device_index or 0}"
        return self.stream_url

    # --- health -------------------------------------------------------------
    @property
    def health(self) -> str:
        """online | offline | error | never_connected | disabled"""
        if not self.is_active:
            return "disabled"
        if self.last_frame_at and timezone.now() - self.last_frame_at < ONLINE_WINDOW:
            return "online"
        if self.last_error:
            return "error"
        if self.last_frame_at is None:
            return "never_connected"
        return "offline"
