import csv

from django.http import HttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import generics
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdmin

from . import services
from .models import AuditEvent
from .serializers import AuditEventSerializer


def filtered_audit_queryset(params):
    qs = AuditEvent.objects.all()
    if action := params.get("action"):
        qs = qs.filter(action__icontains=action)
    if entity_type := params.get("entity_type"):
        qs = qs.filter(entity_type=entity_type)
    if actor := params.get("actor"):
        qs = qs.filter(actor_username__icontains=actor)
    if date_from := parse_date(params.get("from") or ""):
        qs = qs.filter(occurred_at__date__gte=date_from)
    if date_to := parse_date(params.get("to") or ""):
        qs = qs.filter(occurred_at__date__lte=date_to)
    return qs


class AuditEventListView(generics.ListAPIView):
    serializer_class = AuditEventSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        return filtered_audit_queryset(self.request.query_params)


class AuditExportView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        qs = filtered_audit_queryset(request.query_params)[:50000]
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="audit-log-{timezone.localdate()}.csv"'
        writer = csv.writer(response)
        writer.writerow(["occurred_at", "actor", "action", "entity_type", "entity_id", "reason", "ip_address"])
        for e in qs:
            writer.writerow([
                timezone.localtime(e.occurred_at).isoformat(), e.actor_username, e.action,
                e.entity_type, e.entity_id, e.reason, e.ip_address or "",
            ])
        services.record("audit.export", request=request, changes={"rows": len(qs)})
        return response
