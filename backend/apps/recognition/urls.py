from django.urls import path

from . import views

urlpatterns = [
    path("employees/<int:employee_id>/enrollments", views.EmployeeEnrollmentsView.as_view()),
    path("employees/<int:employee_id>/biometrics/erase", views.EraseBiometricsView.as_view()),
    path("enrollments/<int:pk>", views.EnrollmentDetailView.as_view()),
    path("enrollments/<int:pk>/samples", views.EnrollmentSampleView.as_view()),
    path("enrollments/<int:pk>/samples/<int:sample_id>", views.EnrollmentSampleDeleteView.as_view()),
    path("enrollments/<int:pk>/capture", views.EnrollmentCameraCaptureView.as_view()),
    path("enrollments/<int:pk>/complete", views.EnrollmentCompleteView.as_view()),
    path("enrollments/<int:pk>/cancel", views.EnrollmentCancelView.as_view()),
    path("recognition/status", views.RecognitionStatusView.as_view()),
]
