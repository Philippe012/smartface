from django.urls import path

from . import views

urlpatterns = [
    path("health", views.HealthView.as_view()),
    path("settings", views.SettingsView.as_view()),
    path("settings/system-status", views.SystemStatusView.as_view()),
    path("settings/backups", views.BackupView.as_view()),
    path("settings/retention", views.RetentionView.as_view()),
]
