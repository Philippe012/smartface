from django.test import TestCase

from apps.audit.models import AuditEvent
from apps.cameras.models import Camera

from .helpers import client_for, make_camera, make_employee, make_user

API = "/api/v1"


class EmployeeCrudTests(TestCase):
    def setUp(self):
        self.client = client_for(make_user("admin"))

    def test_create_list_update(self):
        res = self.client.post(f"{API}/employees", {"employee_number": " emp010 ", "first_name": "Grace",
                                                    "last_name": "Hopper", "department": "Engineering"})
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["employee_number"], "EMP010")
        self.assertFalse(res.data["enrollment"]["enrolled"])
        emp_id = res.data["id"]

        res = self.client.get(f"{API}/employees", {"search": "hopp"})
        self.assertEqual(res.data["count"], 1)

        res = self.client.patch(f"{API}/employees/{emp_id}", {"position": "Lead"})
        self.assertEqual(res.data["position"], "Lead")
        update = AuditEvent.objects.get(action="employee.update")
        self.assertEqual(update.changes["position"], {"before": "", "after": "Lead"})

    def test_duplicate_employee_number_rejected(self):
        make_employee("EMP001")
        res = self.client.post(f"{API}/employees", {"employee_number": "emp001", "first_name": "A", "last_name": "B"})
        self.assertEqual(res.status_code, 400)
        self.assertIn("employee_number", res.data["errors"])

    def test_status_cannot_be_patched_directly(self):
        emp = make_employee()
        self.client.patch(f"{API}/employees/{emp.id}", {"status": "inactive"})
        emp.refresh_from_db()
        self.assertEqual(emp.status, "active")

    def test_deactivate_disables_portal_account(self):
        emp = make_employee()
        user = make_user("ada", role="employee", employee=emp)
        res = self.client.post(f"{API}/employees/{emp.id}/deactivate", {"reason": "Left company"})
        self.assertEqual(res.data["status"], "inactive")
        user.refresh_from_db()
        self.assertFalse(user.is_active)
        self.assertEqual(self.client.get(f"{API}/employees", {"status": "inactive"}).data["count"], 1)
        self.client.post(f"{API}/employees/{emp.id}/activate")
        user.refresh_from_db()
        self.assertTrue(user.is_active)

    def test_create_portal_account(self):
        emp = make_employee()
        res = self.client.post(f"{API}/employees/{emp.id}/account", {"username": "ada", "password": "Strong-Pass-123"})
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["account"]["username"], "ada")
        res = self.client.post(f"{API}/employees/{emp.id}/account", {"username": "ada2", "password": "Strong-Pass-123"})
        self.assertEqual(res.status_code, 409)

    def test_export_csv(self):
        make_employee()
        res = self.client.get(f"{API}/employees/export")
        self.assertEqual(res.status_code, 200)
        self.assertIn("text/csv", res["Content-Type"])
        self.assertIn("EMP001", res.content.decode())

    def test_pagination(self):
        for i in range(30):
            make_employee(f"E{i:03d}", last=f"L{i:03d}")
        res = self.client.get(f"{API}/employees", {"page_size": 10, "page": 2})
        self.assertEqual(res.data["count"], 30)
        self.assertEqual(len(res.data["results"]), 10)


class CameraTests(TestCase):
    def setUp(self):
        self.client = client_for(make_user("admin"))

    def test_password_is_write_only_and_encrypted(self):
        res = self.client.post(f"{API}/cameras", {
            "name": "Gate", "direction": "IN", "source_type": "rtsp",
            "stream_url": "rtsp://10.0.0.5:554/live", "stream_username": "viewer", "stream_password": "s3cret!",
        })
        self.assertEqual(res.status_code, 201, res.data)
        self.assertNotIn("stream_password", res.data)
        self.assertTrue(res.data["has_password"])
        cam = Camera.objects.get(pk=res.data["id"])
        self.assertNotIn("s3cret", cam.stream_password_encrypted)
        self.assertEqual(cam.capture_source(), "rtsp://viewer:s3cret%21@10.0.0.5:554/live")
        self.assertNotIn("s3cret", str(AuditEvent.objects.filter(action="camera.create").first().changes))
        # Blank password on update keeps the stored one.
        self.client.patch(f"{API}/cameras/{cam.id}", {"location": "North gate", "stream_password": ""})
        cam.refresh_from_db()
        self.assertTrue(cam.has_password)

    def test_credentials_in_url_rejected(self):
        res = self.client.post(f"{API}/cameras", {"name": "Bad", "source_type": "rtsp",
                                                  "stream_url": "rtsp://admin:pw@10.0.0.5/live"})
        self.assertEqual(res.status_code, 400)

    def test_out_direction_not_available_in_this_release(self):
        res = self.client.post(f"{API}/cameras", {"name": "Exit", "direction": "OUT", "source_type": "rtsp",
                                                  "stream_url": "rtsp://10.0.0.6/live"})
        self.assertEqual(res.status_code, 400)
        self.assertIn("direction", res.data["errors"])

    def test_new_camera_is_never_reported_online(self):
        cam = make_camera()
        res = self.client.get(f"{API}/cameras/{cam.id}")
        self.assertEqual(res.data["health"], "never_connected")
