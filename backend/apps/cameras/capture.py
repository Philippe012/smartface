"""OpenCV stream access shared by connection tests, enrollment capture and the recognition worker."""

import logging
import re
import time

import cv2

from .models import Camera

logger = logging.getLogger(__name__)

OPEN_TIMEOUT_MS = 8000
READ_TIMEOUT_MS = 8000


def redact(text: str) -> str:
    """Strip credentials from any URL that might appear in an error message."""
    return re.sub(r"://[^/@\s]+@", "://***@", text or "")


def open_capture(camera: Camera) -> cv2.VideoCapture:
    source = camera.capture_source()
    if isinstance(source, int):
        cap = cv2.VideoCapture(source)
    else:
        params = [cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, OPEN_TIMEOUT_MS, cv2.CAP_PROP_READ_TIMEOUT_MSEC, READ_TIMEOUT_MS]
        cap = cv2.VideoCapture(source, cv2.CAP_FFMPEG, params)
    try:
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    except cv2.error:
        pass
    return cap


def grab_frame(camera: Camera):
    """Open the camera, read one frame and close it. Returns (frame, diagnostics)."""
    started = time.monotonic()
    cap = open_capture(camera)
    try:
        if not cap.isOpened():
            return None, {"ok": False, "error": "Could not open the stream. Check the address, network and credentials."}
        frame = None
        for _ in range(5):  # skip any stale buffered frames
            ok, frame = cap.read()
            if not ok:
                frame = None
                break
        if frame is None:
            return None, {"ok": False, "error": "Connected, but no video frame was received."}
        h, w = frame.shape[:2]
        return frame, {
            "ok": True,
            "width": int(w),
            "height": int(h),
            "latency_ms": int((time.monotonic() - started) * 1000),
            "reported_fps": float(cap.get(cv2.CAP_PROP_FPS) or 0) or None,
        }
    except cv2.error as exc:
        return None, {"ok": False, "error": redact(f"OpenCV error: {exc}")[:400]}
    finally:
        cap.release()
