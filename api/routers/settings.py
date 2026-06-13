import importlib
import json
import re
import subprocess
import sys

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from api.config import PROJECT_ROOT
import config.config as configurator

router = APIRouter(prefix="/api/settings", tags=["Settings"])

VERSION_FILE = PROJECT_ROOT / "version.json"

@router.get("/version", tags=["Settings"])
def get_version():
    """Return the contents of version.json."""
    if not VERSION_FILE.exists():
        return {"version": "unknown", "build_date": "", "changelog": "", "min_base_version": ""}
    with open(VERSION_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


CONFIG_FILE_PATH = PROJECT_ROOT / "config" / "config.py"

class SettingsModel(BaseModel):
    IMAGES_BASE_PATH: str
    IMAGES_REPORT_PATH: str
    TESSERACT_CMD_PATH: str
    TESSERACT_LANGUAGE: str
    IMAGE_CONFIDENCE_THRESHOLD: int
    OCR_CONFIDENCE_THRESHOLD: int
    STOP_ON_FAILURE: bool

@router.get("/")
def get_settings():
    try:
        importlib.reload(configurator)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reloading config: {str(e)}")
        
    return {
        "IMAGES_BASE_PATH": configurator.IMAGES_BASE_PATH,
        "IMAGES_REPORT_PATH": configurator.IMAGES_REPORT_PATH,
        "TESSERACT_CMD_PATH": configurator.TESSERACT_CMD_PATH,
        "TESSERACT_LANGUAGE": configurator.TESSERACT_LANGUAGE,
        "IMAGE_CONFIDENCE_THRESHOLD": configurator.IMAGE_CONFIDENCE_THRESHOLD,
        "OCR_CONFIDENCE_THRESHOLD": configurator.OCR_CONFIDENCE_THRESHOLD,
        "STOP_ON_FAILURE": configurator.STOP_ON_FAILURE
    }

@router.get("/browse_file")
def browse_file():
    code = """
import tkinter as tk
from tkinter import filedialog
root = tk.Tk()
root.withdraw()
root.attributes('-topmost', True)
path = filedialog.askopenfilename(title="Seleccionar ejecutable de Tesseract", filetypes=[("Ejecutables", "*.exe"), ("Todos los archivos", "*.*")])
print(path)
"""
    try:
        result = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True, check=True)
        return {"path": result.stdout.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

OCR_CONFIG_PATH = PROJECT_ROOT / "config" / "ocr_config.json"

@router.put("/")
def update_settings(new_settings: SettingsModel):
    if hasattr(new_settings, "model_dump"):
        settings_dict = new_settings.model_dump()
    else:
        settings_dict = new_settings.dict()
        
    # Map from UPPERCASE settings (python constants) to lowercase JSON keys
    json_data = {
        "images_base_path": settings_dict["IMAGES_BASE_PATH"],
        "images_report_path": settings_dict["IMAGES_REPORT_PATH"],
        "tesseract_cmd_path": settings_dict["TESSERACT_CMD_PATH"],
        "tesseract_language": settings_dict["TESSERACT_LANGUAGE"],
        "image_confidence_threshold": settings_dict["IMAGE_CONFIDENCE_THRESHOLD"],
        "ocr_confidence_threshold": settings_dict["OCR_CONFIDENCE_THRESHOLD"],
        "stop_on_failure": settings_dict["STOP_ON_FAILURE"]
    }
    
    try:
        with open(OCR_CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(json_data, f, indent=4, ensure_ascii=False)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error writing ocr_config.json: {str(e)}")
        
    return {"status": "success", "settings": settings_dict}
