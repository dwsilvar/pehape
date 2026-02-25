"""
Tasks related to log file manipulation and verification.
"""
import os
import logging
import allure
from allure_commons.types import AttachmentType
from executor.tasks_core.registry import register_task
from executor.tasks_core.base_task import BaseTask

logger = logging.getLogger(__name__)

@register_task("limpiar_log")
class CleanupLogTask(BaseTask):
    """
    Deletes a log file before generation.
    """
    scope = "Before Scenario / Before Step"

    @classmethod
    def get_args_schema(cls) -> list:
        return [
            {"name": "log_file_path", "label": "Ruta del Archivo Log", "type": "text", "default": "C:\\temp\\activity.log"}
        ]

    def execute(self, context, step, **kwargs):
        log_file_path = kwargs.get('log_file_path', "C:\\temp\\activity.log")
        
        logger.info(f"CleanupLogTask: Attempting to delete log file at '{log_file_path}'...")
        
        if os.path.exists(log_file_path):
            try:
                os.remove(log_file_path)
                logger.info(f"CleanupLogTask: Successfully deleted '{log_file_path}'.")
            except Exception as e:
                logger.error(f"CleanupLogTask: Error deleting file '{log_file_path}'. Cause: {e}")
                raise e
        else:
            logger.info(f"CleanupLogTask: File '{log_file_path}' does not exist, nothing to delete.")

    def should_run(self, hook_type, step) -> bool:
        # Original condition: "Generar Reporte" in s.name
        return hook_type == 'before' and "Generar Reporte" in step.name

@register_task("validar_existencia_log")
class ValidateLogExistenceTask(BaseTask):
    """
    Verifies ONLY if a log file exists and attaches it to Allure.
    """
    scope = "After Step"
    def should_run(self, hook_type, step) -> bool:
        # Support running at the end of scenario (step is None)
        if hook_type == 'after_scenario':
            return True
        # For steps, only run if passed
        return hook_type == 'after' and step and step.status == 'passed'

    @classmethod
    def get_args_schema(cls) -> list:
        return [
            {"name": "log_file_path", "label": "Ruta del Log", "type": "text", "default": "C:\\temp\\activity.log"}
        ]

    def execute(self, context, step, **kwargs):
        log_file_path = kwargs.get('log_file_path', "C:\\temp\\activity.log")
        
        logger.info(f"ValidateLogExistenceTask: Verifying existence of file at '{log_file_path}'...")
        if not os.path.exists(log_file_path):
            error_msg = f"ValidateLogExistenceTask: File '{log_file_path}' does not exist."
            logger.error(error_msg)
            raise AssertionError(error_msg)

        try:
            with open(log_file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                allure.attach(content, name=f"Content of {os.path.basename(log_file_path)}", attachment_type=AttachmentType.TEXT)
                logger.info(f"ValidateLogExistenceTask: File '{log_file_path}' exists and was attached to Allure.")
        except Exception as e:
            logger.error(f"ValidateLogExistenceTask: Error reading file '{log_file_path}'. Cause: {e}")
            raise e
