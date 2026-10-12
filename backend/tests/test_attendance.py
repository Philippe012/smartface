from datetime import time, timedelta

from django.test import TestCase
from django.utils import timezone

from apps.attendance.models import AttendanceEvent, CorrectionRequest
from apps.attendance.services import record_observation
from apps.audit.models import AuditEvent
from apps.settings_app.models import SystemSettings

from .helpers import client_for, local_dt, make_camera, make_employee, make_user

API = "/api/v1"


def observe(camera, outcome="matched", employee=None, similarity=0.7, at=None):
    return record_observation(camera=camera, outcome=outcome, employee_id=employee.id if employee else None,
                              similarity=similarity, quality=0.9, model_version="test", occurred_at=at)


class RecordObservationTests(TestCase):
    def setUp(self):
        self.camera = make_camera()
        self.emp = make_employee()

    def test_first_match_creates_in_event(self):
        event, action = observe(self.camera, employee=self.emp)
        self.assertEqual(action, "created")
        self.assertEqual(event.status, "confirmed")
        self.assertEqual(event.direction, "IN")

    def test_repeated_sightings_are_suppressed_not_turned_into_out(self):
        first, _ = observe(self.camera, employee=self.emp)
        for minutes in (1, 30, 240):
            event, action = observe(self.camera, employee=self.emp, at=timezone.now() + timedelta(minutes=minutes))
            self.assertEqual(action, "duplicate")
            self.assertEqual(event.id, first.id)
        self.assertEqual(AttendanceEvent.objects.count(), 1)
        self.assertFalse(AttendanceEvent.objects.filter(direction="OUT").exists())
        first.refresh_from_db()
        self.assertEqual(first.sighting_count, 4)

    def test_new_day_creates_new_event(self):
        observe(self.camera, employee=self.emp, at=local_dt(2026, 3, 2, 8))
        _, action = observe(self.camera, employee=self.emp, at=local_dt(2026, 3, 3, 8))
        self.assertEqual(action, "created")

    def test_uncertain_creates_single_merged_review_item(self):
        e1, a1 = observe(self.camera, "uncertain", self.emp, similarity=0.40)
        e2, a2 = observe(self.camera, "uncertain", self.emp, similarity=0.42)
        self.assertEqual((a1, a2), ("review_created", "review_merged"))
        self.assertEqual(e1.id, e2.id)
        e1.refresh_from_db()
        self.assertEqual(e1.status, "pending_review")
        self.assertIsNone(e1.employee_id)  # never assigned automatically
        self.assertEqual(e1.candidate_employee_id, self.emp.id)
        self.assertAlmostEqual(e1.confidence, 0.42)

    def test_unknown_faces_can_be_disabled(self):
        _, action = observe(self.camera, "unknown")
        self.assertEqual(action, "review_created")
        cfg = SystemSettings.load()
        cfg.record_unknown_faces = False
        cfg.save()
        AttendanceEvent.objects.all().delete()
        _, action = observe(self.camera, "unknown")
        self.assertEqual(action, "ignored")

    def test_out_camera_never_creates_events(self):
        out_cam = make_camera("Exit", direction="OUT")
        self.assertEqual(observe(out_cam, employee=self.emp)[1], "ignored")


class ReviewAndCorrectionTests(TestCase):
    def setUp(self):
        self.admin = make_user("admin")
        self.client = client_for(self.admin)
        self.camera = make_camera()
        self.emp = make_employee()

    def test_manual_entry_and_conflict(self):
        when = timezone.now() - timedelta(hours=1)
        payload = {"employee_id": self.emp.id, "occurred_at": when.isoformat(), "reason": "Camera offline"}
        res = self.client.post(f"{API}/attendance/manual", payload, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["source"], "manual")
        res = self.client.post(f"{API}/attendance/manual", payload, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertTrue(AuditEvent.objects.filter(action="attendance.manual_entry", reason="Camera offline").exists())

    def test_manual_entry_rejects_future_time(self):
        payload = {"employee_id": self.emp.id, "occurred_at": (timezone.now() + timedelta(days=1)).isoformat(),
                   "reason": "x"}
        self.assertEqual(self.client.post(f"{API}/attendance/manual", payload, format="json").status_code, 400)

    def test_review_confirm_assigns_employee(self):
        event, _ = observe(self.camera, "uncertain", self.emp, similarity=0.4)
        res = self.client.post(f"{API}/attendance/{event.id}/review",
                               {"decision": "confirm", "employee_id": self.emp.id, "reason": "Verified at desk"})
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["status"], "confirmed")
        self.assertEqual(res.data["match_status"], "reviewed")
        # Second review is refused.
        res = self.client.post(f"{API}/attendance/{event.id}/review", {"decision": "reject", "reason": "x"})
        self.assertEqual(res.status_code, 400)

    def test_review_reject(self):
        event, _ = observe(self.camera, "unknown")
        res = self.client.post(f"{API}/attendance/{event.id}/review", {"decision": "reject", "reason": "Visitor"})
        self.assertEqual(res.data["status"], "rejected")

    def test_correction_records_actor_reason_before_after(self):
        event, _ = observe(self.camera, employee=self.emp, at=timezone.now() - timedelta(minutes=30))
        new_time = timezone.now() - timedelta(minutes=90)
        res = self.client.post(f"{API}/attendance/{event.id}/corrections",
                               {"occurred_at": new_time.isoformat(), "reason": "Arrived earlier"}, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        audit = AuditEvent.objects.get(action="attendance.correct")
        self.assertEqual(audit.actor, self.admin)
        self.assertEqual(audit.reason, "Arrived earlier")
        self.assertNotEqual(audit.changes["before"]["occurred_at"], audit.changes["after"]["occurred_at"])
        correction = CorrectionRequest.objects.get(event=event)
        self.assertEqual(correction.status, "approved")
        self.assertEqual(correction.decided_by, self.admin)
        detail = self.client.get(f"{API}/attendance/{event.id}").data
        self.assertEqual(len(detail["corrections"]), 1)
        self.assertTrue(detail["history"])

    def test_void_correction(self):
        event, _ = observe(self.camera, employee=self.emp)
        res = self.client.post(f"{API}/attendance/{event.id}/corrections", {"void": True, "reason": "Wrong person"})
        self.assertEqual(res.data["status"], "rejected")
        # A fresh confirmed record for the same day is possible again.
        _, action = observe(self.camera, employee=self.emp)
        self.assertEqual(action, "created")

    def test_audit_events_are_append_only(self):
        event = AuditEvent.objects.create(action="x")
        event.action = "y"
        with self.assertRaises(ValueError):
            event.save()


class EmployeePortalTests(TestCase):
    def setUp(self):
        self.camera = make_camera()
        self.ada = make_employee("EMP001", "Ada", "Lovelace")
        self.bob = make_employee("EMP002", "Bob", "Builder")
        self.client = client_for(make_user("ada", role="employee", employee=self.ada))
        self.admin_client = client_for(make_user("admin"))
        self.ada_event, _ = observe(self.camera, employee=self.ada)
        self.bob_event, _ = observe(self.camera, employee=self.bob)

    def test_employee_sees_only_own_records(self):
        res = self.client.get(f"{API}/me/attendance")
        self.assertEqual([r["id"] for r in res.data["results"]], [self.ada_event.id])
        self.assertEqual(self.client.get(f"{API}/me/attendance/{self.bob_event.id}").status_code, 404)
        self.assertEqual(self.client.get(f"{API}/me/attendance/{self.ada_event.id}").status_code, 200)

    def test_employee_cannot_filter_into_other_records(self):
        res = self.client.get(f"{API}/me/attendance", {"employee": self.bob.id})
        self.assertEqual([r["id"] for r in res.data["results"]], [self.ada_event.id])

    def test_cannot_request_correction_for_someone_else(self):
        res = self.client.post(f"{API}/me/correction-requests",
                               {"kind": "not_me", "event_id": self.bob_event.id, "reason": "x"})
        self.assertEqual(res.status_code, 400)

    def test_correction_request_approval_flow(self):
        when = timezone.now() - timedelta(hours=2)
        res = self.client.post(f"{API}/me/correction-requests",
                               {"kind": "wrong_time", "event_id": self.ada_event.id,
                                "requested_time": when.isoformat(), "reason": "I arrived earlier"}, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        req_id = res.data["id"]
        res = self.admin_client.post(f"{API}/correction-requests/{req_id}/decide", {"approve": True, "note": "OK"})
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["status"], "approved")
        self.assertTrue(res.data["before"])
        self.ada_event.refresh_from_db()
        self.assertEqual(self.ada_event.occurred_at, when)

    def test_missing_attendance_request_creates_manual_event(self):
        yesterday = timezone.now() - timedelta(days=1)
        res = self.client.post(f"{API}/me/correction-requests",
                               {"kind": "missing", "requested_time": yesterday.isoformat(), "reason": "Camera was down"},
                               format="json")
        self.assertEqual(res.status_code, 201, res.data)
        self.admin_client.post(f"{API}/correction-requests/{res.data['id']}/decide", {"approve": True})
        self.assertTrue(AttendanceEvent.objects.filter(employee=self.ada, source="manual").exists())

    def test_summary(self):
        res = self.client.get(f"{API}/me/summary")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["today"]["id"], self.ada_event.id)
        self.assertFalse(res.data["enrollment"]["enrolled"])


class ReportTests(TestCase):
    def setUp(self):
        self.client = client_for(make_user("admin"))
        self.camera = make_camera()
        self.early = make_employee("E1", "Early", "Bird")
        self.late = make_employee("E2", "Late", "Comer")
        self.absent = make_employee("E3", "Not", "Here")
        self.day = local_dt(2026, 3, 2, 0).date()  # a Monday
        observe(self.camera, employee=self.early, at=local_dt(2026, 3, 2, 7, 55))
        observe(self.camera, employee=self.late, at=local_dt(2026, 3, 2, 9, 30))

    def test_no_lateness_or_absence_without_configured_policy(self):
        res = self.client.get(f"{API}/reports/daily", {"date": self.day.isoformat()})
        self.assertFalse(res.data["policy"]["configured"])
        states = {r["employee"]["employee_number"]: r["state"] for r in res.data["rows"]}
        self.assertEqual(states, {"E1": "present", "E2": "present", "E3": "no_record"})

    def test_lateness_and_absence_with_policy(self):
        cfg = SystemSettings.load()
        cfg.schedule_configured = True
        cfg.work_start_time = time(8, 0)
        cfg.grace_minutes = 10
        cfg.save()
        res = self.client.get(f"{API}/reports/daily", {"date": self.day.isoformat()})
        states = {r["employee"]["employee_number"]: r["state"] for r in res.data["rows"]}
        self.assertEqual(states, {"E1": "on_time", "E2": "late", "E3": "absent"})
        monthly = self.client.get(f"{API}/reports/monthly", {"month": "2026-03"}).data
        row = next(r for r in monthly["rows"] if r["employee"]["employee_number"] == "E2")
        self.assertEqual((row["days_present"], row["late_days"]), (1, 1))

    def test_csv_exports_and_dashboard(self):
        res = self.client.get(f"{API}/reports/daily/export", {"date": self.day.isoformat()})
        self.assertIn("E1", res.content.decode())
        res = self.client.get(f"{API}/reports/monthly/export", {"month": "2026-03"})
        self.assertEqual(res.status_code, 200)
        res = self.client.get(f"{API}/attendance/export", {"from": "2026-03-01", "to": "2026-03-31"})
        self.assertEqual(len(res.content.decode().strip().splitlines()), 3)
        dash = self.client.get(f"{API}/dashboard").data
        self.assertEqual(dash["employees"]["active"], 3)
        self.assertEqual(dash["cameras"][0]["health"], "never_connected")
        self.assertEqual(dash["services"]["worker"]["state"], "not_started")

    def test_invalid_report_params(self):
        self.assertEqual(self.client.get(f"{API}/reports/daily", {"date": "nope"}).status_code, 400)
        self.assertEqual(self.client.get(f"{API}/reports/monthly", {"month": "2026-13"}).status_code, 400)
