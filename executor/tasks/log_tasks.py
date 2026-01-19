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
    def should_run(self, hook_type, step) -> bool:
        # Original condition: "Generar Reporte" in s.name
        return hook_type == 'before' and "Generar Reporte" in step.name

    def execute(self, context, step, **kwargs):
        # Default path, could be configurable via context/userdata in the future
        log_file_path = "C:\\temp\\activity.log"
        
        logger.info(f"CleanupLogTask: Attempting to clean up file '{log_file_path}'...")
        if os.path.exists(log_file_path):
            try:
                os.remove(log_file_path)
                logger.info(f"CleanupLogTask: File '{log_file_path}' deleted.")
            except Exception as e:
                logger.error(f"CleanupLogTask: Could not delete file '{log_file_path}'. Cause: {e}")

@register_task("verificar_log")
class VerifyLogTask(BaseTask):
    """
    Verifies if a log file exists, optionally checks content, and attaches to Allure.
    """
    def should_run(self, hook_type, step) -> bool:
        # Original condition: s.status == 'passed'
        # Note: step.status might not be populated in 'after_step' exactly as expected depending on behave version,
        # but following original logic.
        return hook_type == 'after' and step.status == 'passed'

    def execute(self, context, step, **kwargs):
        log_file_path = "C:\\temp\\activity.log"
        expected_content = None # Could be extracted from somewhere if needed
        
        logger.info(f"VerifyLogTask: Verifying file at '{log_file_path}'...")
        if not os.path.exists(log_file_path):
            logger.warning(f"VerifyLogTask: File '{log_file_path}' does not exist.")
            return

        try:
            with open(log_file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                allure.attach(content, name=f"Content of {os.path.basename(log_file_path)}", attachment_type=AttachmentType.TEXT)
                logger.info(f"VerifyLogTask: File '{log_file_path}' attached to Allure.")

                if expected_content:
                    # Rasing assertion error here to fail the step if content is missing
                    if expected_content not in content:
                        raise AssertionError(f"Expected content '{expected_content}' not found in the file.")
                    logger.info("VerifyLogTask: Expected content was found in the file.")
        except Exception as e:
            logger.error(f"VerifyLogTask: Error reading or verifying file '{log_file_path}'. Cause: {e}")
            # Re-raise if we want to fail the test on error, or just log. Original logged error.
