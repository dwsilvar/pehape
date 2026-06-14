import json
import os
import re
import shutil
import subprocess
import sys
import zipfile
import urllib.request
from threading import Thread
from pathlib import Path
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel

from api.config import PROJECT_ROOT
import config.config as configurator

router = APIRouter(prefix="/api/update", tags=["Updates"])

# Global variable to track active downloads
_download_state = {
    "status": "idle", # "idle", "downloading", "completed", "error"
    "version": "",
    "error_message": ""
}

class UpgradeConfigModel(BaseModel):
    update_url: str
    local_update_dir: str

def parse_version(v_str: str):
    v_str = v_str.strip().lower()
    # Handle optional dev suffixes
    match = re.match(r"^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$", v_str)
    if not match:
        return (0, 0, 0, 0)
    major = int(match.group(1))
    minor = int(match.group(2))
    patch = int(match.group(3))
    suffix = match.group(4) or ""
    suffix_weight = 0 if suffix else 1
    return (major, minor, patch, suffix_weight)

def is_newer(v_current: str, v_candidate: str) -> bool:
    return parse_version(v_candidate) > parse_version(v_current)

def get_current_version() -> str:
    v_file = PROJECT_ROOT / "version.json"
    if v_file.exists():
        try:
            with open(v_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("version", "0.0.0")
        except Exception:
            pass
    return "0.0.0"

def get_zip_version(zip_path: Path) -> str:
    try:
        with zipfile.ZipFile(zip_path, 'r') as z:
            if 'version.json' in z.namelist():
                with z.open('version.json') as f:
                    data = json.loads(f.read().decode('utf-8-sig'))
                    return data.get("version", "")
    except Exception:
        pass
    return ""

def scan_local_updates():
    local_dir = Path(configurator.LOCAL_UPDATE_DIR)
    if not local_dir.exists():
        return None
        
    current = get_current_version()
    best_zip = None
    best_ver = ""
    
    for f in local_dir.iterdir():
        if f.is_file() and f.name.endswith(".zip") and f.name.startswith("pehape-update-"):
            ver = get_zip_version(f)
            if ver and is_newer(current, ver):
                if not best_ver or is_newer(best_ver, ver):
                    best_ver = ver
                    best_zip = f
                    
    if best_zip:
        return {
            "version": best_ver,
            "filename": best_zip.name,
            "filepath": str(best_zip)
        }
    return None

def download_updater_task(url: str, version: str, dest_path: Path):
    global _download_state
    _download_state["status"] = "downloading"
    _download_state["version"] = version
    _download_state["error_message"] = ""
    
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = dest_path.with_suffix(".zip.tmp")
    
    try:
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        )
        with urllib.request.urlopen(req, timeout=30) as response, open(tmp_path, 'wb') as out_file:
            shutil.copyfileobj(response, out_file)
            
        # Verify the ZIP and extract its version before final renaming
        zip_ver = get_zip_version(tmp_path)
        if not zip_ver:
            raise Exception("El archivo descargado no es un paquete de actualizacion valido (falta version.json)")
            
        shutil.move(str(tmp_path), str(dest_path))
        _download_state["status"] = "completed"
    except Exception as e:
        _download_state["status"] = "error"
        _download_state["error_message"] = str(e)
        if tmp_path.exists():
            try:
                tmp_path.unlink()
            except Exception:
                pass

@router.get("/config")
def get_upgrade_config():
    return {
        "update_url": configurator.UPDATE_URL,
        "local_update_dir": configurator.LOCAL_UPDATE_DIR
    }

@router.put("/config")
def update_upgrade_config(cfg: UpgradeConfigModel):
    config_file = PROJECT_ROOT / "config" / "upgrade_config.json"
    
    # Intenta resolver la ruta local relativa para portabilidad
    local_path = Path(cfg.local_update_dir)
    try:
        rel = local_path.relative_to(PROJECT_ROOT)
        local_dir_to_save = str(rel)
    except ValueError:
        local_dir_to_save = str(local_path)
        
    json_data = {
        "update_url": cfg.update_url,
        "local_update_dir": local_dir_to_save
    }
    
    try:
        with open(config_file, "w", encoding="utf-8") as f:
            json.dump(json_data, f, indent=4, ensure_ascii=False)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al escribir upgrade_config.json: {str(e)}")
        
    return {"status": "success", "config": json_data}

@router.get("/status")
def get_update_status():
    global _download_state
    local_update = scan_local_updates()
    
    return {
        "current_version": get_current_version(),
        "local_update_available": local_update is not None,
        "local_update_version": local_update["version"] if local_update else "",
        "download_state": _download_state
    }

@router.post("/check")
def check_for_updates(background_tasks: BackgroundTasks):
    global _download_state
    
    # 1. Comprobar URL remota
    url = configurator.UPDATE_URL
    current_ver = get_current_version()
    
    if url:
        try:
            req = urllib.request.Request(
                url, 
                headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
            )
            with urllib.request.urlopen(req, timeout=5) as response:
                data = json.loads(response.read().decode('utf-8'))
                remote_ver = data.get("version", "")
                download_url = data.get("download_url", "")
                
                if remote_ver and is_newer(current_ver, remote_ver) and download_url:
                    # Si ya está descargando esta versión, retornar estado actual
                    if _download_state["status"] == "downloading" and _download_state["version"] == remote_ver:
                        return {"status": "downloading", "version": remote_ver}
                        
                    # Iniciar descarga en segundo plano
                    filename = f"pehape-update-{remote_ver}.zip"
                    dest_path = Path(configurator.LOCAL_UPDATE_DIR) / filename
                    
                    # Evitar volver a descargar si el ZIP correcto ya existe
                    if dest_path.exists() and get_zip_version(dest_path) == remote_ver:
                        return {"status": "ready", "version": remote_ver, "source": "remote_cached"}
                        
                    background_tasks.add_task(
                        download_updater_task, 
                        download_url, 
                        remote_ver, 
                        dest_path
                    )
                    return {"status": "downloading", "version": remote_ver}
        except Exception as e:
            # Fallback silencioso a escaneo local en caso de fallo HTTP
            pass
            
    # 2. Fallback a escaneo local
    local_update = scan_local_updates()
    if local_update:
        return {"status": "ready", "version": local_update["version"], "source": "local"}
        
    return {"status": "no_update_found", "version": current_ver}

@router.post("/apply")
def apply_update():
    local_update = scan_local_updates()
    if not local_update:
        raise HTTPException(status_code=400, detail="No hay ninguna actualizacion disponible localmente para aplicar.")
        
    filepath = Path(local_update["filepath"])
    temp_extract_dir = PROJECT_ROOT / "temp" / "update_extract"
    
    try:
        # 1. Limpiar directorio temporal anterior y crear
        if temp_extract_dir.exists():
            shutil.rmtree(temp_extract_dir)
        temp_extract_dir.mkdir(parents=True, exist_ok=True)
        
        # 2. Descomprimir el ZIP de actualizacion en la carpeta temporal
        with zipfile.ZipFile(filepath, 'r') as zip_ref:
            zip_ref.extractall(temp_extract_dir)
            
        # 3. Validar que exista update.ps1 en el extraido
        update_ps1_path = temp_extract_dir / "update.ps1"
        if not update_ps1_path.exists():
            raise Exception("El paquete de actualizacion no contiene el script 'update.ps1'")
            
        # 4. Crear archivo por lotes desacoplado para aplicar y reiniciar
        apply_bat = PROJECT_ROOT / "temp_apply.bat"
        
        launcher = os.environ.get("PEHAPE_LAUNCHER", "")
        node_path = os.environ.get("NODE_PATH", "")
        extra_args = ""
        if launcher:
            extra_args += f' -Launcher "{launcher}"'
        if node_path:
            extra_args += f' -NodePath "{node_path}"'

        bat_content = f"""@echo off
title PeHaPe - Aplicando Actualizacion Automatizada...
echo ======================================================================
echo   Iniciando actualizacion de PeHaPe...
echo ======================================================================
echo Esperando a que el servidor principal se apague para liberar puertos...
timeout /t 3 /nobreak > nul

echo.
echo Ejecutando script de actualizacion...
powershell.exe -ExecutionPolicy Bypass -File "{update_ps1_path.resolve()}" -InstallDir "{PROJECT_ROOT.resolve()}" -Restart -Silent{extra_args}
if errorlevel 1 (
    echo.
    echo ======================================================================
    echo ERROR: La actualizacion fallo. Revise los mensajes anteriores.
    echo El paquete actualizador y archivos temporales NO han sido eliminados.
    echo ======================================================================
    echo.
    pause
    del /f /q "{apply_bat.resolve()}"
    exit /b 1
)

echo.
echo Limpiando paquete actualizador y archivos temporales...
if exist "{filepath.resolve()}" del /f /q "{filepath.resolve()}"
if exist "{temp_extract_dir.resolve()}" rmdir /s /q "{temp_extract_dir.resolve()}"

echo Actualizacion terminada de forma exitosa. Esta ventana se cerrara en 5 segundos.
timeout /t 5 > nul
del /f /q "{apply_bat.resolve()}"
exit
"""
        with open(apply_bat, "w", encoding="ascii") as f:
            f.write(bat_content)
            
        # 5. Ejecutar el BAT en una nueva consola visible (CREATE_NEW_CONSOLE = 0x00000010)
        if sys.platform == "win32":
            subprocess.Popen(
                ["cmd.exe", "/c", str(apply_bat)], 
                creationflags=0x00000010, 
                close_fds=True
            )
        else:
            # Fallback básico para otros sistemas (aunque la app es nativa Windows)
            subprocess.Popen(["bash", "-c", f"sleep 3 && cp -r {temp_extract_dir}/* {PROJECT_ROOT}"])
            
        # 6. Apagar el servidor FastAPI de manera limpia
        # Al cerrarse, temp_apply.bat continuará la ejecución después del timeout
        def shutdown_server():
            import time
            time.sleep(1)
            os._exit(0)
            
        Thread(target=shutdown_server).start()
        
        return {"status": "applying", "message": "El servidor se esta reiniciando para aplicar la actualizacion."}
    except Exception as e:
        if temp_extract_dir.exists():
            try:
                shutil.rmtree(temp_extract_dir)
            except Exception:
                pass
        raise HTTPException(status_code=500, detail=f"Error al preparar actualizacion: {str(e)}")
