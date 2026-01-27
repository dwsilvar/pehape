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
import executor.tasks.text_verification_tasks
import logging
import time
import json
import sys
# Import the executor instance so hooks can use executor.driver (UIExecutor.driver)
from executor.ui_executor import executor
import os

logger = logging.getLogger(__name__)

def before_all(context):
    """Executes once before all tests."""
    # Instantiate the task executor once for the entire lifecycle.
    context.task_executor = TaskExecutor()
    
    # Load UI-configured tasks if they exist
    context.ui_tasks = []
    ui_tasks_file = context.config.userdata.get("ui_tasks_file")
    if ui_tasks_file and os.path.exists(ui_tasks_file):
        try:
            with open(ui_tasks_file, 'r', encoding='utf-8') as f:
                context.ui_tasks = json.load(f)
            logger.info(f"Environment: Loaded {len(context.ui_tasks)} UI tasks.")
        except Exception as e:
            logger.error(f"Environment: Error loading UI tasks from {ui_tasks_file}: {e}")

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

    # Setup for GIF generation: Create a temp directory for this scenario run
    timestamp = int(time.time())
    sanitized_name = "".join([c if c.isalnum() else "_" for c in scenario.name])
    execution_id = f"{timestamp}_{sanitized_name}"
    
    # Store in context for steps to access
    context.gif_execution_id = execution_id
    context.gif_step_count = 0
    
    # Define and create the directory
    import os
    # Assuming 'reports' is in the project root, accessible via relative path or config
    # detailed_path: reports/temp_gif/{execution_id}
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    gif_dir = os.path.join(project_root, 'reports', 'temp_gif', execution_id)
    os.makedirs(gif_dir, exist_ok=True)
    context.gif_dir = gif_dir

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

    # Capture screenshot for Allure and GIF
    try:
        screenshot_bytes = executor.driver.capture_evidence_screenshot()
        if screenshot_bytes:
            # 1. Attach to Allure Report
            allure.attach(
                screenshot_bytes, 
                name=f"Step: {step.name}", 
                attachment_type=AttachmentType.PNG
            )

            # 2. Logic for GIF generation: save to temp directory
            if hasattr(context, 'gif_dir') and hasattr(context, 'gif_step_count'):
                context.gif_step_count += 1
                filename = f"{context.gif_step_count:03d}.png"
                filepath = os.path.join(context.gif_dir, filename)
                with open(filepath, "wb") as f:
                    f.write(screenshot_bytes)
    except Exception as e:
        logger.error(f"Failed to capture evidence/GIF frame for step '{step.name}': {e}")

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
        "status": scenario.status.name,  # 'passed', 'failed', 'skipped', etc.
        "gifExecutionId": getattr(context, 'gif_execution_id', None) # Pass ID to frontend
    }
    print(json.dumps(status_report), flush=True)