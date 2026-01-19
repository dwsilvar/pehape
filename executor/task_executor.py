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
        Parses context tags, finds corresponding tasks, and executes them if conditions are met.
        
        Args:
            context: Behave context containing tags.
            step: Behave step object.
            hook_type: 'before' or 'after'.
        """
        for tag in context.tags:
            if tag.startswith("task_"):
                task_name = tag.split("task_", 1)[1]
                task_class = get_task(task_name)
                
                if task_class:
                    try:
                        # Instantiate the task (could use dependency injection here later)
                        task_instance = task_class()
                        
                        if task_instance.should_run(hook_type, step):
                            logger.info(f"TaskExecutor: Executing task '{task_name}' (hook: {hook_type})")
                            task_instance.execute(context, step)
                            
                    except Exception as e:
                        logger.error(f"TaskExecutor: Error executing task '{task_name}'. Cause: {e}")
                else:
                    logger.warning(f"TaskExecutor: Tag '{tag}' found but no task registered with name '{task_name}'.")
