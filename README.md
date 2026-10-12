# SmartFace Attendance System

On-premises facial-recognition attendance for a single workplace. An entrance IP camera
recognises enrolled employees and records their arrival (IN). Administrators manage
employees, enrollment, cameras, reviews, corrections and reports from a web console;
employees get their own portal to see their records and request corrections.

Everything runs on your local network. There is no cloud AI service and no external
face-recognition API.

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript, Vite, Tailwind CSS 4, React Router, React Hook Form + Zod, Lucide icons, Recharts |
| Backend | Python 3.12, Django 5.2 LTS, Django REST Framework, session auth + CSRF |
| Database | PostgreSQL 17 (existing `SmartFace` database) |
| Recognition | OpenCV 4.x with YuNet (face detection, MIT) and SFace (face recognition, Apache-2.0), CPU only |

> **Responsible use.** Face templates are sensitive biometric data. Before enrolling
> anyone, complete a privacy and employment assessment for your jurisdiction, confirm
> the lawful basis, give notice, document consent or authorisation where required, and
> offer a non-biometric alternative. Recognition is probabilistic: match scores are a
> system signal, not proof of identity. Do not use these records as the sole basis for
> consequential employment decisions. This README is technical guidance, not legal advice.

---

## Contents

1. [What's included](#whats-included)
2. [Architecture](#architecture)
3. [Quick start (Windows)](#quick-start-windows)
4. [Quick start (Linux)](#quick-start-linux)
5. [Running the recognition service](#running-the-recognition-service)
6. [Configuration reference](#configuration-reference)
7. [Tests and quality checks](#tests-and-quality-checks)
8. [Production deployment](#production-deployment)
9. [Backup and restore](#backup-and-restore)
10. [Troubleshooting](#troubleshooting)
11. [Decisions still needed before a pilot](#decisions-still-needed-before-a-pilot)

---

## What's included

**Public pages:** landing page, sign in, password recovery and reset, access denied.

**Administrator console** (`/admin/*`):
- Dashboard with live employee totals, today's arrivals, review queue, a 14-day trend, camera and service status.
- Employees: search, filters, pagination, CSV export, create/edit, activate/deactivate (with reason), delete (only if there's no history), portal account creation.
- Guided face enrollment: notice and consent step, browser webcam or IP-camera capture, 7 poses, per-sample quality feedback, re-enrollment, revocation with permanent template deletion.
- Cameras: RTSP, HTTP/MJPEG or a USB device; encrypted write-only passwords; real connection tests; health computed from frames actually received.
- Attendance: filter by date range, employee, camera, status and source; record details with correction history and audit trail; manual entry fallback; CSV export.
- Reviews: uncertain/unknown camera observations (confirm or reject) and employee correction requests (approve or reject).
- Reports: daily and monthly, with CSV export. Lateness and absence are calculated **only** after an attendance schedule is configured.
- Audit log: append-only, filterable, exportable.
- Settings: account, security (password, sessions, staff accounts), attendance policy and recognition thresholds, privacy notice, retention, backup, system status.

**Employee portal** (`/employee/*`): overview, own attendance history and record details,
correction requests, profile and privacy notice, contact details, password and sessions.

**Roles** (enforced on the server for every endpoint):

| Role | Access |
|---|---|
| Administrator | Everything |
| Operator | Read-only console: dashboard, attendance, employees, cameras (incl. connection tests), reports, review queue, system status |
| Employee | Own records and account only |

**MVP attendance rules** (SDLC 9.2/9.3):
- IN events only, from cameras marked as entrance. A repeated sighting never becomes an OUT event.
- At most one confirmed IN per employee per workplace day, enforced by a database constraint. Later sightings increase a sighting counter.
- Low-quality faces are skipped. Ambiguous or below-threshold matches go to human review; they are never assigned automatically.
- Every correction stores who, when, why and the before/after values.

---

## Architecture

```
IP camera ──RTSP──▶ Recognition worker ──▶ Attendance rules ──▶ PostgreSQL ◀── Django REST API ◀── React app
(local LAN)         manage.py run_recognition   (dedup, review)                 (session + CSRF)    (browser)
                    YuNet detect → quality → SFace embed → match encrypted templates
```

- **`backend/`**: Django project (`config/`) and apps:
  `accounts` (users, roles, auth), `employees`, `cameras`, `recognition` (enrollment, engine, worker),
  `attendance` (events, review, corrections), `reports`, `audit`, `settings_app` (policy, retention, backups, health).
- **`frontend/`**: React app (`src/app` router, `src/components/ui` design system, `src/features/*` pages, `src/layouts`, `src/lib` API client).
- The recognition worker is a separate process from the web server. It shares the database and attendance business logic but no web endpoints.
- Camera frames and enrollment images are processed in memory and discarded. Only encrypted 128-dimension templates are stored (Fernet, key in `SMARTFACE_ENCRYPTION_KEY`).

---

## Quick start (Windows)

Prerequisites: Python 3.12+, Node.js 20+ (tested with 24), PostgreSQL 17 running with the `SmartFace` database.

### 1. Backend

```powershell
cd backend

py -m venv .venv
.\.venv\Scripts\Activate.ps1          # see "PowerShell execution policy" below if this is blocked

python -m pip install --upgrade pip
pip install -r requirements.txt

Copy-Item .env.example .env            # skip if backend\.env already exists
```

Edit `backend\.env`:

- `DB_PASSWORD`: your real PostgreSQL password.
- `DJANGO_SECRET_KEY`: a long random value: `python -c "import secrets; print(secrets.token_urlsafe(50))"`
- `SMARTFACE_ENCRYPTION_KEY`: `python manage.py generate_encryption_key`
- For development set `DJANGO_DEBUG=True`.

> A development `backend\.env` has already been created with a generated secret key and
> encryption key, `DJANGO_DEBUG=True` and a **placeholder** database password. Replace
> `DB_PASSWORD` with your real password; nothing else needs to change for development.

Download the face models (one time, ~39 MB, verified by SHA-256):

```powershell
python scripts\download_models.py
```

Check the configuration and **inspect the existing database before migrating**:

```powershell
python manage.py check
python manage.py showmigrations        # what Django thinks is applied in SmartFace
python manage.py migrate               # creates SmartFace's tables; never drops the database
```

`makemigrations` is only needed if you change models; the initial migrations are included.
If `showmigrations` or `migrate` reports existing tables with conflicting names (for example
from an earlier, unrelated project in the same database), stop and review them. Don't
drop anything you haven't inspected.

Create the first administrator (prompts for the password; it's never passed on the command line):

```powershell
python manage.py create_admin --username admin --email you@example.com --first-name Your --last-name Name
```

(`python manage.py createsuperuser` also works and creates an administrator.)

Start the API:

```powershell
python manage.py runserver
```

### 2. Frontend

In a second terminal:

```powershell
cd frontend
npm install
Copy-Item .env.example .env            # skip if frontend\.env already exists
npm run dev
```

Open **http://localhost:5173**. The Vite dev server proxies `/api` to Django at
`127.0.0.1:8000`, so session and CSRF cookies are same-origin.

### 3. Recognition worker

In a third terminal (with the virtual environment active):

```powershell
cd backend
python manage.py run_recognition
```

### PowerShell execution policy

If `Activate.ps1` is blocked, allow scripts **for the current PowerShell window only**:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
```

Or skip activation and call the interpreter directly, e.g. `.\.venv\Scripts\python.exe manage.py runserver`.
Avoid changing the machine-wide policy.

---

## Quick start (Linux)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip && pip install -r requirements.txt
cp .env.example .env          # then edit DB_PASSWORD, DJANGO_SECRET_KEY, SMARTFACE_ENCRYPTION_KEY
python scripts/download_models.py
python manage.py check && python manage.py showmigrations && python manage.py migrate
python manage.py create_admin --username admin --email you@example.com
python manage.py runserver &               # API
python manage.py run_recognition &         # worker

cd ../frontend && npm install && cp .env.example .env && npm run dev
```

On a headless server, `opencv-python-headless` is already used (no GUI libraries required).

---

## Running the recognition service

1. Add the entrance camera under **Cameras → Add camera** (`rtsp://…` without credentials; enter the username and password in their fields). Use **Test connection** to confirm a frame can be read.
2. For testing without an IP camera, choose **Local video device** with index `0` to use a webcam attached to the server.
3. Enroll employees under **Employees → (employee) → Start enrollment**.
4. Run `python manage.py run_recognition`. The worker:
   - processes every active IN camera in its own thread and reconnects with back-off;
   - samples a frame every `frame_sample_interval_ms` (default 500 ms);
   - skips faces that fail quality checks (size, sharpness, brightness, detection score);
   - matches against active employees only (deactivation takes effect within 10 s);
   - records camera health and a heartbeat every few seconds. The dashboard shows "Stopped" if no heartbeat arrives for 45 s.

**Thresholds are starting points, not validated values.** The defaults (match 0.50, review
0.36, margin 0.06, cosine similarity) are deliberately conservative. Measure false-accept and
false-reject rates on consented pilot data in your real lighting and camera position, then
adjust under **Settings → Attendance & recognition**.

---

## Configuration reference

`backend/.env` (template: `backend/.env.example`):

| Variable | Purpose |
|---|---|
| `DJANGO_SECRET_KEY` | Required when `DJANGO_DEBUG=False` |
| `DJANGO_DEBUG` | `False` in production |
| `DJANGO_ALLOWED_HOSTS` | Host names that serve SmartFace |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` | PostgreSQL connection |
| `CORS_ALLOWED_ORIGINS` | Only needed when the frontend runs on a different origin |
| `CSRF_TRUSTED_ORIGINS` | Defaults to `CORS_ALLOWED_ORIGINS`; add your HTTPS origin in production |
| `TIME_ZONE` | Workplace timezone (default `Africa/Kigali`). Timestamps are stored in UTC |
| `FRONTEND_URL` | Base URL used in password-reset emails |
| `SMARTFACE_ENCRYPTION_KEY` | Fernet key for templates and camera passwords. **Back it up separately** |
| `FACE_MODELS_DIR` | Where the `.onnx` models live (default `backend/models`) |
| `BACKUP_DIR`, `PG_DUMP_PATH` | Backup destination and `pg_dump` executable |
| `EMAIL_*`, `DEFAULT_FROM_EMAIL` | SMTP for password recovery (console output by default) |
| `SECURE_COOKIES`, `SECURE_SSL_REDIRECT`, `USE_X_FORWARDED_PROTO`, `SECURE_HSTS_SECONDS` | HTTPS settings |
| `LOGIN_MAX_FAILED_ATTEMPTS`, `LOGIN_LOCKOUT_MINUTES` | Account lockout (default 5 attempts / 15 minutes) |

`frontend/.env` (template: `frontend/.env.example`): only `VITE_API_BASE_URL` (default
`/api/v1`). Never put secrets in `VITE_*` variables; they're compiled into the public bundle.

> **About `VITE_API_BASE_URL`.** The default is the same-origin path `/api/v1` (proxied in
> development, served by Django in production). Pointing it directly at
> `http://127.0.0.1:8000/api/v1` also works, but only if you open the app at
> `http://127.0.0.1:5173`. Opening `localhost:5173` against an API on `127.0.0.1` is
> cross-site, so browsers withhold the session cookie.

---

## Tests and quality checks

Backend (from `backend/`):

```powershell
python manage.py test tests                    # uses a throwaway test_SmartFace database on PostgreSQL
$env:TEST_USE_SQLITE="1"; python manage.py test tests   # same suite without PostgreSQL
python manage.py check --deploy                # with production .env values
python manage.py makemigrations --check --dry-run
```

The 60 backend tests cover authentication, lockout, CSRF, password reset, role permissions,
employee CRUD, camera credential handling, attendance deduplication, review, corrections with
audit data, the employee portal's data isolation, reports with and without a schedule, CSV
exports, template encryption, gallery matching and the enrollment pipeline (using the real
models when installed).

Frontend (from `frontend/`):

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

---

## Production deployment

See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** for the full guide (Windows service and Linux systemd,
HTTPS reverse proxy, hardening checklist). In short:

1. `npm run build` in `frontend/`. Django serves `frontend/dist` itself, so the app and API share one origin.
2. Set `DJANGO_DEBUG=False`, a strong `DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS=https://your-host`.
3. `python manage.py collectstatic --noinput && python manage.py migrate`.
4. Run the app with **Waitress** (Windows) or **Gunicorn** (Linux), never `runserver`, behind an HTTPS reverse proxy.
5. Run `python manage.py run_recognition` as a second service.
6. Schedule `backup_db` and `apply_retention` daily.

---

## Backup and restore

- **Backup now:** *Settings → Backup → Back up now*, or `python manage.py backup_db`. Uses `pg_dump --format=custom` into `BACKUP_DIR` (default `backend/backups`).
- **Schedule:** run `python manage.py backup_db` daily (Task Scheduler / cron). Copy backups off the server to encrypted storage with restricted access.
- **Encryption key:** store `SMARTFACE_ENCRYPTION_KEY` separately from the backups. Without it, restored templates and camera passwords can't be decrypted, and employees must re-enroll.
- **Restore** (stop the web server and worker first; this replaces the current data):

```powershell
& "C:\Program Files\PostgreSQL\17\bin\pg_restore.exe" --clean --if-exists --no-owner `
  -h 127.0.0.1 -U postgres -d SmartFace backups\smartface-YYYYMMDD-HHMMSS.dump
python manage.py migrate
```

- Test a restore on a separate machine periodically. Retention deletions aren't applied to old backups until those backups expire. Rotate backups to match your retention policy.

---

## Troubleshooting

**`password authentication failed for user "postgres"` / `fe_sendauth: no password supplied`**
`DB_PASSWORD` in `backend/.env` is wrong or still the placeholder. Put the correct password
there (no quotes needed) and retry `python manage.py check`. Test the same credentials with
`psql -h 127.0.0.1 -U postgres -d SmartFace`. SmartFace never changes database users or
passwords. If you've forgotten the password, reset it yourself using PostgreSQL's
documented procedure.

**`database "SmartFace" does not exist`.** PostgreSQL names are case-sensitive when created with quotes. Check with `psql -l` and match `DB_NAME` exactly.

**Dashboard says "Encryption key missing".** Set `SMARTFACE_ENCRYPTION_KEY` and restart the server and worker.

**Dashboard says "Face models not installed".** Run `python scripts/download_models.py`, or copy the two `.onnx` files into `backend/models/` on an offline machine.

**Camera test fails.** Confirm the URL in VLC from the server, check the camera's RTSP port (usually 554), that the account has view permission, and that the server can reach the camera VLAN. Credentials must go in the username and password fields, not in the URL.

**Browser webcam not available during enrollment.** Browsers only allow camera access on `https://` or `localhost`. Use HTTPS in production, or capture from a configured camera instead.

**Login works but every action says the session ended.** You're probably mixing `localhost` and `127.0.0.1`. Use the default `VITE_API_BASE_URL=/api/v1`.

---

## Decisions still needed before a pilot

From SDLC section 16. The software supports these, but your organisation must decide them:

1. Employee and camera counts, peak traffic and server hardware (load-test the worker on the target machine).
2. Attendance policy: schedule, grace period, workdays (enter in Settings before enabling lateness/absence), overnight shifts, correction approvals.
3. Privacy/employment requirements: lawful basis, notice text (Settings → Privacy), alternatives, retention periods (Settings → Retention), employee access rights.
4. Pilot methodology, acceptable error rates and stop criteria for the recognition thresholds.
5. Whether raw frames may ever be retained for review (the system currently never stores them).
6. Hosting OS, network segmentation for cameras, administrator roles, backup target and maintenance owner.

Not in this release (planned per SDLC section 13): OUT cameras and OUT events, multi-site
operation, liveness/anti-spoofing checks, MFA.
