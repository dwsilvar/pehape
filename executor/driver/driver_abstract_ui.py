from abc import ABC, abstractmethod
from typing import Optional
#from behave import Context

class DriverAbstractUI(ABC):
    """
    Abstract base class for UI drivers.

    Implement high-level UI actions here. Concrete drivers (OCRDriver, etc.)
    must implement these methods. Docstrings are in English per project policy.
    """

    @abstractmethod
    def is_app_running(self, app_name: str) -> bool:
        """Return True if an application with the given name is currently running/visible."""
        pass

    @abstractmethod
    def click_on_element_by_text(self, text: str, image_text_path: Optional[str] = None) -> bool:
        """Find text on screen and click its center. Returns True on success."""
        pass

    @abstractmethod
    def click_on_element_by_text_in_app(self, text: str, app_name: str, image_text_path: Optional[str] = None) -> bool:
        """Find text inside a specific application window and click it."""
        pass

    @abstractmethod
    def enter_text(self, text: str) -> bool:
        """Type text into the currently focused input or element."""
        pass

    @abstractmethod
    def enter_url_in_address_bar(self, url: str) -> bool:
        """Enter a URL into the browser address bar and press Enter."""
        pass

    @abstractmethod
    def find_text_on_screen(self, text_to_find: str, image_text_path: Optional[str] = None) -> bool:
        """Return True if the text is found anywhere on the screen using OCR."""
        pass

    @abstractmethod
    def find_text_on_app(self, app_name: str, text_to_find: str, image_text_path: Optional[str] = None) -> bool:
        """Return True if the text is found within the specified application window."""
        pass

    @abstractmethod
    def wait(self, seconds: float) -> None:
        """Sleep/wait for the given number of seconds."""
        pass

    @abstractmethod
    def wait_until_text_appears(self, seconds: float, text_to_find: str) -> bool:
        """Wait up to `seconds` until the given text appears on screen; return True when found."""
        pass

    @abstractmethod
    def capture_evidence_screenshot(self) -> Optional[str]:
        """Capture and return the path to an evidence screenshot (for reports)."""
        pass

    