"""
api/db.py
=========
Thread-safe JSON file helpers for persisting plans and blueprints.
"""
from __future__ import annotations

import json
from threading import Lock
from typing import List

from api.config import BLUEPRINTS_DB_FILE, PLANS_DB_FILE

# ── Plans DB ───────────────────────────────────────────────────────────────────

_db_lock = Lock()


def _load_plans() -> List[dict]:
    with _db_lock:
        if not PLANS_DB_FILE.exists():
            return []
        try:
            with open(PLANS_DB_FILE, "r", encoding="utf-8") as fh:
                data = json.load(fh)
            return data if isinstance(data, list) else []
        except (json.JSONDecodeError, IOError):
            return []


def _save_plans(plans: List[dict]) -> None:
    with _db_lock:
        with open(PLANS_DB_FILE, "w", encoding="utf-8") as fh:
            json.dump(plans, fh, indent=2, ensure_ascii=False)


# ── Blueprints DB ──────────────────────────────────────────────────────────────

_blueprints_lock = Lock()

_EMPTY_BLUEPRINTS: dict = {"plans": [], "cycles": [], "sets": [], "flows": []}


def _load_blueprints() -> dict:
    with _blueprints_lock:
        if not BLUEPRINTS_DB_FILE.exists():
            return dict(_EMPTY_BLUEPRINTS)
        try:
            with open(BLUEPRINTS_DB_FILE, "r", encoding="utf-8") as fh:
                data = json.load(fh)
            return data if isinstance(data, dict) else dict(_EMPTY_BLUEPRINTS)
        except (json.JSONDecodeError, IOError):
            return dict(_EMPTY_BLUEPRINTS)


def _save_blueprints(data: dict) -> None:
    with _blueprints_lock:
        with open(BLUEPRINTS_DB_FILE, "w", encoding="utf-8") as fh:
            json.dump(data, fh, indent=2, ensure_ascii=False)
