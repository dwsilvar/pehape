#!/usr/bin/env python3
"""
orchestrator_api.py — FastAPI entry point for the Test Orchestrator Engine
===========================================================================
Spec: test-orchestrator-backend-api-spec-v1

Run:
  uvicorn orchestrator_api:app --host 0.0.0.0 --port 5001 --reload

This file is intentionally thin: it imports the pre-configured FastAPI
application from api.config and registers all domain routers. All business
logic lives in the api/ package.
"""
from __future__ import annotations

# ── Application & routers ──────────────────────────────────────────────────────

from api.config import app                          # noqa: F401  (re-exported for uvicorn)
from api.config import ALLURE_REPORT, ORCHESTRATOR, PLANS_DB_FILE  # health endpoint
from api.routers import (
    blueprints,
    execution,
    execution_plan,
    export_import,
    features,
    ocr,
    reports,
    test_plans,
    tools,
)

# Register all routers
app.include_router(blueprints.router)
app.include_router(features.router)
app.include_router(ocr.router)
app.include_router(reports.router)
app.include_router(execution_plan.router)
app.include_router(execution.router)
app.include_router(test_plans.router)
app.include_router(tools.router)
app.include_router(export_import.router)


# ── Utility endpoints ──────────────────────────────────────────────────────────

@app.get("/health", tags=["Health"])
def health_check():
    """Simple health check endpoint."""
    return {
        "status":               "ok",
        "orchestrator_exists":  ORCHESTRATOR.exists(),
        "plans_db":             str(PLANS_DB_FILE),
        "allure_report_ready":  ALLURE_REPORT.exists() and any(ALLURE_REPORT.iterdir()),
        "report_url":           "/allure-report/index.html",
    }


# ── Dev entrypoint ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "orchestrator_api:app",
        host="0.0.0.0",
        port=5001,
        reload=True,
        log_level="info",
    )
