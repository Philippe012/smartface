from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

User = get_user_model()


class MeSerializer(serializers.ModelSerializer):
    employee = serializers.SerializerMethodField()
    phone = serializers.CharField(required=False, allow_blank=True, max_length=32, write_only=True)

    class Meta:
        model = User
        fields = [
            "id", "username", "email", "first_name", "last_name", "role", "employee", "phone",
            "last_login", "date_joined", "password_changed_at", "theme_preference",
        ]
        read_only_fields = ["id", "username", "role", "last_login", "date_joined", "password_changed_at"]

    def get_employee(self, obj):
        emp = obj.employee
        if emp is None:
            return None
        return {"id": emp.id, "employee_number": emp.employee_number, "full_name": emp.full_name,
                "department": emp.department, "position": emp.position, "phone": emp.phone, "status": emp.status}

    def validate(self, attrs):
        user = self.instance
        if user.role == User.Role.EMPLOYEE:
            # Names are maintained on the employee record by administrators.
            for field in ("first_name", "last_name"):
                if field in attrs and attrs[field] != getattr(user, field):
                    raise serializers.ValidationError({field: "Ask an administrator to change your name."})
        elif "phone" in attrs:
            attrs.pop("phone")
        return attrs

    def update(self, instance, validated_data):
        phone = validated_data.pop("phone", None)
        instance = super().update(instance, validated_data)
        if phone is not None and instance.employee is not None:
            instance.employee.phone = phone
            instance.employee.save(update_fields=["phone", "updated_at"])
        return instance


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(max_length=256, style={"input_type": "password"})


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField()
    new_password = serializers.CharField()

    def validate(self, attrs):
        user = self.context["request"].user
        if not user.check_password(attrs["current_password"]):
            raise serializers.ValidationError({"current_password": "Your current password is incorrect."})
        if attrs["current_password"] == attrs["new_password"]:
            raise serializers.ValidationError({"new_password": "Choose a password you have not just used."})
        check_password_strength(attrs["new_password"], user, "new_password")
        return attrs


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField()


class StaffUserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)
    is_locked = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "role", "is_active", "last_login",
                  "date_joined", "password", "is_locked"]
        read_only_fields = ["last_login", "date_joined"]

    def get_is_locked(self, obj):
        return obj.is_locked()

    def validate_role(self, value):
        if value not in (User.Role.ADMIN, User.Role.OPERATOR):
            raise serializers.ValidationError("Staff accounts must be administrators or operators.")
        return value

    def validate(self, attrs):
        if self.instance is None:
            if not attrs.get("password"):
                raise serializers.ValidationError({"password": "Set an initial password."})
            check_password_strength(attrs["password"], User(username=attrs.get("username", "")))
        elif "password" in attrs:
            raise serializers.ValidationError({"password": "Use password recovery to change another user's password."})
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


def check_password_strength(password: str, user, field: str = "password") -> None:
    """Run Django's password validators, reporting failures against a specific form field."""
    try:
        validate_password(password, user)
    except DjangoValidationError as exc:
        raise serializers.ValidationError({field: list(exc.messages)}) from exc
