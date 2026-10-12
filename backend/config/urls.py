from django.conf import settings
from django.contrib import admin
from django.http import FileResponse, Http404
from django.urls import include, path, re_path

api_v1 = [
    path("", include("apps.accounts.urls")),
    path("", include("apps.employees.urls")),
    path("", include("apps.cameras.urls")),
    path("", include("apps.recognition.urls")),
    path("", include("apps.attendance.urls")),
    path("", include("apps.reports.urls")),
    path("", include("apps.audit.urls")),
    path("", include("apps.settings_app.urls")),
]


def spa_index(request):
    """Serve the built React app for client-side routes (production single-origin deployment)."""
    index = settings.FRONTEND_DIST_DIR / "index.html"
    if not index.is_file():
        raise Http404("Frontend build not found. Run `npm run build` in frontend/ or use the Vite dev server.")
    return FileResponse(index.open("rb"), content_type="text/html")


urlpatterns = [
    # The React app owns /admin/*, so Django's own admin lives elsewhere.
    path("django-admin/", admin.site.urls),
    path("api/v1/", include(api_v1)),
    re_path(r"^(?!api/|django-admin/|static/|media/).*$", spa_index),
]
