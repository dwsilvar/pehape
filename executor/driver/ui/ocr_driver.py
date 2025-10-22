# poc/ocr_driver.py
"""
Implementation of an automation driver that uses OCR (Tesseract)
to find and interact with elements based on their text.
"""
from executor.worker.pyautogui_worker import PyAutoGUIWorker
from executor.worker.pytesseract_worker import PyTesseractWorker
from util.system_utils import get_screenshot_path
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
            logger.info("Get coordinates screen absolute")
            center_coordinates = self.tesseractWorker.find_text_coordinates(screenshot, screenshot_total_path, text_to_find)

            if center_coordinates is None:
                logger.info(f"Phrase '{text_to_find}' not found on the full screen")
                if image_text_path is not None:                
                    center_coordinates = self._get_element_coordinates_by_img(image_text_path, screenshot, screenshot_total_path)

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
            
            logger.info("Getting coordinates from ABSOLUTE screen")
            center_coordinates = self.tesseractWorker.find_text_coordinates(screenshot, screenshot_total_path, text_to_find)

            if center_coordinates is None:
                logger.info("Getting coordinates from screen SECTION")
                data_screenshoot= self.pyAutoGUIWorker.get_region_screenshot_window(app_name)
                if data_screenshoot is not None:
                    screenshot_region, region = data_screenshoot
                    center_coordinates = self.tesseractWorker.find_text_coordinates(screenshot_region, screenshot_section_path, text_to_find,region)
                    if center_coordinates is None:
                        logger.info(f"Phrase '{text_to_find}' not found on the full screen or in the app's screen section '{app_name}'")
                        if image_text_path is not None:                
                            center_coordinates = self._get_element_coordinates_by_img(image_text_path, screenshot, screenshot_total_path)

 
            return center_coordinates

        except Exception as e:
            logger.error(f"An error occurred during text recognition. Cause: {e}")
            return None

    def _get_element_coordinates_by_img(self,image_text_path:str, screenshot=None, screenshot_path:str = None):
        """
        Searches for an image on the screen and returns the coordinates of its center.

        Paremeters:
            image_text_path: The path to the image file to search for.
            screenshot: PIL Image to search within. If None, a full screenshot is taken.
            screenshot_path: Path to save the screenshot if the image is not found.
        Returns:
            A tuple (x, y) with the coordinates of the image's center, or None if not found.
        """
        logger.info(f"Attempting to find the phrase on the full screen by image")                
        center_coordinates = self.pyAutoGUIWorker.get_element_coordinates_by_img(image_text_path)
        if center_coordinates is not None:
            logger.info(f"Successfully found phrase by image, coordinates: {center_coordinates}")
        else:
            logger.info(f"Phrase not found on the full screen, not even by image")
            screenshot.save(screenshot_path)

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