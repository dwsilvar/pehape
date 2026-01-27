# Window Management Architecture

## Overview

The window management system has been refactored to support cross-platform compatibility (Windows, Linux, macOS) and to allow flexible implementation strategies.

This architecture decouples the high-level automation worker (`PyAutoGUIWorker`) from the low-level OS-specific details of window control (activation, focus, geometry retrieval).

## Architecture

We utilize the **Strategy Patern** and a **Factory**:

1.  **`AbstractWindowManager` (`executor/worker/window_manager/abstract_window_manager.py`)**:
    *   Defines the contract for any window manager.
    *   Key methods: `ensure_window_is_visible(title)`, `get_window_region(title)`.

2.  **Concrete Strategies**:
    *   **`WindowsWindowManager`**: Implements the legacy `ctypes`/`user32` logic for robust Windows handling.
    *   **`LinuxWindowManager`**: Placeholder for future Linux support (using tools like `wmctrl` or `xdotool`).

3.  **Factory (`executor/worker/window_manager/window_manager_factory.py`)**:
    *   Automatically detects the OS (`platform.system()`) and returns the correct manager instance.
    *   Allows manual override (useful for testing or switching libraries).

## Usage

The `PyAutoGUIWorker` implementation is now platform-agnostic:

```python
# executor/worker/pyautogui_worker.py
from .window_manager import get_window_manager

class PyAutoGUIWorker(WorkerInterface):
    def __init__(self):
        # Automatically gets the correct manager
        self.window_manager = get_window_manager() 

    def ensure_window_is_visible(self, title):
        # Delegates the "HOW" to the manager
        return self.window_manager.ensure_window_is_visible(title)
```

## Adding a New Implementation

To switch to a new library (e.g., if `ctypes` becomes obsolete or you want to use `pywinauto`):

1.  Create a new class `WindowsPyWinAutoManager` implementing `AbstractWindowManager`.
2.  Update `window_manager_factory.py` to return your new class when desired (e.g., via config flag).
3.  **No changes** are needed in `PyAutoGUIWorker`.

## Linux Support Status

*   Infrastructure is ready.
*   `LinuxWindowManager` class exists but methods currently return `False` or `None`.
*   To enable full support, implement the methods in `executor/worker/window_manager/linux_window_manager.py`.
