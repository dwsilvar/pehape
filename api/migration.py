"""
api/migration.py
================
Backward-compatibility migration layer to upgrade older index-based targetScenario
fields to stable signature-based scenario IDs.
"""
from __future__ import annotations

import re
import uuid
import itertools

# Regex to match old dynamic set targetScenario ID:
# set-{cycle_ref_id}-{set_ref_id}-{combo_index}-{scenario_index}-{scenario_blueprint_id}
OLD_SET_ID_RE = re.compile(
    r"^set-([0-9a-fA-F-]{36})-([0-9a-fA-F-]{36})-(\d+)-(\d+)-([0-9a-fA-F-]{36})$"
)


def fnv1a_32(val: str) -> str:
    """Standard FNV-1a 32-bit non-cryptographic hash."""
    hash_val = 2166136261
    for char in val:
        hash_val ^= ord(char)
        hash_val = (hash_val * 16777619) & 0xffffffff
    return f"{hash_val:x}"


def migrate_blueprints_to_stable_ids(blueprints: dict) -> bool:
    """
    Scans blueprints and upgrades any old index-based targetScenario fields
    to stable FNV-1a signature-based ones. Also ensures all references have IDs.
    
    Returns True if blueprints were modified (so they can be saved).
    """
    if not isinstance(blueprints, dict):
        return False

    modified = False

    # 1. Ensure all reference items in plans, cycles, sets, flows have IDs
    for plan in blueprints.get("plans", []):
        for item in plan.get("items", []):
            if not item.get("id"):
                item["id"] = str(uuid.uuid4())
                modified = True

    for cycle in blueprints.get("cycles", []):
        for item in cycle.get("items", []):
            if not item.get("id"):
                item["id"] = str(uuid.uuid4())
                modified = True

    for test_set in blueprints.get("sets", []):
        for item in test_set.get("items", []):
            if not item.get("id"):
                item["id"] = str(uuid.uuid4())
                modified = True

    for flow in blueprints.get("flows", []):
        for item in flow.get("items", []):
            if not item.get("id"):
                item["id"] = str(uuid.uuid4())
                modified = True

    # Cache for combinations per Set blueprint
    set_combos_cache: dict[str, list] = {}

    def get_set_combos_cached(set_bp_id: str) -> list:
        if set_bp_id in set_combos_cache:
            return set_combos_cache[set_bp_id]

        set_bp = next((s for s in blueprints.get("sets", []) if s["id"] == set_bp_id), None)
        if not set_bp:
            return []

        choices_per_item = []
        for ref in set_bp.get("items", []):
            if ref.get("type") == "flow":
                flow_bp = next((f for f in blueprints.get("flows", []) if f["id"] == ref.get("refId")), None)
                if flow_bp:
                    choices_per_item.append([("flow", flow_bp["id"])])
            elif ref.get("type") == "feature":
                scenarios = []
                for sname in ref.get("steps", []):
                    feature_ref_id = ref.get("refId", "") or ref.get("featurePath", "")
                    det_id = f"{feature_ref_id}-{sname}"
                    scenarios.append(("scenario", det_id))
                if scenarios:
                    choices_per_item.append(scenarios)

        if not choices_per_item:
            return []

        combos = list(itertools.product(*choices_per_item))
        set_combos_cache[set_bp_id] = combos
        return combos

    # Helper to migrate a single targetScenario string
    def migrate_target_scenario(target_scenario: str) -> str:
        if not target_scenario:
            return target_scenario

        match = OLD_SET_ID_RE.match(target_scenario)
        if not match:
            return target_scenario

        c_ref_id, set_ref_id, combo_idx_str, scenario_idx_str, scenario_blueprint_id = match.groups()
        combo_idx = int(combo_idx_str)

        # Find the Set blueprint refId in the cycle composition
        set_blueprint_id = None
        for cycle in blueprints.get("cycles", []):
            for item in cycle.get("items", []):
                if item.get("id") == set_ref_id and item.get("type") == "set":
                    set_blueprint_id = item.get("refId")
                    break
            if set_blueprint_id:
                break

        if not set_blueprint_id:
            return target_scenario

        combos = get_set_combos_cached(set_blueprint_id)
        if combo_idx >= len(combos):
            return target_scenario

        selected_combo = combos[combo_idx]
        parts = []
        for t, val in selected_combo:
            parts.append(f"{t}:{val}")
        combined = "|".join(parts)
        combo_signature = fnv1a_32(combined)

        new_target = f"set-{c_ref_id}-{set_ref_id}-{combo_signature}-{scenario_idx_str}-{scenario_blueprint_id}"
        return new_target

    # 2. Update tasks in plans, cycles, sets, flows
    for plan in blueprints.get("plans", []):
        for task in plan.get("tasks", []):
            target = task.get("targetScenario")
            if target:
                new_target = migrate_target_scenario(target)
                if new_target != target:
                    task["targetScenario"] = new_target
                    modified = True

    for cycle in blueprints.get("cycles", []):
        for task in cycle.get("tasks", []):
            target = task.get("targetScenario")
            if target:
                new_target = migrate_target_scenario(target)
                if new_target != target:
                    task["targetScenario"] = new_target
                    modified = True

    for test_set in blueprints.get("sets", []):
        for task in test_set.get("tasks", []):
            target = task.get("targetScenario")
            if target:
                new_target = migrate_target_scenario(target)
                if new_target != target:
                    task["targetScenario"] = new_target
                    modified = True

    for flow in blueprints.get("flows", []):
        for task in flow.get("tasks", []):
            target = task.get("targetScenario")
            if target:
                new_target = migrate_target_scenario(target)
                if new_target != target:
                    task["targetScenario"] = new_target
                    modified = True

    return modified
