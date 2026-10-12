import csv

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import IsAdmin, IsStaffReadAdminWrite
from apps.audit import services as audit

from .models import Employee
from .serializers import EmployeeAccountSerializer, EmployeeSerializer, snapshot

User = get_user_model()

ORDERINGS = {
    "last_name", "-last_name", "employee_number", "-employee_number",
    "created_at", "-created_at", "department", "-department",
}


def filter_employees(params):
    qs = Employee.objects.select_related("user_account")
    if search := (params.get("search") or "").strip():
        qs = qs.filter(
            Q(first_name__icontains=search) | Q(last_name__icontains=search)
            | Q(employee_number__icontains=search) | Q(email__icontains=search)
        )
    if status_ := params.get("status"):
        qs = qs.filter(status=status_)
    if department := params.get("department"):
        qs = qs.filter(department__iexact=department)
    enrolled = params.get("enrolled")
    if enrolled in ("true", "false"):
        has_template = Q(face_templates__is_active=True)
        qs = qs.filter(has_template).distinct() if enrolled == "true" else qs.exclude(has_template)
    ordering = params.get("ordering") or "last_name"
    return qs.order_by(ordering if ordering in ORDERINGS else "last_name", "first_name", "id")


class EmployeeViewSet(viewsets.ModelViewSet):
    serializer_class = EmployeeSerializer
    permission_classes = [IsStaffReadAdminWrite]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return filter_employees(self.request.query_params)

    def perform_create(self, serializer):
        employee = serializer.save()
        audit.record("employee.create", request=self.request, entity=employee, changes=snapshot(employee))

    def perform_update(self, serializer):
        before = snapshot(serializer.instance)
        employee = serializer.save()
        audit.record(
            "employee.update", request=self.request, entity=employee,
            changes=audit.diff(before, snapshot(employee)),
        )

    def destroy(self, request, *args, **kwargs):
        employee = self.get_object()
        if employee.attendance_events.exists():
            return Response(
                {"detail": "This employee has attendance history. Deactivate the employee instead; "
                           "records are kept according to the retention policy."},
                status=status.HTTP_409_CONFLICT,
            )
        with transaction.atomic():
            audit.record("employee.delete", request=request, entity=employee, changes=snapshot(employee))
            if hasattr(employee, "user_account"):
                employee.user_account.delete()
            employee.delete()  # cascades to face templates and enrollment sessions
        return Response(status=status.HTTP_204_NO_CONTENT)

    def _set_status(self, request, new_status):
        employee = self.get_object()
        reason = (request.data.get("reason") or "").strip()
        before = employee.status
        employee.set_status(new_status)
        employee.save(update_fields=["status", "deactivated_at", "updated_at"])
        # Only active employees are matched, so deactivation stops recognition immediately.
        # It also disables the employee's portal login.
        if hasattr(employee, "user_account"):
            employee.user_account.is_active = new_status == Employee.Status.ACTIVE
            employee.user_account.save(update_fields=["is_active"])
        verb = "activate" if new_status == Employee.Status.ACTIVE else "deactivate"
        audit.record(
            f"employee.{verb}", request=request, entity=employee, reason=reason,
            changes={"status": {"before": before, "after": new_status}},
        )
        return Response(self.get_serializer(employee).data)

    @action(detail=True, methods=["post"], permission_classes=[IsAdmin])
    def deactivate(self, request, pk=None):
        return self._set_status(request, Employee.Status.INACTIVE)

    @action(detail=True, methods=["post"], permission_classes=[IsAdmin])
    def activate(self, request, pk=None):
        return self._set_status(request, Employee.Status.ACTIVE)

    @action(detail=True, methods=["post", "delete"], permission_classes=[IsAdmin])
    def account(self, request, pk=None):
        """Create (POST) or remove (DELETE) the employee's portal login."""
        employee = self.get_object()
        existing = getattr(employee, "user_account", None)
        if request.method == "DELETE":
            if existing is None:
                return Response({"detail": "This employee has no portal account."}, status=404)
            audit.record("account.delete", request=request, entity=existing,
                         changes={"username": existing.username})
            existing.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

        if existing is not None:
            return Response({"detail": "This employee already has a portal account."}, status=409)
        serializer = EmployeeAccountSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        user = User(
            username=data["username"], email=data.get("email") or employee.email,
            first_name=employee.first_name, last_name=employee.last_name,
            role=User.Role.EMPLOYEE, employee=employee, is_active=employee.is_active,
            password_changed_at=timezone.now(),
        )
        user.set_password(data["password"])
        user.save()
        audit.record("account.create", request=request, entity=user,
                     changes={"username": user.username, "employee_id": employee.id})
        employee = self.get_queryset().get(pk=employee.pk)
        return Response(self.get_serializer(employee).data, status=201)

    @action(detail=False, methods=["get"])
    def departments(self, request):
        values = (
            Employee.objects.exclude(department="").order_by("department")
            .values_list("department", flat=True).distinct()
        )
        return Response(list(values))

    @action(detail=False, methods=["get"], permission_classes=[IsAdmin])
    def export(self, request):
        qs = filter_employees(request.query_params)
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="employees-{timezone.localdate()}.csv"'
        writer = csv.writer(response)
        writer.writerow(["employee_number", "first_name", "last_name", "email", "phone",
                         "department", "position", "status", "created_at"])
        count = 0
        for e in qs:
            writer.writerow([
                e.employee_number, e.first_name, e.last_name, e.email, e.phone, e.department,
                e.position, e.status, timezone.localtime(e.created_at).date().isoformat(),
            ])
            count += 1
        audit.record("employee.export", request=request, changes={"rows": count})
        return response
