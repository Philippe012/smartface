from datetime import datetime

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from apps.cameras.models import Camera
from apps.employees.models import Employee

User = get_user_model()
PASSWORD = "Correct-Horse-42!"


def make_user(username="admin", role="admin", employee=None, **extra):
    user = User(username=username, role=role, employee=employee, email=f"{username}@example.test", **extra)
    user.set_password(PASSWORD)
    user.save()
    return user


def make_employee(number="EMP001", first="Ada", last="Lovelace", **extra):
    return Employee.objects.create(employee_number=number, first_name=first, last_name=last, **extra)


def make_camera(name="Main Entrance", **extra):
    defaults = {"location": "Lobby", "direction": "IN", "source_type": "rtsp",
                "stream_url": "rtsp://192.168.1.20:554/stream1"}
    defaults.update(extra)
    return Camera.objects.create(name=name, **defaults)


def client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user)
    return client


def local_dt(year, month, day, hour, minute=0):
    return timezone.make_aware(datetime(year, month, day, hour, minute))
