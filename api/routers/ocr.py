"""
api/routers/ocr.py
==================
Endpoints for OCR image management.

GET  /api/ocr-images
GET  /api/ocr-images/{filepath}
GET  /api/resources/images/{filepath}
POST /api/images/upload
POST /api/images/link
"""
from __future__ import annotations

import hashlib
import json
import os
import shutil
import time
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse

from api.config import IMAGES_DIR

router = APIRouter(tags=["OCR"])


def _load_ocr_mapping() -> dict:
    mapping_path = IMAGES_DIR / "ocr_mapping.json"
    if mapping_path.exists():
        with open(mapping_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def _save_ocr_mapping(mapping: dict) -> None:
    mapping_path = IMAGES_DIR / "ocr_mapping.json"
    with open(mapping_path, "w", encoding="utf-8") as f:
        json.dump(mapping, f, indent=4, ensure_ascii=False)


@router.get("/api/ocr-images")
def list_ocr_images():
    """Lista recursivamente todas las imágenes en resources/images."""
    try:
        mapping = _load_ocr_mapping()

        def get_images_in_dir(path):
            images = []
            if not path.exists():
                return images
            for item in sorted(os.listdir(str(path))):
                full_path = path / item
                if full_path.is_dir():
                    images.extend(get_images_in_dir(full_path))
                elif item.lower().endswith((".png", ".jpg", ".jpeg", ".gif")):
                    rel_path  = os.path.relpath(str(full_path), str(IMAGES_DIR)).replace("\\", "/")
                    path_parts = rel_path.split("/")

                    img_entry = {
                        "relative_path":     rel_path,
                        "filename":          item,
                        "key_text":          os.path.splitext(item)[0],
                        "full_path_parts":   path_parts,
                        "associated_texts":  [],
                        "mapped_to":         [],
                        "is_mapped":         False,
                    }

                    for feat_key, feat_data in mapping.items():
                        if feat_key == "generic" and isinstance(feat_data, list):
                            for step in feat_data:
                                if step.get("id") == item:
                                    img_entry["key_text"] = step.get("original_text", img_entry["key_text"])
                                    img_entry["associated_texts"].extend(step.get("texts", []))
                                    img_entry["is_mapped"] = True
                                    img_entry["mapped_to"].append({
                                        "feature":    "generic",
                                        "tag":        None,
                                        "text":       step.get("original_text"),
                                        "full_steps": step.get("texts", []),
                                    })
                        elif isinstance(feat_data, dict):
                            for tag_name, tag_info in feat_data.items():
                                if not isinstance(tag_info, dict):
                                    continue
                                for step in tag_info.get("steps", []):
                                    if step.get("id") == item:
                                        img_entry["key_text"] = step.get("original_text", img_entry["key_text"])
                                        img_entry["associated_texts"].extend(step.get("texts", []))
                                        img_entry["is_mapped"] = True
                                        img_entry["mapped_to"].append({
                                            "feature":    feat_key,
                                            "tag":        tag_name,
                                            "text":       step.get("original_text"),
                                            "full_steps": step.get("texts", []),
                                        })

                    images.append(img_entry)
            return images

        return get_images_in_dir(IMAGES_DIR)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/ocr-images/{filepath:path}")
def get_ocr_image(filepath: str):
    """Sirve un archivo de imagen OCR."""
    try:
        full_path = (IMAGES_DIR / filepath).resolve()
        if not str(full_path).startswith(str(IMAGES_DIR.resolve())):
            raise HTTPException(status_code=403, detail="Acceso denegado")
        if not full_path.exists():
            raise HTTPException(status_code=404, detail="Imagen no encontrada")
        return FileResponse(str(full_path))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/resources/images/{filepath:path}")
def get_resource_image(filepath: str):
    """Endpoint de compatibilidad para servir imágenes OCR."""
    return get_ocr_image(filepath)


@router.post("/api/images/upload")
async def upload_image(
    file: UploadFile = File(...),
    text: str = Form(...),
    step_text: Optional[str] = Form(None),
    is_generic: bool = Form(False),
    feature_path: Optional[str] = Form(None),
    tag: Optional[str] = Form(None),
):
    """
    Sube una imagen OCR y actualiza ocr_mapping.json.
    """
    try:
        timestamp  = int(time.time())
        text_hash  = hashlib.md5(text.encode()).hexdigest()[:8]
        unique_id  = f"img_{timestamp}_{text_hash}.png"
        mapping    = _load_ocr_mapping()

        if is_generic:
            generic_dir = IMAGES_DIR / "features" / "generic"
            generic_dir.mkdir(parents=True, exist_ok=True)
            target_path = generic_dir / unique_id
            with open(target_path, "wb") as buf:
                shutil.copyfileobj(file.file, buf)

            if "generic" not in mapping:
                mapping["generic"] = []
            mapping["generic"].append({
                "id":            unique_id,
                "texts":         [step_text] if step_text else [text],
                "original_text": text,
            })
            _save_ocr_mapping(mapping)
            return {"message": "Generic image saved", "id": unique_id, "is_generic": True}
        else:
            if not feature_path or not tag:
                raise HTTPException(status_code=400, detail="Missing feature_path or tag")
            if not tag.startswith("@"):
                tag = f"@{tag}"

            clean_feat_path = feature_path.replace(".feature", "")
            target_dir      = IMAGES_DIR / clean_feat_path / tag.lstrip("@")
            target_dir.mkdir(parents=True, exist_ok=True)
            target_path = target_dir / unique_id
            with open(target_path, "wb") as buf:
                shutil.copyfileobj(file.file, buf)

            feat_key = feature_path.replace("\\", "/")
            if feat_key not in mapping:
                mapping[feat_key] = {}
            if tag not in mapping[feat_key]:
                mapping[feat_key][tag] = {"steps": []}
            mapping[feat_key][tag]["steps"].append({
                "id":            unique_id,
                "texts":         [step_text] if step_text else [text],
                "original_text": text,
            })
            _save_ocr_mapping(mapping)
            return {"message": "Image saved and mapped", "id": unique_id, "path": str(target_path)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/images/link")
async def link_image(request: Request):
    """Vincular una imagen existente a un nuevo patrón."""
    try:
        data              = await request.json()
        source_rel_path   = data.get("source_relative_path")
        text              = data.get("text")
        step_text         = data.get("step_text")
        feature_path      = data.get("feature_path")
        tag               = data.get("tag")
        is_generic        = data.get("is_generic", False)

        if not source_rel_path or not text:
            raise HTTPException(status_code=400, detail="Missing data")

        mapping     = _load_ocr_mapping()
        img_filename = os.path.basename(source_rel_path)
        entry = {"id": img_filename, "texts": [step_text] if step_text else [], "original_text": text}

        if is_generic:
            if "generic" not in mapping:
                mapping["generic"] = []
            if not any(e.get("id") == img_filename and e.get("original_text") == text for e in mapping["generic"]):
                mapping["generic"].append(entry)
        else:
            if not feature_path:
                raise HTTPException(status_code=400, detail="feature_path required for non-generic link")
            feat_key = feature_path.replace("\\", "/")
            if feat_key not in mapping:
                mapping[feat_key] = {}
            tag_key = tag or "default"
            if tag_key not in mapping[feat_key]:
                mapping[feat_key][tag_key] = {"steps": []}
            steps = mapping[feat_key][tag_key].get("steps", [])
            if not any(e.get("id") == img_filename and e.get("original_text") == text for e in steps):
                steps.append(entry)
                mapping[feat_key][tag_key]["steps"] = steps

        _save_ocr_mapping(mapping)
        return {"message": "Image linked successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
