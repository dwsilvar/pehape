# poc/ocr_driver.py
"""
Implementation of an automation driver that uses OCR (Tesseract)
to find and interact with elements based on their text.
"""
from executor.worker.pyautogui_worker import PyAutoGUIWorker
from executor.worker.pytesseract_worker import PyTesseractWorker
from util.system_utils import get_screenshot_path
from pathlib import Path
import logging
import io
from executor.driver.driver_abstract_ui import DriverAbstractUI

logger = logging.getLogger(__name__)


# IMPORTANT NOTE:
# For pytesseract to work, you must have the Google Tesseract-OCR engine
# installed on your system and, preferably, in the system's PATH.
# You can download it from: https://github.com/tesseract-ocr/tesseract

class OCRDriver(DriverAbstractUI):
    
    """
    Driver that uses OCR to interact with the GUI.
    """
    def __init__(self):
        logger.info("OCR Driver (PyTesseract) initialized.")
        # Optional: If Tesseract is not in your PATH, you can specify its location here.
        # Example on Windows:
        # pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
        self.pyAutoGUIWorker = PyAutoGUIWorker()
        self.tesseractWorker = PyTesseractWorker()

    def is_app_running(self, app_name:str) -> bool:
        return self.pyAutoGUIWorker.ensure_window_is_visible(app_name)

    def _find_text_location(self, text_to_find: str, image_text_path:str = None):
        """
        Searches for an exact phrase on the screen and returns the coordinates of its center.
        This method reconstructs phrases from words detected by OCR to
        find an exact match.

        Paremeters:
            text_to_find: The exact phrase to search for on the screen.

        Returns:
            A tuple (x, y) with the coordinates of the phrase's center, or None if not found.
        """
        try:
            # Create screenshots folder if it doesn't exist
            screenshot_total_path = get_screenshot_path()          
            screenshot = self.pyAutoGUIWorker.capture_screenshot()
            logger.info(f"--- Strategy 1: OCR Search for '{text_to_find}' ---")
            center_coordinates = self.tesseractWorker.find_text_coordinates(screenshot, screenshot_total_path, text_to_find)

            if center_coordinates:
                logger.info(f"✓ Found '{text_to_find}' via OCR at {center_coordinates}")
                return center_coordinates
            
            logger.info(f"Phrase '{text_to_find}' not found via OCR. Trying Strategy 2: Image Search.")
            if image_text_path is not None:                
                center_coordinates = self._get_element_coordinates_by_img(image_text_path, screenshot, screenshot_total_path)
                if center_coordinates:
                    logger.info(f"✓ Found '{text_to_find}' via Image Search at {center_coordinates}")

            return center_coordinates

        except Exception as e:
            logger.error(f"An error occurred during text recognition. Cause: {e}")
            return None

    def _find_text_location_in_app(self, text_to_find: str, app_name: str, image_text_path:str = None):
        """
        Searches for an exact phrase on a specific application's screen and returns the coordinates of its center.
        This method reconstructs phrases from words detected by OCR to
        find an exact match.

        Paremeters:
            text_to_find: The exact phrase to search for on the screen.
            app_name: The name of the application to search in.
            image_text_path: Path to an image of the text to search for, if image search is desired as a fallback.

        Returns:
            A tuple (x, y) with the coordinates of the phrase's center, or None if not found.
        """
        
        try:
            screenshot_total_path = get_screenshot_path()
            screenshot_section_path = get_screenshot_path("screenshot_section")

            screenshot = self.pyAutoGUIWorker.get_screenshot_of_app(app_name)
            
            logger.info(f"--- Strategy 1: OCR Search for '{text_to_find}' inside '{app_name}' ---")
            center_coordinates = self.tesseractWorker.find_text_coordinates(screenshot, screenshot_total_path, text_to_find)

            if center_coordinates:
                 logger.info(f"✓ Found '{text_to_find}' via OCR at {center_coordinates}")
                 return center_coordinates

            logger.info(f"Phrase '{text_to_find}' not found via OCR in '{app_name}'. Trying Strategy 2: Screen Section OCR.")
            data_screenshoot= self.pyAutoGUIWorker.get_region_screenshot_window(app_name)
            if data_screenshoot is not None:
                screenshot_region, region = data_screenshoot
                center_coordinates = self.tesseractWorker.find_text_coordinates(screenshot_region, screenshot_section_path, text_to_find,region)
                if center_coordinates:
                    logger.info(f"✓ Found '{text_to_find}' via Section OCR at {center_coordinates}")
                    return center_coordinates
                
                logger.info(f"Phrase '{text_to_find}' not found via Section OCR. Trying Strategy 3: Image Search in Section.")
                if image_text_path is not None:                
                    center_coordinates = self._get_element_coordinates_by_img(image_text_path, screenshot, screenshot_total_path, region=region)
                    if center_coordinates:
                        logger.info(f"✓ Found '{text_to_find}' via Image Search in Section at {center_coordinates}")

 
            return center_coordinates

        except Exception as e:
            logger.error(f"An error occurred during text recognition. Cause: {e}")
            return None

    def _get_element_coordinates_by_img(self, image_text_path: str, screenshot=None, screenshot_path: str = None, region: tuple = None) -> tuple[int, int] | None:
        """
        Search for an image on the screen and return the coordinates of its center.

        Parameters
        ----------
        image_text_path : str
            The path to the image file to search for. The method will first
            try a direct search using this path. If not found, it will extract
            the image base name (without extension) and try to locate the
            image inside the generic resources folder by delegating to
            `_find_generic_image_coordinates`.

        screenshot : PIL.Image.Image | None
            Optional screenshot to use or save when the image isn't found.

        screenshot_path : str | None
            Path where to save the screenshot in case the image is not found.

        region : tuple | None
            Optional (left, top, width, height) to restrict the search.

        Returns
        -------
        tuple[int, int] | None
            (x, y) coordinates of the image's center if found, otherwise
            `None`.
        """
        logger.info("Attempting to find the element on the full screen by image")

        # First, try a direct lookup using the provided path
        center_coordinates = None
        try:
            if image_text_path:
                center_coordinates = self.pyAutoGUIWorker.get_element_coordinates_by_img(image_text_path, region=region)
        except Exception as e:
            # Keep behavior tolerant: log and continue to fallback
            logger.debug(f"Direct image search failed for '{image_text_path}': {e}")
            center_coordinates = None

        if center_coordinates is not None:
            logger.info(f"Successfully found image by exact path, coordinates: {center_coordinates}")
            return center_coordinates

        # Fallback: derive the image name (stem) and try the generic images folder
        if image_text_path:
            try:
                image_name = Path(image_text_path).stem
                logger.info(f"Falling back to generic image search using name '{image_name}'")
                center_coordinates = self._find_generic_image_coordinates(image_name, region=region)
                if center_coordinates is not None:
                    logger.info(f"Successfully found phrase by generic image '{image_name}', coordinates: {center_coordinates}")
                    return center_coordinates
            except Exception as e:
                logger.error(f"Error while attempting generic image lookup for '{image_text_path}': {e}")

        logger.info("Phrase not found on the full screen, not even by image")
        if screenshot is not None and screenshot_path:
            try:
                screenshot.save(screenshot_path)
            except Exception as e:
                logger.debug(f"Could not save screenshot to '{screenshot_path}': {e}")

        return None
    
    def _find_generic_image_coordinates(self, name_image: str, region: tuple = None) -> tuple[int, int] | None:
        """
        Search for an image inside the project's generic images folder and return its center coordinates.

        Parameters
        ----------
        name_image : str
            Image base name (without extension) to search for in
            `resources/images/features/generic/`. For example, passing
            `'ok_button'` will look for
            `resources/images/features/generic/ok_button.png`.
        
        region : tuple | None
            Optional region to restrict the search.

        Returns
        -------
        tuple[int, int] | None
            (x, y) coordinates of the image center on screen if found,
            otherwise `None`.

        Notes
        -----
        - This is a convenience helper that builds the path for images
          stored in the generic features folder and delegates the actual
          image search to `PyAutoGUIWorker.get_element_coordinates_by_img`.
        """
        logger.info("Attempting to find element by image in generic resources folder")
        image_text_path = f"resources/images/features/generic/{name_image}.png"
        center_coordinates = self.pyAutoGUIWorker.get_element_coordinates_by_img(image_text_path, region=region)
        if center_coordinates is not None:
            logger.info(f"Found image '{image_text_path}' at {center_coordinates}")
        else:
            logger.info(f"Image '{image_text_path}' not found in generic resources")

        return center_coordinates

    def click_on_element_by_text(self, text: str, image_text_path:str = None) -> bool:
        """
        Finds a text on the screen and clicks on it.
        It first tries an exact phrase search. If it fails, it tries
        a search for a word that starts with the text.

        Paremeters:
            text: The text to click on.

        Returns:
            True if the operation was successful, False otherwise.
        """
        logger.info(f"Starting cascade search for text '{text}'.")
        
        location_startswith = self._find_text_location(text, image_text_path)
        if location_startswith:
            result  = self.pyAutoGUIWorker.click_at(location_startswith)
            if result is True:
                logger.info("--- Success in 'starts with' search. ---")
                return True

        logger.info(f"Search failed. Text '{text}' not found.")
        return False

    def click_on_element_by_text_in_app(self, text: str, app_name: str, image_text_path:str = None) -> bool:
        """
        Finds a text on the screen and clicks on it.
        It first tries an exact phrase search. If it fails, it tries
        a search for a word that starts with the text.

        Paremeters:
            text: The text to click on.

        Returns:
            True if the operation was successful, False otherwise.
        """
        logger.info(f"Starting cascade search for text '{text}'.")
        
        # Attempt 2: Search for a word that starts with the text
        logger.info(f"[{text}]--- Search by 'starts with' ---")
        
        location_startswith = self._find_text_location_in_app(text, app_name, image_text_path)
        if location_startswith:
            result = self.pyAutoGUIWorker.click_in_app_element_by_point(app_name, location_startswith)
            logger.info("Resultado click: " + str(result))
            return True

        logger.info(f"Search failed. Text '{text}' not found with any strategy.")
        return False

    def enter_text(self, text: str) -> bool:
        """
        Type the provided text into the currently focused input element.

        This delegates to the underlying PyAutoGUI worker.
        """
        return self.pyAutoGUIWorker.enter_text(text)


    def find_text_on_screen(self, text_to_find: str, image_text_path:str = None) -> bool:
        """
        Searches for an exact phrase on the screen using Tesseract OCR.
        """
        points = self._find_text_location(text_to_find, image_text_path)
        found = points is not None
        
        return found
    
    def find_text_on_app(self, app_name: str, text_to_find: str,image_text_path: str = None) -> bool:
        """
        Searches for an exact phrase on the application screen using Tesseract OCR.
        """
        points = self._find_text_location_in_app(text_to_find, app_name, image_text_path)
        found = points is not None
        return found
    
    def wait(self, seconds: float):
        """
        Introduces an explicit wait.

        Paremeters:
            seconds: Number of seconds to wait (can be a decimal).
        """
        self.pyAutoGUIWorker.wait(seconds)


    def wait_until_text_appears(self, seconds: float, text_to_find: str, image_text_path:str = None) -> bool:
        """
        Waits until a specific text appears on the screen or until the time runs out.

        Parameters:
            seconds: Maximum time to wait (in seconds, can be a decimal).
            text_to_find: The text to search for on the screen.
            image_text_path: Optional image path for fallback search.

        Returns:
            True if the text appears within the time, False otherwise.
        """
        return self.pyAutoGUIWorker.wait_until_condition(
            seconds,
            lambda t, img: self.find_text_on_screen(t, img),
            text_to_find,
            image_text_path
        )
    
    def capture_evidence_screenshot(self) -> bytes | None:
        """
        Capture an evidence screenshot and return it as PNG bytes.

        Returns:
            PNG bytes of the screenshot, or None on error.
        """
        try:
            screenshot_pil = self.pyAutoGUIWorker.capture_screenshot()
            if screenshot_pil:
                byte_array = io.BytesIO()
                screenshot_pil.save(byte_array, format='PNG')
                return byte_array.getvalue()
        except Exception as e:
            logger.error(f"Error capturing evidence screenshot: {e}")
        return None

    def enter_url_in_address_bar(self, url: str) -> bool:
        """
        Enters the specified URL into the browser's address bar and presses Enter.
        Uses the PyAutoGUIWorker for the action.
        """
        try:
            logger.info(f"Entering URL '{url}' into the address bar using PyAutoGUIWorker...")
            success = self.pyAutoGUIWorker.enter_text(url)
            if success:
                success_enter = self.pyAutoGUIWorker.press_enter()
                if success_enter:
                    logger.info(f"URL '{url}' entered successfully.")
                else:
                    return False
                return True
            else:
                logger.error(f"Error writing URL '{url}' to the address bar.")
                return False
        except Exception as e:
            logger.error(f"Error entering URL '{url}'. Cause: {e}")
            return False