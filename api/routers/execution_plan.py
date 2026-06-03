"""
api/routers/execution_plan.py
==============================
Endpoints for managing the execution order and module configuration.

GET  /api/execution-order
PUT  /api/execution-order
GET  /api/modules
POST /api/modules
PUT  /api/modules/{module_name}/features/tags
PUT  /api/modules/{module_name}/color
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from api.config import plan_manager

router = APIRouter(tags=["Execution Plan"])


@router.get("/api/execution-order")
def get_execution_order(request: Request):
    """Lee y devuelve el contenido de run_list.json."""
    try:
        if not plan_manager:
            raise HTTPException(status_code=500, detail="ExecutionPlanManager not available")

        include_inactive = request.query_params.get("include_inactive", "false").lower() == "true"
        sequence = plan_manager.get_sequence()

        if not include_inactive:
            sequence = [m for m in sequence if m.get("active")]

        for module in sequence:
            for feature in module.get("features", []):
                feature["id"] = (
                    f"feature::{module['module_name']}::"
                    f"{feature.get('feature_dir', '')}/{feature['feature_file']}"
                )

        return sequence
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/api/execution-order")
async def save_execution_order(request: Request):
    """Guarda una nueva secuencia de ejecución."""
    try:
        if not plan_manager:
            raise HTTPException(status_code=500, detail="ExecutionPlanManager not available")

        new_sequence      = await request.json()
        updated_sequence  = plan_manager.update_sequence(new_sequence)

        for module in updated_sequence:
            for feature in module.get("features", []):
                feature["id"] = (
                    f"feature::{module['module_name']}::"
                    f"{feature.get('feature_dir', '')}/{feature['feature_file']}"
                )

        return updated_sequence
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/modules")
def get_modules(request: Request):
    """Lista módulos del plan."""
    return get_execution_order(request)


@router.post("/api/modules")
async def add_module(request: Request):
    """Agrega un nuevo módulo."""
    try:
        data        = await request.json()
        module_name = data.get("module_name")
        order       = data.get("order")
        if not module_name or order is None:
            raise HTTPException(status_code=400, detail="module_name and order required")
        return plan_manager.add_module(module_name, int(order))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/api/modules/{module_name}/features/tags")
async def update_feature_tags(module_name: str, request: Request):
    """Actualiza tags de un feature."""
    try:
        data         = await request.json()
        feature_file = data.get("feature_file")
        feature_dir  = data.get("feature_dir", "")
        tags         = data.get("tags")
        return plan_manager.update_feature_tags(module_name, feature_file, feature_dir, tags)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/api/modules/{module_name}/color")
async def update_module_color(module_name: str, request: Request):
    """Actualiza el color de un módulo."""
    try:
        data  = await request.json()
        color = data.get("color")
        return plan_manager.update_module_color(module_name, color)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
