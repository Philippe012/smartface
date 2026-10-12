from django.core.management.base import BaseCommand, CommandError

from apps.settings_app.services import run_backup


class Command(BaseCommand):
    help = "Back up the SmartFace PostgreSQL database with pg_dump into BACKUP_DIR."

    def handle(self, *args, **options):
        record = run_backup(triggered_by="cli")
        if record.status != "success":
            raise CommandError(record.message)
        self.stdout.write(self.style.SUCCESS(f"Backup written: {record.file_name} ({record.size_bytes} bytes)"))
