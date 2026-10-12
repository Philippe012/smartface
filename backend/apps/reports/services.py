"""
Report calculations.

Lateness and absence are only calculated when an attendance schedule has been configured
(System settings > Attendance policy). Otherwise reports show presence/no-record only.
"""

import calendar
from datetime import date, datetime, timedelta

from django.db.models import Count, Q
from django.utils import timezone

from apps.attendance.models import AttendanceEvent as Event
from apps.employees.models import Employee
from apps.settings_app.models import SystemSettings


def policy(cfg: SystemSettings | None = None) -> dict:
    cfg = cfg or SystemSettings.load()
    configured = bool(cfg.schedule_configured and cfg.work_start_time)
    return {
        "configured": configured,
        "work_start_time": cfg.work_start_time.strftime("%H:%M") if cfg.work_start_time else None,
        "grace_minutes": cfg.grace_minutes,
        "workdays": cfg.workdays,
        "timezone": timezone.get_current_timezone_name(),
    }


def _employees_for_period(start: date, end: date):
    """Active employees plus anyone with confirmed attendance in the period."""
    return Employee.objects.filter(
        Q(status=Employee.Status.ACTIVE)
        | Q(attendance_events__local_date__range=(start, end), attendance_events__status=Event.Status.CONFIRMED)
    ).distinct().order_by("last_name", "first_name")


def _is_late(first_in: datetime, cfg: SystemSettings) -> bool:
    local = timezone.localtime(first_in)
    deadline = datetime.combine(local.date(), cfg.work_start_time) + timedelta(minutes=cfg.grace_minutes)
    return local.replace(tzinfo=None) > deadline


def daily_report(day: date) -> dict:
    cfg = SystemSettings.load()
    pol = policy(cfg)
    events = {
        e.employee_id: e
        for e in Event.objects.filter(local_date=day, status=Event.Status.CONFIRMED, direction=Event.Direction.IN)
        .select_related("camera")
    }
    is_workday = day.weekday() in (cfg.workdays or [])
    today = timezone.localdate()
    rows = []
    counts = {"present": 0, "no_record": 0, "late": 0, "on_time": 0, "absent": 0}
    for emp in _employees_for_period(day, day):
        event = events.get(emp.id)
        if event:
            state = "present"
            if pol["configured"]:
                state = "late" if _is_late(event.occurred_at, cfg) else "on_time"
                counts["present"] += 1
        elif pol["configured"] and is_workday and day < today:
            state = "absent"
        else:
            state = "no_record"
        counts[state] += 1
        rows.append({
            "employee": {"id": emp.id, "employee_number": emp.employee_number, "full_name": emp.full_name,
                         "department": emp.department},
            "event_id": event.id if event else None,
            "first_in": event.occurred_at if event else None,
            "source": event.source if event else None,
            "match_status": event.match_status if event else None,
            "camera": event.camera.name if event and event.camera else None,
            "state": state,
        })
    return {"date": day, "policy": pol, "is_workday": is_workday, "counts": counts, "rows": rows}


def monthly_report(year: int, month: int) -> dict:
    cfg = SystemSettings.load()
    pol = policy(cfg)
    start = date(year, month, 1)
    end = date(year, month, calendar.monthrange(year, month)[1])
    today = timezone.localdate()
    events = Event.objects.filter(
        local_date__range=(start, end), status=Event.Status.CONFIRMED, direction=Event.Direction.IN
    ).only("employee_id", "local_date", "occurred_at")

    per_emp: dict[int, list] = {}
    per_day: dict[date, int] = {}
    for e in events:
        per_emp.setdefault(e.employee_id, []).append(e)
        per_day[e.local_date] = per_day.get(e.local_date, 0) + 1

    elapsed_workdays = [
        start + timedelta(days=i) for i in range((min(end, today - timedelta(days=1)) - start).days + 1)
        if (start + timedelta(days=i)).weekday() in (cfg.workdays or [])
    ] if start < today else []

    rows = []
    for emp in _employees_for_period(start, end):
        evs = per_emp.get(emp.id, [])
        row = {
            "employee": {"id": emp.id, "employee_number": emp.employee_number, "full_name": emp.full_name,
                         "department": emp.department},
            "days_present": len(evs),
            "late_days": None,
            "absent_days": None,
        }
        if pol["configured"]:
            present_days = {e.local_date for e in evs}
            row["late_days"] = sum(1 for e in evs if _is_late(e.occurred_at, cfg))
            row["absent_days"] = sum(1 for d in elapsed_workdays if d not in present_days)
        rows.append(row)

    days = [
        {"date": start + timedelta(days=i), "present": per_day.get(start + timedelta(days=i), 0)}
        for i in range((end - start).days + 1)
    ]
    return {"month": f"{year:04d}-{month:02d}", "policy": pol, "workdays_elapsed": len(elapsed_workdays),
            "rows": rows, "days": days}


def dashboard_summary() -> dict:
    from apps.attendance.models import CorrectionRequest
    from apps.attendance.serializers import AttendanceEventSerializer
    from apps.cameras.models import Camera
    from apps.recognition.services import readiness
    from apps.settings_app.services import database_status, worker_status

    today = timezone.localdate()
    active = Employee.objects.filter(status=Employee.Status.ACTIVE)
    active_count = active.count()
    enrolled = active.filter(face_templates__is_active=True).distinct().count()
    present = Event.objects.filter(local_date=today, status=Event.Status.CONFIRMED, direction=Event.Direction.IN).count()

    start = today - timedelta(days=13)
    counts = {
        row["local_date"]: row["n"]
        for row in Event.objects.filter(local_date__gte=start, status=Event.Status.CONFIRMED, direction=Event.Direction.IN)
        .values("local_date").annotate(n=Count("id"))
    }
    trend = [{"date": start + timedelta(days=i), "present": counts.get(start + timedelta(days=i), 0)} for i in range(14)]

    recent = Event.objects.select_related("employee", "candidate_employee", "camera").order_by("-occurred_at")[:8]

    return {
        "date": today,
        "employees": {"total": Employee.objects.count(), "active": active_count, "enrolled": enrolled},
        "today": {"present": present, "not_recorded": max(active_count - present, 0)},
        "pending_reviews": Event.objects.filter(status=Event.Status.PENDING_REVIEW).count(),
        "pending_corrections": CorrectionRequest.objects.filter(status=CorrectionRequest.Status.PENDING).count(),
        "trend": trend,
        "recent_events": AttendanceEventSerializer(recent, many=True).data,
        "cameras": [
            {"id": c.id, "name": c.name, "location": c.location, "direction": c.direction, "health": c.health,
             "last_frame_at": c.last_frame_at, "last_error": c.last_error}
            for c in Camera.objects.all()
        ],
        "services": {"database": database_status(), "recognition": readiness(), "worker": worker_status()},
        "policy": policy(),
    }
