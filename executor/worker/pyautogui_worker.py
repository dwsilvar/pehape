"""
Implementation of the automation driver using PyAutoGUI.
"""
import os
from typing import Any, Optional
import pyautogui
import config.config as configurator
import logging
from .worker_interface import WorkerInterface
import time

logger = logging.getLogger(__name__)

class PyAutoGUIWorker(WorkerInterface):
    def wait_until_condition(self, seconds: float, condition_fn, *args, **kwargs) -> bool:
        """
        Waits until a condition function returns True or until the time runs out.

        Parameters:
            seconds: Maximum time to wait (in seconds, can be a decimal).
            condition_fn: Callable that returns True when the condition is met.
            *args, **kwargs: Arguments to pass to the condition function.

        Returns:
            True if the condition was met within the time, False otherwise.
        """
        found = False
        try:
            wait_time = float(seconds)
            logger.info(f"Waiting for {wait_time} second(s) or until condition is met...")
            start_time = pyautogui.time.time()
            while pyautogui.time.time() - start_time < wait_time:
                if condition_fn(*args, **kwargs):
                    logger.info("Condition met.")
                    found = True
                    break
                pyautogui.sleep(0.5)
        except ValueError:
            logger.error(f"The wait value '{seconds}' is not a valid number.")
        except Exception as e:
            logger.error(f"Error in wait_until_condition: {e}")
        return found
    """
    Worker that encapsulates PyAutoGUI actions.

    Implements methods with clear names and wrappers for
    legacy names used in the project.
    """
    def __init__(self):
        """
        Initializes PyAutoGUI with safe configurations.
        """
        pyautogui.FAILSAFE = True
        pyautogui.PAUSE = 0.5
        logger.info("PyAutoGUI driver initialized.")



    def get_window_region(self, app_name: str) -> Optional[tuple]:
        """
        Gets the region (x, y, width, height) of the specified application window.
        
        Parameters:
            app_name: The title (or partial title) of the window.
            
        Returns:
            A tuple (left, top, width, height) or None if not found.
        """
        try:
            windows = pyautogui.getWindowsWithTitle(app_name)
            if windows:
                window = windows[0] # Use the first one found
                return (window.left, window.top, window.width, window.height)
            else:
                logger.warning(f"No window found with title containing '{app_name}'")
                return None
        except Exception as e:
            logger.error(f"Error getting window region for '{app_name}': {e}")
            return None

    def click_at(self, point: tuple) -> bool:
        """
        Clicks at a specific point on the screen.

        Parameters:
            point: A tuple (x, y) representing the screen coordinates.

        Returns:
            True if the click was performed, False in case of an error.
        """
        try:
            pyautogui.click(point)
            logger.info(f"Successfully clicked at {point}.")
            return True
        except Exception as e:
            logger.exception(f"error clicking at {point}: {e}")
            return False
        
    def click_on_image(self, image_path: str, region: tuple = None) -> bool:
        """
        Locates an image on the screen and clicks its center.

        Parameters:
            image_path: Path to the reference image.
            region: Optional tuple (left, top, width, height) to restrict the search.

        Returns:
            True if found and clicked, False otherwise.
        """
        try:
            logger.info(f"Searching for image '{image_path}'..." + (f" in region {region}" if region else ""))
            location = pyautogui.locateCenterOnScreen(image_path, confidence=(configurator.CONFIDENCE_THRESHOLD/100), region=region)
            if location is not None:
                pyautogui.click(location)
                logger.info(f"Successfully clicked at {location}.")
                return True
            else:
                logger.warning(f"Image '{image_path}' not found.")
                return False
        except Exception as e:
            logger.exception(f"click_on_image: error searching for '{image_path}': {e}")
            return False

    def enter_text(self, text: str) -> bool:
        """
        Types the provided text into the active field.

        Parameters:
            text: Text to type.

        Returns:
            True on success, False on error.
        """
        try:
            pyautogui.typewrite(text, interval=0.05)
            logger.info(f"Text '{text}' typed successfully.")
            return True
        except Exception as e:
            logger.exception(f"enter_text: error typing text '{text}': {e}")
            return False

    def capture_screenshot(self) -> Optional[Any]:
        """
        Takes a screenshot and returns it.

        Returns:
            Image object (PIL.Image) or None on error.
        """
        try:
            screenshot = pyautogui.screenshot()
            logger.info("Screenshot taken successfully.")
            return screenshot
        except Exception as e:
            logger.exception(f"Error taking screenshot. Cause: {e}")
            return None
    
# --- Helper methods and aliases -------------------------------------

    def click_in_app_element_by_point(self, app_name: str, point: tuple):
        """
        Clicks at a specific point within an application.

        Paremeters:
            app_name: The name (or part of the name) of the application.
            point: A tuple (x, y) representing the screen coordinates.

        Returns:
            True if the operation was successful, False otherwise.
        """
        result = False
        if self.ensure_window_is_visible(app_name):
            result = self.click_at(point)

        return result
    
    def click_in_app_element_by_img(self, app_name: str, image_path: str):
        """
        Finds an image on an app's screen and clicks on its center.
        Paremeters:
            app_name: The name (or part of the name) of the app.
            image_path: The path to the image file to find.
        Returns:
            True if the operation was successful, False otherwise.
        """
        result = False
        if self.ensure_window_is_visible(app_name):
            # Optimización: Buscar solo dentro de la región de la ventana
            region = self.get_window_region(app_name)
            result = self.click_on_image(image_path, region=region)

        return result
    
    

    def get_element_coordinates_by_img(self, image_path: str, region: tuple = None):
        """
        Searches for an image on the screen and returns the coordinates of its center.

        Paremeters:
            image_path: The path to the image file to search for.
            region: Optional tuple (left, top, width, height) to restrict the search.

        Returns:
            A tuple (x, y) with the coordinates of the image's center, or None if not found.
        """

        root_path = configurator.IMAGES_BASE_PATH
        if not image_path.startswith(root_path):
            # Use os.path.join for robust path construction
            image_path = os.path.join(root_path, image_path)
        image_path = os.path.normpath(image_path)

        if not os.path.exists(image_path):
            logger.warning(f"Image does not exist at the specified path: {image_path}")
            return None
        
        try:
            logger.info(f"PyAutoGUI: Searching for image '{image_path}'..." + (f" in region {region}" if region else ""))

            location = pyautogui.locateCenterOnScreen(image_path, confidence=(configurator.CONFIDENCE_THRESHOLD/100), region=region)
            if location:
                logger.info(f"PyAutoGUI: Image found at {location}.")
                return location
            else:
                logger.warning(f"PyAutoGUI: Image '{image_path}' not found.")
                return None
        except pyautogui.PyAutoGUIException as e:
            logger.exception(f"PyAutoGUI: Error searching for image '{image_path}'. Cause: {e}")
            return None
    
    
    def get_screenshot_of_app(self, app_name: str):
        """Takes a screenshot of the entire screen, but only if the specified app window is visible."""
        result = None
        if self.ensure_window_is_visible(app_name):
            screenshot = self.capture_screenshot()
            result = screenshot

        return result
        
    def get_region_screenshot_window(self, app_name: str):
        """Takes a screenshot of a specific application window's region."""
        logger.info(f"Taking screenshot of the window '{app_name}'...")
        try:
            # Find the window by its title
            ventana = pyautogui.getWindowsWithTitle(app_name)[0]

            # Activate the window to ensure it is visible
            ventana.activate()

            # Get the coordinates and dimensions of the window
            x, y, ancho, alto = ventana.left, ventana.top, ventana.width, ventana.height

            region=(x, y, ancho, alto)

            # Take the screenshot of the window's region
            captura = pyautogui.screenshot(region=region)
            logger.info("Screenshot region ok")
            return captura, region
            
        except IndexError:
            logger.warning(f"No window found with the title: '{app_name}'")
        except Exception as e:
            logger.error(f"An error occurred: {e}")


    def ensure_window_is_visible(self, title_substring: str) -> bool:
        """
        Finds a window by its title. If found, it moves it to the primary screen,
        restores it if minimized, and brings it to the front.

        Paremeters:
            title_substring: The text to search for in the window titles.

        Returns:
            True if the window was found (and restored if necessary), False otherwise.
        """
        logger.info(f"Ensuring window '{title_substring}' is visible...")
        try:
            # getWindowsWithTitle is more direct than iterating over all windows.
            windows = pyautogui.getWindowsWithTitle(title_substring)
            
            if not windows:
                logger.info(f"No window found with title '{title_substring}'.")
                return False

            # Use the first matching window
            window = windows[0]
            sanitized_title = window.title.replace('\u200b', '')
            logger.info(f"Window found: '{sanitized_title}'")

            # If the window is minimized, restore it.
            if window.isMinimized:
                logger.info("Window is minimized. Restoring...")
                window.restore()
                time.sleep(0.5)  # Pause for the window to redraw.

            # Move window to primary screen (0, 0) or slightly offset to be safe
            # This avoids issues with secondary screens where pyautogui might struggle
            screen_width, screen_height = pyautogui.size()
            if (window.left < 0 or window.top < 0 or 
                window.left > screen_width or window.top > screen_height):
                 logger.info(f"Moving window '{sanitized_title}' to primary screen (10, 10)...")
                 window.moveTo(10, 10)
                 time.sleep(0.5)

            # Ensure the window is truly active and in the foreground
            # Note: window.isActive can be unreliable on Windows, so we use multiple strategies
            # IMPORTANT: Temporarily disable FAILSAFE to avoid false-positive cancellations
            # when the cursor moves near screen corners during window activation
            original_failsafe = pyautogui.FAILSAFE
            try:
                pyautogui.FAILSAFE = False  # Disable FAILSAFE temporarily
                
                # Strategy 1: Always call activate() to ensure window is in foreground
                logger.info(f"Activating window '{sanitized_title}'...")
                window.activate()
                time.sleep(0.3)
                
                # Strategy 2: Move cursor to window center (safer than clicking)
                # This helps ensure focus without triggering FAILSAFE if cursor passes through corners
                if not window.isActive:
                    logger.info("Window still not active after activate(). Moving cursor to window as fallback...")
                    center_x = window.left + (window.width // 2)
                    center_y = window.top + (window.height // 2)
                    # Use moveTo instead of direct click to avoid FAILSAFE issues
                    pyautogui.moveTo(center_x, center_y, duration=0.2)
                    time.sleep(0.1)
                    # Now click to ensure focus
                    pyautogui.click()
                    time.sleep(0.2)
                    
            except Exception as e:
                logger.warning(f"Error during window activation: {e}. Continuing anyway...")
            finally:
                # Always restore FAILSAFE to its original state
                pyautogui.FAILSAFE = original_failsafe

            logger.info(f"Window '{sanitized_title}' is visible and active.")
            return True

        except Exception as e:
            # PyAutoGUI can raise exceptions if there are issues with permissions or the graphical environment.
            logger.error(f"An error occurred while manipulating windows: {e}")
            return False
        

    def press_enter(self) -> bool:
        """
        Presses the Enter key using PyAutoGUI.
        """
        try:
            pyautogui.press('enter')
            logger.info("Enter key pressed successfully.")
            return True
        except Exception as e:
            logger.exception(f"Error pressing Enter. Cause: {e}")
            return False
        
    def wait(self, seconds: float):
        """
        Waits for the specified number of seconds.

        PArameters:
            seconds: Number of seconds to wait (can be a decimal).
        """
        try:
            wait_time = float(seconds)
            logger.info(f"Waiting for {wait_time} second(s)...")
            pyautogui.sleep(wait_time)
        except Exception:
            logger.exception(f"The wait value '{seconds}' is not a valid number.")
