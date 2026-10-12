from cryptography.fernet import Fernet
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Print a new Fernet key for SMARTFACE_ENCRYPTION_KEY. Store it securely and back it up separately."

    def handle(self, *args, **options):
        self.stdout.write(Fernet.generate_key().decode())
        self.stderr.write(
            "Add this as SMARTFACE_ENCRYPTION_KEY in backend/.env. Losing or changing it makes existing "
            "biometric templates and camera passwords unreadable (employees would need to re-enroll)."
        )
