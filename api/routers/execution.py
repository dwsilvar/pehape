"""
api/routers/execution.py
=========================
Endpoints for triggering and monitoring orchestrator executions.

POST /api/execute-plan/{plan_id}
POST /api/execution-status/{task_id}/cancel
GET  /api/execution-status/{task_id}
GET  /api/execution-status/{task_id}/logs
GET  /api/execution-status/{task_id}/stream
GET  /api/executions
"""
from __future__ import annotations

import asyncio
import json
import uuid
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from fastapi.responses import StreamingResponse

from api.db import _load_blueprints
from api.models import ExecuteResponse, StatusResponse
from api.workers.orchestrator_worker import (
    ExecutionState,
    _convert_plan_to_orchestrator_format,
    _executions,
    _schedule_and_run_orchestrator,
    _state_lock,
)

router = APIRouter(tags=["Execution"])


@router.post("/api/execute-plan/{plan_id}", response_model=ExecuteResponse)
def execute_plan(
    plan_id: str,
    background_tasks: BackgroundTasks,
    scheduled_at: Optional[str] = None,
):
    """Trigger the execution of a specific Test Plan from Blueprints."""
    blueprints = _load_blueprints()
    plan = next((p for p in blueprints.get("plans", []) if p.get("id") == plan_id), None)
    if not plan:
        raise HTTPException(status_code=404, detail=f"Plan '{plan_id}' not found.")

    orchestrator_input = _convert_plan_to_orchestrator_format(plan, blueprints)
    plan_json_str      = json.dumps(orchestrator_input, ensure_ascii=False)

    task_id = str(uuid.uuid4())
    state   = ExecutionState(task_id=task_id, plan_id=plan_id)
    if scheduled_at:
        state.status       = "scheduled"
        state.scheduled_at = scheduled_at

    with _state_lock:
        _executions[task_id] = state

    background_tasks.add_task(
        _schedule_and_run_orchestrator, task_id, plan_id, plan_json_str, scheduled_at
    )

    return ExecuteResponse(
        task_id=task_id,
        plan_id=plan_id,
        status="scheduled" if scheduled_at else "pending",
        message=f"Execution queued. Poll status at /api/execution-status/{task_id}",
    )


@router.post("/api/execution-status/{task_id}/cancel")
def cancel_execution(task_id: str):
    """Cancels a scheduled execution."""
    with _state_lock:
        state = _executions.get(task_id)

    if not state:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found.")
    if state.status == "scheduled":
        state.is_cancelled = True
        return {"message": "Execution cancelled."}
    raise HTTPException(status_code=400, detail=f"Cannot cancel task in status '{state.status}'.")


@router.get("/api/execution-status/{task_id}", response_model=StatusResponse)
def get_execution_status(task_id: str):
    """Poll the status of a running/completed execution."""
    with _state_lock:
        state = _executions.get(task_id)

    if not state:
        raise HTTPException(
            status_code=404,
            detail=f"Task '{task_id}' not found. It may have expired or never existed.",
        )
    return StatusResponse(**state.to_dict())


@router.get("/api/execution-status/{task_id}/logs")
def get_execution_logs(task_id: str, since: int = 0):
    """
    Return captured log lines for a task.
    Query param `since` (int): return only lines from this index onward.
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


@router.get("/api/execution-status/{task_id}/stream", response_class=StreamingResponse)
async def stream_execution_logs(task_id: str, request: Request):
    """
    Server-Sent Events (SSE) stream of orchestrator stdout.
    """
    with _state_lock:
        state = _executions.get(task_id)

    if not state:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found.")

    async def event_generator():
        sent = 0
        while True:
            if await request.is_disconnected():
                break

            with state._lock:
                current_logs   = state.logs[sent:]
                new_sent       = len(state.logs)
                current_status = state.status

            for line in current_logs:
                payload = json.dumps({"line": line, "status": current_status})
                yield f"data: {payload}\n\n"
                # Yield control so each event is flushed as a separate SSE message.
                # This prevents scenario_status events from being batched together
                # (e.g. "running" + "passed" arriving in the same browser microtask).
                await asyncio.sleep(0)

            sent = new_sent

            if current_status in ("finished", "failed") and sent == new_sent:
                yield f"data: {json.dumps({'line': None, 'status': current_status, 'done': True})}\n\n"
                break

            # Poll at 50 ms so status transitions are near-real-time
            await asyncio.sleep(0.05)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/api/executions")
def list_executions():
    """List all tracked executions (task IDs, statuses, plan IDs)."""
    with _state_lock:
        return [s.to_dict() for s in _executions.values()]
