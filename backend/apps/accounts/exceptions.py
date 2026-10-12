import logging

from django.db import DatabaseError, IntegrityError
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


def api_exception_handler(exc, context):
    """Consistent JSON errors: {"detail": "...", "errors": {...}} plus database outage handling."""
    response = exception_handler(exc, context)
    if response is None:
        if isinstance(exc, IntegrityError):
            return Response({"detail": "This change conflicts with an existing record."}, status=409)
        if isinstance(exc, DatabaseError):
            logger.exception("Database error while handling request")
            return Response({"detail": "The database is unavailable. Please try again shortly."}, status=503)
        return None

    data = response.data
    if isinstance(data, dict) and "detail" not in data:
        response.data = {"detail": "Please correct the highlighted fields.", "errors": data}
    elif isinstance(data, list):
        response.data = {"detail": " ".join(str(item) for item in data)}
    return response
