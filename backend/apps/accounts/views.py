from django.conf import settings
from django.contrib.auth import authenticate, get_user_model, login, logout, update_session_auth_hash
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.contrib.sessions.models import Session
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.middleware.csrf import get_token
from django.utils import timezone
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.audit import services as audit

from .permissions import IsAdmin
from .serializers import (
    LoginSerializer,
    MeSerializer,
    PasswordChangeSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    StaffUserSerializer,
)

User = get_user_model()


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfView(APIView):
    """Sets the CSRF cookie and returns the token for the SPA's unsafe requests."""

    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"csrfToken": get_token(request)})


class SessionView(APIView):
    """POST: sign in. DELETE: sign out."""

    permission_classes = [AllowAny]
    throttle_scope = "login"

    def get_throttles(self):
        return [ScopedRateThrottle()] if self.request.method == "POST" else []

    def post(self, request):
        s = LoginSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        username = s.validated_data["username"].strip()
        candidate = User.objects.filter(username__iexact=username).first()
        if candidate and candidate.is_locked():
            minutes = max(1, int((candidate.locked_until - timezone.now()).total_seconds() // 60) + 1)
            audit.record("auth.login_blocked", request=request, actor=None, entity=candidate)
            return Response(
                {"detail": f"Too many failed attempts. Try again in {minutes} minute(s) or reset your password."},
                status=status.HTTP_403_FORBIDDEN,
            )
        user = authenticate(request, username=candidate.username if candidate else username,
                            password=s.validated_data["password"])
        if user is None:
            if candidate:
                candidate.register_failed_login()
            audit.record("auth.login_failed", request=request, actor=None, entity_type="user",
                         changes={"username": username[:150]})
            return Response({"detail": "Incorrect username or password."}, status=status.HTTP_400_BAD_REQUEST)
        if user.role == User.Role.EMPLOYEE and not user.employee_id:
            return Response({"detail": "This account is not linked to an employee record. Contact an administrator."},
                            status=status.HTTP_403_FORBIDDEN)
        login(request, user)
        user.register_successful_login()
        audit.record("auth.login", request=request, actor=user, entity=user)
        return Response(MeSerializer(user).data)

    def delete(self, request):
        if request.user.is_authenticated:
            audit.record("auth.logout", request=request, entity=request.user)
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(MeSerializer(request.user).data)

    def patch(self, request):
        s = MeSerializer(request.user, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        before = {k: getattr(request.user, k) for k in ("email", "first_name", "last_name")}
        user = s.save()
        audit.record("account.update", request=request, entity=user,
                     changes=audit.diff(before, {k: getattr(user, k) for k in before}))
        return Response(MeSerializer(user).data)


class PasswordChangeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        s = PasswordChangeSerializer(data=request.data, context={"request": request})
        s.is_valid(raise_exception=True)
        user = request.user
        user.set_password(s.validated_data["new_password"])
        user.password_changed_at = timezone.now()
        user.save(update_fields=["password", "password_changed_at"])
        update_session_auth_hash(request, user)  # keep this session; other sessions are invalidated
        audit.record("auth.password_change", request=request, entity=user)
        return Response({"detail": "Your password has been changed. Other sessions have been signed out."})


class OtherSessionsView(APIView):
    """DELETE: sign out every other session for the current user."""

    permission_classes = [IsAuthenticated]

    def _user_sessions(self, user):
        uid = str(user.pk)
        for session in Session.objects.filter(expire_date__gt=timezone.now()):
            if session.get_decoded().get("_auth_user_id") == uid:
                yield session

    def get(self, request):
        current = request.session.session_key
        sessions = list(self._user_sessions(request.user))
        return Response({"active_sessions": len(sessions), "other_sessions": sum(s.session_key != current for s in sessions)})

    def delete(self, request):
        current = request.session.session_key
        removed = 0
        for session in self._user_sessions(request.user):
            if session.session_key != current:
                session.delete()
                removed += 1
        audit.record("auth.sessions_revoked", request=request, entity=request.user, changes={"sessions": removed})
        return Response({"signed_out": removed})


class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "password_reset"
    throttle_classes = [ScopedRateThrottle]

    def post(self, request):
        s = PasswordResetRequestSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        for user in User.objects.filter(email__iexact=s.validated_data["email"], is_active=True):
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            link = f"{settings.FRONTEND_URL}/reset-password?uid={uid}&token={token}"
            send_mail(
                "SmartFace password reset",
                f"Hello {user.get_full_name() or user.username},\n\n"
                f"A password reset was requested for your SmartFace account ({user.username}).\n"
                f"Open this link within one hour to choose a new password:\n\n{link}\n\n"
                "If you did not request this, you can ignore this message.",
                None, [user.email], fail_silently=True,
            )
            audit.record("auth.password_reset_requested", request=request, actor=None, entity=user)
        # Same response whether or not the address exists.
        return Response({"detail": "If an account uses that email address, a reset link has been sent."})


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "password_reset"
    throttle_classes = [ScopedRateThrottle]

    def post(self, request):
        s = PasswordResetConfirmSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        try:
            user = User.objects.get(pk=force_str(urlsafe_base64_decode(s.validated_data["uid"])), is_active=True)
        except (User.DoesNotExist, ValueError, TypeError, OverflowError):
            user = None
        if user is None or not default_token_generator.check_token(user, s.validated_data["token"]):
            return Response({"detail": "This reset link is invalid or has expired. Request a new one."}, status=400)
        try:
            validate_password(s.validated_data["new_password"], user)
        except DjangoValidationError as exc:
            return Response({"detail": "Choose a stronger password.", "errors": {"new_password": exc.messages}}, status=400)
        user.set_password(s.validated_data["new_password"])
        user.password_changed_at = timezone.now()
        user.failed_login_count = 0
        user.locked_until = None
        user.save()
        audit.record("auth.password_reset", request=request, actor=None, entity=user)
        return Response({"detail": "Your password has been reset. You can now sign in."})


class StaffUserListCreateView(generics.ListCreateAPIView):
    serializer_class = StaffUserSerializer
    permission_classes = [IsAdmin]
    pagination_class = None

    def get_queryset(self):
        return User.objects.filter(role__in=[User.Role.ADMIN, User.Role.OPERATOR]).order_by("username")

    def perform_create(self, serializer):
        user = serializer.save(password_changed_at=timezone.now())
        audit.record("account.create", request=self.request, entity=user,
                     changes={"username": user.username, "role": user.role})


class StaffUserDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = StaffUserSerializer
    permission_classes = [IsAdmin]
    http_method_names = ["get", "patch"]

    def get_queryset(self):
        return User.objects.filter(role__in=[User.Role.ADMIN, User.Role.OPERATOR])

    def perform_update(self, serializer):
        user = serializer.instance
        if user == self.request.user and (
            serializer.validated_data.get("is_active") is False
            or serializer.validated_data.get("role", user.role) != user.role
        ):
            raise ValidationError({"detail": "You cannot deactivate or demote your own account."})
        before = {"role": user.role, "is_active": user.is_active, "email": user.email}
        user = serializer.save()
        if self.request.data.get("unlock"):
            user.failed_login_count = 0
            user.locked_until = None
            user.save(update_fields=["failed_login_count", "locked_until"])
        audit.record("account.update", request=self.request, entity=user,
                     changes=audit.diff(before, {"role": user.role, "is_active": user.is_active, "email": user.email}))
