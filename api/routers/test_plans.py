"""
api/routers/test_plans.py
==========================
CRUD for legacy test plans (test_plans.json).

GET    /api/test-plans
GET    /api/test-plans/{plan_id}
POST   /api/test-plans
PUT    /api/test-plans
DELETE /api/test-plans/{plan_id}
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, HTTPException, Request

from api.db import _load_plans, _save_plans
from api.models import TestPlanIn

router = APIRouter(tags=["Test Plans"])


@router.get("/api/test-plans", response_model=List[dict])
def list_test_plans():
    """Return all saved Test Plans."""
    return _load_plans()


@router.put("/api/test-plans")
async def save_all_plans(request: Request):
    """Save the full list of Test Plans."""
    data = await request.json()
    _save_plans(data)
    return data


@router.get("/api/test-plans/{plan_id}")
def get_test_plan(plan_id: str):
    """Return a single Test Plan by ID."""
    for plan in _load_plans():
        if plan.get("id") == plan_id:
            return plan
    raise HTTPException(status_code=404, detail=f"Plan '{plan_id}' not found.")


@router.post("/api/test-plans", status_code=201)
def save_test_plan(payload: TestPlanIn):
    """
    Upsert a Test Plan.
    - If the payload carries an existing `id`, the plan is updated in place.
    - If `id` is absent or new, a UUID is generated and the plan is inserted.
    """
    plans     = _load_plans()
    plan_dict = payload.model_dump()

    if not plan_dict.get("id"):
        plan_dict["id"] = str(uuid.uuid4())

    plan_dict["updated_at"] = datetime.now(timezone.utc).isoformat()

    replaced = False
    for i, existing in enumerate(plans):
        if existing.get("id") == plan_dict["id"]:
            plans[i]  = plan_dict
            replaced  = True
            break

    if not replaced:
        plan_dict.setdefault("created_at", plan_dict["updated_at"])
        plans.append(plan_dict)

    _save_plans(plans)

    return {
        "message":  "Plan saved successfully.",
        "plan_id":  plan_dict["id"],
        "action":   "updated" if replaced else "created",
    }


@router.delete("/api/test-plans/{plan_id}")
def delete_test_plan(plan_id: str):
    """Delete a Test Plan by ID."""
    plans     = _load_plans()
    new_plans = [p for p in plans if p.get("id") != plan_id]
    if len(new_plans) == len(plans):
        raise HTTPException(status_code=404, detail=f"Plan '{plan_id}' not found.")
    _save_plans(new_plans)
    return {"message": f"Plan '{plan_id}' deleted."}
