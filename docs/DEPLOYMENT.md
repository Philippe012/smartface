# Production deployment

SmartFace runs as two long-lived processes on one server inside your network:

| Process | Command | Notes |
|---|---|---|
| Web app (API + built React app) | Waitress (Windows) or Gunicorn (Linux) | Never use `manage.py runserver` in production |
| Recognition worker | `python manage.py run_recognition` | Needs network access to the cameras |

An HTTPS reverse proxy (Caddy, nginx or IIS with ARR) terminates TLS in front of the web app.
PostgreSQL can be on the same server or another restricted host.

---

## 1. Prepare the release

```powershell
# Frontend: build static files into frontend/dist
cd frontend
npm ci
npm run build

# Backend
cd ..\backend
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe scripts\download_models.py
```

Django detects `frontend/dist` and serves it: `/assets/*` through WhiteNoise, every other
non-API path returns `index.html`. To keep the build elsewhere, set `FRONTEND_DIST_DIR`.

## 2. Production configuration (`backend/.env`)

```dotenv
DJANGO_SECRET_KEY=<64+ random characters>
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=smartface.example.local
CSRF_TRUSTED_ORIGINS=https://smartface.example.local
CORS_ALLOWED_ORIGINS=https://smartface.example.local
FRONTEND_URL=https://smartface.example.local

DB_NAME=SmartFace
DB_USER=smartface_app            # dedicated least-privilege role, not postgres
DB_PASSWORD=<strong password>
DB_HOST=127.0.0.1
DB_PORT=5432

SMARTFACE_ENCRYPTION_KEY=<from manage.py generate_encryption_key>
TIME_ZONE=Africa/Kigali

# TLS is terminated by the reverse proxy:
USE_X_FORWARDED_PROTO=True
SECURE_SSL_REDIRECT=True
SECURE_HSTS_SECONDS=31536000

EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.example.local
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=...
EMAIL_HOST_PASSWORD=...
DEFAULT_FROM_EMAIL=SmartFace <no-reply@example.local>

BACKUP_DIR=D:\SmartFaceBackups
PG_DUMP_PATH=C:\Program Files\PostgreSQL\17\bin\pg_dump.exe
```

With `DJANGO_DEBUG=False`, session and CSRF cookies are `Secure`, HSTS is enabled and HTTP
requests are redirected to HTTPS. Django refuses to start without a real secret key.

**Least-privilege database role** (run once as a PostgreSQL superuser; review before running):

```sql
CREATE ROLE smartface_app LOGIN PASSWORD '<strong password>';
GRANT CONNECT ON DATABASE "SmartFace" TO smartface_app;
\c "SmartFace"
GRANT USAGE, CREATE ON SCHEMA public TO smartface_app;   -- CREATE is needed for migrations
```

If you migrate with a more privileged account instead, grant `smartface_app`
`SELECT, INSERT, UPDATE, DELETE` on the tables and `USAGE` on sequences afterwards. Restrict
`pg_hba.conf` so that only the SmartFace server can connect.

**Secrets:** keep `backend/.env` readable only by the service account (`icacls` on Windows,
`chmod 600` on Linux). Never commit it. Store the encryption key in a password manager or
secret vault as well. It's needed to restore backups.

## 3. Initialise

```powershell
.\.venv\Scripts\python.exe manage.py check --deploy
.\.venv\Scripts\python.exe manage.py showmigrations
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py collectstatic --noinput
.\.venv\Scripts\python.exe manage.py create_admin --username <name> --email <email>
```

`check --deploy` should report only `W005`/`W021` (HSTS subdomains/preload), which are
deliberately off for a single internal host.

## 4a. Windows server

Run the web app with Waitress (installed from `requirements.txt` on Windows):

```powershell
.\.venv\Scripts\waitress-serve.exe --listen=127.0.0.1:8000 --threads=8 config.wsgi:application
```

Register both processes as Windows services so they start at boot and restart on failure.
[NSSM](https://nssm.cc) is a common choice:

```powershell
nssm install SmartFaceWeb    "C:\SmartFace\backend\.venv\Scripts\waitress-serve.exe" "--listen=127.0.0.1:8000 --threads=8 config.wsgi:application"
nssm set     SmartFaceWeb    AppDirectory "C:\SmartFace\backend"
nssm install SmartFaceWorker "C:\SmartFace\backend\.venv\Scripts\python.exe" "manage.py run_recognition"
nssm set     SmartFaceWorker AppDirectory "C:\SmartFace\backend"
nssm set     SmartFaceWorker AppStdout "C:\SmartFace\logs\worker.log"
nssm set     SmartFaceWorker AppStderr "C:\SmartFace\logs\worker.log"
nssm start SmartFaceWeb
nssm start SmartFaceWorker
```

Run the services under a dedicated low-privilege account. Put IIS (URL Rewrite + ARR),
Caddy or nginx in front for HTTPS, forwarding to `127.0.0.1:8000` and setting
`X-Forwarded-Proto`.

## 4b. Linux server (systemd + Gunicorn)

`/etc/systemd/system/smartface-web.service`:

```ini
[Unit]
Description=SmartFace web
After=network.target postgresql.service

[Service]
User=smartface
WorkingDirectory=/opt/smartface/backend
ExecStart=/opt/smartface/backend/.venv/bin/gunicorn config.wsgi:application --bind 127.0.0.1:8000 --workers 3 --timeout 60
Restart=always

[Install]
WantedBy=multi-user.target
```

`/etc/systemd/system/smartface-worker.service`:

```ini
[Unit]
Description=SmartFace recognition worker
After=network.target postgresql.service

[Service]
User=smartface
WorkingDirectory=/opt/smartface/backend
ExecStart=/opt/smartface/backend/.venv/bin/python manage.py run_recognition
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now smartface-web smartface-worker
```

Example Caddy configuration (internal CA or your own certificate):

```
smartface.example.local {
    tls internal
    reverse_proxy 127.0.0.1:8000
}
```

Example nginx server block:

```nginx
server {
    listen 443 ssl;
    server_name smartface.example.local;
    ssl_certificate     /etc/ssl/smartface.crt;
    ssl_certificate_key /etc/ssl/smartface.key;
    client_max_body_size 6m;               # enrollment uploads are limited to 5 MB
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
server { listen 80; server_name smartface.example.local; return 301 https://$host$request_uri; }
```

## 5. Scheduled jobs

| Job | Command | Frequency |
|---|---|---|
| Database backup | `python manage.py backup_db` | Daily |
| Retention | `python manage.py apply_retention` | Daily |
| Copy backups off-server | your tooling | Daily |

Windows example (Task Scheduler, run whether the user is logged in or not):

```powershell
schtasks /Create /TN "SmartFace Backup" /SC DAILY /ST 01:30 /RU <service-account> `
  /TR "C:\SmartFace\backend\.venv\Scripts\python.exe C:\SmartFace\backend\manage.py backup_db"
```

Linux example (crontab of the `smartface` user):

```
30 1 * * * cd /opt/smartface/backend && .venv/bin/python manage.py backup_db
45 1 * * * cd /opt/smartface/backend && .venv/bin/python manage.py apply_retention
```

## 6. Network and hardening checklist

- [ ] Cameras on a segmented VLAN; only the SmartFace server may reach their RTSP ports. Camera accounts are view-only.
- [ ] Only ports 443 (and 80 to redirect) exposed by the server; Django/Waitress listens on `127.0.0.1` only.
- [ ] PostgreSQL listens on localhost or a restricted interface; `pg_hba.conf` allows only the app server.
- [ ] `DJANGO_DEBUG=False`, unique secret key, correct `DJANGO_ALLOWED_HOSTS` and `CSRF_TRUSTED_ORIGINS`.
- [ ] Server time synchronised (NTP/Windows Time), and the camera clocks too.
- [ ] `.env` readable only by the service account; encryption key also stored in a vault.
- [ ] Backups automated, encrypted, copied off-server, restore tested.
- [ ] Logs: web and worker logs rotate (NSSM `AppRotateFiles`, or journald). Logs contain no face images or passwords; camera URLs are redacted.
- [ ] Dependencies reviewed and updated monthly: `pip list --outdated`, `npm outdated`, `npm audit`. Rebuild and re-run tests after updating.
- [ ] Staff accounts reviewed quarterly (Settings → Security → Staff accounts).
- [ ] Manual attendance fallback and correction procedure published to employees.

## 7. Updating

```powershell
# stop SmartFaceWorker and SmartFaceWeb
python manage.py backup_db
# replace the code, then:
pip install -r requirements.txt
cd ..\frontend; npm ci; npm run build; cd ..\backend
python manage.py migrate
python manage.py collectstatic --noinput
# start the services again; check Settings → System
```

## Optional: Docker

Docker isn't required, and no Compose file is shipped. The deployment above uses the
existing host PostgreSQL `SmartFace` database directly. If you containerise later, point
`DB_HOST` at the host database rather than creating a new containerised database, so the
existing data isn't replaced.
