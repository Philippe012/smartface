import re

from django.core import mail
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.audit.models import AuditEvent

from .helpers import PASSWORD, client_for, make_employee, make_user

API = "/api/v1"


class LoginTests(TestCase):
    def setUp(self):
        self.client = APIClient(enforce_csrf_checks=True)
        self.admin = make_user("admin")

    def login(self, username="admin", password=PASSWORD):
        return self.client.post(f"{API}/auth/session", {"username": username, "password": password}, format="json")

    def test_login_success_returns_profile_and_audits(self):
        res = self.login()
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["role"], "admin")
        self.assertNotIn("password", res.data)
        self.assertTrue(AuditEvent.objects.filter(action="auth.login").exists())

    def test_login_is_case_insensitive_on_username(self):
        self.assertEqual(self.login("ADMIN").status_code, 200)

    def test_wrong_password_rejected_and_audited(self):
        res = self.login(password="wrong-password")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data["detail"], "Incorrect username or password.")
        self.assertTrue(AuditEvent.objects.filter(action="auth.login_failed").exists())

    @override_settings(LOGIN_MAX_FAILED_ATTEMPTS=3)
    def test_lockout_after_repeated_failures(self):
        for _ in range(3):
            self.login(password="nope")
        res = self.login()  # even the correct password is refused while locked
        self.assertEqual(res.status_code, 403)
        self.assertIn("Too many failed attempts", res.data["detail"])

    def test_inactive_user_cannot_login(self):
        self.admin.is_active = False
        self.admin.save()
        self.assertEqual(self.login().status_code, 400)

    def test_unauthenticated_access_denied(self):
        self.assertEqual(self.client.get(f"{API}/auth/me").status_code, 403)
        self.assertEqual(self.client.get(f"{API}/employees").status_code, 403)

    def test_csrf_enforced_for_authenticated_unsafe_requests(self):
        self.login()
        res = self.client.post(f"{API}/employees", {"employee_number": "E1", "first_name": "A", "last_name": "B"},
                               format="json")
        self.assertEqual(res.status_code, 403)
        token = self.client.get(f"{API}/auth/csrf").data["csrfToken"]
        res = self.client.post(f"{API}/employees", {"employee_number": "E1", "first_name": "A", "last_name": "B"},
                               format="json", HTTP_X_CSRFTOKEN=token)
        self.assertEqual(res.status_code, 201)

    def test_logout(self):
        self.login()
        token = self.client.get(f"{API}/auth/csrf").data["csrfToken"]
        self.assertEqual(self.client.delete(f"{API}/auth/session", HTTP_X_CSRFTOKEN=token).status_code, 204)
        self.assertEqual(self.client.get(f"{API}/auth/me").status_code, 403)


class AccountTests(TestCase):
    def test_password_change_requires_current_password(self):
        user = make_user("ops", role="operator")
        client = client_for(user)
        res = client.post(f"{API}/auth/password/change", {"current_password": "bad", "new_password": "N3w-Secret-Pass"})
        self.assertEqual(res.status_code, 400)
        res = client.post(f"{API}/auth/password/change", {"current_password": PASSWORD, "new_password": "N3w-Secret-Pass"})
        self.assertEqual(res.status_code, 200)
        user.refresh_from_db()
        self.assertTrue(user.check_password("N3w-Secret-Pass"))

    def test_weak_password_rejected(self):
        client = client_for(make_user("ops", role="operator"))
        res = client.post(f"{API}/auth/password/change", {"current_password": PASSWORD, "new_password": "12345"})
        self.assertEqual(res.status_code, 400)
        self.assertIn("new_password", res.data["errors"])

    def test_password_reset_flow(self):
        user = make_user("resetme")
        client = APIClient()
        res = client.post(f"{API}/auth/password/reset", {"email": "resetme@example.test"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        uid, token = re.search(r"uid=([^&]+)&token=(\S+)", mail.outbox[0].body).groups()
        res = client.post(f"{API}/auth/password/reset/confirm", {"uid": uid, "token": token, "new_password": "Brand-New-Pass-9"})
        self.assertEqual(res.status_code, 200)
        user.refresh_from_db()
        self.assertTrue(user.check_password("Brand-New-Pass-9"))
        # Token cannot be reused once the password changed.
        res = client.post(f"{API}/auth/password/reset/confirm", {"uid": uid, "token": token, "new_password": "Another-Pass-77"})
        self.assertEqual(res.status_code, 400)

    def test_reset_for_unknown_email_gives_same_response(self):
        res = APIClient().post(f"{API}/auth/password/reset", {"email": "nobody@example.test"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(mail.outbox), 0)

    def test_employee_cannot_rename_self_but_can_update_email(self):
        emp = make_employee()
        client = client_for(make_user("ada", role="employee", employee=emp))
        self.assertEqual(client.patch(f"{API}/auth/me", {"first_name": "Eve"}).status_code, 400)
        res = client.patch(f"{API}/auth/me", {"email": "ada@new.test", "phone": "+250700000000"})
        self.assertEqual(res.status_code, 200)
        emp.refresh_from_db()
        self.assertEqual(emp.phone, "+250700000000")


class RolePermissionTests(TestCase):
    def setUp(self):
        self.emp = make_employee()
        self.employee_client = client_for(make_user("ada", role="employee", employee=self.emp))
        self.operator_client = client_for(make_user("ops", role="operator"))

    def test_employee_blocked_from_admin_endpoints(self):
        for path in ("/employees", "/attendance", "/cameras", "/dashboard", "/audit-events", "/settings",
                     "/correction-requests", "/reports/daily", "/staff-users"):
            self.assertEqual(self.employee_client.get(API + path).status_code, 403, path)

    def test_operator_can_read_but_not_change_employees(self):
        self.assertEqual(self.operator_client.get(f"{API}/employees").status_code, 200)
        res = self.operator_client.post(f"{API}/employees", {"employee_number": "X", "first_name": "A", "last_name": "B"})
        self.assertEqual(res.status_code, 403)
        self.assertEqual(self.operator_client.get(f"{API}/audit-events").status_code, 403)

    def test_staff_cannot_use_employee_portal(self):
        self.assertEqual(self.operator_client.get(f"{API}/me/attendance").status_code, 403)
