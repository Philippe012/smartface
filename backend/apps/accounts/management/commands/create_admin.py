import getpass
import os

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.audit import services as audit


class Command(BaseCommand):
    help = (
        "Create a SmartFace administrator. Prompts for the password (never pass it on the command line). "
        "For unattended setup, set SMARTFACE_ADMIN_PASSWORD in the environment for this one command."
    )

    def add_arguments(self, parser):
        parser.add_argument("--username", required=True)
        parser.add_argument("--email", default="")
        parser.add_argument("--first-name", default="")
        parser.add_argument("--last-name", default="")

    def handle(self, *args, **opts):
        User = get_user_model()
        username = opts["username"].strip()
        if User.objects.filter(username__iexact=username).exists():
            raise CommandError(f"A user named '{username}' already exists.")

        password = os.environ.get("SMARTFACE_ADMIN_PASSWORD")
        if not password:
            password = getpass.getpass("Password: ")
            if password != getpass.getpass("Password (again): "):
                raise CommandError("Passwords do not match.")

        user = User(
            username=username, email=opts["email"], first_name=opts["first_name"], last_name=opts["last_name"],
            role=User.Role.ADMIN, is_staff=True, is_superuser=True, password_changed_at=timezone.now(),
        )
        try:
            validate_password(password, user)
        except ValidationError as exc:
            raise CommandError("Password rejected: " + " ".join(exc.messages)) from exc
        user.set_password(password)
        user.save()
        audit.record("account.create", actor=None, entity=user, changes={"username": username, "role": "admin", "via": "cli"})
        self.stdout.write(self.style.SUCCESS(f"Administrator '{username}' created."))
