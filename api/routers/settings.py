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
    # Recargar el módulo para leer los valores actuales del disco
    try:
        importlib.reload(configurator)
    except Exception:
        pass

    # Devolver la ruta de Tesseract ya resuelta como absoluta para mostrar al usuario
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
def browse_file(current_path: str = ""):
    from pathlib import Path as _Path

    # Determinar el directorio inicial: usar el dir del path actual si existe, si no PROJECT_ROOT
    initial_dir = str(PROJECT_ROOT)
    if current_path:
        p = _Path(current_path)
        candidate = p.parent if p.is_file() else p
        if candidate.exists():
            initial_dir = str(candidate)

    code = f"""
import tkinter as tk
from tkinter import filedialog
root = tk.Tk()
root.withdraw()
root.attributes('-topmost', True)
path = filedialog.askopenfilename(
    title="Seleccionar ejecutable de Tesseract",
    initialdir={repr(initial_dir)},
    filetypes=[("Ejecutables", "*.exe"), ("Todos los archivos", "*.*")]
)
print(path)
"""
    try:
        result = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True, check=True)
        return {"path": result.stdout.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/browse_directory")
def browse_directory(current_path: str = ""):
    from pathlib import Path as _Path

    # Determinar el directorio inicial: usar el dir del path actual si existe, si no PROJECT_ROOT
    initial_dir = str(PROJECT_ROOT)
    if current_path:
        p = _Path(current_path)
        candidate = p if p.is_dir() else p.parent
        if candidate.exists():
            initial_dir = str(candidate)

    code = f"""
import tkinter as tk
from tkinter import filedialog
root = tk.Tk()
root.withdraw()
root.attributes('-topmost', True)
path = filedialog.askdirectory(
    title="Seleccionar carpeta",
    initialdir={repr(initial_dir)}
)
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
    from pathlib import Path as _Path
    if hasattr(new_settings, "model_dump"):
        settings_dict = new_settings.model_dump()
    else:
        settings_dict = new_settings.dict()

    # Si la ruta de Tesseract está dentro del directorio del proyecto,
    # guardarla como ruta relativa para preservar portabilidad del paquete.
    # Si apunta a otro lugar (ej. instalación del sistema), guardarla absoluta.
    tesseract_path = _Path(settings_dict["TESSERACT_CMD_PATH"])
    try:
        rel = tesseract_path.relative_to(PROJECT_ROOT)
        tesseract_to_save = str(rel)
    except ValueError:
        tesseract_to_save = str(tesseract_path)

    # Si la ruta base de imágenes está dentro del proyecto, guardarla como relativa
    images_base_path = _Path(settings_dict["IMAGES_BASE_PATH"])
    try:
        rel_base = images_base_path.relative_to(PROJECT_ROOT)
        images_base_to_save = str(rel_base)
    except ValueError:
        images_base_to_save = str(images_base_path)

    # Si la ruta de reportes/evidencias está dentro del proyecto, guardarla como relativa
    images_report_path = _Path(settings_dict["IMAGES_REPORT_PATH"])
    try:
        rel_report = images_report_path.relative_to(PROJECT_ROOT)
        images_report_to_save = str(rel_report)
    except ValueError:
        images_report_to_save = str(images_report_path)

    # Map from UPPERCASE settings (python constants) to lowercase JSON keys
    json_data = {
        "images_base_path": images_base_to_save,
        "images_report_path": images_report_to_save,
        "tesseract_cmd_path": tesseract_to_save,
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
