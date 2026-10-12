from django.contrib import admin

from .models import Camera


@admin.register(Camera)
class CameraAdmin(admin.ModelAdmin):
    list_display = ("name", "location", "direction", "source_type", "is_active", "last_frame_at")
    exclude = ("stream_password_encrypted",)
