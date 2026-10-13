from datetime import timedelta

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class User(AbstractUser):
    """Login account. Administrators/operators manage the system; employees use the portal."""

    class Role(models.TextChoices):
        ADMIN = "admin", "Administrator"
        OPERATOR = "operator", "System operator"
        EMPLOYEE = "employee", "Employee"

    class Theme(models.TextChoices):
        SYSTEM = "system", "Match device"
        LIGHT = "light", "Light"
        DARK = "dark", "Dark"

    role = models.CharField(max_length=16, choices=Role.choices, default=Role.EMPLOYEE)
    employee = models.OneToOneField(
        "employees.Employee",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="user_account",
        help_text="Employee record this portal account belongs to (employees only).",
    )
    failed_login_count = models.PositiveIntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)
    password_changed_at = models.DateTimeField(null=True, blank=True)
    theme_preference = models.CharField(max_length=8, choices=Theme.choices, default=Theme.SYSTEM)

    def save(self, *args, **kwargs):
        if self.is_superuser:
            self.role = self.Role.ADMIN
        super().save(*args, **kwargs)

    @property
    def is_admin(self) -> bool:
        return self.is_active and self.role == self.Role.ADMIN

    @property
    def is_staff_member(self) -> bool:
        """Administrators and operators (the back-office roles)."""
        return self.is_active and self.role in (self.Role.ADMIN, self.Role.OPERATOR)

    def is_locked(self) -> bool:
        return bool(self.locked_until and self.locked_until > timezone.now())

    def register_failed_login(self) -> None:
        self.failed_login_count += 1
        if self.failed_login_count >= settings.LOGIN_MAX_FAILED_ATTEMPTS:
            self.locked_until = timezone.now() + timedelta(minutes=settings.LOGIN_LOCKOUT_MINUTES)
            self.failed_login_count = 0
        self.save(update_fields=["failed_login_count", "locked_until"])

    def register_successful_login(self) -> None:
        if self.failed_login_count or self.locked_until:
            self.failed_login_count = 0
            self.locked_until = None
            self.save(update_fields=["failed_login_count", "locked_until"])
