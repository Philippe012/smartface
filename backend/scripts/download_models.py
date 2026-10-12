"""
Download the local face models used by SmartFace (one-time, needs internet access).

  * YuNet face detector   - MIT licence        - https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet
  * SFace face recogniser - Apache-2.0 licence - https://github.com/opencv/opencv_zoo/tree/main/models/face_recognition_sface

After downloading, the system runs fully offline. To install on an offline server, copy the
two .onnx files into backend/models/ (or FACE_MODELS_DIR) by other means.

Usage:  python scripts/download_models.py [target_dir]
"""

import hashlib
import sys
import urllib.request
from pathlib import Path

BASE = "https://github.com/opencv/opencv_zoo/raw/main/models"
MODELS = {
    "face_detection_yunet_2023mar.onnx": (
        f"{BASE}/face_detection_yunet/face_detection_yunet_2023mar.onnx",
        "8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4",
    ),
    "face_recognition_sface_2021dec.onnx": (
        f"{BASE}/face_recognition_sface/face_recognition_sface_2021dec.onnx",
        "0ba9fbfa01b5270c96627c4ef784da859931e02f04419c829e83484087c34e79",
    ),
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / "models"
    target.mkdir(parents=True, exist_ok=True)
    failed = False
    for name, (url, expected) in MODELS.items():
        dest = target / name
        if dest.exists() and sha256(dest) == expected:
            print(f"[ok]   {name} already present")
            continue
        print(f"[get]  {name}")
        tmp = dest.with_suffix(".part")
        try:
            urllib.request.urlretrieve(url, tmp)
        except OSError as exc:
            print(f"[fail] {name}: {exc}")
            failed = True
            continue
        actual = sha256(tmp)
        if actual != expected:
            tmp.unlink(missing_ok=True)
            print(f"[fail] {name}: checksum mismatch (got {actual})")
            failed = True
            continue
        tmp.replace(dest)
        print(f"[ok]   {name} saved to {dest}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
