from django.contrib import admin

from .models import EnrollmentSession


@admin.register(EnrollmentSession)
class EnrollmentSessionAdmin(admin.ModelAdmin):
    list_display = ("employee", "status", "created_at", "completed_at")
    # Face templates are intentionally not exposed in the Django admin.
