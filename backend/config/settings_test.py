"""
Test settings.

By default tests run against PostgreSQL (Django creates and destroys a separate
``test_SmartFace`` database; the real ``SmartFace`` database is never touched).
Set ``TEST_USE_SQLITE=1`` to run the suite without a PostgreSQL server.
"""

import os

from cryptography.fernet import Fernet

os.environ.setdefault("DJANGO_DEBUG", "True")
os.environ.setdefault("SMARTFACE_ENCRYPTION_KEY", Fernet.generate_key().decode())

from .settings import *  # noqa: E402,F403

if os.environ.get("TEST_USE_SQLITE") == "1":
    DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}

PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]  # speed only; tests
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}
REST_FRAMEWORK = {**REST_FRAMEWORK, "DEFAULT_THROTTLE_RATES": {"login": "1000/min", "password_reset": "1000/min"}}  # noqa: F405
SECURE_SSL_REDIRECT = False
LOGGING = {**LOGGING, "loggers": {**LOGGING["loggers"], "django.request": {"level": "ERROR"}}}  # noqa: F405
