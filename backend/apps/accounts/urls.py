from django.urls import path

from . import views

urlpatterns = [
    path("auth/csrf", views.CsrfView.as_view()),
    path("auth/session", views.SessionView.as_view()),
    path("auth/me", views.MeView.as_view()),
    path("auth/password/change", views.PasswordChangeView.as_view()),
    path("auth/password/reset", views.PasswordResetRequestView.as_view()),
    path("auth/password/reset/confirm", views.PasswordResetConfirmView.as_view()),
    path("auth/sessions", views.OtherSessionsView.as_view()),
    path("staff-users", views.StaffUserListCreateView.as_view()),
    path("staff-users/<int:pk>", views.StaffUserDetailView.as_view()),
]
