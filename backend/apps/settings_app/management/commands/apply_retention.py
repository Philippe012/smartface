from django.core.management.base import BaseCommand

from apps.audit import services as audit
from apps.settings_app.services import apply_retention


class Command(BaseCommand):
    help = "Delete data past its configured retention period. Schedule daily (cron / Task Scheduler)."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        result = apply_retention(dry_run=options["dry_run"])
        if not options["dry_run"]:
            audit.record("retention.apply", actor=None, changes={"deleted": result, "via": "cli"})
        label = "Would delete" if options["dry_run"] else "Deleted"
        for key, count in result.items() or {"nothing": 0}.items():
            self.stdout.write(f"{label} {count} {key.replace('_', ' ')}")
