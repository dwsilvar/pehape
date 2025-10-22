from abc import ABC, abstractmethod
from typing import Any

class WorkerInterface(ABC):
    """
    Worker interface: low-level screen automation primitives.

    Preferred names:
      - click_at(point)
      - click_on_image(image_path)
      - enter_text(text)
      - capture_screenshot()
      - press_enter()
    """

    @abstractmethod
    def click_at(self, point: tuple) -> bool:
        """
        Click at absolute screen coordinates.

        Parameters:
            point: (x, y) screen coordinates.

        Returns:
            True on success, False otherwise.
        """
        pass

    @abstractmethod
    def click_on_image(self, image_path: str) -> bool:
        """
        Locate the given image on screen and click its center.

        Parameters:
            image_path: Path to the reference image.

        Returns:
            True on success, False otherwise.
        """
        pass

    @abstractmethod
    def enter_text(self, text: str) -> bool:
        """
        Type the provided text into the active input.

        Parameters:
            text: Text to type.

        Returns:
            True on success, False otherwise.
        """
        pass

    @abstractmethod
    def capture_screenshot(self) -> Any:
        """
        Capture and return a raw screenshot object (PIL.Image or similar).

        Returns:
            Screenshot object or None on failure.
        """
        pass

    @abstractmethod
    def press_enter(self) -> bool:
        """Press the Enter key."""
        pass