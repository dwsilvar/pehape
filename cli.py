#!/usr/bin/env python3
"""
cli.py — Command-line interface for the PeHaPe Test Orchestrator
================================================================
Exposes options to run a Test Plan, Cycle (Suite), Flow, Scenario, or Feature.
Supports --local execution (offline/subprocess) and --api execution (FastAPI).
"""

import argparse
import copy
import json
import os
import sys
import subprocess
import urllib.request
import urllib.parse
import urllib.error
from pathlib import Path

# Fix terminal encoding issues on Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

# Root of the project is always the directory containing cli.py,
# regardless of which directory the user runs the command from.
_PROJECT_ROOT = Path(__file__).resolve().parent

def get_network_config() -> tuple[str, int]:
    """Reads network configuration from config/network_config.json."""
    host = "127.0.0.1"
    port = 5001
    config_path = _PROJECT_ROOT / "config" / "network_config.json"
    if config_path.exists():
        try:
            with open(config_path, "r", encoding="utf-8-sig") as f:
                data = json.load(f)
            host = data.get("backend_host", host)
            port = data.get("backend_port", port)
        except Exception:
            pass
    if host == "0.0.0.0":
        host = "127.0.0.1"
    return host, port

# A standard UUID has exactly 5 dash-separated groups: 8-4-4-4-12 hex chars.
_UUID_PARTS = 5

def get_cycle_instance_id(scen_id: str) -> str:
    """
    Extracts the full cycle instance UUID from a compiled scenario ID.

    ID formats (UUIDs contain dashes, so simple indexing is wrong):
      flow-{cycle_uuid}-{flow_uuid}-{scen_uuid}
      set-{cycle_uuid}-{set_uuid}-{combo_8hex}-{idx}-{scen_uuid}

    The cycle UUID is always the first UUID after the prefix token.
    It occupies parts[1:6] (5 groups) when the ID is split by '-'.
    """
    parts = scen_id.split("-")
    # parts[0] = "flow" or "set", parts[1:1+5] = cycle UUID (5 groups)
    if len(parts) >= 1 + _UUID_PARTS:
        return "-".join(parts[1 : 1 + _UUID_PARTS])
    return ""

def get_flow_instance_id(scen_id: str) -> str:
    """
    Extracts the flow instance ID from a compiled scenario ID in the format
    expected by the backend execution router.

    For flow scenarios:
      Input:  flow-{cycle_uuid}-{flow_uuid}-{scen_uuid}
      Output: flow-{cycle_uuid}-{flow_uuid}
              (backend checks: scen_id.startswith(flow_instance_id + "-"))

    For set scenarios:
      Input:  set-{cycle_uuid}-{set_uuid}-{combo_8hex}-{idx}-{scen_uuid}
      Output: set-{cycle_uuid}-{set_uuid}-combo-{combo_8hex}
              (backend splits on "-combo-" and checks prefix)
    """
    parts = scen_id.split("-")

    if scen_id.startswith("flow-"):
        # Need 1 prefix + 5 cycle UUID parts + 5 flow UUID parts = 11 total
        if len(parts) >= 1 + _UUID_PARTS + _UUID_PARTS:
            cycle_uuid = "-".join(parts[1 : 1 + _UUID_PARTS])
            flow_uuid  = "-".join(parts[1 + _UUID_PARTS : 1 + 2 * _UUID_PARTS])
            return f"flow-{cycle_uuid}-{flow_uuid}"

    elif scen_id.startswith("set-"):
        # Need 1 prefix + 5 cycle UUID parts + 5 set UUID parts + 1 combo_sig = 12 total
        if len(parts) >= 1 + _UUID_PARTS + _UUID_PARTS + 1:
            cycle_uuid = "-".join(parts[1 : 1 + _UUID_PARTS])
            set_uuid   = "-".join(parts[1 + _UUID_PARTS : 1 + 2 * _UUID_PARTS])
            combo_sig  = parts[1 + 2 * _UUID_PARTS]  # 8-char hex hash, no dashes
            return f"set-{cycle_uuid}-{set_uuid}-combo-{combo_sig}"

    return ""

def parse_args():
    # Positional 'help' shortcut
    if len(sys.argv) > 1 and sys.argv[1] == "help":
        sys.argv[1] = "--help"

    parser = argparse.ArgumentParser(
        prog="pehape",
        description="PeHaPe CLI: Run test plans, cycles (suites), flows, scenarios, or feature files from the console.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  pehape --plan "veesoon"
  pehape --cycle "retiro"
  pehape --flow "ingresopin"
  pehape --scenario "Nuevo escenario"
  pehape --feature "example.feature"
  pehape --feature "retiro/retiro.feature" --scenario "Nuevo escenario"
  pehape --plan "veesoon" --api
  pehape help
"""
    )
    parser.add_argument("--plan", help="Name or ID of the Test Plan to execute")
    parser.add_argument("--cycle", help="Name, Definition ID, or Instance ID of the Cycle (Suite) to execute")
    parser.add_argument("--flow", help="Name, Definition ID, or Instance ID of the Flow to execute")
    parser.add_argument("--scenario", help="Name or ID of the Scenario to execute")
    parser.add_argument("--feature", help="Path to a raw Gherkin .feature file to execute (without blueprints)")

    mode_group = parser.add_mutually_exclusive_group()
    mode_group.add_argument(
        "--local", 
        action="store_true", 
        help="Execute locally in the terminal (default). Updates Allure/Gherkin results and evidence, but does NOT create a task in the web UI background execution monitor."
    )
    mode_group.add_argument(
        "--api", 
        action="store_true", 
        help="Delegate execution to the FastAPI server and stream logs. Automatically registers the run in the web UI background execution monitor and history."
    )

    parser.add_argument("--host", help="FastAPI host override")
    parser.add_argument("--port", type=int, help="FastAPI port override")
    parser.add_argument("--debug", action="store_true", help="Enable verbose debug output")

    return parser.parse_args()

def execute_local(plan_json_str: str):
    """Launches orchestrator.py in a local subprocess to execute the plan."""
    orchestrator = str(_PROJECT_ROOT / "orchestrator.py")
    cmd = [
        sys.executable,
        orchestrator,
        "--json", plan_json_str,
        "--results-dir", str(_PROJECT_ROOT / "reports" / "allure_results"),
        "--report-dir",  str(_PROJECT_ROOT / "reports" / "allure-report"),
        "--features-dir", str(_PROJECT_ROOT / "features"),
    ]
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUNBUFFERED"] = "1"
    
    try:
        proc = subprocess.Popen(cmd, env=env)
        proc.wait()
        sys.exit(proc.returncode)
    except KeyboardInterrupt:
        print("\n[CLI] Execution interrupted by user.")
        sys.exit(1)
    except Exception as e:
        print(f"Error launching local orchestrator: {e}")
        sys.exit(1)

def execute_api(host: str, port: int, plan_id: str, cycle_inst: str = None, flow_inst: str = None, scen_inst: str = None):
    """Calls FastAPI backend to execute plan and streams the output in real-time."""
    params = {}
    if scen_inst:
        params["scenario_instance_id"] = scen_inst
    elif flow_inst:
        params["flow_instance_id"] = flow_inst
    elif cycle_inst:
        params["cycle_instance_id"] = cycle_inst

    query = urllib.parse.urlencode(params)
    url = f"http://{host}:{port}/api/execute-plan/{plan_id}"
    if query:
        url += f"?{query}"

    print(f"[CLI] Sending request to API: {url}")
    req = urllib.request.Request(url, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            task_id = data["task_id"]
            print(f"[CLI] Task queued successfully (ID: {task_id}). Streaming logs...\n")
    except urllib.error.HTTPError as he:
        err_body = he.read().decode("utf-8", errors="replace")
        try:
            err_json = json.loads(err_body)
            detail = err_json.get("detail", err_body)
        except Exception:
            detail = err_body
        print(f"API Error ({he.code}): {detail}")
        sys.exit(1)
    except Exception as e:
        print(f"Failed to connect to API server: {e}")
        sys.exit(1)

    # Stream SSE logs
    stream_url = f"http://{host}:{port}/api/execution-status/{task_id}/stream"
    try:
        # Avoid buffering in urlopen
        with urllib.request.urlopen(stream_url) as stream:
            for line in stream:
                line_str = line.decode("utf-8").strip()
                if line_str.startswith("data:"):
                    payload_str = line_str[5:].strip()
                    if not payload_str:
                        continue
                    try:
                        payload = json.loads(payload_str)
                        log_line = payload.get("line")
                        status = payload.get("status")
                        done = payload.get("done", False)

                        if log_line is not None:
                            print(log_line)

                        if done:
                            sys.exit(0 if status == "finished" else 1)
                    except Exception:
                        pass
    except KeyboardInterrupt:
        print("\n[CLI] Interrupted by user. Note: The task may still be running on the server.")
        sys.exit(1)
    except Exception as e:
        print(f"Error during log streaming: {e}")
        sys.exit(1)

def main():
    args = parse_args()

    # 1. Handle raw feature run
    if args.feature:
        if args.plan or args.cycle or args.flow:
            print("Error: --feature cannot be combined with blueprint targets (--plan, --cycle, --flow).")
            sys.exit(1)
        
        # Load behave parser
        try:
            from api.config import Parser, FEATURES_DIR
        except ImportError:
            print("Error: Could not load behave parser from environment.")
            sys.exit(1)
            
        full_path = Path(args.feature).resolve()
        if not full_path.exists():
            full_path = (FEATURES_DIR / args.feature).resolve()
        if not full_path.exists():
            print(f"Error: Feature file '{args.feature}' not found.")
            sys.exit(1)

        parser = Parser()
        with open(full_path, "r", encoding="utf-8") as f:
            content = f.read()
        feature = parser.parse(content)
        if not feature:
            print(f"Error: Failed to parse Gherkin file '{args.feature}'.")
            sys.exit(1)

        scenarios_to_run = []
        for s in feature.scenarios:
            if args.scenario and s.name != args.scenario:
                continue
            scenarios_to_run.append({
                "id": f"cli-raw-{s.name}",
                "feature_path": str(full_path.relative_to(FEATURES_DIR.resolve())).replace("\\", "/"),
                "scenario_name": s.name,
                "tags": list(s.tags or []),
                "enabled": True
            })

        if not scenarios_to_run:
            if args.scenario:
                print(f"Error: Scenario '{args.scenario}' not found in feature file.")
            else:
                print("Error: No scenarios found in feature file.")
            sys.exit(1)

        mock_plan = {
            "plan_id": "cli-raw-run",
            "name": "CLI Raw Feature Run",
            "enabled": True,
            "global_config": {},
            "test_cycles": [
                {
                    "cycle_id": "cli-raw-cycle",
                    "cycle_name": "Raw Cycle",
                    "enabled": True,
                    "test_flows": [
                        {
                            "flow_id": "cli-raw-flow",
                            "flow_name": "Raw Flow",
                            "enabled": True,
                            "scenarios": scenarios_to_run
                        }
                    ]
                }
            ]
        }

        if args.api:
            print("Warning: Raw feature execution does not support --api mode since it is not saved in blueprints.")
            print("Executing locally instead...\n")
        
        execute_local(json.dumps(mock_plan, ensure_ascii=False))
        return

    # 2. Parse blueprints.json for plan, cycle, flow, scenario
    try:
        from api.db import _load_blueprints
        from api.workers.orchestrator_worker import _convert_plan_to_orchestrator_format
    except ImportError:
        print("Error: Could not load blueprint libraries.")
        sys.exit(1)

    blueprints = _load_blueprints()
    compiled_plans = []
    for plan_bp in blueprints.get("plans", []):
        try:
            compiled = _convert_plan_to_orchestrator_format(plan_bp, blueprints)
            compiled_plans.append(compiled)
        except Exception:
            pass

    # Collect matching endpoints
    matches = []
    for plan in compiled_plans:
        if args.plan:
            if plan.get("plan_id") != args.plan and plan.get("name") != args.plan:
                continue

        for cycle in plan.get("test_cycles", []):
            if args.cycle:
                # Resolve cycle instance ID
                plan_bp = next((p for p in blueprints.get("plans", []) if p.get("id") == plan.get("plan_id")), None)
                cycle_instance_ids = []
                if plan_bp:
                    for item in plan_bp.get("items", []):
                        if item.get("type") == "cycle" and item.get("refId") == cycle.get("cycle_id"):
                            cycle_instance_ids.append(item.get("id"))
                
                if (cycle.get("cycle_id") != args.cycle and 
                    cycle.get("cycle_name") != args.cycle and 
                    args.cycle not in cycle_instance_ids):
                    continue

            for flow in cycle.get("test_flows", []):
                if args.flow:
                    # Resolve flow instance IDs (checking scenario prefixes)
                    flow_instance_ids = []
                    for scen in flow.get("scenarios", []):
                        scen_id = scen.get("id", "")
                        if scen_id.startswith("flow-"):
                            parts = scen_id.split("-")
                            if len(parts) >= 3:
                                flow_instance_ids.append("-".join(parts[:3]))
                        elif scen_id.startswith("set-"):
                            parts = scen_id.split("-")
                            if len(parts) >= 4:
                                if "-combo-" in args.flow:
                                    flow_instance_ids.append(args.flow)
                                else:
                                    flow_instance_ids.append("-".join(parts[:3]))
                    
                    if (flow.get("flow_id") != args.flow and 
                        flow.get("flow_name") != args.flow and 
                        args.flow not in flow_instance_ids):
                        continue

                for scenario in flow.get("scenarios", []):
                    if args.scenario:
                        if scenario.get("id") != args.scenario and scenario.get("scenario_name") != args.scenario:
                            continue

                    matches.append({
                        "plan": plan,
                        "cycle": cycle,
                        "flow": flow,
                        "scenario": scenario
                    })

    if not matches:
        print("Error: No elements in blueprints.json matched the given filters.")
        sys.exit(1)

    # De-duplicate elements to check for ambiguity
    matched_plans = {m["plan"]["plan_id"]: m["plan"] for m in matches}
    matched_cycles = {(m["plan"]["plan_id"], m["cycle"]["cycle_id"]): m["cycle"] for m in matches}
    matched_flows = {(m["plan"]["plan_id"], m["cycle"]["cycle_id"], m["flow"]["flow_id"]): m["flow"] for m in matches}
    matched_scenarios = {(m["plan"]["plan_id"], m["cycle"]["cycle_id"], m["flow"]["flow_id"], m["scenario"]["id"]): m["scenario"] for m in matches}

    target_type = None
    target_plan = None
    target_id = None
    target_name = None
    scen_ref = None

    # Handle filters hierarchy
    if args.scenario:
        if len(matched_scenarios) > 1:
            print("Ambiguity detected: Multiple scenarios found matching your request:")
            for key, s in matched_scenarios.items():
                p_name = matched_plans[key[0]]["name"]
                c_name = matched_cycles[(key[0], key[1])]["cycle_name"]
                f_name = matched_flows[(key[0], key[1], key[2])]["flow_name"]
                print(f"  - Plan: '{p_name}' > Cycle: '{c_name}' > Flow: '{f_name}' > Scenario: '{s['scenario_name']}' (Instance ID: {s['id']})")
            print("\nPlease specify parent filters (e.g. --plan, --cycle) or use the unique Instance ID directly.")
            sys.exit(1)
        
        target_type = "scenario"
        key = list(matched_scenarios.keys())[0]
        target_plan = matched_plans[key[0]]
        target_id = key[3]
        scen_ref = matched_scenarios[key]
        target_name = scen_ref["scenario_name"]

    elif args.flow:
        if len(matched_flows) > 1:
            print("Ambiguity detected: Multiple flows found matching your request:")
            for key, f in matched_flows.items():
                p_name = matched_plans[key[0]]["name"]
                c_name = matched_cycles[(key[0], key[1])]["cycle_name"]
                print(f"  - Plan: '{p_name}' > Cycle: '{c_name}' > Flow: '{f['flow_name']}' (ID: {f['flow_id']})")
            print("\nPlease specify parent filters (e.g. --plan or --cycle).")
            sys.exit(1)

        target_type = "flow"
        key = list(matched_flows.keys())[0]
        target_plan = matched_plans[key[0]]
        target_id = key[2]
        # Get one scenario inside flow to resolve instance ID
        scen_ref = matched_flows[key]["scenarios"][0]
        target_name = matched_flows[key]["flow_name"]

    elif args.cycle:
        if len(matched_cycles) > 1:
            print("Ambiguity detected: Multiple cycles found matching your request:")
            for key, c in matched_cycles.items():
                p_name = matched_plans[key[0]]["name"]
                print(f"  - Plan: '{p_name}' > Cycle: '{c['cycle_name']}' (ID: {c['cycle_id']})")
            print("\nPlease specify the parent plan filter (e.g. --plan).")
            sys.exit(1)

        target_type = "cycle"
        key = list(matched_cycles.keys())[0]
        target_plan = matched_plans[key[0]]
        target_id = key[1]
        target_name = matched_cycles[key]["cycle_name"]
        # Safely find the first scenario in the cycle for API filter resolution
        scen_ref = None
        for _tf in matched_cycles[key].get("test_flows", []):
            _scenarios = _tf.get("scenarios", [])
            if _scenarios:
                scen_ref = _scenarios[0]
                break
        if scen_ref is None and args.api:
            print("Error: Cycle has no runnable scenarios — cannot resolve API filter.")
            sys.exit(1)

    else:
        # Default to plan execution
        if len(matched_plans) > 1:
            print("Ambiguity detected: Multiple plans found matching your request:")
            for p_id, p in matched_plans.items():
                print(f"  - Plan: '{p['name']}' (ID: {p_id})")
            print("\nPlease specify the plan name/ID explicitly with --plan.")
            sys.exit(1)

        target_type = "plan"
        key = list(matched_plans.keys())[0]
        target_plan = matched_plans[key]
        target_id = key
        target_name = target_plan["name"]

    print(f"[CLI] Resolved: {target_type.upper()} '{target_name}' in Plan '{target_plan['name']}'")

    # Determine backend config
    net_host, net_port = get_network_config()
    host = args.host if args.host else net_host
    port = args.port if args.port else net_port

    # Execute
    if args.api:
        # Resolve target API arguments
        cycle_inst = None
        flow_inst = None
        scen_inst = None

        if target_type == "cycle" and scen_ref:
            cycle_inst = get_cycle_instance_id(scen_ref["id"])
        elif target_type == "flow" and scen_ref:
            flow_inst = get_flow_instance_id(scen_ref["id"])
        elif target_type == "scenario" and scen_ref:
            scen_inst = scen_ref["id"]

        execute_api(host, port, target_plan["plan_id"], cycle_inst, flow_inst, scen_inst)
    else:
        # Prune plan for local execution
        pruned_plan = copy.deepcopy(target_plan)
        if target_type == "cycle":
            pruned_plan["test_cycles"] = [c for c in pruned_plan.get("test_cycles", []) if c.get("cycle_id") == target_id]
        elif target_type == "flow":
            pruned_cycles = []
            for cycle in pruned_plan.get("test_cycles", []):
                pruned_flows = [f for f in cycle.get("test_flows", []) if f.get("flow_id") == target_id]
                if pruned_flows:
                    cycle["test_flows"] = pruned_flows
                    pruned_cycles.append(cycle)
            pruned_plan["test_cycles"] = pruned_cycles
        elif target_type == "scenario":
            pruned_cycles = []
            for cycle in pruned_plan.get("test_cycles", []):
                pruned_flows = []
                for flow in cycle.get("test_flows", []):
                    pruned_scenarios = [s for s in flow.get("scenarios", []) if s.get("id") == target_id]
                    if pruned_scenarios:
                        flow["scenarios"] = pruned_scenarios
                        pruned_flows.append(flow)
                if pruned_flows:
                    cycle["test_flows"] = pruned_flows
                    pruned_cycles.append(cycle)
            pruned_plan["test_cycles"] = pruned_cycles

        execute_local(json.dumps(pruned_plan, ensure_ascii=False))

if __name__ == "__main__":
    main()
