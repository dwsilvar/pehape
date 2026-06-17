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
    También inyecta labels de Allure con el contexto del ciclo/flow del orquestador.
    """
    ud = context.config.userdata

    # ── Allure labels: diferenciar por Cycle y Flow en la vista de matriz ────
    cycle_name     = ud.get("orch_cycle_name",     "")
    flow_name      = ud.get("orch_flow_name",      "")
    cycle_id       = ud.get("orch_cycle_id",       "")
    flow_id        = ud.get("orch_flow_id",        "")
    scenario_id    = ud.get("orch_scenario_id",    "")
    instance_index = int(ud.get("orch_instance_index", "1"))

    if cycle_name:
        allure.dynamic.epic(cycle_name)        # Nivel 1: Test Cycle
    if flow_name:
        allure.dynamic.story(flow_name)        # Nivel 2: Test Flow
    if cycle_name or flow_name:
        # Parámetro visible en la vista de Matriz/Tabla de Allure
        context_label = " › ".join(filter(None, [cycle_name, flow_name]))
        allure.dynamic.parameter("Ejecución", context_label)
        # Tag adicional para trazabilidad en los filtros
        allure.dynamic.tag(f"cycle:{cycle_id or cycle_name}")
        allure.dynamic.tag(f"flow:{flow_id or flow_name}")

    # ── Instancia: cuando el mismo escenario aparece más de una vez en el plan ──
    # El parámetro "Instancia" se añade SIEMPRE que el escenario venga del orquestador
    # (es decir, cuando scenario_id está presente). Esto asegura que Allure calcule
    # un historyId distinto por slot del plan, evitando que dos ejecuciones del mismo
    # escenario sean agrupadas como "retries" en lugar de tests independientes.
    if scenario_id:
        # Únicamente modifica el título en Allure si hay repetición (evita noise en caso único)
        if instance_index > 1:
            allure.dynamic.title(f"{scenario.name} (Instancia #{instance_index})")
        # El parámetro siempre se añade → afecta historyId → tests son independientes en Allure
        allure.dynamic.parameter("Instancia", str(instance_index))
        allure.dynamic.parameter("scenario_id", scenario_id[:8])  # Prefijo UUID (brevedad)
        allure.dynamic.tag(f"instance:{scenario_id[:8]}")

    feature_id = ud.get("feature_id", "unknown_feature")
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