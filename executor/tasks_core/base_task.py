"""
Base module for hook tasks.
Defines the interface that all tasks must implement.
"""
from abc import ABC, abstractmethod
import logging

logger = logging.getLogger(__name__)

class BaseTask(ABC):
    """
    Abstract base class for all tasks executed from hooks.
    """

    def should_run(self, hook_type: str, step) -> bool:
        """
        Determines if the task should run given the current hook type and step.
        
        Args:
            hook_type: 'before' or 'after'.
            step: The Behave step object.
            
        Returns:
            bool: True if it should run, False otherwise.
        """
        return True

    @classmethod
    def get_args_schema(cls) -> list:
        """
        Returns a list of argument definitions for the UI to render.
        Example: [
            {"name": "path", "label": "Log Path", "type": "text", "default": "C:\\temp\\activity.log"},
            {"name": "expected_text", "label": "Expected Text", "type": "text"}
        ]
        """
        return []

    @abstractmethod
    def execute(self, context, step, **kwargs):
        """
        Executes the task logic.
        
        Args:
            context: The Behave context.
            step: The Behave step object.
            **kwargs: Additional arguments.
        """
        pass
