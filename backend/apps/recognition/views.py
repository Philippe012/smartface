from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdmin, IsStaffMember
from apps.cameras.capture import grab_frame
from apps.cameras.models import Camera
from apps.employees.models import Employee
from apps.settings_app.models import SystemSettings
from apps.settings_app.services import worker_status

from . import engine as face_engine
from . import services
from .models import EnrollmentSession


class StartEnrollmentSerializer(serializers.Serializer):
    consent_confirmed = serializers.BooleanField()
    consent_method = serializers.CharField(max_length=120)
    identity_verified = serializers.BooleanField()

    def validate(self, attrs):
        if not attrs["consent_confirmed"]:
            raise serializers.ValidationError(
                {"consent_confirmed": "Notice and consent/authorisation must be completed before capture."}
            )
        if not attrs["identity_verified"]:
            raise serializers.ValidationError(
                {"identity_verified": "Verify the employee's identity before enrollment."}
            )
        return attrs


def session_payload(session: EnrollmentSession) -> dict:
    cfg = SystemSettings.load()
    samples = [
        {"id": t.id, "pose": t.pose, "quality_score": t.quality_score, "created_at": t.created_at}
        for t in session.templates.all()
    ]
    return {
        "id": session.id,
        "employee_id": session.employee_id,
        "status": session.status,
        "consent_method": session.consent_method,
        "notice_version": session.notice_version,
        "model_version": session.model_version,
        "started_by": session.started_by.username if session.started_by else None,
        "created_at": session.created_at,
        "completed_at": session.completed_at,
        "samples": samples,
        "min_samples": cfg.enrollment_min_samples,
        "poses": services.POSES,
    }


class EmployeeEnrollmentsView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request, employee_id):
        employee = get_object_or_404(Employee, pk=employee_id)
        sessions = employee.enrollment_sessions.select_related("started_by").prefetch_related("templates")[:20]
        return Response([session_payload(s) for s in sessions])

    def post(self, request, employee_id):
        employee = get_object_or_404(Employee, pk=employee_id)
        serializer = StartEnrollmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        session = services.start_session(
            employee, request.user,
            consent_method=serializer.validated_data["consent_method"],
            identity_verified=serializer.validated_data["identity_verified"],
            request=request,
        )
        return Response(session_payload(session), status=status.HTTP_201_CREATED)


class EnrollmentDetailView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request, pk):
        return Response(session_payload(get_object_or_404(EnrollmentSession, pk=pk)))


class EnrollmentSampleView(APIView):
    """Upload one captured frame (multipart field `image`) for a pose. The image is never stored."""

    permission_classes = [IsAdmin]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, pk):
        session = get_object_or_404(EnrollmentSession, pk=pk)
        upload = request.FILES.get("image")
        if upload is None:
            return Response({"detail": "No image was uploaded."}, status=400)
        if upload.size > services.MAX_UPLOAD_BYTES:
            return Response({"detail": "Image is too large (maximum 5 MB)."}, status=400)
        frame = face_engine.decode_image(upload.read())
        result = services.add_sample(session, frame, request.data.get("pose", ""))
        return Response({**result, "session": session_payload(session)})


class EnrollmentCameraCaptureView(APIView):
    """Capture an enrollment frame from a configured camera instead of the browser webcam."""

    permission_classes = [IsAdmin]
    parser_classes = [JSONParser]

    def post(self, request, pk):
        session = get_object_or_404(EnrollmentSession, pk=pk)
        camera = get_object_or_404(Camera, pk=request.data.get("camera_id"))
        frame, diag = grab_frame(camera)
        if frame is None:
            return Response({"detail": f"Camera capture failed: {diag['error']}"}, status=502)
        result = services.add_sample(session, face_engine.downscale(frame), request.data.get("pose", ""))
        return Response({**result, "session": session_payload(session)})


class EnrollmentSampleDeleteView(APIView):
    permission_classes = [IsAdmin]

    def delete(self, request, pk, sample_id):
        session = get_object_or_404(EnrollmentSession, pk=pk)
        if session.status != EnrollmentSession.Status.IN_PROGRESS:
            return Response({"detail": "This enrollment session is no longer open."}, status=400)
        session.templates.filter(pk=sample_id).delete()
        return Response(session_payload(session))


class EnrollmentCompleteView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        session = services.complete_session(get_object_or_404(EnrollmentSession, pk=pk), request=request)
        return Response(session_payload(session))


class EnrollmentCancelView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        session = services.cancel_session(get_object_or_404(EnrollmentSession, pk=pk), request=request)
        return Response(session_payload(session))


class EraseBiometricsView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request, employee_id):
        employee = get_object_or_404(Employee, pk=employee_id)
        reason = (request.data.get("reason") or "").strip()
        if not reason:
            return Response({"detail": "A reason is required.", "errors": {"reason": ["A reason is required."]}}, status=400)
        deleted = services.erase_biometrics(employee, reason=reason, request=request)
        return Response({"templates_deleted": deleted})


class RecognitionStatusView(APIView):
    permission_classes = [IsStaffMember]

    def get(self, request):
        return Response({**services.readiness(), "worker": worker_status()})
