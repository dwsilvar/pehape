# language: en
"""
This file contains Behave "hooks", which are functions that are executed
automatically at certain points in the test lifecycle.
"""
import allure
from allure_commons.types import AttachmentType
from executor.task_executor import TaskExecutor
# Import tasks module to ensure tasks are registered
import executor.tasks.log_tasks
import logging
import time
import json
import sys

logger = logging.getLogger(__name__)

def before_all(context):
    """Executes once before all tests."""
    # Instantiate the task executor once for the entire lifecycle.
    context.task_executor = TaskExecutor()

def before_scenario(context, scenario):
    """
    Este hook se ejecuta ANTES de cada escenario.
    Imprime un JSON para notificar al frontend que el escenario está "running".
    """
    feature_id = context.config.userdata.get("feature_id", "unknown_feature")
    status_report = {
        "type": "scenario_status",
        "feature_id": feature_id,
        "name": scenario.name,
        "status": "running"
    }
    print(json.dumps(status_report), flush=True)

    # Execute setup tasks
    if hasattr(context, 'task_executor'):
        context.task_executor.run_tasks(context, None, 'before_scenario')

def before_step(context, step):
    """
    Executes BEFORE each step.
    """
    # Delegates task processing to the TaskExecutor class.
    # Note: 'before' maps to 'before_step' logic in tasks that expect it.
    context.task_executor.run_tasks(context, step, 'before')

def after_step(context, step):
    """
    Executes after each step.
    """
    # Delegates task processing to the TaskExecutor class.
    context.task_executor.run_tasks(context, step, 'after')

    # Avoids taking a screenshot if the step itself is already for taking a screenshot, to prevent duplication.
    if "take a screenshot as evidence" in step.name:
        return

    try:
        screenshot_bytes = executor.driver.capture_evidence_screenshot()
        if screenshot_bytes:
            allure.attach(screenshot_bytes, name=f"After: '{step.name}'", attachment_type=AttachmentType.PNG)
    except Exception as e:
        logger.error(f"Could not take automatic screenshot after step '{step.name}'. Cause: {e}")

def after_scenario(context, scenario):
    """
    Este hook se ejecuta después de cada escenario.
    Imprime un JSON estructurado a stdout con el estado del escenario.
    """
    # Execute teardown tasks
    if hasattr(context, 'task_executor'):
        context.task_executor.run_tasks(context, None, 'after_scenario')

    feature_id = context.config.userdata.get("feature_id", "unknown_feature")
    status_report = {
        "type": "scenario_status",
        "feature_id": feature_id,
        "name": scenario.name,
        "status": scenario.status.name  # 'passed', 'failed', 'skipped', etc.
    }
    print(json.dumps(status_report), flush=True)