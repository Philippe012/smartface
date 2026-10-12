from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import IsStaffMember, IsStaffReadAdminWrite
from apps.audit import services as audit
from apps.security import EncryptionNotConfigured

from .capture import grab_frame
from .models import Camera
from .serializers import CameraSerializer, snapshot


class CameraViewSet(viewsets.ModelViewSet):
    serializer_class = CameraSerializer
    permission_classes = [IsStaffReadAdminWrite]
    queryset = Camera.objects.all()
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def perform_create(self, serializer):
        camera = serializer.save()
        audit.record("camera.create", request=self.request, entity=camera, changes=snapshot(camera))

    def perform_update(self, serializer):
        before = snapshot(serializer.instance)
        camera = serializer.save()
        audit.record("camera.update", request=self.request, entity=camera,
                     changes=audit.diff(before, snapshot(camera)))

    def perform_destroy(self, instance):
        audit.record("camera.delete", request=self.request, entity=instance, changes=snapshot(instance))
        instance.delete()

    @action(detail=True, methods=["post"], url_path="test", permission_classes=[IsStaffMember])
    def test_connection(self, request, pk=None):
        """Actually connect to the stream and read a frame. Records the real outcome."""
        camera = self.get_object()
        try:
            _frame, result = grab_frame(camera)
        except EncryptionNotConfigured as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        camera.last_checked_at = timezone.now()
        if result["ok"]:
            camera.last_error = ""
            camera.frame_width = result["width"]
            camera.frame_height = result["height"]
        else:
            camera.last_error = result["error"]
        camera.save(update_fields=["last_checked_at", "last_error", "frame_width", "frame_height", "updated_at"])
        audit.record("camera.test", request=request, entity=camera, changes={"ok": result["ok"]})
        return Response({**result, "camera": self.get_serializer(camera).data})
