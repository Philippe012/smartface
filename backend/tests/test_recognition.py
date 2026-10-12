from unittest import skipUnless

import cv2
import numpy as np
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase

from apps.recognition import engine
from apps.recognition.models import EnrollmentSession, FaceTemplate

from .helpers import client_for, make_employee, make_user

API = "/api/v1"


def unit(v):
    v = np.asarray(v, dtype=np.float32)
    return v / np.linalg.norm(v)


class GalleryMatchTests(TestCase):
    def setUp(self):
        rng = np.random.default_rng(1)
        self.a = unit(rng.normal(size=128))
        self.b = unit(rng.normal(size=128))
        self.gallery = engine.Gallery({1: np.vstack([self.a]), 2: np.vstack([self.b])})
        self.kw = {"match_threshold": 0.5, "uncertain_threshold": 0.36, "margin": 0.06}

    def test_clear_match(self):
        result = self.gallery.match(self.a, **self.kw)
        self.assertEqual((result.outcome, result.employee_id), ("matched", 1))

    def test_unrelated_face_is_unknown(self):
        other = unit(np.random.default_rng(7).normal(size=128))
        result = self.gallery.match(other, **self.kw)
        self.assertEqual(result.outcome, "unknown")
        self.assertIsNone(result.employee_id)

    def test_ambiguous_between_two_employees_is_uncertain(self):
        mixed = unit(self.a + self.b)
        result = self.gallery.match(mixed, **{**self.kw, "match_threshold": 0.6, "margin": 0.2})
        self.assertEqual(result.outcome, "uncertain")

    def test_empty_gallery(self):
        self.assertEqual(engine.Gallery({}).match(self.a, **self.kw).outcome, "unknown")


class TemplateProtectionTests(TestCase):
    def test_embedding_encrypted_at_rest_and_roundtrips(self):
        emp = make_employee()
        session = EnrollmentSession.objects.create(employee=emp, consent_confirmed=True)
        vec = unit(np.arange(128))
        t = FaceTemplate(employee=emp, session=session, model_version="test")
        t.set_embedding(vec)
        t.save()
        raw = bytes(FaceTemplate.objects.get(pk=t.pk).encrypted_embedding)
        self.assertNotEqual(raw, vec.tobytes())
        np.testing.assert_allclose(FaceTemplate.objects.get(pk=t.pk).get_embedding(), vec)

    def test_deactivated_employee_excluded_from_gallery(self):
        emp = make_employee()
        session = EnrollmentSession.objects.create(employee=emp, consent_confirmed=True)
        t = FaceTemplate(employee=emp, session=session, model_version="test", is_active=True)
        t.set_embedding(unit(np.ones(128)))
        t.save()
        self.assertEqual(len(engine.load_gallery()), 1)
        emp.set_status("inactive")
        emp.save()
        self.assertEqual(len(engine.load_gallery()), 0)


class EnrollmentApiTests(TestCase):
    def setUp(self):
        self.client = client_for(make_user("admin"))
        self.emp = make_employee()

    def test_consent_and_identity_required(self):
        res = self.client.post(f"{API}/employees/{self.emp.id}/enrollments",
                               {"consent_confirmed": False, "consent_method": "Signed form", "identity_verified": True})
        self.assertEqual(res.status_code, 400)

    @skipUnless(engine.models_installed(), "face models not downloaded")
    def test_enrollment_rejects_image_without_face_and_stores_nothing(self):
        res = self.client.post(f"{API}/employees/{self.emp.id}/enrollments",
                               {"consent_confirmed": True, "consent_method": "Signed form", "identity_verified": True})
        self.assertEqual(res.status_code, 201, res.data)
        session_id = res.data["id"]
        blank = np.full((480, 640, 3), 128, np.uint8)
        ok, jpg = cv2.imencode(".jpg", blank)
        upload = SimpleUploadedFile("frame.jpg", jpg.tobytes(), content_type="image/jpeg")
        res = self.client.post(f"{API}/enrollments/{session_id}/samples", {"image": upload, "pose": "front"},
                               format="multipart")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertFalse(res.data["accepted"])
        self.assertIn("No face detected", res.data["problems"][0])
        self.assertEqual(FaceTemplate.objects.count(), 0)
        # Completing without enough samples is refused.
        self.assertEqual(self.client.post(f"{API}/enrollments/{session_id}/complete").status_code, 400)
        self.assertEqual(self.client.post(f"{API}/enrollments/{session_id}/cancel").data["status"], "cancelled")

    def test_erase_biometrics_requires_reason_and_deletes(self):
        session = EnrollmentSession.objects.create(employee=self.emp, consent_confirmed=True)
        t = FaceTemplate(employee=self.emp, session=session, model_version="test", is_active=True)
        t.set_embedding(unit(np.ones(128)))
        t.save()
        self.assertEqual(self.client.post(f"{API}/employees/{self.emp.id}/biometrics/erase").status_code, 400)
        res = self.client.post(f"{API}/employees/{self.emp.id}/biometrics/erase", {"reason": "Consent withdrawn"})
        self.assertEqual(res.data["templates_deleted"], 1)
        self.assertFalse(FaceTemplate.objects.exists())

    def test_employee_api_never_exposes_templates(self):
        session = EnrollmentSession.objects.create(employee=self.emp, consent_confirmed=True)
        t = FaceTemplate(employee=self.emp, session=session, model_version="test", is_active=True)
        t.set_embedding(unit(np.ones(128)))
        t.save()
        res = self.client.get(f"{API}/employees/{self.emp.id}")
        self.assertTrue(res.data["enrollment"]["enrolled"])
        self.assertNotIn("embedding", str(res.data))
