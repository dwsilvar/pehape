"""
api/workers/orchestrator_worker.py
===================================
In-memory execution state store, subprocess runner, scheduler wrapper,
and blueprint-to-orchestrator format converter.
"""
from __future__ import annotations

import itertools
import json
import os
import subprocess
import sys
import time
import uuid
from datetime import datetime, timezone
from threading import Lock
from typing import Dict, List, Optional

from api.config import ALLURE_REPORT, ALLURE_RESULTS, ORCHESTRATOR, PROJECT_ROOT

# ── In-memory execution state ──────────────────────────────────────────────────

_state_lock: Lock = Lock()
_executions: Dict[str, "ExecutionState"] = {}


class ExecutionState:
    """Thread-safe container for a single orchestrator run."""

    def __init__(self, task_id: str, plan_id: str):
        self.task_id       = task_id
        self.plan_id       = plan_id
        self.status        = "pending"   # pending | running | finished | failed | scheduled | cancelled
        self.started_at:   Optional[str] = None
        self.ended_at:     Optional[str] = None
        self.scheduled_at: Optional[str] = None
        self.is_cancelled: bool          = False
        self.exit_code:    Optional[int] = None
        self.logs:         List[str]     = []
        self.report_url:   Optional[str] = None
        self._lock = Lock()

    def append_log(self, line: str) -> None:
        with self._lock:
            self.logs.append(line)

    def to_dict(self) -> dict:
        with self._lock:
            return {
                "task_id":      self.task_id,
                "plan_id":      self.plan_id,
                "status":       self.status,
                "scheduled_at": self.scheduled_at,
                "started_at":   self.started_at,
                "ended_at":     self.ended_at,
                "exit_code":    self.exit_code,
                "log_lines":    len(self.logs),
                "last_log":     self.logs[-1] if self.logs else None,
                "report_url":   self.report_url,
            }


# ── Subprocess runner ──────────────────────────────────────────────────────────

def _run_orchestrator(task_id: str, plan_id: str, plan_json: str) -> None:
    """
    Executes orchestrator.py in a subprocess, capturing stdout/stderr
    line-by-line into the ExecutionState store.
    """
    state = _executions[task_id]
    state.status     = "running"
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
        env["PYTHONUNBUFFERED"] = "1"

        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            encoding="utf-8",
            env=env,
        )

        for line in iter(proc.stdout.readline, ""):
            stripped = line.rstrip()
            if stripped:
                state.append_log(stripped)

        proc.stdout.close()
        proc.wait()

        state.exit_code = proc.returncode
        state.status    = "finished" if proc.returncode == 0 else "failed"
        state.append_log(f"[ORCHESTRATOR] Completed with exit code {proc.returncode}")

        if ALLURE_REPORT.exists() and any(ALLURE_REPORT.iterdir()):
            state.report_url = "/allure-report/index.html"
            state.append_log(f"[REPORT] Available at {state.report_url}")

    except FileNotFoundError:
        state.status    = "failed"
        state.exit_code = -1
        state.append_log(
            "[ERROR] orchestrator.py not found. "
            f"Expected path: {ORCHESTRATOR}"
        )
    except Exception as exc:
        state.status    = "failed"
        state.exit_code = -1
        state.append_log(f"[ERROR] Unexpected error: {exc}")
    finally:
        state.ended_at = datetime.now(timezone.utc).isoformat()


def _schedule_and_run_orchestrator(
    task_id: str,
    plan_id: str,
    plan_json: str,
    scheduled_at: Optional[str] = None,
) -> None:
    """Wrapper that waits for scheduled_at before calling _run_orchestrator."""
    state = _executions[task_id]

    if scheduled_at:
        try:
            target_time = datetime.fromisoformat(scheduled_at.replace("Z", "+00:00"))
        except ValueError:
            target_time = datetime.now(timezone.utc)

        while True:
            if state.is_cancelled:
                state.status   = "cancelled"
                state.ended_at = datetime.now(timezone.utc).isoformat()
                state.append_log("[ORCHESTRATOR] Execution cancelled before start.")
                return
            if datetime.now(timezone.utc) >= target_time:
                break
            time.sleep(0.5)

    if state.is_cancelled:
        state.status   = "cancelled"
        state.ended_at = datetime.now(timezone.utc).isoformat()
        state.append_log("[ORCHESTRATOR] Execution cancelled before start.")
        return

    _run_orchestrator(task_id, plan_id, plan_json)


# ── Blueprint → Orchestrator format converter ──────────────────────────────────

def _convert_plan_to_orchestrator_format(plan: dict, blueprints: dict) -> dict:
    """
    Convert the Blueprint compositional format (Plan → Cycles → Sets/Flows)
    into the orchestrator engine format (test_cycles[] → test_flows[] → scenarios[]).
    Includes Cartesian Product matrix expansion for Test Sets containing Features.
    """

    def expand_set(set_bp: dict) -> list:
        choices_per_item = []
        for ref in set_bp.get("items", []):
            if ref.get("type") == "flow":
                flow_bp = next(
                    (f for f in blueprints.get("flows", []) if f["id"] == ref.get("refId")),
                    None,
                )
                if flow_bp:
                    enhanced_items = [
                        {**i, "source_name": flow_bp.get("name"), "source_type": "flow"}
                        for i in flow_bp.get("items", [])
                    ]
                    choices_per_item.append([enhanced_items])
            elif ref.get("type") == "feature":
                scenarios = []
                for sname in ref.get("steps", []):
                    # Use a deterministic ID matching the frontend's construction:
                    # ExecutionMonitor builds feature-scenario IDs as `${setRef.refId}-${sname}`
                    feature_ref_id = ref.get("refId", "") or ref.get("featurePath", "")
                    det_id = f"{feature_ref_id}-{sname}"
                    scenarios.append([{
                        "id":           det_id,
                        "type":         "scenario",
                        "featurePath":  ref.get("featurePath", ""),
                        "scenarioName": sname,
                        "source_name":  ref.get("name", ref.get("refId", "").split("/")[-1]),
                        "source_type":  "feature",
                        "tags":         [],
                        "enabled":      True,
                    }])
                if scenarios:
                    choices_per_item.append(scenarios)

        if not choices_per_item:
            return []

        generated_flows = []
        for i, combo in enumerate(itertools.product(*choices_per_item)):
            flattened: list = []
            for block in combo:
                flattened.extend(block)
            generated_flows.append({
                "flow_id":   f"{set_bp.get('id')}-exp-{i}",
                "flow_name": f"{set_bp.get('name')} (Matriz {i + 1})",
                "enabled":   True,
                "scenarios": [
                    {
                        # Build the same compound ID the frontend uses:
                        # ExecutionMonitor: `${s.id}-${idx}-${sIdx}`
                        "id":            f"{s.get('id', str(uuid.uuid4()))}-{i}-{s_idx}",
                        "feature_path":  s.get("featurePath", ""),
                        "scenario_name": s.get("scenarioName", ""),
                        "tags":          s.get("tags", []),
                        "enabled":       s.get("enabled", True),
                        "set_name":      set_bp.get("name", "—"),
                        "set_detail":    s.get("source_name", "—"),
                        "source_type":   s.get("source_type", "flow"),
                        "userdata":      s.get("userdata", {}),
                    }
                    for s_idx, s in enumerate(flattened)
                ],
            })
        return generated_flows

    test_cycles = []
    for c_ref in plan.get("items", []):
        if c_ref.get("type") != "cycle":
            continue
        cycle_bp = next(
            (c for c in blueprints.get("cycles", []) if c["id"] == c_ref.get("refId")),
            None,
        )
        if not cycle_bp:
            continue

        test_flows = []
        for ref in cycle_bp.get("items", []):
            if ref.get("type") == "flow":
                flow_bp = next(
                    (f for f in blueprints.get("flows", []) if f["id"] == ref.get("refId")),
                    None,
                )
                if flow_bp:
                    test_flows.append({
                        "flow_id":   flow_bp.get("id"),
                        "flow_name": flow_bp.get("name"),
                        "enabled":   True,
                        "scenarios": [
                            {
                                "id":            s.get("id", str(uuid.uuid4())),
                                "feature_path":  s.get("featurePath", ""),
                                "scenario_name": s.get("scenarioName", ""),
                                "tags":          s.get("tags", []),
                                "enabled":       s.get("enabled", True),
                                "set_name":      "—",
                                "set_detail":    "—",
                                "source_type":   "flow",
                                "userdata":      s.get("userdata", {}),
                            }
                            for s in flow_bp.get("items", [])
                        ],
                    })
            elif ref.get("type") == "set":
                set_bp = next(
                    (s for s in blueprints.get("sets", []) if s["id"] == ref.get("refId")),
                    None,
                )
                if set_bp:
                    test_flows.extend(expand_set(set_bp))

        test_cycles.append({
            "cycle_id":   cycle_bp.get("id"),
            "cycle_name": cycle_bp.get("name"),
            "enabled":    True,
            "test_flows": test_flows,
        })

    return {
        "plan_id":      plan.get("id", "UNKNOWN"),
        "name":         plan.get("name", "Test Plan"),
        "enabled":      True,
        "global_config": {},
        "test_cycles":  test_cycles,
    }
