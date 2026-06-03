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

from api.config import FEATURES_DIR, get_all_tasks, gw, plan_manager, registry
from api.models import CheckLiteralRequest, UICollapseRequest

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


@router.get("/api/steps/catalog", tags=["Tasks"])
def get_steps_catalog():
    """Obtiene todos los pasos (Given, When, Then) registrados en el proyecto."""
    if not registry:
        raise HTTPException(status_code=500, detail="behave.step_registry not available")

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


@router.get("/api/validate-files", tags=["Maintenance"])
def validate_files():
    """Valida que todos los archivos registrados existen físicamente."""
    try:
        if not plan_manager:
            raise HTTPException(status_code=500, detail="ExecutionPlanManager not available")

        modules           = plan_manager.get_sequence()
        missing_features: list = []
        missing_tasks:    list = []

        try:
            from executor.tasks_core.registry import get_all_tasks as _get_tasks
            registered_tasks = _get_tasks()
        except Exception:
            registered_tasks = {}

        for module in modules:
            for feature in module.get("features", []):
                feature_dir  = feature.get("feature_dir", "")
                feature_file = feature.get("feature_file", "")
                path = (
                    FEATURES_DIR / feature_dir / feature_file
                    if feature_dir
                    else FEATURES_DIR / feature_file
                )
                if not path.exists():
                    f_id = f"feature::{module.get('module_name')}::{feature_dir}/{feature_file}"
                    missing_features.append({
                        "id":           f_id,
                        "path":         f"{feature_dir}/{feature_file}" if feature_dir else feature_file,
                        "module":       module.get("module_name"),
                        "feature_file": feature_file,
                        "feature_dir":  feature_dir,
                    })

                for task in feature.get("ui_tasks", []):
                    task_name = task.get("name")
                    if task_name and task_name not in registered_tasks:
                        if not any(t["name"] == task_name for t in missing_tasks):
                            missing_tasks.append({
                                "name":       task_name,
                                "feature_id": feature.get("id", "unknown"),
                                "hook":       task.get("hook"),
                            })

        return {
            "missing_features": missing_features,
            "missing_tasks":    missing_tasks,
            "all_valid":        len(missing_features) == 0 and len(missing_tasks) == 0,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/api/ui-settings/module-collapse", tags=["Maintenance"])
def update_module_collapse(payload: UICollapseRequest):
    """Guarda el estado de colapso de un módulo."""
    try:
        settings_path = FEATURES_DIR / "ui_settings.json"
        settings: dict = {}
        if settings_path.exists():
            with open(settings_path, "r", encoding="utf-8") as f:
                settings = json.load(f)

        if "collapsed_sections" not in settings:
            settings["collapsed_sections"] = {}
        if payload.view not in settings["collapsed_sections"]:
            settings["collapsed_sections"][payload.view] = []

        collapsed_list = settings["collapsed_sections"][payload.view]
        if payload.is_collapsed:
            if payload.section_id not in collapsed_list:
                collapsed_list.append(payload.section_id)
        else:
            if payload.section_id in collapsed_list:
                collapsed_list.remove(payload.section_id)

        with open(settings_path, "w", encoding="utf-8") as f:
            json.dump(settings, f, indent=4)

        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
