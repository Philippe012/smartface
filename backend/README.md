# SmartFace backend

Django 5.2 + Django REST Framework API, PostgreSQL storage and the local recognition worker.
See the [project README](../README.md) for setup, and [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md) for production.

## Apps

| App | Responsibility |
|---|---|
| `accounts` | Custom user model with roles (admin, operator, employee), session login, lockout, password change/reset, staff accounts, `create_admin` command |
| `employees` | Employee records, activation, portal accounts, CSV export |
| `cameras` | Camera configuration, encrypted stream passwords, OpenCV capture helpers, connection tests |
| `recognition` | Enrollment sessions, encrypted face templates, YuNet/SFace engine, gallery matching, `run_recognition` worker |
| `attendance` | Attendance events, deduplication rules, review, manual entry, corrections, employee portal endpoints |
| `reports` | Dashboard summary, daily/monthly reports, CSV exports |
| `audit` | Append-only audit log |
| `settings_app` | System settings (policy, thresholds, privacy, retention), heartbeats, backups, retention, health |

## Management commands

| Command | Purpose |
|---|---|
| `create_admin --username U [--email E]` | Create an administrator (password prompted, or `SMARTFACE_ADMIN_PASSWORD` for unattended setup) |
| `generate_encryption_key` | Print a new `SMARTFACE_ENCRYPTION_KEY` |
| `run_recognition [--camera ID]` | Run the recognition worker |
| `backup_db` | `pg_dump` the database into `BACKUP_DIR` |
| `apply_retention [--dry-run]` | Delete data past its retention period |

## API (all under `/api/v1`)

| Area | Endpoints |
|---|---|
| Auth | `GET auth/csrf`, `POST/DELETE auth/session`, `GET/PATCH auth/me`, `POST auth/password/change`, `POST auth/password/reset`, `POST auth/password/reset/confirm`, `GET/DELETE auth/sessions` |
| Staff | `GET/POST staff-users`, `PATCH staff-users/{id}` |
| Employees | `GET/POST employees`, `GET/PATCH/DELETE employees/{id}`, `POST employees/{id}/activate`, `POST employees/{id}/deactivate`, `POST/DELETE employees/{id}/account`, `GET employees/departments`, `GET employees/export` |
| Enrollment | `GET/POST employees/{id}/enrollments`, `GET enrollments/{id}`, `POST enrollments/{id}/samples` (multipart), `POST enrollments/{id}/capture`, `DELETE enrollments/{id}/samples/{sid}`, `POST enrollments/{id}/complete`, `POST enrollments/{id}/cancel`, `POST employees/{id}/biometrics/erase`, `GET recognition/status` |
| Cameras | `GET/POST cameras`, `GET/PATCH/DELETE cameras/{id}`, `POST cameras/{id}/test` |
| Attendance | `GET attendance`, `GET attendance/{id}`, `GET attendance/export`, `POST attendance/manual`, `POST attendance/{id}/review`, `POST attendance/{id}/corrections`, `GET attendance/review-counts` |
| Corrections | `GET correction-requests`, `POST correction-requests/{id}/decide` |
| Employee portal | `GET me/summary`, `GET me/attendance`, `GET me/attendance/{id}`, `GET/POST me/correction-requests`, `POST me/correction-requests/{id}/cancel` |
| Reports | `GET dashboard`, `GET reports/daily[/export]`, `GET reports/monthly[/export]` |
| Audit | `GET audit-events`, `GET audit-events/export` |
| Settings | `GET/PATCH settings`, `GET settings/system-status`, `GET/POST settings/backups`, `GET/POST settings/retention`, `GET health` (public) |

Errors use `{"detail": "...", "errors": {"field": ["message"]}}`. Lists are paginated
(`?page=&page_size=`, max 100).

## Tests

```powershell
python manage.py test tests                     # PostgreSQL (creates and drops test_SmartFace)
$env:TEST_USE_SQLITE="1"; python manage.py test tests
```
