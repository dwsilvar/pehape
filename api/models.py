"""
api/models.py
=============
All Pydantic request/response models used across the API.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ── Blueprint / Test-Plan models ───────────────────────────────────────────────

class ScenarioRef(BaseModel):
    id:           str
    featurePath:  str
    featureName:  Optional[str] = None
    scenarioName: str
    tags:         List[str]      = Field(default_factory=list)
    steps:        List[str]      = Field(default_factory=list)
    enabled:      bool           = True
    userdata:     Dict[str, str] = Field(default_factory=dict)


class TestFlowIn(BaseModel):
    id:        str
    name:      str
    scenarios: List[ScenarioRef] = Field(default_factory=list)


class TestCycleIn(BaseModel):
    id:        str
    name:      str
    enabled:   bool                        = True
    flows:     List[TestFlowIn]            = Field(default_factory=list)
    # Backward compatibility fields
    flowName:  Optional[str]               = None
    scenarios: Optional[List[ScenarioRef]] = None


class TestPlanIn(BaseModel):
    """
    Accepts both the UI format (cycles[] with scenarios[]) and the spec format
    (test_cycles[] with test_flows[]).  The id field is auto-generated if absent.
    """
    id:           Optional[str]     = None
    name:         str
    status:       str               = "draft"
    enabled:      bool              = True
    global_config: Dict[str, Any]  = Field(default_factory=dict)
    cycles:       List[TestCycleIn] = Field(default_factory=list)


# ── Execution response models ──────────────────────────────────────────────────

class ExecuteResponse(BaseModel):
    task_id:  str
    plan_id:  str
    status:   str
    message:  str


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
    scheduled_at: Optional[str] = None


# ── Request body models ────────────────────────────────────────────────────────

class CleanRequest(BaseModel):
    target: str


class ValidateFeatureRequest(BaseModel):
    path: str


class SaveFeatureRequest(BaseModel):
    content: str


class CreateDirRequest(BaseModel):
    path: str


class CreateFileRequest(BaseModel):
    path: str


class CheckLiteralRequest(BaseModel):
    text:           str
    case_sensitive: bool = False


class UICollapseRequest(BaseModel):
    view:         str
    section_id:   str
    is_collapsed: bool
