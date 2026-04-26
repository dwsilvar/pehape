#!/usr/bin/env python3
"""
orchestrator_api.py — FastAPI controller for the Test Orchestrator Engine
=========================================================================
Spec: test-orchestrator-backend-api-spec-v1

Endpoints:
  POST   /api/test-plans                   → Save / upsert a Test Plan to JSON DB
  GET    /api/test-plans                   → List all stored Test Plans
  GET    /api/test-plans/{plan_id}         → Get a single plan by ID
  DELETE /api/test-plans/{plan_id}         → Delete a plan
  POST   /api/execute-plan/{plan_id}       → Launch orchestrator.py as BackgroundTask
  GET    /api/execution-status/{task_id}   → Poll running / finished / failed + logs
  GET    /api/execution-status/{task_id}/logs → Stream logs via SSE
  GET    /allure-report/...                → Serve static Allure HTML report

Storage: JSON file (features/test_plans.json) — same file the existing Flask backend
         already reads/writes, so both servers share state seamlessly.

Run:
  uvicorn orchestrator_api:app --host 0.0.0.0 --port 5001 --reload
"""

from __future__ import annotations

import asyncio
import json
import os
import subprocess
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Any, Dict, List, Optional

from fastapi import BackgroundTasks, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

# ── Paths ──────────────────────────────────────────────────────────────────────

PROJECT_ROOT   = Path(__file__).parent
PLANS_DB_FILE  = PROJECT_ROOT / "features" / "test_plans.json"
ALLURE_RESULTS = PROJECT_ROOT / "reports" / "allure_results"
ALLURE_REPORT  = PROJECT_ROOT / "reports" / "allure-report"
ORCHESTRATOR   = PROJECT_ROOT / "orchestrator.py"

# Create directories if they don't exist yet
PLANS_DB_FILE.parent.mkdir(parents=True, exist_ok=True)
ALLURE_RESULTS.mkdir(parents=True, exist_ok=True)
ALLURE_REPORT.mkdir(parents=True, exist_ok=True)

# ── FastAPI app ────────────────────────────────────────────────────────────────

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

# Serve the generated Allure report as a static site at /allure-report
if ALLURE_REPORT.exists():
    app.mount(
        "/allure-report",
        StaticFiles(directory=str(ALLURE_REPORT), html=True),
        name="allure_report",
    )

# ── In-memory execution state store ───────────────────────────────────────────
# { task_id: ExecutionState }

_state_lock: Lock = Lock()
_executions: Dict[str, "ExecutionState"] = {}


class ExecutionState:
    """Thread-safe container for a single orchestrator run."""

    def __init__(self, task_id: str, plan_id: str):
        self.task_id    = task_id
        self.plan_id    = plan_id
        self.status     = "pending"   # pending | running | finished | failed
        self.started_at: Optional[str] = None
        self.ended_at:   Optional[str] = None
        self.scheduled_at: Optional[str] = None
        self.is_cancelled: bool        = False
        self.exit_code:  Optional[int] = None
        self.logs:       List[str]     = []
        self.report_url: Optional[str] = None
        self._lock = Lock()

    def append_log(self, line: str) -> None:
        with self._lock:
            self.logs.append(line)

    def to_dict(self) -> dict:
        with self._lock:
            return {
                "task_id":    self.task_id,
                "plan_id":    self.plan_id,
                "status":     self.status,
                "scheduled_at": self.scheduled_at,
                "started_at": self.started_at,
                "ended_at":   self.ended_at,
                "exit_code":  self.exit_code,
                "log_lines":  len(self.logs),
                "last_log":   self.logs[-1] if self.logs else None,
                "report_url": self.report_url,
            }


# ── JSON DB helpers ─────────────────────────────────────────────────────────────

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


# ── Pydantic models ─────────────────────────────────────────────────────────────

class ScenarioRef(BaseModel):
    id:           str
    featurePath:  str
    featureName:  Optional[str] = None
    scenarioName: str
    tags:         List[str]     = Field(default_factory=list)
    steps:        List[str]     = Field(default_factory=list)
    enabled:      bool          = True
    userdata:     Dict[str, str] = Field(default_factory=dict)


class TestFlowIn(BaseModel):
    id:        str
    name:      str
    scenarios: List[ScenarioRef] = Field(default_factory=list)


class TestCycleIn(BaseModel):
    id:        str
    name:      str
    enabled:   bool             = True
    flows:     List[TestFlowIn] = Field(default_factory=list)
    # Backward compatibility fields
    flowName:  Optional[str]    = None
    scenarios: Optional[List[ScenarioRef]] = None


class TestPlanIn(BaseModel):
    """
    Accepts both the UI format (cycles[] with scenarios[]) and the spec format
    (test_cycles[] with test_flows[]).  The id field is auto-generated if absent.
    """
    id:           Optional[str]        = None
    name:         str
    status:       str                  = "draft"
    enabled:      bool                 = True
    global_config: Dict[str, Any]      = Field(default_factory=dict)
    cycles:       List[TestCycleIn]    = Field(default_factory=list)


class ExecuteResponse(BaseModel):
    task_id:    str
    plan_id:    str
    status:     str
    message:    str


class StatusResponse(BaseModel):
    task_id:    str
    plan_id:    str
    status:     str
    started_at: Optional[str]
    ended_at:   Optional[str]
    exit_code:  Optional[int]
    log_lines:  int
    last_log:   Optional[str]
    report_url: Optional[str]


# ── Background worker ───────────────────────────────────────────────────────────

import time
import asyncio

def _schedule_and_run_orchestrator(task_id: str, plan_id: str, plan_json: str, scheduled_at: Optional[str] = None) -> None:
    """Wrapper that waits for scheduled_at before calling _run_orchestrator."""
    state = _executions[task_id]
    
    if scheduled_at:
        try:
            target_time = datetime.fromisoformat(scheduled_at.replace("Z", "+00:00"))
        except ValueError:
            target_time = datetime.now(timezone.utc)
            
        while True:
            if state.is_cancelled:
                state.status = "cancelled"
                state.ended_at = datetime.now(timezone.utc).isoformat()
                state.append_log("[ORCHESTRATOR] Execution cancelled before start.")
                return
                
            now = datetime.now(timezone.utc)
            if now >= target_time:
                break
                
            time.sleep(0.5)

    if state.is_cancelled:
        state.status = "cancelled"
        state.ended_at = datetime.now(timezone.utc).isoformat()
        state.append_log("[ORCHESTRATOR] Execution cancelled before start.")
        return

    _run_orchestrator(task_id, plan_id, plan_json)


def _run_orchestrator(task_id: str, plan_id: str, plan_json: str) -> None:
    """
    Executes orchestrator.py in a subprocess, capturing stdout/stderr
    line-by-line into the ExecutionState store.
    """
    state = _executions[task_id]
    state.status = "running"
    state.started_at = datetime.now(timezone.utc).isoformat()

    cmd = [
        sys.executable,
        str(ORCHESTRATOR),
        "--json", plan_json,
        "--results-dir", str(ALLURE_RESULTS),
        "--report-dir",  str(ALLURE_REPORT),
        "--features-dir", str(PROJECT_ROOT / "features"),
    ]

    state.append_log(f"[ORCHESTRATOR] Starting plan '{plan_id}'")
    state.append_log(f"[CMD] {' '.join(cmd)}")

    try:
        env = os.environ.copy()
        env["PYTHONIOENCODING"] = "utf-8"

        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,           # line-buffered
            encoding="utf-8",    # explicitly decode stdout as utf-8
            env=env,
        )

        # Stream lines into the state store
        for line in iter(proc.stdout.readline, ""):
            stripped = line.rstrip()
            if stripped:
                state.append_log(stripped)

        proc.stdout.close()
        proc.wait()

        state.exit_code = proc.returncode
        state.status = "finished" if proc.returncode == 0 else "failed"
        state.append_log(
            f"[ORCHESTRATOR] Completed with exit code {proc.returncode}"
        )

        # Attach report URL if report was generated
        if ALLURE_REPORT.exists() and any(ALLURE_REPORT.iterdir()):
            state.report_url = "/allure-report/index.html"
            state.append_log(f"[REPORT] Available at {state.report_url}")

    except FileNotFoundError:
        state.status = "failed"
        state.exit_code = -1
        state.append_log(
            "[ERROR] orchestrator.py not found. "
            f"Expected path: {ORCHESTRATOR}"
        )
    except Exception as exc:
        state.status = "failed"
        state.exit_code = -1
        state.append_log(f"[ERROR] Unexpected error: {exc}")
    finally:
        state.ended_at = datetime.now(timezone.utc).isoformat()


# ── Routes — Reports ────────────────────────────────────────────────────────────

@app.get("/api/reports/orchestrator-summary", tags=["Reports"])
def get_orchestrator_summary():
    """Return the summary JSON generated by orchestrator.py (Hierarchy + Results)"""
    summary_file = ALLURE_RESULTS.parent / "orchestrator_summary.json"
    if not summary_file.exists():
        # Return an empty structure if no plan has been run yet
        return {"test_cycles": []}
    
    try:
        with open(summary_file, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to read summary: {exc}")


# ── Routes — Test Plans ─────────────────────────────────────────────────────────

@app.get("/api/test-plans", response_model=List[dict], tags=["Test Plans"])
def list_test_plans():
    """Return all saved Test Plans."""
    return _load_plans()


@app.get("/api/test-plans/{plan_id}", tags=["Test Plans"])
def get_test_plan(plan_id: str):
    """Return a single Test Plan by ID."""
    plans = _load_plans()
    for plan in plans:
        if plan.get("id") == plan_id:
            return plan
    raise HTTPException(status_code=404, detail=f"Plan '{plan_id}' not found.")


@app.post("/api/test-plans", status_code=201, tags=["Test Plans"])
def save_test_plan(payload: TestPlanIn):
    """
    Upsert a Test Plan.
    - If the payload carries an existing `id`, the plan is updated in place.
    - If `id` is absent or new, a UUID is generated and the plan is inserted.
    """
    plans = _load_plans()

    plan_dict = payload.model_dump()

    # Auto-generate ID if absent
    if not plan_dict.get("id"):
        plan_dict["id"] = str(uuid.uuid4())

    plan_dict["updated_at"] = datetime.now(timezone.utc).isoformat()

    # Upsert
    replaced = False
    for i, existing in enumerate(plans):
        if existing.get("id") == plan_dict["id"]:
            plans[i] = plan_dict
            replaced = True
            break

    if not replaced:
        plan_dict.setdefault("created_at", plan_dict["updated_at"])
        plans.append(plan_dict)

    _save_plans(plans)

    return {
        "message": "Plan saved successfully.",
        "plan_id": plan_dict["id"],
        "action":  "updated" if replaced else "created",
    }


@app.delete("/api/test-plans/{plan_id}", tags=["Test Plans"])
def delete_test_plan(plan_id: str):
    """Delete a Test Plan by ID."""
    plans = _load_plans()
    new_plans = [p for p in plans if p.get("id") != plan_id]
    if len(new_plans) == len(plans):
        raise HTTPException(status_code=404, detail=f"Plan '{plan_id}' not found.")
    _save_plans(new_plans)
    return {"message": f"Plan '{plan_id}' deleted."}


# ── Routes — Execution ──────────────────────────────────────────────────────────

@app.post(
    "/api/execute-plan/{plan_id}",
    response_model=ExecuteResponse,
    tags=["Execution"],
)
def execute_plan(plan_id: str, background_tasks: BackgroundTasks, scheduled_at: Optional[str] = None):
    """
    Trigger the execution of a specific Test Plan.
    """
    # Retrieve plan
    plans = _load_plans()
    plan = next((p for p in plans if p.get("id") == plan_id), None)
    if not plan:
        raise HTTPException(status_code=404, detail=f"Plan '{plan_id}' not found.")

    # Convert UI plan format → orchestrator input format
    orchestrator_input = _convert_plan_to_orchestrator_format(plan)
    plan_json_str = json.dumps(orchestrator_input, ensure_ascii=False)

    # Create execution state
    task_id = str(uuid.uuid4())
    state = ExecutionState(task_id=task_id, plan_id=plan_id)
    if scheduled_at:
        state.status = "scheduled"
        state.scheduled_at = scheduled_at

    with _state_lock:
        _executions[task_id] = state

    # Launch background task
    background_tasks.add_task(_schedule_and_run_orchestrator, task_id, plan_id, plan_json_str, scheduled_at)

    return ExecuteResponse(
        task_id=task_id,
        plan_id=plan_id,
        status="scheduled" if scheduled_at else "pending",
        message=(
            f"Execution queued. Poll status at "
            f"/api/execution-status/{task_id}"
        ),
    )


@app.post(
    "/api/execution-status/{task_id}/cancel",
    tags=["Execution"],
)
def cancel_execution(task_id: str):
    """
    Cancels a scheduled execution.
    """
    with _state_lock:
        state = _executions.get(task_id)

    if not state:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found.")

    if state.status == "scheduled":
        state.is_cancelled = True
        return {"message": "Execution cancelled."}
    else:
        raise HTTPException(status_code=400, detail=f"Cannot cancel task in status '{state.status}'.")


def _convert_plan_to_orchestrator_format(plan: dict) -> dict:
    """
    Convert the UI-saved plan format (cycles[] → scenarios[])
    into the orchestrator engine format (test_cycles[] → test_flows[] → scenarios[]).
    """
    global_config = plan.get("global_config", {})

    test_cycles = []
    for cycle in plan.get("cycles", []):
        test_flows = []
        
        # Backward compatibility: if cycle has 'scenarios', treat it as a single flow
        legacy_scenarios = cycle.get("scenarios")
        if legacy_scenarios is not None and len(legacy_scenarios) > 0:
            flow = {
                "flow_id":   f"FLOW-{cycle.get('id', uuid.uuid4())[:8].upper()}",
                "flow_name": cycle.get('flowName') or "Sin Grupo",
                "enabled":   cycle.get("enabled", True),
                "scenarios": [
                    {
                        "feature_path":   s.get("featurePath", ""),
                        "scenario_name":  s.get("scenarioName", ""),
                        "tags":           s.get("tags", []),
                        "enabled":        s.get("enabled", True),
                        "userdata":       s.get("userdata", {}),
                    }
                    for s in legacy_scenarios
                ],
            }
            test_flows.append(flow)
        else:
            # New nested flows structure
            for f in cycle.get("flows", []):
                flow = {
                    "flow_id":   f.get("id", str(uuid.uuid4())),
                    "flow_name": f.get("name", "Unnamed Flow"),
                    "enabled":   True,
                    "scenarios": [
                        {
                            "feature_path":   s.get("featurePath", ""),
                            "scenario_name":  s.get("scenarioName", ""),
                            "tags":           s.get("tags", []),
                            "enabled":        s.get("enabled", True),
                            "userdata":       s.get("userdata", {}),
                        }
                        for s in f.get("scenarios", [])
                    ],
                }
                test_flows.append(flow)

        test_cycles.append({
            "cycle_id":   cycle.get("id", str(uuid.uuid4())),
            "cycle_name": cycle.get("name", "Cycle"),
            "enabled":    cycle.get("enabled", True),
            "test_flows": test_flows,
        })

    return {
        "plan_id":       plan.get("id", "UNKNOWN"),
        "name":          plan.get("name", "Test Plan"),
        "enabled":       plan.get("enabled", True),
        "global_config": global_config,
        "test_cycles":   test_cycles,
    }


# ── Routes — Status Polling ─────────────────────────────────────────────────────

@app.get(
    "/api/execution-status/{task_id}",
    response_model=StatusResponse,
    tags=["Execution"],
)
def get_execution_status(task_id: str):
    """
    Poll the status of a running/completed execution.
    Returns: status (pending/running/finished/failed), log count, last log line, report URL.
    """
    with _state_lock:
        state = _executions.get(task_id)

    if not state:
        raise HTTPException(
            status_code=404,
            detail=f"Task '{task_id}' not found. It may have expired or never existed.",
        )

    return StatusResponse(**state.to_dict())


@app.get(
    "/api/execution-status/{task_id}/logs",
    tags=["Execution"],
)
def get_execution_logs(task_id: str, since: int = 0):
    """
    Return captured log lines for a task.

    Query param `since` (int): return only lines from this index onward.
    Useful for polling — save the last `log_lines` count and send it as `since`
    on the next request to receive only new lines.
    """
    with _state_lock:
        state = _executions.get(task_id)

    if not state:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found.")

    with state._lock:
        slice_ = state.logs[since:]
        total  = len(state.logs)

    return {
        "task_id":    task_id,
        "status":     state.status,
        "since":      since,
        "next_since": total,
        "lines":      slice_,
    }


@app.get(
    "/api/execution-status/{task_id}/stream",
    tags=["Execution"],
    response_class=StreamingResponse,
)
async def stream_execution_logs(task_id: str, request: Request):
    """
    Server-Sent Events (SSE) stream of orchestrator stdout.
    The frontend can connect with EventSource and receive live log lines.

    Example (JS):
        const es = new EventSource(`/api/execution-status/${taskId}/stream`);
        es.onmessage = (e) => console.log(JSON.parse(e.data));
    """
    with _state_lock:
        state = _executions.get(task_id)

    if not state:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found.")

    async def event_generator():
        sent = 0
        while True:
            # Check if client disconnected
            if await request.is_disconnected():
                break

            with state._lock:
                current_logs = state.logs[sent:]
                new_sent     = len(state.logs)
                current_status = state.status

            for line in current_logs:
                payload = json.dumps({"line": line, "status": current_status})
                yield f"data: {payload}\n\n"

            sent = new_sent

            # Stop streaming when execution completes
            if current_status in ("finished", "failed") and sent == new_sent:
                # Send a final status event
                yield f"data: {json.dumps({'line': None, 'status': current_status, 'done': True})}\n\n"
                break

            await asyncio.sleep(0.5)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",   # Disable nginx buffering
        },
    )


# ── Routes — Utility ────────────────────────────────────────────────────────────

@app.get("/api/executions", tags=["Execution"])
def list_executions():
    """List all tracked executions (task IDs, statuses, plan IDs)."""
    with _state_lock:
        return [s.to_dict() for s in _executions.values()]


@app.get("/health", tags=["Health"])
def health_check():
    """Simple health check endpoint."""
    return {
        "status": "ok",
        "orchestrator_exists": ORCHESTRATOR.exists(),
        "plans_db":            str(PLANS_DB_FILE),
        "allure_report_ready": ALLURE_REPORT.exists() and any(ALLURE_REPORT.iterdir()),
        "report_url":          "/allure-report/index.html",
    }


# ── Dev entrypoint ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "orchestrator_api:app",
        host="0.0.0.0",
        port=5001,
        reload=True,
        log_level="info",
    )
