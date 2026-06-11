# config/config.py
"""
Configuration file for the automation framework.
Defines the type of driver to use.
"""
import json
from pathlib import Path

# Base directory for config
_config_dir = Path(__file__).parent

# 1. Load OCR and automation settings from ocr_config.json
_ocr_config_path = _config_dir / "ocr_config.json"
_ocr_config = {}
if _ocr_config_path.exists():
    try:
        with open(_ocr_config_path, "r", encoding="utf-8") as _f:
            _ocr_config = json.load(_f)
    except Exception:
        pass

IMAGES_BASE_PATH = _ocr_config.get("images_base_path", "resources/images")
IMAGES_REPORT_PATH = _ocr_config.get("images_report_path", "reports/screenshots")

# --- Tesseract OCR Configuration ---
# Path to the Tesseract executable. Required if not in the system PATH.
TESSERACT_CMD_PATH = _ocr_config.get("tesseract_cmd_path", r"C:\src\tesseract-ocr\tesseract.exe")
TESSERACT_LANGUAGE = _ocr_config.get("tesseract_language", "spa")

# Threshold for image-based search (PyAutoGUI locateOnScreen).
# Value 0–100, will be divided by 100 when passed to PyAutoGUI.
IMAGE_CONFIDENCE_THRESHOLD = _ocr_config.get("image_confidence_threshold", 70)

# Threshold for OCR text detection (PyTesseract).
# Value 0–100, used directly to filter low-confidence words.
OCR_CONFIDENCE_THRESHOLD = _ocr_config.get("ocr_confidence_threshold", 40)

# --- Behave Execution Configuration ---
# If True, stop execution on the first failing scenario.
# If False, continue executing all scenarios even if some fail.
STOP_ON_FAILURE = _ocr_config.get("stop_on_failure", False)


# 2. Load network/server settings from network_config.json
_net_config_path = _config_dir / "network_config.json"
_net_config = {}
if _net_config_path.exists():
    try:
        with open(_net_config_path, "r", encoding="utf-8") as _f:
            _net_config = json.load(_f)
    except Exception:
        pass

# Port and Host for the Backend (FastAPI)
BACKEND_HOST = _net_config.get("backend_host", "0.0.0.0")
BACKEND_PORT = _net_config.get("backend_port", 5001)

# Port for the Frontend (Vite)
FRONTEND_PORT = _net_config.get("frontend_port", 3000)
