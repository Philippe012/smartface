from django.urls import path

from . import views

urlpatterns = [
    path("audit-events", views.AuditEventListView.as_view()),
    path("audit-events/export", views.AuditExportView.as_view()),
]
