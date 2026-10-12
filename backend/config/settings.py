"""
Django settings for the SmartFace attendance system.

All environment-specific values are read from environment variables, loaded from
``backend/.env`` when present. See ``.env.example`` for the full list.
"""

import os
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Real environment variables take precedence over values in .env.
load_dotenv(BASE_DIR / ".env", override=False)


def env(name: str, default: str | None = None, *, required: bool = False) -> str:
    value = os.environ.get(name, default)
    if required and not value:
        raise ImproperlyConfigured(f"Environment variable {name} is required.")
    return value or ""


def env_bool(name: str, default: bool = False) -> bool:
    return env(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


def env_list(name: str, default: str = "") -> list[str]:
    return [item.strip() for item in env(name, default).split(",") if item.strip()]


DEBUG = env_bool("DJANGO_DEBUG", False)

SECRET_KEY = env("DJANGO_SECRET_KEY")
if not SECRET_KEY or SECRET_KEY.startswith("replace-with"):
    if DEBUG:
        SECRET_KEY = "insecure-development-only-key-do-not-use-in-production"
    else:
        raise ImproperlyConfigured(
            "DJANGO_SECRET_KEY must be set to a long random value when DJANGO_DEBUG=False."
        )

ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "apps.accounts",
    "apps.audit",
    "apps.settings_app",
    "apps.employees",
    "apps.cameras",
    "apps.recognition",
    "apps.attendance",
    "apps.reports",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# --- Database ---------------------------------------------------------------
# PostgreSQL only. Credentials always come from the environment.
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("DB_NAME", "SmartFace"),
        "USER": env("DB_USER", "postgres"),
        "PASSWORD": env("DB_PASSWORD"),
        "HOST": env("DB_HOST", "127.0.0.1"),
        "PORT": env("DB_PORT", "5432"),
        "CONN_MAX_AGE": int(env("DB_CONN_MAX_AGE", "60")),
        "OPTIONS": {"connect_timeout": 5},
    }
}

AUTH_USER_MODEL = "accounts.User"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 10}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# --- Internationalisation ---------------------------------------------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = env("TIME_ZONE", "Africa/Kigali")  # workplace timezone; DB stores UTC
USE_I18N = True
USE_TZ = True

# --- Static and media -------------------------------------------------------
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [BASE_DIR / "static"]
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}
# Built React app (npm run build). When present, Django serves it so the SPA and API share
# one origin in production (WhiteNoise serves /assets/*, a catch-all view serves index.html).
FRONTEND_DIST_DIR = Path(env("FRONTEND_DIST_DIR", str(BASE_DIR.parent / "frontend" / "dist")))
WHITENOISE_ROOT = FRONTEND_DIST_DIR if FRONTEND_DIST_DIR.is_dir() else None

MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

# --- REST framework ---------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework.authentication.SessionAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_PAGINATION_CLASS": "apps.accounts.pagination.StandardPagination",
    "PAGE_SIZE": 25,
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_THROTTLE_RATES": {
        "login": env("LOGIN_THROTTLE_RATE", "10/min"),
        "password_reset": "5/hour",
    },
    "EXCEPTION_HANDLER": "apps.accounts.exceptions.api_exception_handler",
}
if DEBUG:
    REST_FRAMEWORK["DEFAULT_RENDERER_CLASSES"].append("rest_framework.renderers.BrowsableAPIRenderer")

# --- CORS / CSRF ------------------------------------------------------------
CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS", "http://localhost:5173")
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS", ",".join(CORS_ALLOWED_ORIGINS))

# --- Sessions and cookies ---------------------------------------------------
SESSION_COOKIE_AGE = int(env("SESSION_COOKIE_AGE", str(60 * 60 * 8)))  # 8 hours
SESSION_EXPIRE_AT_BROWSER_CLOSE = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SECURE = env_bool("SECURE_COOKIES", not DEBUG)
CSRF_COOKIE_SECURE = SESSION_COOKIE_SECURE

# --- Production hardening ---------------------------------------------------
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
SECURE_REFERRER_POLICY = "same-origin"
if not DEBUG:
    SECURE_SSL_REDIRECT = env_bool("SECURE_SSL_REDIRECT", True)
    SECURE_HSTS_SECONDS = int(env("SECURE_HSTS_SECONDS", "31536000"))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = False
    if env_bool("USE_X_FORWARDED_PROTO", False):
        SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# --- Email (password recovery) ----------------------------------------------
EMAIL_BACKEND = env("EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend")
EMAIL_HOST = env("EMAIL_HOST", "localhost")
EMAIL_PORT = int(env("EMAIL_PORT", "25"))
EMAIL_HOST_USER = env("EMAIL_HOST_USER")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD")
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", False)
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", "SmartFace <no-reply@localhost>")
PASSWORD_RESET_TIMEOUT = 60 * 60  # 1 hour

# --- SmartFace specific -----------------------------------------------------
FRONTEND_URL = env("FRONTEND_URL", "http://localhost:5173").rstrip("/")

# Fernet key protecting biometric templates and camera passwords at rest.
# Generate with: python manage.py generate_encryption_key
SMARTFACE_ENCRYPTION_KEY = env("SMARTFACE_ENCRYPTION_KEY")

# Directory holding the local ONNX face models (see scripts/download_models.py).
FACE_MODELS_DIR = Path(env("FACE_MODELS_DIR", str(BASE_DIR / "models")))

# Account lockout after repeated failed sign-ins.
LOGIN_MAX_FAILED_ATTEMPTS = int(env("LOGIN_MAX_FAILED_ATTEMPTS", "5"))
LOGIN_LOCKOUT_MINUTES = int(env("LOGIN_LOCKOUT_MINUTES", "15"))

# Database backups triggered from the admin UI or `manage.py backup_db`.
BACKUP_DIR = Path(env("BACKUP_DIR", str(BASE_DIR / "backups")))
PG_DUMP_PATH = env("PG_DUMP_PATH", "pg_dump")

# --- Logging ----------------------------------------------------------------
LOG_LEVEL = env("LOG_LEVEL", "INFO")
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"standard": {"format": "%(asctime)s %(levelname)s %(name)s: %(message)s"}},
    "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "standard"}},
    "root": {"handlers": ["console"], "level": LOG_LEVEL},
    "loggers": {"django.db.backends": {"level": "WARNING"}},
}
