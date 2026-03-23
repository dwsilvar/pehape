# config/config.py
"""
Configuration file for the automation framework.
Defines the type of driver to use.
"""

# Base path where the element images are stored.
IMAGES_BASE_PATH = "resources/images"
IMAGES_REPORT_PATH = "reports/screenshots"

# --- Tesseract OCR Configuration ---
# Path to the Tesseract executable. Required if not in the system PATH.
# Example on Windows: "C:\Program Files\Tesseract-OCR\tesseract.exe"
TESSERACT_CMD_PATH = r"C:\src\tesseract-ocr\tesseract.exe"
TESSERACT_LANGUAGE = "spa"

# Threshold for image-based search (PyAutoGUI locateOnScreen).
# Value 0–100, will be divided by 100 when passed to PyAutoGUI.
IMAGE_CONFIDENCE_THRESHOLD = 70

# Threshold for OCR text detection (PyTesseract).
# Value 0–100, used directly to filter low-confidence words.
OCR_CONFIDENCE_THRESHOLD = 40

# --- Behave Execution Configuration ---
# If True, stop execution on the first failing scenario.
# If False, continue executing all scenarios even if some fail.
STOP_ON_FAILURE = False

