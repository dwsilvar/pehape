"""
api/routers/features.py
========================
Endpoints for browsing, reading, writing and validating .feature files.

GET  /api/features-with-scenarios
GET  /api/features
GET  /api/features/{filepath}
POST /api/features/{filepath}
POST /api/features/validate
POST /api/directories
POST /api/files
POST /api/execution-order/refresh
"""
from __future__ import annotations

import os
import subprocess
import sys

from fastapi import APIRouter, HTTPException

from api.config import FEATURES_DIR, Parser
from api.models import CreateDirRequest, CreateFileRequest, SaveFeatureRequest, ValidateFeatureRequest

router = APIRouter(tags=["Features"])


@router.get("/api/features-with-scenarios")
def list_features_with_scenarios():
    """
    Returns a flat list of .feature files with their parsed scenario names, tags and steps.
    Used to populate the Asset Library in the Test Plan Designer.
    """
    results = []
    if not Parser:
        raise HTTPException(status_code=500, detail="behave.parser not available")

    try:
        for root, dirs, files in os.walk(str(FEATURES_DIR)):
            dirs[:] = [d for d in dirs if d != "steps"]
            for filename in sorted(files):
                if not filename.endswith(".feature"):
                    continue
                full_path = os.path.join(root, filename)
                rel_path  = os.path.relpath(full_path, str(FEATURES_DIR)).replace("\\", "/")

                feature_title = filename.replace(".feature", "")
                scenarios: list = []

                try:
                    parser = Parser()
                    with open(full_path, "r", encoding="utf-8") as fh:
                        content = fh.read()
                    feature = parser.parse(content)
                    if feature:
                        feature_title = feature.name or feature_title
                        for scenario in feature.scenarios:
                            steps = [
                                f"{step.keyword} {step.name}"
                                for step in (scenario.steps or [])
                            ]
                            scenarios.append({
                                "name":  scenario.name,
                                "tags":  list(scenario.tags or []),
                                "steps": steps,
                            })
                except Exception:
                    scenarios = []

                results.append({
                    "name":         filename,
                    "path":         rel_path,
                    "featureTitle": feature_title,
                    "scenarios":    scenarios,
                })

        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/features")
def list_features():
    """
    Lista todos los archivos .feature y sus directorios como árbol.
    """
    def build_tree(path):
        tree = []
        if not path.exists():
            return tree
        for item in sorted(os.listdir(str(path))):
            if item == "steps" and (path / item).is_dir():
                continue
            full_path     = path / item
            relative_path = os.path.relpath(str(full_path), str(FEATURES_DIR)).replace("\\", "/")
            if full_path.is_dir():
                tree.append({
                    "name":     item,
                    "type":     "directory",
                    "path":     relative_path,
                    "children": build_tree(full_path),
                })
            elif item.endswith(".feature"):
                tree.append({"name": item, "type": "file", "path": relative_path})
        return tree

    try:
        return [{"name": "Features", "type": "directory", "path": "", "children": build_tree(FEATURES_DIR)}]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/features/validate")
async def validate_feature(payload: ValidateFeatureRequest):
    """
    Valida un archivo .feature usando behave --dry-run para encontrar pasos no definidos.
    """
    try:
        from api.config import PROJECT_ROOT
        full_path = (FEATURES_DIR / payload.path).resolve()
        if not str(full_path).startswith(str(FEATURES_DIR.resolve())):
            raise HTTPException(status_code=403, detail="Access denied")

        venv_python = PROJECT_ROOT / ".venv" / "Scripts" / "python.exe"
        if not venv_python.exists():
            venv_python = sys.executable

        cmd    = [str(venv_python), "-m", "behave", "--dry-run", "-f", "json", str(full_path)]
        result = subprocess.run(cmd, cwd=str(PROJECT_ROOT), capture_output=True, text=True, encoding="utf-8", errors="replace")
        output = result.stdout
        stderr = result.stderr

        undefined_steps: list = []
        snippets:        list = []
        is_valid = True
        execution_error = None

        json_start = output.find("[")
        json_end   = output.rfind("]")
        report = None
        if json_start != -1 and json_end != -1 and json_end > json_start:
            import json
            try:
                report = json.loads(output[json_start : json_end + 1])
                for feature in report:
                    if feature.get("status") == "error":
                        is_valid = False
                    for element in feature.get("elements", []):
                        if element.get("status") == "error":
                            is_valid = False
                        for step in element.get("steps", []):
                            status = step.get("result", {}).get("status")
                            is_undefined = (status == "undefined") or ("match" not in step)
                            if is_undefined:
                                is_valid = False
                                undefined_steps.append({
                                    "keyword": step.get("keyword", ""),
                                    "name":    step.get("name", ""),
                                    "line":    step.get("location", "").split(":")[-1] if step.get("location") else "1",
                                })
            except Exception:
                pass

        if not report and result.returncode != 0:
            is_valid = False
            execution_error = (stderr or output or "Error de validación desconocido").strip()

        import re
        snippet_pattern = re.compile(
            r"(@(?:given|when|then)\(u?'.*?'\)\s+def step_impl\(context\):.*?)(?=@|$)", re.DOTALL
        )
        all_output = output + "\n" + stderr
        found_snippets = snippet_pattern.findall(all_output)
        snippets = [s.strip() for s in found_snippets]

        # Si encontramos snippets, definitivamente no es válido
        if snippets:
            is_valid = False

        return {
            "valid":           is_valid,
            "undefined_steps": undefined_steps,
            "snippets":        snippets,
            "error":           execution_error,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/features/{filepath:path}")
def get_feature_content(filepath: str):
    """Obtiene el contenido de un archivo .feature."""
    try:
        full_path = (FEATURES_DIR / filepath).resolve()
        if not str(full_path).startswith(str(FEATURES_DIR.resolve())):
            raise HTTPException(status_code=403, detail="Acceso denegado")
        if not full_path.exists():
            raise HTTPException(status_code=404, detail="Archivo no encontrado")
        with open(str(full_path), "r", encoding="utf-8", newline="") as f:
            content = f.read()
        return {"path": filepath, "content": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/features/{filepath:path}")
async def save_feature_content(filepath: str, payload: SaveFeatureRequest):
    """Guarda el contenido de un archivo .feature."""
    try:
        full_path = (FEATURES_DIR / filepath).resolve()
        if not str(full_path).startswith(str(FEATURES_DIR.resolve())):
            raise HTTPException(status_code=403, detail="Acceso denegado")
        with open(str(full_path), "w", encoding="utf-8", newline="") as f:
            f.write(payload.content)
        return {"message": f"File '{filepath}' saved successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/directories", status_code=201)
async def create_directory(payload: CreateDirRequest):
    """Crea un nuevo directorio dentro de features/."""
    try:
        full_path = (FEATURES_DIR / payload.path).resolve()
        if not str(full_path).startswith(str(FEATURES_DIR.resolve())):
            raise HTTPException(status_code=403, detail="Ruta inválida o acceso denegado")
        if full_path.exists():
            raise HTTPException(status_code=409, detail=f"El directorio o archivo '{payload.path}' ya existe.")
        full_path.mkdir(parents=True, exist_ok=True)
        return {"message": f"Directorio '{payload.path}' creado exitosamente."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/files", status_code=201)
async def create_file(payload: CreateFileRequest):
    """Crea un nuevo archivo .feature."""
    try:
        path = payload.path
        if not path.endswith(".feature"):
            path += ".feature"
        full_path = (FEATURES_DIR / path).resolve()
        if not str(full_path).startswith(str(FEATURES_DIR.resolve())):
            raise HTTPException(status_code=403, detail="Ruta inválida o acceso denegado")
        if full_path.exists():
            raise HTTPException(status_code=409, detail=f"El archivo '{path}' ya existe.")
        default_content = "Feature: Nuevo Feature\n\n  Scenario: Nuevo escenario\n    Given \n    When \n    Then "
        with open(str(full_path), "w", encoding="utf-8", newline="") as f:
            f.write(default_content)
        return {"message": f"Archivo '{path}' creado exitosamente."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/execution-order/refresh")
def refresh_execution_order():
    """Placeholder para refrescar datos de features."""
    return {"message": "Features refreshed successfully"}
