from django.urls import path

from . import views

urlpatterns = [
    path("dashboard", views.DashboardView.as_view()),
    path("reports/daily", views.DailyReportView.as_view()),
    path("reports/daily/export", views.DailyReportExportView.as_view()),
    path("reports/monthly", views.MonthlyReportView.as_view()),
    path("reports/monthly/export", views.MonthlyReportExportView.as_view()),
    path("me/summary", views.MySummaryView.as_view()),
]
