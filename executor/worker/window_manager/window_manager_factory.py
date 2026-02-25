import platform
from .abstract_window_manager import AbstractWindowManager
from .windows_window_manager import WindowsWindowManager
from .linux_window_manager import LinuxWindowManager

def get_window_manager(force_platform: str = None) -> AbstractWindowManager:
    """
    Factory method to get the appropriate WindowManager based on the OS.
    
    Args:
        force_platform: Optional string ('Windows', 'Linux') to force a specific implementation.
        
    Returns:
        An instance of a class implementing AbstractWindowManager.
    """
    system = force_platform if force_platform else platform.system()
    
    if system == "Windows":
        return WindowsWindowManager()
    elif system == "Linux":
        return LinuxWindowManager()
    else:
        # Default fallback or error - for now fallback to Linux (agnostic) or raise
        # Choosing raise to be explicit
        raise NotImplementedError(f"Platform '{system}' is not currently supported for Window Management.")
