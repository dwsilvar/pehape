from abc import ABC, abstractmethod
from typing import Optional, Tuple, Any

class AbstractWindowManager(ABC):
    """
    Abstract base class for OS-specific window management.
    """

    @abstractmethod
    def ensure_window_is_visible(self, title_substring: str) -> bool:
        """
        Ensures a window matching the title substring is visible, restored, and focused.
        
        Args:
            title_substring: The title (or partial title) of the window.
            
        Returns:
            True if the window was found and activated, False otherwise.
        """
        pass


    @abstractmethod
    def get_window_region(self, title_substring: str) -> Optional[Tuple[int, int, int, int]]:
        """
        Gets the region (left, top, width, height) of the specified application window.
        
        Args:
            title_substring: The title (or partial title) of the window.
            
        Returns:
            A tuple (left, top, width, height) or None if not found.
        """
        pass

    @abstractmethod
    def send_text(self, text: str, title_substring: str = None, interval: float = 0.2) -> bool:
        """
        Sends text to a window. If title_substring is None, sends to the active window.
        
        Args:
            text: The string to type.
            title_substring: Optional window title to target.
            interval: Delay between key presses in seconds.
            
        Returns:
            True on success, False otherwise.
        """
        pass

    @abstractmethod
    def capture_screenshot(self, region: Optional[Tuple[int, int, int, int]] = None) -> Any:
        """
        Captures a screenshot of the entire screen or a specific region.
        
        Args:
            region: Optional tuple (left, top, width, height) to capture. 
                    If None, captures the entire screen.
            
        Returns:
            A PIL Image object (or equivalent) containing the screenshot, or None on failure.
        """
        pass

