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

from api.config import ALLURE_REPORT, ALLURE_RESULTS, EXECUTIONS_DIR, ORCHESTRATOR, PROJECT_ROOT

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


def save_execution_state(state: ExecutionState) -> None:
    """Saves the given ExecutionState to reports/executions/{task_id}.json."""
    with state._lock:
        data = {
            "task_id": state.task_id,
            "plan_id": state.plan_id,
            "status": state.status,
            "started_at": state.started_at,
            "ended_at": state.ended_at,
            "scheduled_at": state.scheduled_at,
            "is_cancelled": state.is_cancelled,
            "exit_code": state.exit_code,
            "logs": state.logs,
            "report_url": state.report_url,
        }
    file_path = EXECUTIONS_DIR / f"{state.task_id}.json"
    try:
        with open(file_path, "w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=False, indent=2)
    except Exception as exc:
        print(f"[ERROR] Failed to save execution state to {file_path}: {exc}", file=sys.stderr)


def load_executions() -> None:
    """Loads all persisted ExecutionStates from reports/executions/."""
    if not EXECUTIONS_DIR.exists():
        return
    for file_path in EXECUTIONS_DIR.glob("*.json"):
        try:
            with open(file_path, "r", encoding="utf-8") as fh:
                data = json.load(fh)
            state = ExecutionState(task_id=data["task_id"], plan_id=data["plan_id"])
            state.status = data.get("status", "pending")
            state.started_at = data.get("started_at")
            state.ended_at = data.get("ended_at")
            state.scheduled_at = data.get("scheduled_at")
            state.is_cancelled = data.get("is_cancelled", False)
            state.exit_code = data.get("exit_code")
            state.logs = data.get("logs", [])
            state.report_url = data.get("report_url")
            _executions[state.task_id] = state
        except Exception as exc:
            print(f"[ERROR] Failed to load execution state from {file_path}: {exc}", file=sys.stderr)


# Load all persisted executions on startup
load_executions()


# ── Subprocess runner ──────────────────────────────────────────────────────────

def _run_orchestrator(task_id: str, plan_id: str, plan_json: str) -> None:
    """
    Executes orchestrator.py in a subprocess, capturing stdout/stderr
    line-by-line into the ExecutionState store.
    """
    state = _executions[task_id]
    state.status     = "running"
    state.started_at = datetime.now(timezone.utc).isoformat()
    save_execution_state(state)

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
        save_execution_state(state)


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
                save_execution_state(state)
                return
            if datetime.now(timezone.utc) >= target_time:
                break
            time.sleep(0.5)

    if state.is_cancelled:
        state.status   = "cancelled"
        state.ended_at = datetime.now(timezone.utc).isoformat()
        state.append_log("[ORCHESTRATOR] Execution cancelled before start.")
        save_execution_state(state)
        return

    _run_orchestrator(task_id, plan_id, plan_json)


# ── Blueprint → Orchestrator format converter ──────────────────────────────────

def _convert_plan_to_orchestrator_format(plan: dict, blueprints: dict) -> dict:
    """
    Convert the Blueprint compositional format (Plan → Cycles → Sets/Flows)
    into the orchestrator engine format (test_cycles[] → test_flows[] → scenarios[]).
    Includes Cartesian Product matrix expansion for Test Sets containing Features.
    """

    def merge_and_stamp_tasks(scenario_id: str, scenario_name: str, p_tasks: list | None, c_tasks: list | None, f_tasks: list | None, s_tasks: list | None) -> list:
        # 1. Check if there are any instance-specific tasks targeting this scenario_id
        has_instance_override = False
        for tasks_list in (p_tasks, c_tasks, f_tasks):
            if tasks_list and isinstance(tasks_list, list):
                for t in tasks_list:
                    if isinstance(t, dict) and t.get("targetScenario") == scenario_id:
                        has_instance_override = True
                        break
            if has_instance_override:
                break

        merged = []

        # 2. Process container tasks (plan, cycle, flow)
        for tasks_list in (p_tasks, c_tasks, f_tasks):
            if tasks_list and isinstance(tasks_list, list):
                for t in tasks_list:
                    if isinstance(t, dict):
                        target_s = t.get("targetScenario")
                        matches_instance = (target_s == scenario_id)
                        matches_name = (target_s == scenario_name)
                        is_global = (not target_s or target_s == "all")

                        if matches_instance or matches_name or is_global:
                            if t.get("name") == "__none__":
                                continue
                            task_id = t.get("id") or f"{scenario_id}-{t.get('name')}"
                            merged.append({**t, "id": task_id, "scenario_id": scenario_id})

        # 3. Process scenario-level tasks if there is no instance override
        if not has_instance_override and s_tasks and isinstance(s_tasks, list):
            for t in s_tasks:
                if isinstance(t, dict):
                    target_s = t.get("targetScenario")
                    if not target_s or target_s == "all" or target_s == scenario_name or target_s == scenario_id:
                        if t.get("name") == "__none__":
                            continue
                        task_id = t.get("id") or f"{scenario_id}-{t.get('name')}"
                        merged.append({**t, "id": task_id, "scenario_id": scenario_id})

        return merged

    def stamp_tasks_for_scenario(scenario_id: str, tasks: list) -> list:
        stamped = []
        if not tasks:
            return stamped
        for t in tasks:
            if isinstance(t, dict):
                if t.get("name") == "__none__":
                    continue
                task_id = t.get("id") or f"{scenario_id}-{t.get('name')}"
                stamped.append({**t, "id": task_id, "scenario_id": scenario_id})
        return stamped

    def expand_set(set_bp: dict, c_ref_id: str, ref_id: str, cycle_bp: dict) -> list:
        choices_per_item = []
        for ref in set_bp.get("items", []):
            if ref.get("type") == "flow":
                flow_bp = next(
                    (f for f in blueprints.get("flows", []) if f["id"] == ref.get("refId")),
                    None,
                )
                if flow_bp:
                    enhanced_items = [
                        {**i, "source_name": flow_bp.get("name"), "source_type": "flow", "flow_tasks": flow_bp.get("tasks", []), "flow_bp_id": flow_bp.get("id")}
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
                        "feature_tasks": ref.get("tasks", []),
                    }])
                if scenarios:
                    choices_per_item.append(scenarios)
 
        if not choices_per_item:
            return []

        generated_flows = []
        all_combo_scenario_lists = []

        for i, combo in enumerate(itertools.product(*choices_per_item)):
            # Generate stable combo signature using FNV-1a 32-bit hash
            parts = []
            for block in combo:
                if not block:
                    continue
                first_item = block[0]
                if first_item.get("source_type") == "flow":
                    parts.append(f"flow:{first_item.get('flow_bp_id')}")
                else:
                    parts.append(f"scenario:{first_item.get('id')}")
            
            combined = "|".join(parts)
            hash_val = 2166136261
            for char in combined:
                hash_val ^= ord(char)
                hash_val = (hash_val * 16777619) & 0xffffffff
            combo_signature = f"{hash_val:x}"

            flattened: list = []
            for block in combo:
                flattened.extend(block)
            
            scenarios_list = []
            for s_idx, s in enumerate(flattened):
                scenario_instance_id = f"set-{c_ref_id}-{ref_id}-{combo_signature}-{s_idx}-{s.get('id', str(uuid.uuid4()))}"
                p_tasks = plan.get("tasks", [])
                
                s_tasks = []
                if s.get("source_type") == "flow":
                    s_tasks = s.get("tasks", [])

                scenarios_list.append({
                    "id":            scenario_instance_id,
                    "feature_path":  s.get("featurePath", ""),
                    "scenario_name": s.get("scenarioName", ""),
                    "tags":          s.get("tags", []),
                    "enabled":       s.get("enabled", True),
                    "set_name":      set_bp.get("name", "—"),
                    "set_detail":    s.get("source_name", "—"),
                    "source_type":   s.get("source_type", "flow"),
                    "userdata":      s.get("userdata", {}),
                    "tasks":         merge_and_stamp_tasks(scenario_instance_id, s.get("scenarioName", ""), p_tasks, cycle_bp.get("tasks", []), None, s_tasks),
                    "flow_bp_id":    s.get("flow_bp_id"),
                    "flow_tasks":    s.get("flow_tasks"),
                })

            # Apply flow-level tasks for flows inside set combo (checking for combo-instance overrides first)
            combo_instance_id = f"set-{c_ref_id}-{ref_id}-combo-{combo_signature}"
            cycle_tasks = cycle_bp.get("tasks", []) if cycle_bp else []
            instance_flow_tasks = [t for t in cycle_tasks if isinstance(t, dict) and t.get("targetScenario") == combo_instance_id]
            has_instance_flow_tasks = len(instance_flow_tasks) > 0

            if has_instance_flow_tasks:
                flow_tasks = [t for t in instance_flow_tasks if t.get("name") != "__none__"]
                before_flow_tasks = [t for t in flow_tasks if t.get("hook") == "before"]
                after_flow_tasks = [t for t in flow_tasks if t.get("hook") == "after"]

                if before_flow_tasks and scenarios_list:
                    scenarios_list[0]["tasks"].extend(stamp_tasks_for_scenario(scenarios_list[0]["id"], before_flow_tasks))
                if after_flow_tasks and scenarios_list:
                    scenarios_list[-1]["tasks"].extend(stamp_tasks_for_scenario(scenarios_list[-1]["id"], after_flow_tasks))
            else:
                # Fallback to flow-level blueprint tasks
                flow_groups = {}
                for idx, s in enumerate(scenarios_list):
                    f_id = s.get("flow_bp_id")
                    if f_id:
                        if f_id not in flow_groups:
                            flow_groups[f_id] = []
                        flow_groups[f_id].append(idx)

                for f_id, indices in flow_groups.items():
                    first_idx = indices[0]
                    last_idx = indices[-1]
                    flow_tasks = scenarios_list[first_idx].get("flow_tasks") or []
                    before_flow_tasks = [t for t in flow_tasks if t.get("hook") == "before"]
                    after_flow_tasks = [t for t in flow_tasks if t.get("hook") == "after"]

                    scenarios_list[first_idx]["tasks"].extend(stamp_tasks_for_scenario(scenarios_list[first_idx]["id"], before_flow_tasks))
                    scenarios_list[last_idx]["tasks"].extend(stamp_tasks_for_scenario(scenarios_list[last_idx]["id"], after_flow_tasks))

            all_combo_scenario_lists.append(scenarios_list)
            generated_flows.append({
                "flow_id":   f"{set_bp.get('id')}-exp-{i}",
                "flow_name": f"{set_bp.get('name')} (Caso {i + 1})",
                "enabled":   True,
                "scenarios": scenarios_list,
            })

        # Apply set-level tasks ONCE across all combos:
        # before → first scenario of first combo
        # after  → last scenario of last combo
        set_tasks = set_bp.get("tasks", []) or []
        before_set_tasks = [t for t in set_tasks if t.get("hook") == "before"]
        after_set_tasks = [t for t in set_tasks if t.get("hook") == "after"]
        if all_combo_scenario_lists:
            first_scenarios = all_combo_scenario_lists[0]
            last_scenarios = all_combo_scenario_lists[-1]
            if first_scenarios and before_set_tasks:
                first_scenarios[0]["tasks"].extend(stamp_tasks_for_scenario(first_scenarios[0]["id"], before_set_tasks))
            if last_scenarios and after_set_tasks:
                last_scenarios[-1]["tasks"].extend(stamp_tasks_for_scenario(last_scenarios[-1]["id"], after_set_tasks))

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
                    scenarios_list = []
                    for s in flow_bp.get("items", []):
                        scenario_instance_id = f"flow-{c_ref.get('id')}-{ref.get('id')}-{s.get('id', str(uuid.uuid4()))}"
                        p_tasks = plan.get("tasks", [])
                        s_tasks = s.get("tasks", [])

                        scenarios_list.append({
                            "id":            scenario_instance_id,
                            "feature_path":  s.get("featurePath", ""),
                            "scenario_name": s.get("scenarioName", ""),
                            "tags":          s.get("tags", []),
                            "enabled":       s.get("enabled", True),
                            "set_name":      "—",
                            "set_detail":    "—",
                            "source_type":   "flow",
                            "userdata":      s.get("userdata", {}),
                            "tasks":         merge_and_stamp_tasks(scenario_instance_id, s.get("scenarioName", ""), p_tasks, cycle_bp.get("tasks", []), None, s_tasks),
                        })

                    # Apply flow-level tasks (checking for instance override first)
                    flow_instance_id = f"flow-{c_ref.get('id')}-{ref.get('id')}"
                    cycle_tasks = cycle_bp.get("tasks", []) or []
                    instance_flow_tasks = [t for t in cycle_tasks if isinstance(t, dict) and t.get("targetScenario") == flow_instance_id]

                    if instance_flow_tasks:
                        flow_tasks = [t for t in instance_flow_tasks if t.get("name") != "__none__"]
                    else:
                        flow_tasks = flow_bp.get("tasks", []) or []

                    before_flow_tasks = [t for t in flow_tasks if t.get("hook") == "before"]
                    after_flow_tasks = [t for t in flow_tasks if t.get("hook") == "after"]
                    if scenarios_list:
                        scenarios_list[0]["tasks"].extend(stamp_tasks_for_scenario(scenarios_list[0]["id"], before_flow_tasks))
                        scenarios_list[-1]["tasks"].extend(stamp_tasks_for_scenario(scenarios_list[-1]["id"], after_flow_tasks))

                    test_flows.append({
                        "flow_id":   flow_bp.get("id"),
                        "flow_name": flow_bp.get("name"),
                        "enabled":   True,
                        "scenarios": scenarios_list,
                    })
            elif ref.get("type") == "set":
                set_bp = next(
                    (s for s in blueprints.get("sets", []) if s["id"] == ref.get("refId")),
                    None,
                )
                if set_bp:
                    test_flows.extend(expand_set(set_bp, c_ref.get("id"), ref.get("id"), cycle_bp))

        # Apply cycle-level tasks to the cycle's scenarios (only tasks that do not target a specific scenario or flow)
        cycle_tasks = cycle_bp.get("tasks", []) or []
        before_cycle_tasks = [t for t in cycle_tasks if isinstance(t, dict) and t.get("hook") == "before" and not t.get("targetScenario")]
        after_cycle_tasks = [t for t in cycle_tasks if isinstance(t, dict) and t.get("hook") == "after" and not t.get("targetScenario")]

        if before_cycle_tasks or after_cycle_tasks:
            # Flatten scenarios inside test_flows for this cycle
            all_cycle_scenarios = []
            for tf in test_flows:
                all_cycle_scenarios.extend(tf.get("scenarios", []))
            
            if all_cycle_scenarios:
                first_s = all_cycle_scenarios[0]
                last_s = all_cycle_scenarios[-1]
                first_s["tasks"].extend(stamp_tasks_for_scenario(first_s["id"], before_cycle_tasks))
                last_s["tasks"].extend(stamp_tasks_for_scenario(last_s["id"], after_cycle_tasks))

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
