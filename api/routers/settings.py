import re
import subprocess
import sys

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from api.config import PROJECT_ROOT

router = APIRouter(prefix="/api/settings", tags=["Settings"])

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
    if not CONFIG_FILE_PATH.exists():
        raise HTTPException(status_code=404, detail="config.py not found")
        
    settings = {}
    with open(CONFIG_FILE_PATH, "r", encoding="utf-8") as f:
        content = f.read()
        
    for match in re.finditer(r'^([A-Z_]+)\s*=\s*(.+)$', content, re.MULTILINE):
        key = match.group(1)
        val_str = match.group(2).strip()
        
        if val_str == "True": 
            val = True
        elif val_str == "False": 
            val = False
        elif val_str.isdigit(): 
            val = int(val_str)
        elif val_str.startswith('r"') or val_str.startswith("r'"):
            val = val_str[2:-1]
        elif val_str.startswith('"') or val_str.startswith("'"):
            val = val_str[1:-1]
        else:
            val = val_str
            
        settings[key] = val
        
    return settings

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

@router.put("/")
def update_settings(new_settings: SettingsModel):
    if not CONFIG_FILE_PATH.exists():
        raise HTTPException(status_code=404, detail="config.py not found")
        
    with open(CONFIG_FILE_PATH, "r", encoding="utf-8") as f:
        content = f.read()
        
    if hasattr(new_settings, "model_dump"):
        settings_dict = new_settings.model_dump()
    else:
        settings_dict = new_settings.dict()
    
    for key, value in settings_dict.items():
        if isinstance(value, bool):
            val_str = "True" if value else "False"
        elif isinstance(value, int):
            val_str = str(value)
        else:
            if "\\" in value:
                val_str = f'r"{value}"'
            else:
                val_str = f'"{value}"'
                
        # Regex to replace the value
        pattern = rf'^({key})\s*=\s*.+$'
        replacement = rf'\1 = {val_str}'
        content = re.sub(pattern, replacement, content, flags=re.MULTILINE)
        
    with open(CONFIG_FILE_PATH, "w", encoding="utf-8") as f:
        f.write(content)
        
    return {"status": "success", "settings": settings_dict}
