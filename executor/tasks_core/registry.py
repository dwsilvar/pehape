"""
Registry module for hook tasks.
Maintains a record of available tasks classes decorated with @register_task.
"""

_TASKS = {}

def register_task(task_name):
    """
    Decorator to register a task class with a specific name (tag suffix).
    
    Usage:
        @register_task("my_task")
        class MyTask(BaseTask): ...
    """
    def decorator(cls):
        _TASKS[task_name] = cls
        return cls
    return decorator

def get_task(task_name):
    """
    Retrieves a task class by its registered name.
    
    Returns:
        The class of the task if found, else None.
    """
    return _TASKS.get(task_name)

def get_all_tasks():
    """
    Returns a copy of the registered tasks dictionary.
    """
    return _TASKS.copy()
