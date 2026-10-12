import csv

from django.db.models import Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdmin, IsEmployeeUser, IsStaffMember
from apps.audit import services as audit
from apps.audit.models import AuditEvent
from apps.audit.serializers import AuditEventSerializer

from . import services
from .models import AttendanceEvent, CorrectionRequest
from .serializers import (
    AttendanceEventSerializer,
    CorrectionRequestSerializer,
    CorrectionSerializer,
    DecisionSerializer,
    EmployeeAttendanceSerializer,
    ManualEntrySerializer,
    ReviewSerializer,
)


def filter_events(params, qs=None):
    qs = (qs if qs is not None else AttendanceEvent.objects.all()).select_related(
        "employee", "candidate_employee", "camera", "created_by", "reviewed_by"
    )
    if day := parse_date(params.get("date") or ""):
        qs = qs.filter(local_date=day)
    if date_from := parse_date(params.get("from") or ""):
        qs = qs.filter(local_date__gte=date_from)
    if date_to := parse_date(params.get("to") or ""):
        qs = qs.filter(local_date__lte=date_to)
    for field, param in (("employee_id", "employee"), ("camera_id", "camera")):
        if value := params.get(param):
            if not value.isdigit():
                raise ValidationError({param: "Must be a numeric id."})
            qs = qs.filter(**{field: int(value)})
    for field in ("direction", "status", "match_status", "source"):
        if value := params.get(field):
            qs = qs.filter(**{field: value})
    if search := (params.get("search") or "").strip():
        qs = qs.filter(
            Q(employee__first_name__icontains=search) | Q(employee__last_name__icontains=search)
            | Q(employee__employee_number__icontains=search)
        )
    return qs


class AttendanceListView(generics.ListAPIView):
    serializer_class = AttendanceEventSerializer
    permission_classes = [IsStaffMember]

    def get_queryset(self):
        return filter_events(self.request.query_params)


class AttendanceDetailView(APIView):
    permission_classes = [IsStaffMember]

    def get(self, request, pk):
        event = get_object_or_404(filter_events({}), pk=pk)
        corrections = event.corrections.select_related("employee", "requested_by", "decided_by")
        history = AuditEvent.objects.filter(entity_type="attendanceevent", entity_id=str(event.id))
        return Response({
            **AttendanceEventSerializer(event).data,
            "corrections": CorrectionRequestSerializer(corrections, many=True).data,
            "history": AuditEventSerializer(history, many=True).data,
        })


class AttendanceExportView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        qs = filter_events(request.query_params).order_by("occurred_at")[:100000]
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="attendance-{timezone.localdate()}.csv"'
        writer = csv.writer(response)
        writer.writerow(["id", "date", "time", "employee_number", "employee_name", "direction", "status",
                         "match_status", "source", "camera", "confidence", "notes"])
        rows = 0
        for e in qs:
            local = timezone.localtime(e.occurred_at)
            writer.writerow([
                e.id, e.local_date.isoformat(), local.strftime("%H:%M:%S"),
                e.employee.employee_number if e.employee else "", e.employee.full_name if e.employee else "",
                e.direction, e.status, e.match_status, e.source, e.camera.name if e.camera else "",
                "" if e.confidence is None else f"{e.confidence:.3f}", e.notes,
            ])
            rows += 1
        audit.record("attendance.export", request=request, changes={"rows": rows, "filters": dict(request.query_params)})
        return response


class ManualEntryView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request):
        s = ManualEntrySerializer(data=request.data)
        s.is_valid(raise_exception=True)
        event = services.create_manual_event(
            employee=s.validated_data["employee"], occurred_at=s.validated_data["occurred_at"],
            reason=s.validated_data["reason"], user=request.user, request=request,
        )
        return Response(AttendanceEventSerializer(event).data, status=status.HTTP_201_CREATED)


class ReviewView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        event = get_object_or_404(AttendanceEvent, pk=pk)
        s = ReviewSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        event = services.review_event(
            event=event, decision=s.validated_data["decision"], employee=s.validated_data.get("employee"),
            reason=s.validated_data["reason"], user=request.user, request=request,
        )
        return Response(AttendanceEventSerializer(event).data)


class CorrectionView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        event = get_object_or_404(AttendanceEvent, pk=pk)
        s = CorrectionSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        event = services.correct_event(
            event=event, occurred_at=s.validated_data.get("occurred_at"), void=s.validated_data["void"],
            reason=s.validated_data["reason"], user=request.user, request=request,
        )
        return Response(AttendanceEventSerializer(event).data)


class CorrectionRequestListView(generics.ListAPIView):
    serializer_class = CorrectionRequestSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        qs = CorrectionRequest.objects.select_related("employee", "event", "requested_by", "decided_by")
        if value := self.request.query_params.get("status"):
            qs = qs.filter(status=value)
        return qs


class CorrectionDecisionView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        correction = get_object_or_404(CorrectionRequest, pk=pk)
        s = DecisionSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        correction = services.decide_correction(
            correction=correction, approve=s.validated_data["approve"], note=s.validated_data["note"],
            occurred_at=s.validated_data.get("occurred_at"), user=request.user, request=request,
        )
        return Response(CorrectionRequestSerializer(correction).data)


class ReviewCountsView(APIView):
    permission_classes = [IsStaffMember]

    def get(self, request):
        return Response({
            "pending_reviews": AttendanceEvent.objects.filter(status=AttendanceEvent.Status.PENDING_REVIEW).count(),
            "pending_corrections": CorrectionRequest.objects.filter(status=CorrectionRequest.Status.PENDING).count(),
        })


# --- Employee portal ----------------------------------------------------------

def own_events(user):
    # Employees see their own confirmed and voided records, never other people's or pending observations.
    return AttendanceEvent.objects.filter(employee_id=user.employee_id).exclude(status=AttendanceEvent.Status.PENDING_REVIEW)


class MyAttendanceListView(generics.ListAPIView):
    serializer_class = EmployeeAttendanceSerializer
    permission_classes = [IsEmployeeUser]

    def get_queryset(self):
        params = {k: v for k, v in self.request.query_params.items() if k in ("from", "to", "date", "status")}
        return filter_events(params, own_events(self.request.user))


class MyAttendanceDetailView(APIView):
    permission_classes = [IsEmployeeUser]

    def get(self, request, pk):
        event = get_object_or_404(own_events(request.user).select_related("camera"), pk=pk)
        corrections = event.corrections.filter(employee_id=request.user.employee_id)
        return Response({
            **EmployeeAttendanceSerializer(event).data,
            "corrections": CorrectionRequestSerializer(corrections, many=True).data,
        })


class MyCorrectionRequestsView(generics.ListCreateAPIView):
    serializer_class = CorrectionRequestSerializer
    permission_classes = [IsEmployeeUser]

    def get_queryset(self):
        return CorrectionRequest.objects.filter(employee_id=self.request.user.employee_id).select_related(
            "employee", "event", "requested_by", "decided_by"
        )

    def perform_create(self, serializer):
        event = serializer.validated_data.get("event")
        if event is not None and event.employee_id != self.request.user.employee_id:
            raise ValidationError({"event_id": "You can only request corrections to your own records."})
        correction = serializer.save(employee_id=self.request.user.employee_id, requested_by=self.request.user)
        audit.record("correction.request", request=self.request, entity=correction,
                     reason=correction.reason, changes={"kind": correction.kind})


class MyCorrectionCancelView(APIView):
    permission_classes = [IsEmployeeUser]

    def post(self, request, pk):
        correction = get_object_or_404(CorrectionRequest, pk=pk, employee_id=request.user.employee_id)
        if correction.status != CorrectionRequest.Status.PENDING:
            return Response({"detail": "Only pending requests can be cancelled."}, status=400)
        correction.status = CorrectionRequest.Status.CANCELLED
        correction.save(update_fields=["status"])
        audit.record("correction.cancel", request=request, entity=correction)
        return Response(CorrectionRequestSerializer(correction).data)
