"""
Executor module handles the discovery and execution of tasks based on tags.
"""
import logging
from executor.tasks_core.registry import get_task

logger = logging.getLogger(__name__)

class TaskExecutor:
    """
    Orchestrates the execution of registered tasks.
    """

    def run_tasks(self, context, step, hook_type: str):
        """
        Parses context tags and UI-configured tasks, finds corresponding tasks, 
        and executes them if conditions are met.
        
        Args:
            context: Behave context containing tags and ui_tasks.
            step: Behave step object (None for scenario/feature hooks).
            hook_type: 'before', 'after', 'before_scenario', 'after_scenario', etc.
        """
        # 1. Execute tasks from Tags (Legacy/Feature-embedded)
        for tag in context.tags:
            if tag.startswith("task_"):
                task_name = tag.split("task_", 1)[1]
                self._execute_named_task(context, step, hook_type, task_name)

        # 2. Execute tasks from UI Configuration (Stored in context.ui_tasks)
        ui_tasks = getattr(context, 'ui_tasks', [])
        current_scenario_id = context.config.userdata.get("orch_scenario_id")

        for index, task_config in enumerate(ui_tasks):
            # task_config: { "name": "...", "scope": "...", "hook": "...", "scenario_name": "...", "scenario_id": "..." }
            config_hook = task_config.get('hook', '').lower()
            config_scope = task_config.get('scope', '').lower()
            task_scenario_id = task_config.get('scenario_id')
            
            should_run_ui = False
            
            # Check Hook Match
            if config_hook == 'before':
                 if config_scope == 'step' and hook_type == 'before':
                     should_run_ui = True
                 elif config_scope in ['feature', 'scenario'] and hook_type == 'before_scenario':
                     should_run_ui = True
            elif config_hook == 'after':
                 if config_scope == 'step' and hook_type == 'after':
                     should_run_ui = True
                 elif config_scope in ['feature', 'scenario'] and hook_type == 'after_scenario':
                     should_run_ui = True
            
            if not should_run_ui:
                continue
                
            # Check Scope Match / Instance Match
            if task_scenario_id:
                # Isolate to this specific scenario instance UUID
                if task_scenario_id != current_scenario_id:
                    continue
            else:
                # Fallback to name-based matching (legacy)
                if config_scope == 'scenario':
                    scenario_name = task_config.get('scenario_name')
                    if scenario_name and scenario_name != context.scenario.name:
                        continue
            
            if config_scope == 'step':
                if step is None: 
                    continue
            
            self._execute_named_task(context, step, hook_type, task_config.get('name'), ui_index=index)

    def _execute_named_task(self, context, step, hook_type, task_name, ui_index=None):
        """Helper to instantiate and execute a task by name."""
        import json
        if not hasattr(context, 'ui_task_results'):
            context.ui_task_results = []

        feature_id = context.config.userdata.get("feature_id", "unknown_feature")
        # Normalize feature_id to use forward slashes (matching frontend IDs)
        if feature_id:
            feature_id = feature_id.replace('\\', '/')

        current_scenario_id = context.config.userdata.get("orch_scenario_id")

        task_class = get_task(task_name)
        if task_class:
            result = None
            try:
                task_instance = task_class()
                if task_instance.should_run(hook_type, step):
                    logger.info(f"TaskExecutor: Executing task '{task_name}' (hook: {hook_type})")
                    
                    # Extract args and config id from task_config if available (from UI config)
                    args = {}
                    task_id = None
                    if ui_index is not None:
                        ui_tasks = getattr(context, 'ui_tasks', [])
                        if ui_index < len(ui_tasks):
                            args = ui_tasks[ui_index].get('args', {})
                            task_id = ui_tasks[ui_index].get('id')

                    # Report "running" status to UI
                    if ui_index is not None:
                        status_report = {
                            "type": "task_status",
                            "feature_id": feature_id,
                            "scenario_id": current_scenario_id,
                            "task": {
                                "id": task_id,
                                "name": task_name,
                                "status": "running",
                                "hook": hook_type,
                                "ui_index": ui_index
                            }
                        }
                        logger.info(f"[TASK_EXECUTOR] Emitting task_status (running): {status_report}")
                        print(json.dumps(status_report), flush=True)
                    
                    task_instance.execute(context, step, **args)
                    result = {
                        "id": task_id,
                        "scenario_id": current_scenario_id,
                        "name": task_name,
                        "status": "passed",
                        "hook": hook_type,
                        "ui_index": ui_index
                    }
            except Exception as e:
                error_msg = str(e)
                logger.error(f"TaskExecutor: Error executing task '{task_name}'. Cause: {error_msg}")
                
                # Try to attach the error to Allure report
                try:
                    import allure
                    from allure_commons.types import AttachmentType
                    allure.attach(
                        f"Task '{task_name}' failed.\nError: {error_msg}", 
                        name=f"Task Error: {task_name}", 
                        attachment_type=AttachmentType.TEXT
                    )
                except Exception as allure_e:
                    logger.error(f"TaskExecutor: Failed to attach error to Allure: {allure_e}")

                # Extract config id again in case exception happened before extraction
                task_id = None
                if ui_index is not None:
                    ui_tasks = getattr(context, 'ui_tasks', [])
                    if ui_index < len(ui_tasks):
                        task_id = ui_tasks[ui_index].get('id')

                result = {
                    "id": task_id,
                    "scenario_id": current_scenario_id,
                    "name": task_name,
                    "status": "failed",
                    "hook": hook_type,
                    "error": error_msg,
                    "ui_index": ui_index
                }
            
            if result:
                context.ui_task_results.append(result)
                # Report to UI in real-time
                status_report = {
                    "type": "task_status",
                    "feature_id": feature_id,
                    "scenario_id": current_scenario_id,
                    "task": result
                }
                logger.info(f"[TASK_EXECUTOR] Emitting task_status (final): {status_report}")
                print(json.dumps(status_report), flush=True)
        else:
            logger.warning(f"TaskExecutor: No task registered with name '{task_name}'.")
