"""
Contains a collection of tasks related to file manipulation and verification
that can be called from Behave hooks.
"""
import os
import logging
import allure
from allure_commons.types import AttachmentType

logger = logging.getLogger(__name__)

class FileTasks:
    """
    Encapsulates actions and verifications on the file system.
    """

    def run_tasks_from_context(self, context, step, hook_type: str):
        """
        Processes and executes file tasks based on scenario tags.
        Searches for tags starting with '@task_' and maps them to methods in this class.

        Paremeters:
            context: The Behave context.
            step: The current Behave step.
            hook_type: 'before' or 'after', to filter when the task should be executed.
        """
        # Mapping of tag names to methods and when they are executed.
        # The key is the task name in the tag (e.g., 'cleanup_log').
        # The value is a tuple: (method_name, hook_type, extra_condition).
        task_map = {
            'limpiar_log': ('cleanup_log_file', 'before', lambda s: "Generar Reporte" in s.name),
            'verificar_log': ('verify_log_file_and_attach', 'after', lambda s: s.status == 'passed')
        }

        for tag in context.tags:
            if tag.startswith("task_"):
                task_name = tag.split('task_', 1)[1]
                if task_name in task_map:
                    method_name, required_hook, condition = task_map[task_name]
                    
                    if hook_type == required_hook and (condition is None or condition(step)):
                        # For now, the file path is hardcoded, but it could be parameterized.
                        log_file_path = "C:\\temp\\activity.log"
                        
                        if hasattr(self, method_name):
                            method_to_call = getattr(self, method_name)
                            logger.info(f"Executing task '{task_name}' via method '{method_name}'.")
                            method_to_call(log_file_path)
                        else:
                            logger.warning(f"Task '{task_name}' is defined but method '{method_name}' does not exist in FileTasks.")

    def verify_log_file_and_attach(self, file_path: str, expected_content: str = None):
        """
        Verifies if a file exists, optionally checks its content,
        and attaches it to the Allure report.
        """
        logger.info(f"TASK: Verifying file at '{file_path}'...")
        if not os.path.exists(file_path):
            logger.warning(f"TASK FAILED: File '{file_path}' does not exist.")
            return

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                allure.attach(content, name=f"Content of {os.path.basename(file_path)}", attachment_type=AttachmentType.TEXT)
                logger.info(f"TASK SUCCESS: File '{file_path}' attached to Allure.")

                if expected_content:
                    assert expected_content in content, \
                        f"Expected content '{expected_content}' not found in the file."
                    logger.info("TASK SUCCESS: Expected content was found in the file.")
        except Exception as e:
            logger.error(f"TASK FAILED: Error reading or verifying file '{file_path}'. Cause: {e}")

    def cleanup_log_file(self, file_path: str):
        """
        Deletes a file if it exists.
        """
        logger.info(f"TASK: Attempting to clean up file '{file_path}'...")
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
                logger.info(f"TASK SUCCESS: File '{file_path}' deleted.")
            except Exception as e:
                logger.error(f"TASK FAILED: Could not delete file '{file_path}'. Cause: {e}")