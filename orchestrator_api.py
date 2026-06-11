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
    settings,
    test_plans,
    tools,
)

# Register all routers
app.include_router(blueprints.router)
app.include_router(features.router)
app.include_router(ocr.router)
app.include_router(reports.router)
app.include_router(settings.router)
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


# ── Serve React Frontend ───────────────────────────────────────────────────────

import os
from pathlib import Path
from fastapi.responses import FileResponse
from fastapi import HTTPException

FRONTEND_DIST = Path(__file__).parent / "frontend" / "dist"

@app.get("/{path:path}", tags=["Frontend"])
async def serve_react_app(path: str):
    # Avoid intercepting API routes or Allure report
    if path.startswith("api/") or path.startswith("allure-report/") or path.startswith("health"):
        raise HTTPException(status_code=404, detail=f"Endpoint not found: /{path}")
    
    file_path = FRONTEND_DIST / path
    if path and file_path.exists() and file_path.is_file():
        return FileResponse(str(file_path))
    
    index_html = FRONTEND_DIST / "index.html"
    if index_html.exists():
        return FileResponse(str(index_html))
    
    raise HTTPException(status_code=404, detail="Frontend build not found. Please compile frontend.")


# ── Dev/Prod entrypoint ────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse
    import threading
    import time
    import sys
    import uvicorn

    parser = argparse.ArgumentParser(description='PeHaPe FastAPI Orchestrator Server')
    parser.add_argument('--window', action='store_true', 
                        help='Launch in native window mode (uses pywebview with Edge WebView2)')
    parser.add_argument('--no-window', action='store_true', 
                        help='Launch as server only for network access (default)')
    parser.add_argument('--network', action='store_true',
                        help='Alias for --no-window, launch as network server')
    parser.add_argument('--host', type=str, default=None,
                        help='Host to bind to')
    parser.add_argument('--port', type=int, default=None,
                        help='Port to bind to')
    args = parser.parse_args()

    # Load configuration from config/config.py
    try:
        from config.config import BACKEND_HOST, BACKEND_PORT
        host = BACKEND_HOST
        port = BACKEND_PORT
    except ImportError:
        host = "0.0.0.0"
        port = 5001

    # CLI arguments override config file
    if args.host:
        host = args.host
    if args.port:
        port = args.port

    # If --window is set, host should be localhost for security
    if args.window:
        host = "127.0.0.1"

    if args.window:
        print("=" * 50)
        print("Starting PeHaPe in NATIVE WINDOW MODE (FastAPI)")
        print("=" * 50)
        
        try:
            import webview
        except ImportError:
            print("\n" + "=" * 50)
            print("ERROR: pywebview is not installed!")
            print("=" * 50)
            print("\nPlease install it with:")
            print("  pip install pywebview")
            sys.exit(1)
            
        # Start FastAPI in a background thread
        def start_fastapi():
            uvicorn.run(
                "orchestrator_api:app",
                host=host,
                port=port,
                log_level="warning",
            )
            
        fastapi_thread = threading.Thread(target=start_fastapi, daemon=True)
        fastapi_thread.start()
        
        print(f"Starting FastAPI server on http://{host}:{port}...")
        time.sleep(2)
        
        print("Creating native window...")
        window = webview.create_window(
            'PeHaPe - Automation Framework',
            f'http://{host}:{port}',
            width=1280,
            height=800,
            resizable=True,
            fullscreen=False,
            min_size=(800, 600)
        )
        print("Launching application window...")
        webview.start()
    else:
        print("=" * 50)
        print("Starting PeHaPe in SERVER MODE (FastAPI)")
        print(f"Server will be accessible at http://{host}:{port}")
        print("=" * 50)
        
        # In server mode, run synchronously
        uvicorn.run(
            "orchestrator_api:app",
            host=host,
            port=port,
            reload=True,
            log_level="info",
        )
