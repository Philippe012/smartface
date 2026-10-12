"""
Local face detection, quality assessment, embedding and matching.

Models (OpenCV Model Zoo, downloaded by ``scripts/download_models.py``):
  * YuNet face detector   - face_detection_yunet_2023mar.onnx   (MIT licence)
  * SFace face recogniser - face_recognition_sface_2021dec.onnx (Apache-2.0 licence)

Both run on CPU through OpenCV's DNN module. No cloud services are used.
Thresholds are configurable in System settings and must be validated in a pilot:
similarity scores are a system signal, not proof of identity.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass, field
from pathlib import Path

import cv2
import numpy as np
from django.conf import settings

DETECTOR_FILE = "face_detection_yunet_2023mar.onnx"
RECOGNIZER_FILE = "face_recognition_sface_2021dec.onnx"
MODEL_VERSION = "yunet-2023mar+sface-2021dec"
MAX_FRAME_WIDTH = 1280


class ModelsNotInstalled(RuntimeError):
    pass


def model_paths() -> tuple[Path, Path]:
    base = Path(settings.FACE_MODELS_DIR)
    return base / DETECTOR_FILE, base / RECOGNIZER_FILE


def models_installed() -> bool:
    return all(p.is_file() for p in model_paths())


@dataclass
class QualityThresholds:
    min_face_size_px: int = 80
    min_sharpness: float = 40.0
    min_detection_score: float = 0.85
    min_brightness: float = 40.0
    max_brightness: float = 220.0

    @classmethod
    def from_settings(cls, cfg) -> "QualityThresholds":
        return cls(
            min_face_size_px=cfg.min_face_size_px,
            min_sharpness=cfg.min_sharpness,
            min_detection_score=cfg.min_detection_score,
        )


@dataclass
class FaceObservation:
    box: tuple[int, int, int, int]
    detection_score: float
    sharpness: float
    brightness: float
    yaw: float  # rough head-turn estimate from landmarks: <0 left, >0 right
    pitch: float
    problems: list[str] = field(default_factory=list)
    embedding: np.ndarray | None = None

    @property
    def acceptable(self) -> bool:
        return not self.problems

    @property
    def quality_score(self) -> float:
        """0..1 summary used for display and ranking only."""
        sharp = min(self.sharpness / 150.0, 1.0)
        return round(0.6 * self.detection_score + 0.4 * sharp, 3)


def downscale(frame: np.ndarray) -> np.ndarray:
    h, w = frame.shape[:2]
    if w <= MAX_FRAME_WIDTH:
        return frame
    scale = MAX_FRAME_WIDTH / w
    return cv2.resize(frame, (MAX_FRAME_WIDTH, int(h * scale)), interpolation=cv2.INTER_AREA)


def decode_image(data: bytes) -> np.ndarray | None:
    arr = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    return None if img is None else downscale(img)


class FaceEngine:
    """Thread-safe wrapper; OpenCV DNN objects are not safe to share across threads concurrently."""

    def __init__(self):
        det_path, rec_path = model_paths()
        if not (det_path.is_file() and rec_path.is_file()):
            raise ModelsNotInstalled(
                f"Face models not found in {det_path.parent}. Run `python scripts/download_models.py`."
            )
        self._lock = threading.Lock()
        self.detector = cv2.FaceDetectorYN.create(str(det_path), "", (320, 320), 0.6, 0.3, 50)
        self.recognizer = cv2.FaceRecognizerSF.create(str(rec_path), "")

    def analyse(self, frame: np.ndarray, thresholds: QualityThresholds, *, embed: bool = True) -> list[FaceObservation]:
        frame = downscale(frame)
        h, w = frame.shape[:2]
        with self._lock:
            self.detector.setInputSize((w, h))
            _, faces = self.detector.detect(frame)
            observations = []
            if faces is None:
                return observations
            for face in faces:
                obs = self._assess(frame, face, thresholds)
                if embed and obs.acceptable:
                    aligned = self.recognizer.alignCrop(frame, face)
                    feature = self.recognizer.feature(aligned).flatten().astype(np.float32)
                    norm = np.linalg.norm(feature)
                    obs.embedding = feature / norm if norm else feature
                observations.append(obs)
        observations.sort(key=lambda o: o.box[2] * o.box[3], reverse=True)
        return observations

    @staticmethod
    def _assess(frame, face, t: QualityThresholds) -> FaceObservation:
        h, w = frame.shape[:2]
        x, y, fw, fh = (int(round(v)) for v in face[:4])
        score = float(face[14])
        lm = face[4:14].reshape(5, 2)  # right eye, left eye, nose, right mouth, left mouth
        x0, y0, x1, y1 = max(x, 0), max(y, 0), min(x + fw, w), min(y + fh, h)
        crop = frame[y0:y1, x0:x1]
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY) if crop.size else np.zeros((1, 1), np.uint8)
        if gray.size > 1:
            gray = cv2.resize(gray, (112, 112), interpolation=cv2.INTER_AREA)
        sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        brightness = float(gray.mean())

        eye_mid = (lm[0] + lm[1]) / 2
        mouth_mid = (lm[3] + lm[4]) / 2
        eye_dist = float(np.linalg.norm(lm[0] - lm[1])) or 1.0
        yaw = float((lm[2][0] - eye_mid[0]) / eye_dist)
        face_len = float(np.linalg.norm(mouth_mid - eye_mid)) or 1.0
        pitch = float((lm[2][1] - eye_mid[1]) / face_len - 0.55)

        problems = []
        if score < t.min_detection_score:
            problems.append("Face not clearly detected")
        if min(fw, fh) < t.min_face_size_px:
            problems.append("Face too small - move closer to the camera")
        if x < 0 or y < 0 or x + fw > w or y + fh > h:
            problems.append("Face is partly outside the frame")
        if sharpness < t.min_sharpness:
            problems.append("Image is blurry - hold still")
        if brightness < t.min_brightness:
            problems.append("Too dark - improve lighting")
        elif brightness > t.max_brightness:
            problems.append("Too bright - reduce glare or backlight")
        return FaceObservation(
            box=(x, y, fw, fh), detection_score=round(score, 3), sharpness=round(sharpness, 1),
            brightness=round(brightness, 1), yaw=round(yaw, 3), pitch=round(pitch, 3), problems=problems,
        )


_engine: FaceEngine | None = None
_engine_lock = threading.Lock()


def get_engine() -> FaceEngine:
    global _engine
    with _engine_lock:
        if _engine is None:
            _engine = FaceEngine()
        return _engine


# --- matching ---------------------------------------------------------------

@dataclass
class MatchResult:
    outcome: str  # matched | uncertain | unknown
    employee_id: int | None
    similarity: float
    runner_up_similarity: float


class Gallery:
    """In-memory set of active employee templates used for 1:N matching."""

    def __init__(self, templates: dict[int, np.ndarray]):
        self.templates = templates  # employee_id -> (n, 128) normalised embeddings

    def __len__(self):
        return len(self.templates)

    def match(self, embedding: np.ndarray, *, match_threshold: float, uncertain_threshold: float,
              margin: float) -> MatchResult:
        if not self.templates:
            return MatchResult("unknown", None, 0.0, 0.0)
        scores = sorted(
            ((float(np.max(mat @ embedding)), emp_id) for emp_id, mat in self.templates.items()),
            reverse=True,
        )
        best, best_id = scores[0]
        runner_up = scores[1][0] if len(scores) > 1 else 0.0
        if best >= match_threshold and best - runner_up >= margin:
            return MatchResult("matched", best_id, best, runner_up)
        if best >= uncertain_threshold:
            # Ambiguous or below the acceptance threshold: never assign automatically.
            return MatchResult("uncertain", best_id, best, runner_up)
        return MatchResult("unknown", None, best, runner_up)


def load_gallery(exclude_employee_id: int | None = None) -> Gallery:
    from .models import FaceTemplate

    rows = FaceTemplate.objects.filter(is_active=True, employee__status="active")
    if exclude_employee_id is not None:
        rows = rows.exclude(employee_id=exclude_employee_id)
    grouped: dict[int, list[np.ndarray]] = {}
    for t in rows.only("employee_id", "encrypted_embedding"):
        grouped.setdefault(t.employee_id, []).append(t.get_embedding())
    return Gallery({emp: np.vstack(vecs) for emp, vecs in grouped.items()})
