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

CONFIDENCE_THRESHOLD = 40

