from behave.__main__ import main as behave_main
import os
from typing import List, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

FEATURES_DIR = "./features"
class BehaveRunJson:
    """
    Class responsible for taking the execution plan and executing the commands
    'behave' in the specified order and with the specified filters.
    """
    def __init__(self, execution_plan: List[Dict[str, Any]], extra_args: str = ""):
        self.execution_plan = execution_plan
        self.extra_args = extra_args.split()
        self.modules_by_name = {
            module.get("module_name"): module for module in execution_plan
        }

    def _run_feature(self, feature_item: Dict[str, Any], module_name: str, module_dir: str):
        feature_file = feature_item.get("feature_file")
        feature_active = feature_item.get("active", False)
        feature_dir = feature_item.get("feature_dir", "")
        tags = feature_item.get("tags")
        feature_id = f"feature::{module_name}::{feature_dir}/{feature_file}"

        if not feature_file:
            logger.warning("Feature without 'feature_file'. Skipping.")
            return

        if not feature_active:
            logger.info(f"IGNORED: {feature_dir}/{feature_file} (Feature Deactivated)")
            return

        path_parts = [FEATURES_DIR]
        if module_dir:
            path_parts.append(module_dir)
        if feature_dir:
            path_parts.append(feature_dir)
        path_parts.append(feature_file)
        full_feature_path = os.path.join(*path_parts)
        
        if not os.path.exists(full_feature_path):
            logger.error(f"File not found: {full_feature_path}. Skipping.")
            return

        behave_args = list(self.extra_args)
        behave_args.extend(["-f", "plain", "-o", "-"])
        behave_args.extend(["-f", "allure_behave.formatter:AllureFormatter", "-o", "reports/allure_results"])
        behave_args.extend(["--define", f"feature_id={feature_id}"])

        # Pass UI-configured tasks via a temporary JSON file
        ui_tasks = feature_item.get("ui_tasks", [])
        if ui_tasks:
            import json
            import tempfile
            # Create a temporary file that persists during the behave run
            with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as tf:
                json.dump(ui_tasks, tf)
                temp_tasks_path = tf.name
            
            behave_args.extend(["--define", f"ui_tasks_file={temp_tasks_path}"])

        tag_info = ""
        if tags and isinstance(tags, list):
            tag_expression = ",".join(tags)
            behave_args.extend(["--tags", tag_expression])
            tag_info = f" (Filtro: {tag_expression})"

        behave_args.append(full_feature_path)

        logger.info(f"  INCLUDED: {full_feature_path}{tag_info}")

        exit_code = behave_main(behave_args)
        
        # Cleanup temporary file if it was created
        if ui_tasks and 'temp_tasks_path' in locals() and os.path.exists(temp_tasks_path):
            try:
                os.remove(temp_tasks_path)
            except Exception as e:
                logger.warning(f"Could not remove temporary tasks file: {e}")

        if exit_code == 0:
            logger.info("Tests executed successfully.")
        else:
            logger.error(f"Tests failed with exit code: {exit_code}")

    def _run_module_features(self, module_item: Dict[str, Any]):
        module_name = module_item.get("module_name", "Sin Nombre")
        module_dir = module_item.get("module_dir", "")
        features = module_item.get("features", [])

        logger.info(f"--- EXECUTING MODULE: {module_name} (Base Dir: {module_dir}) ---")

        features_sorted = sorted(
            features,
            key=lambda f: (f.get('order') is None, f.get('order', 0))
        )

        for feature_item in features_sorted:
            self._run_feature(feature_item, module_name, module_dir)

    def run_sequence(self):
        """
        Executes behave for each active feature in the sequence using behave_main.
        """
        if not self.execution_plan:
            logger.info("Execution plan is empty. Terminating execution.")
            return

        logger.info("--- Execution Plan ---")

        modules_sorted = sorted(
            self.execution_plan,
            key=lambda m: (m.get('order') is None, m.get('order', 0))
        )

        for module_item in modules_sorted:
            module_name = module_item.get("module_name", "Sin Nombre")
            module_active = module_item.get("active", False)
            
            setup = module_item.get("setup", [])
            teardown = module_item.get("teardown", [])

            # Execute pre-hooks
            for hook_name in setup:
                hook_module = self.modules_by_name.get(hook_name)
                if hook_module:
                    logger.info(f"--- EXECUTING SETUP: {hook_name} for {module_name} ---")
                    self._run_module_features(hook_module)
                else:
                    logger.warning(f"Setup module '{hook_name}' not found.")

            # Execute main module
            if not module_active:
                logger.info(f"IGNORING MODULE: {module_name} (Deactivated)")
                continue
            
            self._run_module_features(module_item)

            # Execute teardown
            for hook_name in teardown:
                hook_module = self.modules_by_name.get(hook_name)
                if hook_module:
                    logger.info(f"--- EXECUTING TEARDOWN: {hook_name} for {module_name} ---")
                    self._run_module_features(hook_module)
                else:
                    logger.warning(f"Teardown module '{hook_name}' not found.")

        logger.info("--- Execution Finished ---")
