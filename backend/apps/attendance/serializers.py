from rest_framework import serializers

from apps.employees.models import Employee

from .models import AttendanceEvent, CorrectionRequest


def employee_ref(emp):
    if emp is None:
        return None
    return {"id": emp.id, "employee_number": emp.employee_number, "full_name": emp.full_name,
            "department": emp.department}


class AttendanceEventSerializer(serializers.ModelSerializer):
    employee = serializers.SerializerMethodField()
    candidate_employee = serializers.SerializerMethodField()
    camera = serializers.SerializerMethodField()
    created_by = serializers.SlugRelatedField(slug_field="username", read_only=True)
    reviewed_by = serializers.SlugRelatedField(slug_field="username", read_only=True)

    class Meta:
        model = AttendanceEvent
        fields = [
            "id", "employee", "candidate_employee", "camera", "occurred_at", "local_date", "direction",
            "source", "match_status", "status", "confidence", "quality", "model_version", "sighting_count",
            "last_sighting_at", "notes", "created_by", "reviewed_by", "reviewed_at", "created_at",
        ]

    def get_employee(self, obj):
        return employee_ref(obj.employee)

    def get_candidate_employee(self, obj):
        return employee_ref(obj.candidate_employee)

    def get_camera(self, obj):
        return {"id": obj.camera.id, "name": obj.camera.name, "location": obj.camera.location} if obj.camera else None


class EmployeeAttendanceSerializer(AttendanceEventSerializer):
    """What an employee sees about their own records."""

    class Meta(AttendanceEventSerializer.Meta):
        fields = [
            "id", "camera", "occurred_at", "local_date", "direction", "source", "match_status", "status",
            "confidence", "notes", "created_at",
        ]


class ManualEntrySerializer(serializers.Serializer):
    employee_id = serializers.PrimaryKeyRelatedField(queryset=Employee.objects.all(), source="employee")
    occurred_at = serializers.DateTimeField()
    reason = serializers.CharField(max_length=1000)

    def validate_employee(self, value):
        if not value.is_active:
            raise serializers.ValidationError("This employee is inactive.")
        return value


class ReviewSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=["confirm", "reject"])
    employee_id = serializers.PrimaryKeyRelatedField(
        queryset=Employee.objects.filter(status=Employee.Status.ACTIVE), source="employee",
        required=False, allow_null=True,
    )
    reason = serializers.CharField(max_length=1000)


class CorrectionSerializer(serializers.Serializer):
    occurred_at = serializers.DateTimeField(required=False, allow_null=True)
    void = serializers.BooleanField(default=False)
    reason = serializers.CharField(max_length=1000)


class CorrectionRequestSerializer(serializers.ModelSerializer):
    employee = serializers.SerializerMethodField()
    event = serializers.SerializerMethodField()
    event_id = serializers.PrimaryKeyRelatedField(
        queryset=AttendanceEvent.objects.all(), source="event", write_only=True, required=False, allow_null=True
    )
    requested_by = serializers.SlugRelatedField(slug_field="username", read_only=True)
    decided_by = serializers.SlugRelatedField(slug_field="username", read_only=True)

    class Meta:
        model = CorrectionRequest
        fields = [
            "id", "employee", "event", "event_id", "kind", "requested_time", "reason", "status",
            "requested_by", "decided_by", "decided_at", "decision_note", "before", "after", "created_at",
        ]
        read_only_fields = ["status", "decided_at", "decision_note", "before", "after", "created_at"]

    def get_employee(self, obj):
        return employee_ref(obj.employee)

    def get_event(self, obj):
        e = obj.event
        if e is None:
            return None
        return {"id": e.id, "occurred_at": e.occurred_at, "direction": e.direction, "status": e.status}

    def validate(self, attrs):
        kind = attrs.get("kind")
        event = attrs.get("event")
        if kind == CorrectionRequest.Kind.MISSING:
            if not attrs.get("requested_time"):
                raise serializers.ValidationError({"requested_time": "Enter the time you arrived."})
        elif event is None:
            raise serializers.ValidationError({"event_id": "Select the attendance record to correct."})
        if kind == CorrectionRequest.Kind.WRONG_TIME and not attrs.get("requested_time"):
            raise serializers.ValidationError({"requested_time": "Enter the correct time."})
        return attrs


class DecisionSerializer(serializers.Serializer):
    approve = serializers.BooleanField()
    note = serializers.CharField(max_length=1000, required=False, allow_blank=True, default="")
    occurred_at = serializers.DateTimeField(required=False, allow_null=True)
