from django.urls import path

from . import views

urlpatterns = [
    path("attendance", views.AttendanceListView.as_view()),
    path("attendance/export", views.AttendanceExportView.as_view()),
    path("attendance/manual", views.ManualEntryView.as_view()),
    path("attendance/review-counts", views.ReviewCountsView.as_view()),
    path("attendance/<int:pk>", views.AttendanceDetailView.as_view()),
    path("attendance/<int:pk>/review", views.ReviewView.as_view()),
    path("attendance/<int:pk>/corrections", views.CorrectionView.as_view()),
    path("correction-requests", views.CorrectionRequestListView.as_view()),
    path("correction-requests/<int:pk>/decide", views.CorrectionDecisionView.as_view()),
    path("me/attendance", views.MyAttendanceListView.as_view()),
    path("me/attendance/<int:pk>", views.MyAttendanceDetailView.as_view()),
    path("me/correction-requests", views.MyCorrectionRequestsView.as_view()),
    path("me/correction-requests/<int:pk>/cancel", views.MyCorrectionCancelView.as_view()),
]
