from django.contrib import admin

from .models import AttendanceEvent, CorrectionRequest


@admin.register(AttendanceEvent)
class AttendanceEventAdmin(admin.ModelAdmin):
    list_display = ("occurred_at", "employee", "direction", "status", "match_status", "source")
    list_filter = ("status", "match_status", "source")

    def has_change_permission(self, request, obj=None):
        return False  # corrections go through the audited API


admin.site.register(CorrectionRequest)
