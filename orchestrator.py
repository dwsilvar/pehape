#!/usr/bin/env python3
"""
orchestrator.py — Sequential Behave Execution Engine
=====================================================
Conforms to: test-orchestrator-logic-v1 + test-orchestrator-engine-spec-v1

Hierarchy traversal: Plan → Cycles[] → Flows[] → Scenarios[]

Execution Rules:
  - Enabled gate: every node (Plan/Cycle/Flow/Scenario) is checked before processing.
  - Granular execution: uses --name "{scenario_name}" per scenario (NOT full .feature runs).
  - Fail-Fast at Flow level: a failing scenario aborts the current Flow, but execution
    continues with the next Flow or Cycle (global plan never stops).
  - Allure accumulation: each run appends to ./allure_results; final report generated at end.

Usage:
  python orchestrator.py --file test_plan.json
  python orchestrator.py --json '{"plan_id": "...", ...}'
  python orchestrator.py --file test_plan.json --results-dir ./my_results --report-dir ./my_report
  python orchestrator.py --file test_plan.json --features-dir /path/to/project/features
"""

import argparse
import json
import logging
import os
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

# Force unbuffered stdout so events appear immediately in the SSE stream
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(line_buffering=True)

# ── Logging setup ──────────────────────────────────────────────────────────────

LOG_FORMAT = "%(asctime)s  %(levelname)-7s  %(message)s"
DATE_FORMAT = "%H:%M:%S"


def _setup_logging() -> logging.Logger:
    logging.basicConfig(level=logging.INFO, format=LOG_FORMAT, datefmt=DATE_FORMAT)
    return logging.getLogger("orchestrator")


logger = _setup_logging()

# ── Status symbols ──────────────────────────────────────────────────────────────

PASS_SYM = "✅ PASS"
FAIL_SYM = "❌ FAIL"
SKIP_SYM = "⏭  SKIP"

# ── Dataclasses for the summary report ─────────────────────────────────────────


@dataclass
class ScenarioResult:
    plan_id: str
    cycle_id: str
    flow_id: str
    scenario_name: str
    feature_path: str
    status: str          # "pass" | "fail" | "skip"
    exit_code: int = 0
    command: str = ""


@dataclass
class ExecutionSummary:
    results: list[ScenarioResult] = field(default_factory=list)

    @property
    def total(self) -> int:
        return len(self.results)

    @property
    def passed(self) -> int:
        return sum(1 for r in self.results if r.status == "pass")

    @property
    def failed(self) -> int:
        return sum(1 for r in self.results if r.status == "fail")

    @property
    def skipped(self) -> int:
        return sum(1 for r in self.results if r.status == "skip")

    def print_report(self):
        print("\n" + "═" * 68)
        print("  ORCHESTRATOR EXECUTION SUMMARY")
        print("═" * 68)
        print(f"  Total:   {self.total}")
        print(f"  {PASS_SYM}: {self.passed}")
        print(f"  {FAIL_SYM}: {self.failed}")
        print(f"  {SKIP_SYM}: {self.skipped}")
        print("═" * 68)

        if self.failed:
            print("\nFailed scenarios:")
            for r in self.results:
                if r.status == "fail":
                    print(f"  ▸ [{r.cycle_id} / {r.flow_id}] {r.scenario_name} ({r.feature_path})")
        print()


# ── Allure helpers ──────────────────────────────────────────────────────────────

def _find_allure_exe() -> str:
    """
    Locate the Allure CLI executable.
    Reuses the same logic as behave_runner/report_allure.py (portable support on Windows).
    """
    allure_exe = "allure"
    if os.name == "nt":
        project_root = Path(__file__).parent
        portable_path = project_root / "allure-commandline" / "bin" / "allure.bat"
        if portable_path.exists():
            allure_exe = f'"{portable_path}"'
            logger.info(f"Portable Allure found: {portable_path}")
    return allure_exe


def _clean_results_dir(results_dir: Path) -> None:
    """Remove and recreate the allure_results directory before a new plan run."""
    if results_dir.exists():
        shutil.rmtree(results_dir)
    results_dir.mkdir(parents=True, exist_ok=True)
    logger.info(f"Allure results directory reset: {results_dir}")


def _patch_duplicate_allure_results(results_dir: Path) -> None:
    """
    Post-process Allure result JSON files to disambiguate scenarios that share
    the same name (duplicate instances in a Test Flow).

    Allure groups tests with the same historyId as "retries". By assigning a
    unique historyId (and renaming the title for instances > 1) we ensure each
    execution instance appears as an independent test in the Allure report,
    regardless of allure-python-commons version.

    Strategy
    --------
    1. Load all *-result.json files and sort them by start time (ascending).
    2. Count how many files share the same scenario name.
    3. For names that appear more than once, iterate in start-time order and:
       - Assign instance index (1, 2, 3, …)
       - Patch ``name`` for instances > 1  → "Name (Instancia #N)"
       - Patch ``historyId``               → MD5("Name::instancia:N")
       - Patch ``testCaseId``              → MD5("Name::testcase:N")
    4. Re-write only modified files.
    """
    import glob
    import hashlib

    result_files = glob.glob(str(results_dir / "*-result.json"))
    if not result_files:
        return

    # ── Load all result files ─────────────────────────────────────────────────
    loaded: list[tuple[str, dict]] = []
    for rf in result_files:
        try:
            with open(rf, "r", encoding="utf-8") as f:
                data = json.load(f)
            loaded.append((rf, data))
        except Exception:
            continue

    # Sort by start timestamp so instance numbering follows execution order
    loaded.sort(key=lambda x: x[1].get("start", 0))

    # ── Count occurrences per name ────────────────────────────────────────────
    from collections import Counter
    name_counts: Counter = Counter(entry[1].get("name", "") for entry in loaded)

    # ── Patch duplicates ──────────────────────────────────────────────────────
    name_instance: dict[str, int] = {}

    for rf, data in loaded:
        orig_name: str = data.get("name", "")
        if name_counts[orig_name] <= 1:
            continue  # Unique scenario — no patch needed

        name_instance[orig_name] = name_instance.get(orig_name, 0) + 1
        idx = name_instance[orig_name]

        modified = False

        # Preserve the original name so the matrix-report API can still
        # match all instances under the same key, regardless of renaming.
        if data.get("pehape_original_name") != orig_name:
            data["pehape_original_name"] = orig_name
            modified = True

        # Rename instances > 1 so Allure shows them under different titles
        if idx > 1:
            data["name"] = f"{orig_name} (Instancia #{idx})"
            modified = True

        # Always assign unique historyId and testCaseId based on orig name + instance
        unique_key = f"{orig_name}::instancia:{idx}"
        new_history_id = hashlib.md5(unique_key.encode("utf-8")).hexdigest()
        new_test_case_id = hashlib.md5(f"{orig_name}::testcase:{idx}".encode("utf-8")).hexdigest()

        if data.get("historyId") != new_history_id:
            data["historyId"] = new_history_id
            modified = True
        if data.get("testCaseId") != new_test_case_id:
            data["testCaseId"] = new_test_case_id
            modified = True

        if modified:
            try:
                with open(rf, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
            except Exception as e:
                logger.warning(f"Could not patch allure result {rf}: {e}")

    logger.info(
        f"Allure results patched: {sum(name_counts[n] for n in name_counts if name_counts[n] > 1)} "
        f"duplicate-scenario files updated."
    )


def _generate_allure_report(results_dir: Path, report_dir: Path) -> None:
    """Run 'allure generate' to produce a static report."""
    allure_exe = _find_allure_exe()
    command = f'{allure_exe} generate "{results_dir}" -o "{report_dir}" --clean'
    logger.info(f"Generating Allure report → {report_dir}")
    logger.debug(f"Command: {command}")
    try:
        result = subprocess.run(
            command,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=120,
        )
        if result.returncode == 0:
            logger.info(f"Allure report generated successfully at: {report_dir}")
        else:
            stderr = result.stderr.decode("utf-8", errors="replace")
            if result.returncode == 9009:
                logger.error(
                    "Error 9009: 'allure' command not found. "
                    "Ensure Allure and Java are installed and in PATH."
                )
            else:
                logger.error(
                    f"Allure generate failed (exit code {result.returncode}): {stderr}"
                )
    except subprocess.TimeoutExpired:
        logger.error("Allure report generation timed out after 120s.")
    except Exception as exc:
        logger.exception(f"Unexpected error generating Allure report: {exc}")


# ── Command builder ─────────────────────────────────────────────────────────────

def _build_behave_command(
    feature_path: str,
    scenario_name: str,
    tags: list[str],
    userdata: dict,
    results_dir: Path,
    features_base: Optional[Path] = None,
) -> list[str]:
    """
    Build the Behave CLI command for a single scenario.

    Pattern (from test-orchestrator-engine-spec-v1):
      behave {feature_path} --name '{scenario_name}' --tags={tags}
             -f allure_behave.formatter:AllureFormatter -o {results_dir}
             -D key=value ...
    """
    # Resolve the feature path
    if features_base and not Path(feature_path).is_absolute():
        resolved_path = str(features_base / feature_path)
    else:
        resolved_path = feature_path

    import re
    # Behave treats --name as a regex. We escape special characters and anchor it
    # to ensure it ONLY matches the exact scenario we want, avoiding duplicate runs
    # when one scenario name is a substring of another.
    exact_match_name = f"^{re.escape(scenario_name)}$"

    cmd = [
        sys.executable, "-m", "behave",          # Use the venv Python's behave
        resolved_path,
        "--name", exact_match_name,
        "--no-capture",                            # Stream output in real-time
    ]

    # Tag filter
    if tags:
        tag_expr = ",".join(tags)
        cmd += ["--tags", tag_expr]

    # Allure formatter (accumulates into results_dir)
    cmd += [
        "--format", "allure_behave.formatter:AllureFormatter",
        "--outfile", str(results_dir),
    ]

    # Userdata injection: -D key=value
    for key, value in userdata.items():
        cmd += ["-D", f"{key}={value}"]

    return cmd


# ── Scenario executor ───────────────────────────────────────────────────────────

def _run_scenario(
    cmd: list[str],
    scenario_name: str,
) -> tuple[int, str]:
    """
    Execute a single Behave scenario using subprocess.Popen().
    Streams stdout/stderr to console in real-time.
    Returns the exit code (0 = pass, non-zero = fail) and logs.
    """
    logger.debug(f"CMD: {' '.join(cmd)}")
    logs = []
    try:
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,   # Merge stderr into stdout for unified streaming
            text=True,
            bufsize=1,
            encoding="utf-8",
        )
        
        for line in iter(proc.stdout.readline, ""):
            print(f"    │ {line.rstrip()}", flush=True)
            logs.append(line)
            
        proc.stdout.close()
        
        try:
            exit_code = proc.wait(timeout=600)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait()
            logger.error(f"  TIMEOUT: scenario '{scenario_name}' exceeded 600s. Treating as FAIL.")
            return 1, "TIMEOUT: Execution exceeded 600 seconds."
            
        return exit_code, "".join(logs)
    except FileNotFoundError as exc:
        logger.error(f"  Cannot find Python/Behave executable: {exc}")
        return 1, f"Executable not found: {exc}"
    except Exception as exc:
        logger.error(f"  Unexpected error executing scenario '{scenario_name}': {exc}")
        return 1, f"Unexpected error: {exc}"


# ── Orchestration engine ────────────────────────────────────────────────────────

class Orchestrator:
    """
    Sequential execution engine for the test-orchestrator-logic-v1 hierarchy:
    Plan → Cycles → Flows → Scenarios
    """

    def __init__(
        self,
        plan: dict,
        results_dir: Path,
        report_dir: Path,
        features_base: Optional[Path] = None,
    ):
        self.plan = plan
        self.results_dir = results_dir
        self.report_dir = report_dir
        self.features_base = features_base
        self.summary = ExecutionSummary()

    # ── Public entry point ────────────────────────────────────────────────────

    def run(self) -> ExecutionSummary:
        from datetime import datetime, timezone
        
        # Record start time
        self.plan["execution_start_time"] = datetime.now(timezone.utc).isoformat()
        
        plan_id = self.plan.get("plan_id", "UNKNOWN_PLAN")
        plan_name = self.plan.get("name", plan_id)
        plan_enabled = self.plan.get("enabled", True)

        print()
        print("┌" + "─" * 66 + "┐")
        print(f"│  TEST PLAN: {plan_name:<52} │")
        print(f"│  ID:        {plan_id:<52} │")
        print("└" + "─" * 66 + "┘")

        if not plan_enabled:
            logger.warning(f"[SKIP] Plan {plan_id} is disabled.")
            self.plan["execution_end_time"] = datetime.now(timezone.utc).isoformat()
            return self.summary

        # Merge global_config into base userdata available to every scenario
        global_config = self.plan.get("global_config", {})

        # Clear allure_results before starting (spec: cleanup before Plan execution)
        _clean_results_dir(self.results_dir)

        # ── Traverse Cycles ──────────────────────────────────────────────────
        cycles = self.plan.get("test_cycles", [])
        for cycle in cycles:
            self._run_cycle(cycle, plan_id, global_config)

        # ── Generate final Allure report ─────────────────────────────────────
        if any(r.status in ("pass", "fail") for r in self.summary.results):
            print(json.dumps({"type": "allure_report", "status": "generating"}), flush=True)
            # Patch result files BEFORE generating the report so duplicate scenarios
            # appear as independent tests (not retries) in the Allure HTML output.
            _patch_duplicate_allure_results(self.results_dir)
            _generate_allure_report(self.results_dir, self.report_dir)
            print(json.dumps({"type": "allure_report", "status": "ready", "url": "/allure-report/index.html"}), flush=True)
        else:
            logger.warning("No scenarios were executed — skipping Allure report generation.")


        # Record end time
        self.plan["execution_end_time"] = datetime.now(timezone.utc).isoformat()

        # ── Export JSON summary ──────────────────────────────────────────────
        summary_file = self.results_dir.parent / "orchestrator_summary.json"
        try:
            with open(summary_file, "w", encoding="utf-8") as f:
                json.dump(self.plan, f, indent=2, ensure_ascii=False)
            logger.info(f"Execution summary JSON exported to: {summary_file}")
        except Exception as e:
            logger.error(f"Failed to export execution summary JSON: {e}")

        self.summary.print_report()
        return self.summary

    # ── Cycle ─────────────────────────────────────────────────────────────────

    def _run_cycle(self, cycle: dict, plan_id: str, global_config: dict) -> None:
        cycle_id = cycle.get("cycle_id", "UNKNOWN_CYCLE")
        cycle_name = cycle.get("cycle_name", cycle_id)
        cycle_enabled = cycle.get("enabled", True)

        print(f"\n  ▶ CYCLE [{cycle_id}] {cycle_name}")

        if not cycle_enabled:
            logger.warning(f"  [SKIP] Cycle {cycle_id} is disabled.")
            return

        flows = cycle.get("test_flows", [])
        for flow in flows:
            self._run_flow(flow, plan_id, cycle_id, cycle_name, global_config)

    # ── Flow ──────────────────────────────────────────────────────────────────

    def _run_flow(
        self, flow: dict, plan_id: str, cycle_id: str, cycle_name: str, global_config: dict
    ) -> None:
        flow_id = flow.get("flow_id", "UNKNOWN_FLOW")
        flow_name = flow.get("flow_name", flow_id)
        flow_enabled = flow.get("enabled", True)

        print(f"\n    ◆ FLOW [{flow_id}] {flow_name}")

        if not flow_enabled:
            logger.warning(f"    [SKIP] Flow {flow_id} is disabled.")
            return

        scenarios = flow.get("scenarios", [])
        flow_failed = False    # Fail-Fast flag

        # ── Instance counter: tracks how many times each scenario_name has
        #    appeared so far within this flow. Enables disambiguation of
        #    duplicate scenario rows in Allure labels and the frontend monitor.
        instance_counter: dict[str, int] = {}

        for idx, scenario in enumerate(scenarios):
            sname = scenario.get("scenario_name", "")
            instance_counter[sname] = instance_counter.get(sname, 0) + 1
            instance_index = instance_counter[sname]   # 1-based

            result = self._run_scenario_node(
                scenario=scenario,
                plan_id=plan_id,
                cycle_id=cycle_id,
                cycle_name=cycle_name,
                flow_id=flow_id,
                flow_name=flow_name,
                global_config=global_config,
                flow_failed=flow_failed,
                instance_index=instance_index,
            )
            self.summary.results.append(result)

            if result.status == "fail":
                flow_failed = True
                logger.warning(
                    f"    [FAIL-FAST] Flow {flow_id} — aborting remaining scenarios."
                )

    # ── Scenario node ─────────────────────────────────────────────────────────

    def _run_scenario_node(
        self,
        scenario: dict,
        plan_id: str,
        cycle_id: str,
        cycle_name: str,
        flow_id: str,
        flow_name: str,
        global_config: dict,
        flow_failed: bool,
        instance_index: int = 1,   # 1-based ordinal for this scenario name within the flow
    ) -> ScenarioResult:
        scenario_name = scenario.get("scenario_name", "UNKNOWN_SCENARIO")
        scenario_id   = scenario.get("id", "")   # unique UUID per instance row in the plan
        feature_path = scenario.get("feature_path", "")
        tags = scenario.get("tags", [])
        scenario_enabled = scenario.get("enabled", True)

        # Merge userdata: global_config → scenario.userdata → orchestrator context
        userdata: dict = {
            **global_config,
            **scenario.get("userdata", {}),
            # Inject cycle/flow identifiers so environment.py can add Allure labels
            "orch_cycle_id":       cycle_id,
            "orch_cycle_name":     cycle_name,
            "orch_flow_id":        flow_id,
            "orch_flow_name":      flow_name,
            "orch_plan_id":        plan_id,
            # ── Instance tracking (enables duplicate-scenario disambiguation) ──
            # orch_scenario_id   : UUID unique to this slot in the plan (not the name)
            # orch_instance_index: 1-based counter; >1 means a repeated scenario
            "orch_scenario_id":    scenario_id,
            "orch_instance_index": str(instance_index),
        }

        base_result = ScenarioResult(
            plan_id=plan_id,
            cycle_id=cycle_id,
            flow_id=flow_id,
            scenario_name=scenario_name,
            feature_path=feature_path,
            status="skip",
            exit_code=-1,
        )

        # Write scenario-specific tasks (if any) to a temp JSON file
        tasks = scenario.get("tasks", [])
        temp_tasks_path = None
        if tasks:
            import tempfile
            with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as tf:
                json.dump(tasks, tf, ensure_ascii=False)
                temp_tasks_path = tf.name
            userdata["ui_tasks_file"] = temp_tasks_path

        # Disabled node
        if not scenario_enabled:
            if temp_tasks_path and os.path.exists(temp_tasks_path):
                try:
                    os.remove(temp_tasks_path)
                except Exception:
                    pass
            logger.warning(f"      [SKIP] Scenario '{scenario_name}' is disabled.")
            print(json.dumps({"type": "scenario_status", "status": "skipped", "scenario_id": scenario_id, "scenario_name": scenario_name}), flush=True)
            scenario["result_status"] = "skip"
            scenario["duration_ms"] = 0
            return base_result

        # Fail-Fast: skip remaining after a flow failure
        if flow_failed:
            if temp_tasks_path and os.path.exists(temp_tasks_path):
                try:
                    os.remove(temp_tasks_path)
                except Exception:
                    pass
            logger.warning(
                f"      [SKIP] Scenario '{scenario_name}' — skipped due to Flow fail-fast."
            )
            print(json.dumps({"type": "scenario_status", "status": "skipped", "scenario_id": scenario_id, "scenario_name": scenario_name}), flush=True)
            scenario["result_status"] = "skip"
            scenario["duration_ms"] = 0
            return base_result

        # Build and run command
        cmd = _build_behave_command(
            feature_path=feature_path,
            scenario_name=scenario_name,
            tags=tags,
            userdata=userdata,
            results_dir=self.results_dir,
            features_base=self.features_base,
        )

        print(
            f"\n      ▸ Scenario: {scenario_name}\n"
            f"        Feature:  {feature_path}\n"
            f"        Tags:     {', '.join(tags) or '(none)'}"
        )
        # Emit structured JSON event — includes scenario_id for precise frontend matching
        print(json.dumps({"type": "scenario_status", "status": "running", "scenario_id": scenario_id, "scenario_name": scenario_name}), flush=True)

        import time
        start_time = time.time()
        exit_code, logs = _run_scenario(cmd, scenario_name)
        duration_ms = int((time.time() - start_time) * 1000)
        
        # Cleanup temporary file
        if temp_tasks_path and os.path.exists(temp_tasks_path):
            try:
                os.remove(temp_tasks_path)
            except Exception as e:
                logger.warning(f"Could not remove temporary tasks file: {e}")
        
        status = "pass" if exit_code == 0 else "fail"
        symbol = PASS_SYM if exit_code == 0 else FAIL_SYM

        print(f"        Result:   {symbol}  (exit code: {exit_code}, {duration_ms}ms)")
        # Emit structured JSON event — includes scenario_id for precise frontend matching
        result_status = "passed" if exit_code == 0 else "failed"
        print(json.dumps({"type": "scenario_status", "status": result_status, "scenario_id": scenario_id, "scenario_name": scenario_name}), flush=True)

        # Mutate the original plan JSON in memory so we can export it later
        scenario["result_status"] = status
        scenario["result_exit_code"] = exit_code
        scenario["duration_ms"] = duration_ms
        scenario["logs"] = logs

        return ScenarioResult(
            plan_id=plan_id,
            cycle_id=cycle_id,
            flow_id=flow_id,
            scenario_name=scenario_name,
            feature_path=feature_path,
            status=status,
            exit_code=exit_code,
            command=" ".join(cmd),
        )


# ── Input parsing ───────────────────────────────────────────────────────────────

def load_plan(file_path: Optional[str], json_str: Optional[str]) -> dict:
    """
    Load and validate the Test Plan JSON.
    Priority: --file > --json
    """
    raw: dict = {}

    if file_path:
        path = Path(file_path)
        if not path.exists():
            logger.error(f"File not found: {file_path}")
            sys.exit(1)
        try:
            with open(path, "r", encoding="utf-8") as fh:
                raw = json.load(fh)
            logger.info(f"Loaded test plan from file: {file_path}")
        except json.JSONDecodeError as exc:
            logger.error(f"Invalid JSON in file '{file_path}': {exc}")
            sys.exit(1)

    elif json_str:
        try:
            raw = json.loads(json_str)
            logger.info("Loaded test plan from inline JSON string.")
        except json.JSONDecodeError as exc:
            logger.error(f"Invalid JSON string: {exc}")
            sys.exit(1)

    else:
        logger.error("No input provided. Use --file <path> or --json '<json_string>'.")
        sys.exit(1)

    # Basic validation
    if not isinstance(raw, dict) or "test_cycles" not in raw:
        logger.error(
            "Invalid test plan structure. Expected a JSON object with 'test_cycles' key."
        )
        sys.exit(1)

    return raw


# ── CLI entry point ─────────────────────────────────────────────────────────────

def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="orchestrator.py",
        description=(
            "Sequential Behave execution engine — test-orchestrator-logic-v1\n"
            "Traversal: Plan → Cycles → Flows → Scenarios"
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    # Input sources
    input_group = parser.add_mutually_exclusive_group(required=True)
    input_group.add_argument(
        "--file", "-f",
        metavar="PATH",
        help="Path to the Test Plan JSON file (e.g. test_plan.json).",
    )
    input_group.add_argument(
        "--json", "-j",
        metavar="JSON_STRING",
        help="Inline Test Plan as a JSON string.",
    )

    # Paths
    parser.add_argument(
        "--results-dir",
        metavar="PATH",
        default="./allure_results",
        help="Directory to accumulate Allure results (default: ./allure_results).",
    )
    parser.add_argument(
        "--report-dir",
        metavar="PATH",
        default="./allure_report",
        help="Directory where the final Allure report is generated (default: ./allure_report).",
    )
    parser.add_argument(
        "--features-dir",
        metavar="PATH",
        default=None,
        help=(
            "Base directory where .feature files live. "
            "When provided, feature_path values in the JSON are resolved relative to this directory."
        ),
    )

    # Debug
    parser.add_argument(
        "--debug", "-d",
        action="store_true",
        help="Enable DEBUG logging.",
    )

    return parser.parse_args()


def main() -> None:
    args = _parse_args()

    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)

    # Load plan
    plan = load_plan(file_path=args.file, json_str=args.json)

    # Resolve paths
    results_dir = Path(args.results_dir).resolve()
    report_dir = Path(args.report_dir).resolve()
    features_base = Path(args.features_dir).resolve() if args.features_dir else None

    # Run orchestration
    orchestrator = Orchestrator(
        plan=plan,
        results_dir=results_dir,
        report_dir=report_dir,
        features_base=features_base,
    )
    summary = orchestrator.run()

    # Exit with non-zero if any scenario failed
    sys.exit(1 if summary.failed > 0 else 0)


if __name__ == "__main__":
    main()
