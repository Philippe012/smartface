import logging
import threading
import time

from django.core.management.base import BaseCommand, CommandError
from django.db import close_old_connections, connection
from django.db.models import Count, Max
from django.utils import timezone

from apps.attendance.services import record_observation
from apps.cameras.capture import open_capture, redact
from apps.cameras.models import Camera
from apps.recognition import engine as face_engine
from apps.recognition.models import FaceTemplate
from apps.security import EncryptionNotConfigured, encryption_configured
from apps.settings_app.models import SystemSettings
from apps.settings_app.services import WORKER_HEARTBEAT_NAME, beat

logger = logging.getLogger("smartface.worker")

HEALTH_UPDATE_SECONDS = 5
REFRESH_SECONDS = 10
MAX_FACES_PER_FRAME = 5


class SharedState:
    """Gallery and settings shared by all camera threads, refreshed by the main loop."""

    def __init__(self):
        self.lock = threading.Lock()
        self.gallery = face_engine.Gallery({})
        self.settings = SystemSettings.load()
        self.signature = None

    def refresh(self) -> None:
        cfg = SystemSettings.load()
        sig = FaceTemplate.objects.filter(is_active=True, employee__status="active").aggregate(
            n=Count("id"), last=Max("id"), emps=Count("employee", distinct=True)
        )
        signature = (sig["n"], sig["last"], sig["emps"])
        gallery = self.gallery
        if signature != self.signature:
            gallery = face_engine.load_gallery()
            logger.info("Loaded %d enrolled employees (%d templates)", len(gallery), sig["n"])
        with self.lock:
            self.settings = cfg
            self.gallery = gallery
            self.signature = signature

    def snapshot(self):
        with self.lock:
            return self.gallery, self.settings


class CameraWorker(threading.Thread):
    def __init__(self, camera_id: int, state: SharedState, stop: threading.Event):
        super().__init__(name=f"camera-{camera_id}", daemon=True)
        self.camera_id = camera_id
        self.state = state
        self.stop_event = stop
        self.stats = {"frames": 0, "faces": 0, "matched": 0, "uncertain": 0, "unknown": 0, "low_quality": 0,
                      "events_created": 0}

    def run(self):
        backoff = 2
        try:
            while not self.stop_event.is_set():
                close_old_connections()
                camera = Camera.objects.filter(pk=self.camera_id).first()
                if camera is None or not camera.is_active:
                    logger.info("Camera %s removed or disabled; worker exiting", self.camera_id)
                    return
                try:
                    self._stream(camera)
                    backoff = 2
                except EncryptionNotConfigured as exc:
                    self._set_error(camera, str(exc))
                except Exception as exc:  # noqa: BLE001 - keep the worker alive, report the failure
                    logger.exception("Camera %s failed", camera.name)
                    self._set_error(camera, redact(f"{exc.__class__.__name__}: {exc}"))
                self.stop_event.wait(backoff)
                backoff = min(backoff * 2, 60)
        finally:
            connection.close()

    def _set_error(self, camera: Camera, message: str):
        camera.last_error = message[:500]
        camera.last_checked_at = timezone.now()
        camera.save(update_fields=["last_error", "last_checked_at"])

    def _stream(self, camera: Camera):
        cap = open_capture(camera)
        if not cap.isOpened():
            cap.release()
            self._set_error(camera, "Could not open the stream. Check the address, network and credentials.")
            return
        logger.info("Connected to camera %s (%s)", camera.name, camera.redacted_source())
        engine = face_engine.get_engine()
        last_processed = 0.0
        last_health = 0.0
        frames_since_health = 0
        try:
            while not self.stop_event.is_set():
                ok, frame = cap.read()
                if not ok or frame is None:
                    self._set_error(camera, "The stream stopped delivering frames.")
                    return
                frames_since_health += 1
                now = time.monotonic()
                gallery, cfg = self.state.snapshot()

                if now - last_health >= HEALTH_UPDATE_SECONDS:
                    elapsed = now - last_health if last_health else None
                    h, w = frame.shape[:2]
                    camera.last_frame_at = timezone.now()
                    camera.last_checked_at = camera.last_frame_at
                    camera.last_error = ""
                    camera.frame_width, camera.frame_height = int(w), int(h)
                    camera.measured_fps = round(frames_since_health / elapsed, 1) if elapsed else None
                    camera.save(update_fields=["last_frame_at", "last_checked_at", "last_error", "frame_width",
                                               "frame_height", "measured_fps"])
                    camera.refresh_from_db(fields=["is_active", "direction"])
                    if not camera.is_active:
                        return
                    last_health, frames_since_health = now, 0

                if (now - last_processed) * 1000 < cfg.frame_sample_interval_ms:
                    continue
                last_processed = now
                self._process(camera, engine, frame, gallery, cfg)
        finally:
            cap.release()

    def _process(self, camera, engine, frame, gallery, cfg):
        self.stats["frames"] += 1
        thresholds = face_engine.QualityThresholds.from_settings(cfg)
        for obs in engine.analyse(frame, thresholds)[:MAX_FACES_PER_FRAME]:
            self.stats["faces"] += 1
            if not obs.acceptable:
                self.stats["low_quality"] += 1  # abstain: never guess identity from a poor image
                continue
            result = gallery.match(obs.embedding, match_threshold=cfg.match_threshold,
                                   uncertain_threshold=cfg.uncertain_threshold, margin=cfg.match_margin)
            self.stats[result.outcome] += 1
            _event, action = record_observation(
                camera=camera, outcome=result.outcome, employee_id=result.employee_id,
                similarity=result.similarity, quality=obs.quality_score, model_version=face_engine.MODEL_VERSION,
            )
            if action == "created":
                self.stats["events_created"] += 1
                logger.info("IN recorded for employee %s on %s (similarity %.3f)",
                            result.employee_id, camera.name, result.similarity)


class Command(BaseCommand):
    help = "Run the local face-recognition worker for active IN cameras."

    def add_arguments(self, parser):
        parser.add_argument("--camera", type=int, action="append", help="Only process these camera ids.")

    def handle(self, *args, **options):
        if not face_engine.models_installed():
            raise CommandError("Face models are missing. Run `python scripts/download_models.py` first.")
        if not encryption_configured():
            raise CommandError("SMARTFACE_ENCRYPTION_KEY is not configured.")
        face_engine.get_engine()  # fail fast if the models cannot be loaded

        state = SharedState()
        stop = threading.Event()
        workers: dict[int, CameraWorker] = {}
        self.stdout.write(self.style.SUCCESS("Recognition worker started. Press Ctrl+C to stop."))
        try:
            while True:
                close_old_connections()
                state.refresh()
                cameras = Camera.objects.filter(is_active=True, direction=Camera.Direction.IN)
                if options["camera"]:
                    cameras = cameras.filter(pk__in=options["camera"])
                for cam_id in cameras.values_list("id", flat=True):
                    if cam_id not in workers or not workers[cam_id].is_alive():
                        workers[cam_id] = CameraWorker(cam_id, state, stop)
                        workers[cam_id].start()
                beat(
                    WORKER_HEARTBEAT_NAME,
                    cameras=sorted(i for i, w in workers.items() if w.is_alive()),
                    enrolled_employees=len(state.gallery),
                    stats={str(i): w.stats for i, w in workers.items()},
                    model_version=face_engine.MODEL_VERSION,
                )
                time.sleep(REFRESH_SECONDS)
        except KeyboardInterrupt:
            self.stdout.write("Stopping...")
        finally:
            stop.set()
            for w in workers.values():
                w.join(timeout=10)
