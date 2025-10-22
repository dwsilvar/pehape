# language: en
"""
This file contains Behave "hooks", which are functions that are executed
automatically at certain points in the test lifecycle.
"""
import allure
from allure_commons.types import AttachmentType
from executor.ui_executor import executor
from executor.tasks_worker.file_tasks import FileTasks
import logging
import time

logger = logging.getLogger(__name__)

def before_all(context):
    """Executes once before all tests."""
    # Instantiate the task processor once for the entire lifecycle.
    context.file_tasks = FileTasks()

def before_step(context, step):
    """
    Executes BEFORE each step.
    """
    # Delegates task processing to the FileTasks class.
    context.file_tasks.run_tasks_from_context(context, step, 'before')

def after_step(context, step):
    """
    Executes after each step.
    """
    # Delegates task processing to the FileTasks class.
    context.file_tasks.run_tasks_from_context(context, step, 'after')

    # Avoids taking a screenshot if the step itself is already for taking a screenshot, to prevent duplication.
    if "take a screenshot as evidence" in step.name:
        return

    try:
        screenshot_bytes = executor.driver.capture_evidence_screenshot()
        if screenshot_bytes:
            allure.attach(screenshot_bytes, name=f"After: '{step.name}'", attachment_type=AttachmentType.PNG)
    except Exception as e:
        logger.error(f"Could not take automatic screenshot after step '{step.name}'. Cause: {e}")