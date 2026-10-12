import csv
from datetime import date

from django.http import HttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdmin, IsEmployeeUser, IsStaffMember
from apps.attendance.models import AttendanceEvent, CorrectionRequest
from apps.attendance.serializers import EmployeeAttendanceSerializer
from apps.audit import services as audit
from apps.recognition.services import enrollment_summary
from apps.settings_app.models import SystemSettings

from . import services


def _day(params) -> date:
    raw = params.get("date")
    if not raw:
        return timezone.localdate()
    value = parse_date(raw)
    if value is None:
        raise ValidationError({"date": "Use the format YYYY-MM-DD."})
    return value


def _month(params) -> tuple[int, int]:
    raw = params.get("month")
    if not raw:
        today = timezone.localdate()
        return today.year, today.month
    try:
        year, month = (int(p) for p in raw.split("-"))
        date(year, month, 1)
        return year, month
    except (ValueError, TypeError) as exc:
        raise ValidationError({"month": "Use the format YYYY-MM."}) from exc


def _local_time(value):
    return timezone.localtime(value).strftime("%H:%M:%S") if value else ""


class DashboardView(APIView):
    permission_classes = [IsStaffMember]

    def get(self, request):
        return Response(services.dashboard_summary())


class DailyReportView(APIView):
    permission_classes = [IsStaffMember]

    def get(self, request):
        return Response(services.daily_report(_day(request.query_params)))


class MonthlyReportView(APIView):
    permission_classes = [IsStaffMember]

    def get(self, request):
        return Response(services.monthly_report(*_month(request.query_params)))


class DailyReportExportView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        report = services.daily_report(_day(request.query_params))
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="daily-attendance-{report["date"]}.csv"'
        writer = csv.writer(response)
        writer.writerow(["date", "employee_number", "employee_name", "department", "first_in", "state", "source", "camera"])
        for r in report["rows"]:
            writer.writerow([report["date"], r["employee"]["employee_number"], r["employee"]["full_name"],
                             r["employee"]["department"], _local_time(r["first_in"]), r["state"],
                             r["source"] or "", r["camera"] or ""])
        audit.record("report.export", request=request, changes={"report": "daily", "date": str(report["date"])})
        return response


class MonthlyReportExportView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        report = services.monthly_report(*_month(request.query_params))
        configured = report["policy"]["configured"]
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="monthly-attendance-{report["month"]}.csv"'
        writer = csv.writer(response)
        header = ["month", "employee_number", "employee_name", "department", "days_present"]
        if configured:
            header += ["late_days", "absent_days"]
        writer.writerow(header)
        for r in report["rows"]:
            row = [report["month"], r["employee"]["employee_number"], r["employee"]["full_name"],
                   r["employee"]["department"], r["days_present"]]
            if configured:
                row += [r["late_days"], r["absent_days"]]
            writer.writerow(row)
        audit.record("report.export", request=request, changes={"report": "monthly", "month": report["month"]})
        return response


class MySummaryView(APIView):
    permission_classes = [IsEmployeeUser]

    def get(self, request):
        employee = request.user.employee
        today = timezone.localdate()
        own = AttendanceEvent.objects.filter(employee=employee, status=AttendanceEvent.Status.CONFIRMED)
        today_event = own.filter(local_date=today, direction="IN").select_related("camera").first()
        month_days = own.filter(local_date__year=today.year, local_date__month=today.month).count()
        recent = own.select_related("camera").order_by("-occurred_at")[:5]
        cfg = SystemSettings.load()
        return Response({
            "date": today,
            "employee": {
                "id": employee.id, "employee_number": employee.employee_number, "full_name": employee.full_name,
                "department": employee.department, "position": employee.position, "status": employee.status,
            },
            "today": EmployeeAttendanceSerializer(today_event).data if today_event else None,
            "month_days_present": month_days,
            "pending_corrections": CorrectionRequest.objects.filter(
                employee=employee, status=CorrectionRequest.Status.PENDING).count(),
            "recent": EmployeeAttendanceSerializer(recent, many=True).data,
            "enrollment": enrollment_summary(employee),
            "privacy_notice": cfg.privacy_notice,
            "alternative_method": cfg.alternative_method,
            "policy": services.policy(cfg),
        })
