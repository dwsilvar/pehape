"""
api/routers/blueprints.py
=========================
GET /api/blueprints   – retrieve all blueprints
PUT /api/blueprints   – overwrite all blueprints
"""
from __future__ import annotations

from fastapi import APIRouter

from api.db import _load_blueprints, _save_blueprints

router = APIRouter(tags=["Blueprints"])


@router.get("/api/blueprints")
def get_blueprints():
    """Retrieve all blueprints from blueprints.json."""
    return _load_blueprints()


@router.put("/api/blueprints")
def update_blueprints(payload: dict):
    """Overwrite all blueprints in blueprints.json."""
    _save_blueprints(payload)
    return {"message": "Blueprints saved successfully."}
