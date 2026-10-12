from typing import Any

from .models import AuditEvent

SENSITIVE_KEYS = {"password", "stream_password", "embedding", "encrypted_embedding", "token"}


def _client_ip(request) -> str | None:
    if request is None:
        return None
    return request.META.get("REMOTE_ADDR")


def _scrub(value: Any) -> Any:
    if isinstance(value, dict):
        return {k: ("[redacted]" if k in SENSITIVE_KEYS else _scrub(v)) for k, v in value.items()}
    if isinstance(value, list):
        return [_scrub(v) for v in value]
    return value


def diff(before: dict, after: dict) -> dict:
    """Return {field: {"before": x, "after": y}} for fields that changed."""
    keys = set(before) | set(after)
    return {
        k: {"before": before.get(k), "after": after.get(k)}
        for k in sorted(keys)
        if before.get(k) != after.get(k)
    }


def record(
    action: str,
    *,
    request=None,
    actor=None,
    entity=None,
    entity_type: str = "",
    entity_id: Any = "",
    reason: str = "",
    changes: dict | None = None,
) -> AuditEvent:
    if actor is None and request is not None and getattr(request, "user", None) is not None:
        actor = request.user if request.user.is_authenticated else None
    if entity is not None:
        entity_type = entity_type or entity._meta.model_name
        entity_id = entity_id or entity.pk
    return AuditEvent.objects.create(
        actor=actor,
        actor_username=getattr(actor, "username", "") or "system",
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id or ""),
        reason=reason or "",
        changes=_scrub(changes or {}),
        ip_address=_client_ip(request),
    )
