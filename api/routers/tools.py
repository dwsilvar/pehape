"""
api/routers/tools.py
=====================
Miscellaneous utility, validation and task-catalog endpoints.

GET  /api/tools/running-apps
POST /api/tools/check-literal
GET  /api/tasks
GET  /api/steps/catalog
GET  /api/validate-files
PUT  /api/ui-settings/module-collapse
"""
from __future__ import annotations

import importlib.util
import json
import os
import sys

from fastapi import APIRouter, HTTPException

from api.config import FEATURES_DIR, get_all_tasks, gw, registry
from api.models import CheckLiteralRequest

router = APIRouter(tags=["Tools"])


@router.get("/api/tools/running-apps")
def get_running_apps():
    """Lista las ventanas abiertas en el sistema (Windows)."""
    if not gw:
        raise HTTPException(status_code=500, detail="pygetwindow not installed")
    try:
        apps_data = []
        for w in gw.getAllWindows():
            title = w.title
            if not title:
                continue
            apps_data.append({
                "title":       title,
                "id":          getattr(w, "_hWnd", 0),
                "isActive":    getattr(w, "isActive", False),
                "isMaximized": getattr(w, "isMaximized", False),
                "isMinimized": getattr(w, "isMinimized", False),
                "geometry": {
                    "left":   getattr(w, "left", 0),
                    "top":    getattr(w, "top", 0),
                    "width":  getattr(w, "width", 0),
                    "height": getattr(w, "height", 0),
                },
            })
        return {"platform": "Windows", "count": len(apps_data), "windows": apps_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/tools/check-literal")
def check_literal(payload: CheckLiteralRequest):
    """Busca ocurrencias literales de un texto en todos los archivos .feature."""
    try:
        results     = []
        search_text = payload.text if payload.case_sensitive else payload.text.lower()

        for root, _, files in os.walk(str(FEATURES_DIR)):
            for filename in files:
                if not filename.endswith(".feature"):
                    continue
                full_path = os.path.join(root, filename)
                rel_path  = os.path.relpath(full_path, str(FEATURES_DIR)).replace("\\", "/")
                try:
                    with open(full_path, "r", encoding="utf-8") as f:
                        lines = f.readlines()
                    for i, line in enumerate(lines):
                        match_line = line if payload.case_sensitive else line.lower()
                        if search_text in match_line:
                            results.append({"file": rel_path, "line": i + 1, "content": line.strip()})
                except Exception:
                    continue

        return {"count": len(results), "matches": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/tasks", tags=["Tasks"])
def list_tasks():
    """Lista todas las tareas registradas y su documentación."""
    try:
        tasks_data         = []
        registered_tasks   = get_all_tasks()
        for task_name, task_class in registered_tasks.items():
            tasks_data.append({
                "name":        task_name,
                "class_name":  task_class.__name__,
                "module":      task_class.__module__,
                "scope":       getattr(task_class, "scope", "General"),
                "doc":         task_class.__doc__.strip() if task_class.__doc__ else "Sin documentación",
                "args_schema": task_class.get_args_schema() if hasattr(task_class, "get_args_schema") else {},
            })
        return {"tasks": tasks_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


from pydantic import BaseModel

class AssociateStepRequest(BaseModel):
    pattern:  str
    location: str
    keyword:  str


@router.get("/api/steps/catalog", tags=["Tasks"])
def get_steps_catalog():
    """Obtiene todos los pasos (Given, When, Then) registrados en el proyecto."""
    if not registry:
        raise HTTPException(status_code=500, detail="behave.step_registry not available")

    # Clear behave registry and force re-importing steps modules to load fresh changes
    try:
        registry.clear()
        keys_to_del = [k for k in sys.modules if k.startswith("steps.")]
        for k in keys_to_del:
            del sys.modules[k]
    except Exception:
        pass

    steps_dir = FEATURES_DIR / "steps"
    if not steps_dir.exists():
        return []

    if str(FEATURES_DIR) not in sys.path:
        sys.path.append(str(FEATURES_DIR))

    for root, _, files in os.walk(str(steps_dir)):
        for file in files:
            if file.endswith(".py") and file != "__init__.py":
                file_path       = os.path.join(root, file)
                rel_module_path = os.path.relpath(file_path, str(steps_dir)).replace(os.sep, ".")[:-3]
                module_name     = f"steps.{rel_module_path}"
                if module_name not in sys.modules:
                    try:
                        spec   = importlib.util.spec_from_file_location(module_name, file_path)
                        module = importlib.util.module_from_spec(spec)
                        sys.modules[module_name] = module
                        spec.loader.exec_module(module)
                    except Exception:
                        continue

    steps_data: list = []
    seen: set        = set()
    for step_type in ("given", "when", "then"):
        for step in registry.steps.get(step_type, []):
            key = (step_type, step.string)
            if key in seen:
                continue
            seen.add(key)
            steps_data.append({
                "type":     step_type,
                "pattern":  step.string,
                "location": f"{os.path.relpath(step.location.filename, str(FEATURES_DIR))}:{step.location.line}",
            })

    return steps_data


@router.post("/api/steps/associate", tags=["Tasks"])
def associate_step_keyword(payload: AssociateStepRequest):
    """
    Asocia un paso existente a un nuevo keyword en el archivo de pasos correspondiente.
    """
    if not registry:
        raise HTTPException(status_code=500, detail="behave.step_registry not available")

    # Parsear location (esperado: relative_path:line_number)
    parts = payload.location.split(":")
    if len(parts) != 2:
        raise HTTPException(status_code=400, detail="Formato de ubicación inválido. Se esperaba 'archivo:linea'")

    rel_path = parts[0]
    try:
        line_number = int(parts[1])
    except ValueError:
        raise HTTPException(status_code=400, detail="Número de línea inválido")

    file_path = FEATURES_DIR / rel_path
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"Archivo no encontrado: {rel_path}")

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al leer el archivo: {str(e)}")

    def_idx = line_number - 1
    if def_idx < 0 or def_idx >= len(lines):
        raise HTTPException(status_code=400, detail=f"La línea {line_number} está fuera del rango del archivo")

    # Localizar la declaración de la función 'def '
    target_idx = def_idx
    while target_idx < len(lines) and not lines[target_idx].strip().startswith("def "):
        target_idx += 1

    if target_idx >= len(lines):
        # Retroceder para buscar
        target_idx = def_idx
        while target_idx >= 0 and not lines[target_idx].strip().startswith("def "):
            target_idx -= 1
        if target_idx < 0:
            raise HTTPException(status_code=400, detail="No se pudo encontrar la definición de función ('def') asociada")

    # Obtener sangrado
    def_line = lines[target_idx]
    indentation = def_line[:len(def_line) - len(def_line.lstrip())]

    # Encontrar el primer decorador contiguo por encima para insertar
    insert_idx = target_idx
    while insert_idx > 0:
        prev_line = lines[insert_idx - 1].strip()
        if prev_line.startswith("@"):
            insert_idx -= 1
        elif prev_line == "" or prev_line.startswith("#"):
            insert_idx -= 1
        else:
            break

    # Dar formato al nuevo decorador
    keyword = payload.keyword.lower().strip()
    if keyword not in ("given", "when", "then", "step"):
        raise HTTPException(status_code=400, detail=f"Keyword '{keyword}' inválido")

    pattern = payload.pattern
    if "'" in pattern:
        new_decorator = f"{indentation}@{keyword}(\"{pattern}\")\n"
    else:
        new_decorator = f"{indentation}@{keyword}('{pattern}')\n"

    # Evitar decorador duplicado
    already_exists = False
    for i in range(insert_idx, target_idx):
        if new_decorator.strip() == lines[i].strip():
            already_exists = True
            break

    if not already_exists:
        try:
            lines.insert(insert_idx, new_decorator)
            with open(file_path, "w", encoding="utf-8", newline="") as f:
                f.writelines(lines)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error al escribir en el archivo: {str(e)}")

    # Forzar recarga del catálogo para registrar los cambios
    try:
        registry.clear()
        keys_to_del = [k for k in sys.modules if k.startswith("steps.")]
        for k in keys_to_del:
            del sys.modules[k]
    except Exception:
        pass

    return {"status": "ok", "message": f"Keyword '{keyword}' asociado correctamente a '{pattern}'"}

