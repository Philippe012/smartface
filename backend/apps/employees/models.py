from django.db import models
from django.utils import timezone


class Employee(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        INACTIVE = "inactive", "Inactive"

    employee_number = models.CharField(max_length=32, unique=True)
    first_name = models.CharField(max_length=80)
    last_name = models.CharField(max_length=80)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=32, blank=True)
    department = models.CharField(max_length=80, blank=True)
    position = models.CharField(max_length=80, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE, db_index=True)
    deactivated_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["last_name", "first_name"]

    def __str__(self):
        return f"{self.employee_number} {self.full_name}"

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()

    @property
    def is_active(self) -> bool:
        return self.status == self.Status.ACTIVE

    def set_status(self, status: str) -> None:
        self.status = status
        self.deactivated_at = timezone.now() if status == self.Status.INACTIVE else None
