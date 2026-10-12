from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.accounts.serializers import check_password_strength

from .models import Employee

User = get_user_model()

AUDITED_FIELDS = ["employee_number", "first_name", "last_name", "email", "phone", "department", "position", "status"]


def snapshot(employee: Employee) -> dict:
    return {f: getattr(employee, f) for f in AUDITED_FIELDS}


class EmployeeSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    enrollment = serializers.SerializerMethodField()
    account = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = [
            "id", "employee_number", "first_name", "last_name", "full_name", "email", "phone",
            "department", "position", "status", "deactivated_at", "created_at", "updated_at",
            "enrollment", "account",
        ]
        read_only_fields = ["status", "deactivated_at", "created_at", "updated_at"]

    def validate_employee_number(self, value):
        value = value.strip().upper()
        if not value:
            raise serializers.ValidationError("Employee number is required.")
        qs = Employee.objects.filter(employee_number__iexact=value)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("An employee with this number already exists.")
        return value

    def get_enrollment(self, obj):
        from apps.recognition.services import enrollment_summary

        return enrollment_summary(obj)

    def get_account(self, obj):
        user = getattr(obj, "user_account", None)
        if user is None:
            return None
        return {
            "id": user.id, "username": user.username, "email": user.email,
            "is_active": user.is_active, "last_login": user.last_login,
        }


class EmployeeAccountSerializer(serializers.Serializer):
    """Create a portal login for an employee."""

    username = serializers.CharField(max_length=150)
    email = serializers.EmailField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, style={"input_type": "password"})

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("This username is already taken.")
        return value

    def validate(self, attrs):
        check_password_strength(attrs["password"], User(username=attrs["username"]))
        return attrs
