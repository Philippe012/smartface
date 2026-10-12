import os
import shutil
import subprocess
from datetime import timedelta

from django.conf import settings
from django.db import connection
from django.utils import timezone

from .models import BackupRecord, ServiceHeartbeat, SystemSettings

WORKER_HEARTBEAT_NAME = "recognition-worker"
WORKER_STALE_AFTER = timedelta(seconds=45)


def beat(name: str, **details) -> None:
    ServiceHeartbeat.objects.update_or_create(
        name=name, defaults={"last_seen_at": timezone.now(), "details": details}
    )


def worker_status() -> dict:
    hb = ServiceHeartbeat.objects.filter(name=WORKER_HEARTBEAT_NAME).first()
    if hb is None:
        return {"state": "not_started", "last_seen_at": None, "details": {}}
    running = timezone.now() - hb.last_seen_at < WORKER_STALE_AFTER
    return {"state": "running" if running else "stopped", "last_seen_at": hb.last_seen_at, "details": hb.details}


def database_status() -> dict:
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        return {"state": "ok", "vendor": connection.vendor}
    except Exception as exc:  # noqa: BLE001 - surfaced to operators
        return {"state": "error", "error": str(exc.__class__.__name__)}


def run_backup(triggered_by: str = "system") -> BackupRecord:
    """Dump the database with pg_dump (custom format) into BACKUP_DIR."""
    db = settings.DATABASES["default"]
    backup_dir = settings.BACKUP_DIR
    backup_dir.mkdir(parents=True, exist_ok=True)
    stamp = timezone.localtime().strftime("%Y%m%d-%H%M%S")
    file_path = backup_dir / f"smartface-{stamp}.dump"
    record = BackupRecord(status=BackupRecord.Status.FAILED, file_name=file_path.name, triggered_by=triggered_by)

    pg_dump = settings.PG_DUMP_PATH
    if db["ENGINE"] != "django.db.backends.postgresql":
        record.message = "Backups are only supported for PostgreSQL."
    elif shutil.which(pg_dump) is None:
        record.message = f"pg_dump was not found ('{pg_dump}'). Set PG_DUMP_PATH in backend/.env."
    else:
        env = {**os.environ, "PGPASSWORD": db["PASSWORD"]}
        cmd = [
            pg_dump, "--format=custom", "--no-owner",
            "--host", db["HOST"] or "127.0.0.1", "--port", str(db["PORT"] or 5432),
            "--username", db["USER"], "--file", str(file_path), db["NAME"],
        ]
        try:
            result = subprocess.run(cmd, env=env, capture_output=True, text=True, timeout=900)
            if result.returncode == 0:
                record.status = BackupRecord.Status.SUCCESS
                record.size_bytes = file_path.stat().st_size
                record.message = "Backup completed."
            else:
                record.message = (result.stderr or "pg_dump failed").strip()[:2000]
                file_path.unlink(missing_ok=True)
        except (OSError, subprocess.TimeoutExpired) as exc:
            record.message = f"Backup failed: {exc}"
            file_path.unlink(missing_ok=True)
    record.finished_at = timezone.now()
    record.save()
    return record


def apply_retention(dry_run: bool = False) -> dict:
    """Delete data that has passed its configured retention period."""
    from apps.attendance.models import AttendanceEvent
    from apps.audit.models import AuditEvent
    from apps.employees.models import Employee
    from apps.recognition.models import FaceTemplate

    cfg = SystemSettings.load()
    now = timezone.now()
    plan: dict[str, int] = {}

    if cfg.unresolved_event_retention_days:
        cutoff = now - timedelta(days=cfg.unresolved_event_retention_days)
        qs = AttendanceEvent.objects.filter(
            occurred_at__lt=cutoff,
            status__in=[AttendanceEvent.Status.REJECTED, AttendanceEvent.Status.PENDING_REVIEW],
            employee__isnull=True,
        )
        plan["unresolved_events"] = qs.count()
        if not dry_run:
            qs.delete()

    if cfg.attendance_retention_days:
        cutoff = now - timedelta(days=cfg.attendance_retention_days)
        qs = AttendanceEvent.objects.filter(occurred_at__lt=cutoff)
        plan["attendance_events"] = qs.count()
        if not dry_run:
            qs.delete()

    if cfg.inactive_template_retention_days:
        cutoff = now - timedelta(days=cfg.inactive_template_retention_days)
        qs = FaceTemplate.objects.filter(
            employee__status=Employee.Status.INACTIVE, employee__deactivated_at__lt=cutoff
        )
        plan["inactive_employee_templates"] = qs.count()
        if not dry_run:
            qs.delete()

    if cfg.audit_retention_days:
        cutoff = now - timedelta(days=cfg.audit_retention_days)
        qs = AuditEvent.objects.filter(occurred_at__lt=cutoff)
        plan["audit_events"] = qs.count()
        if not dry_run:
            qs._raw_delete(qs.db)  # bypasses append-only save(); deletion only by retention policy

    return plan
