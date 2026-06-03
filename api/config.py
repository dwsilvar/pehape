"""
api/config.py
=============
Central configuration: paths, FastAPI app instance, CORS middleware,
static file mounts, and optional third-party imports.

Every other module in the `api` package imports from here.
"""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

# ── Project paths ──────────────────────────────────────────────────────────────

PROJECT_ROOT = Path(__file__).parent.parent
BACKEND_DIR  = PROJECT_ROOT / "backend"

# Make sure backend helpers (ExecutionPlanManager, etc.) are importable
if str(BACKEND_DIR) not in sys.path:
    sys.path.append(str(BACKEND_DIR))

# ── Optional imports ────────────────────────────────────────────────────────────

try:
    from execution_plan_manager import ExecutionPlanManager
except ImportError:
    ExecutionPlanManager = None  # type: ignore[assignment,misc]

try:
    from behave.step_registry import registry
except ImportError:
    registry = None

try:
    from behave.parser import Parser
except ImportError:
    Parser = None

try:
    from executor.tasks_core.registry import get_all_tasks
except ImportError:
    get_all_tasks = lambda: {}  # noqa: E731

try:
    import pygetwindow as gw
except ImportError:
    gw = None

# ── Filesystem paths ───────────────────────────────────────────────────────────

FEATURES_DIR       = PROJECT_ROOT / "features"
PLANS_DB_FILE      = FEATURES_DIR / "test_plans.json"
BLUEPRINTS_DB_FILE = FEATURES_DIR / "blueprints.json"
RESOURCES_DIR      = PROJECT_ROOT / "resources"
IMAGES_DIR         = RESOURCES_DIR / "images"
ALLURE_RESULTS     = PROJECT_ROOT / "reports" / "allure_results"
ALLURE_REPORT      = PROJECT_ROOT / "reports" / "allure-report"
ORCHESTRATOR       = PROJECT_ROOT / "orchestrator.py"

# ── Singletons ─────────────────────────────────────────────────────────────────

plan_manager = ExecutionPlanManager(str(FEATURES_DIR)) if ExecutionPlanManager else None

# Ensure required directories exist at startup
FEATURES_DIR.mkdir(parents=True, exist_ok=True)
IMAGES_DIR.mkdir(parents=True, exist_ok=True)
PLANS_DB_FILE.parent.mkdir(parents=True, exist_ok=True)
ALLURE_RESULTS.mkdir(parents=True, exist_ok=True)
ALLURE_REPORT.mkdir(parents=True, exist_ok=True)

# ── FastAPI application ────────────────────────────────────────────────────────

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

app = FastAPI(
    title="Test Orchestrator API",
    description="Controller for saving Test Plans and triggering the Orchestrator Engine.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve the generated Allure report as a static site
if ALLURE_REPORT.exists():
    app.mount(
        "/allure-report",
        StaticFiles(directory=str(ALLURE_REPORT), html=True),
        name="allure_report",
    )
    # Compatibility with legacy frontend path
    app.mount(
        "/api/report",
        StaticFiles(directory=str(ALLURE_REPORT), html=True),
        name="legacy_report",
    )
