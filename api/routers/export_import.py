"""
api/routers/export_import.py
=============================
Export and import of test plans as .desb (ZIP) archives.

GET  /api/export-plan/{plan_id}  – download a .desb file
POST /api/import-plan            – upload a .desb file and merge into project
"""
from __future__ import annotations

import io
import json
import os
import re
import shutil
import tempfile
import zipfile
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response

from api.config import FEATURES_DIR, IMAGES_DIR
from api.db import _load_blueprints, _save_blueprints

router = APIRouter(tags=["Export/Import"])

_MD_IMG_RE = re.compile(r"!\[.*?\]\(.*?/api/resources/images/([^)]+)\)")


@router.get("/api/export-plan/{plan_id}")
def export_plan(
    plan_id: str,
    include_all_features: bool = False,
    include_images: bool = False,
):
    """
    Exports a test plan, its hierarchy, and required .feature files
    into a downloadable .desb (ZIP) file.

    Query params:
    - include_all_features: if True, all .feature files in the project are included,
      not only those referenced by the plan.
    - include_images: if True, images referenced inside the exported .feature files
      (via Markdown image syntax) are also bundled under images/ in the ZIP.
    """
    blueprints = _load_blueprints()

    plan = next((p for p in blueprints.get("plans", []) if p["id"] == plan_id), None)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    export_data: dict = {"plans": [plan], "cycles": [], "sets": [], "flows": []}
    feature_paths: set = set()

    # Traverse hierarchy to collect used feature paths
    for item in plan.get("items", []):
        if item.get("type") == "cycle":
            cycle = next(
                (c for c in blueprints.get("cycles", []) if c["id"] == item["refId"]), None
            )
            if cycle and cycle not in export_data["cycles"]:
                export_data["cycles"].append(cycle)
                for c_item in cycle.get("items", []):
                    if c_item.get("type") == "set":
                        test_set = next(
                            (s for s in blueprints.get("sets", []) if s["id"] == c_item["refId"]), None
                        )
                        if test_set and test_set not in export_data["sets"]:
                            export_data["sets"].append(test_set)
                            for s_item in test_set.get("items", []):
                                if s_item.get("type") == "flow":
                                    flow = next(
                                        (f for f in blueprints.get("flows", []) if f["id"] == s_item["refId"]),
                                        None,
                                    )
                                    if flow and flow not in export_data["flows"]:
                                        export_data["flows"].append(flow)
                                        for f_item in flow.get("items", []):
                                            if f_item.get("type") == "scenario" and f_item.get("featurePath"):
                                                feature_paths.add(f_item["featurePath"])
                                elif s_item.get("type") == "feature" and s_item.get("featurePath"):
                                    feature_paths.add(s_item["featurePath"])

    # If requested, extend to ALL .feature files in the project
    if include_all_features:
        for root, _, files in os.walk(str(FEATURES_DIR)):
            for fname in files:
                if fname.endswith(".feature"):
                    rel = os.path.relpath(os.path.join(root, fname), str(FEATURES_DIR)).replace("\\", "/")
                    feature_paths.add(rel)

    # Collect image paths referenced inside .feature files (Markdown syntax)
    image_rel_paths: set = set()
    if include_images:
        for fpath in feature_paths:
            full_path = FEATURES_DIR / fpath
            if full_path.exists() and full_path.is_file():
                try:
                    content = full_path.read_text(encoding="utf-8", errors="ignore")
                    for match in _MD_IMG_RE.finditer(content):
                        image_rel_paths.add(match.group(1))
                except Exception:
                    pass

    # Create ZIP archive in memory
    memory_file = io.BytesIO()
    with zipfile.ZipFile(memory_file, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("blueprints_export.json", json.dumps(export_data, indent=2))

        for fpath in feature_paths:
            full_path = FEATURES_DIR / fpath
            if full_path.exists() and full_path.is_file():
                zf.write(full_path, arcname=f"features/{fpath}")

        for img_rel in image_rel_paths:
            img_full = IMAGES_DIR / img_rel
            if img_full.exists() and img_full.is_file():
                zf.write(img_full, arcname=f"images/{img_rel}")

    memory_file.seek(0)
    headers = {
        "Content-Disposition": f'attachment; filename="{plan.get("name", "plan")}.desb"'
    }
    return Response(memory_file.read(), media_type="application/octet-stream", headers=headers)


@router.get("/api/export-all-features")
def export_all_features():
    """
    Exports all .feature files in the project into a downloadable ZIP archive.
    """
    memory_file = io.BytesIO()
    with zipfile.ZipFile(memory_file, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, _, files in os.walk(str(FEATURES_DIR)):
            for fname in files:
                if fname.endswith(".feature"):
                    full_path = Path(root) / fname
                    rel_path = os.path.relpath(full_path, str(FEATURES_DIR)).replace("\\", "/")
                    zf.write(full_path, arcname=rel_path)

    memory_file.seek(0)
    headers = {
        "Content-Disposition": 'attachment; filename="all_features.zip"'
    }
    return Response(memory_file.read(), media_type="application/octet-stream", headers=headers)


@router.post("/api/import-features")
async def import_features(file: UploadFile = File(...)):
    """
    Imports .feature files from an uploaded ZIP archive.
    """
    if not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="El archivo debe tener extensión .zip")

    try:
        content = await file.read()
        memory_file = io.BytesIO(content)

        imported_count = 0
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            with zipfile.ZipFile(memory_file, "r") as zf:
                zf.extractall(tmp_path)

            for root, _, files in os.walk(str(tmp_path)):
                for fname in files:
                    if fname.endswith(".feature"):
                        full_path = Path(root) / fname
                        rel_path = os.path.relpath(full_path, tmp_path).replace("\\", "/")
                        dest_path = FEATURES_DIR / rel_path
                        dest_path.parent.mkdir(parents=True, exist_ok=True)
                        shutil.copy2(full_path, dest_path)
                        imported_count += 1

        return {
            "status": "success",
            "message": f"Se importaron {imported_count} features correctamente.",
            "count": imported_count
        }
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="El archivo no es un ZIP válido")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))




@router.post("/api/import-plan")
async def import_plan(file: UploadFile = File(...)):
    """
    Imports a .desb file containing a test plan and its features.
    Merges the blueprints and overwrites .feature files.
    If the archive contains an images/ folder, those images are also imported.
    """
    if not file.filename.endswith(".desb"):
        raise HTTPException(status_code=400, detail="El archivo debe tener extensión .desb")

    try:
        content     = await file.read()
        memory_file = io.BytesIO(content)

        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            with zipfile.ZipFile(memory_file, "r") as zf:
                zf.extractall(tmp_path)

            export_json_path = tmp_path / "blueprints_export.json"
            if not export_json_path.exists():
                raise HTTPException(
                    status_code=400,
                    detail="Archivo .desb inválido: falta blueprints_export.json",
                )

            with open(export_json_path, "r", encoding="utf-8") as f:
                import_data = json.load(f)

            # Copy feature files
            features_tmp = tmp_path / "features"
            if features_tmp.exists() and features_tmp.is_dir():
                shutil.copytree(features_tmp, FEATURES_DIR, dirs_exist_ok=True)

            # Copy images (if present in the archive)
            images_imported = 0
            images_tmp = tmp_path / "images"
            if images_tmp.exists() and images_tmp.is_dir():
                shutil.copytree(images_tmp, IMAGES_DIR, dirs_exist_ok=True)
                images_imported = sum(1 for _ in images_tmp.rglob("*") if _.is_file())

            # Merge blueprints
            blueprints = _load_blueprints()
            for key in ("plans", "cycles", "sets", "flows"):
                if key not in import_data:
                    continue
                imported_items = import_data[key]
                existing_items = blueprints.get(key, [])
                for i_item in imported_items:
                    existing_items = [e for e in existing_items if e["id"] != i_item["id"]]
                    existing_items.append(i_item)
                blueprints[key] = existing_items

            _save_blueprints(blueprints)

            return {
                "status":          "success",
                "message":         "Plan importado correctamente",
                "images_imported": images_imported,
            }

    except zipfile.BadZipFile:
        raise HTTPException(
            status_code=400,
            detail="El archivo .desb está corrupto o no es un ZIP válido",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
