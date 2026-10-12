from django.contrib import admin

from .models import BackupRecord, ServiceHeartbeat, SystemSettings

admin.site.register(SystemSettings)
admin.site.register(ServiceHeartbeat)
admin.site.register(BackupRecord)
