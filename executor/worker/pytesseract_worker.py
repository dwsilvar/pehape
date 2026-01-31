import logging
from typing import Any, Dict, Optional, Tuple

import config.config as configurator

logger = logging.getLogger(__name__)

class PyTesseractWorker:

    """
    Wrapper around pytesseract usage providing utilities to find text
    positions inside screenshots.

    This class keeps a lazy import of pytesseract/Pillow and exposes a
    simple API to obtain center coordinates of detected text.
    """

    TESSERACT_AVAILABLE: bool = False
    pytesseract_mod: Any = None

    def __init__(self) -> None:
        """
        Try to import pytesseract and Pillow (PIL). If unavailable,
        set TESSERACT_AVAILABLE to False and log a warning.
        """
        try:
            import pytesseract
            from PIL import Image
            self.TESSERACT_AVAILABLE = True
            pytesseract.pytesseract.tesseract_cmd = configurator.TESSERACT_CMD_PATH
            self.pytesseract_mod = pytesseract
            logger.info("pytesseract and Pillow available.")
        except ImportError:
            self.TESSERACT_AVAILABLE = False
            logger.error(
                "pytesseract or Pillow not installed. "
                "Install with: pip install pytesseract Pillow"
            )
        

    def find_text_coordinates(
        self,
        screenshot: Any,
        screenshot_path: str,
        text_to_find: str,
        coordinates_origin: Optional[Tuple[int, int, int, int]] = None,
        save_screenshot: bool = False,
    ) -> Optional[Tuple[int, int]]:
        """
        Use OCR to find the center coordinates of the given text in the
        provided screenshot.

        Parameters:
            screenshot: PIL.Image (or object supported by pytesseract).
            screenshot_path: Path to save screenshot for debugging if requested.
            text_to_find: Text phrase to search for.
            coordinates_origin: Optional region (x, y, width, height) to
                                offset results when searching in a subimage.
            save_screenshot: If True and text not found, save screenshot.

        Returns:
            (center_x, center_y) coordinates if found, otherwise None.
        """
        if not self.TESSERACT_AVAILABLE:
            logger.error("OCR not available.")
            return None

        # Request OCR data as dictionary
        data_ocr: Dict[str, Any] = self.pytesseract_mod.image_to_data(
            screenshot, output_type=self.pytesseract_mod.Output.DICT,
            lang=configurator.TESSERACT_LANGUAGE
        )

        logger.debug(f"OCR search (region provided: {coordinates_origin is not None})")

        # First attempt: word startswith
        coords = self._find_word_startswith(data_ocr, text_to_find, coordinates_origin)
        if coords is not None:
            logger.info(f"OCR: Match found via 'startswith' strategy for '{text_to_find}'")
            return coords

        # Second attempt: join words to match phrase
        coords = self._find_text_by_joined_words(data_ocr, text_to_find, coordinates_origin)
        if coords is not None:
            logger.info(f"OCR: Match found via 'joined-words' strategy for '{text_to_find}'")
            return coords

        # Not found: optionally save screenshot and log words/confidences
        logger.warning(f"OCR: Text '{text_to_find}' not detected on screen.")
        if save_screenshot:
            try:
                screenshot.save(screenshot_path)
                logger.info("Saved screenshot for debugging: %s", screenshot_path)
            except Exception:
                logger.exception("Failed to save screenshot to '%s'", screenshot_path)

        # Collect words and confidences (for debugging)
        words_conf: Dict[str, Any] = {}
        for i, word in enumerate(data_ocr.get('text', [])):
            if word.strip() != '':
                words_conf[word] = data_ocr.get('conf', [])[i]
        logger.debug("Detected words/confidences: %s", words_conf)

        return None
    
    def _find_text_by_joined_words(
        self,
        data: Dict[str, Any],
        text_to_find: str,
        region_origin: Optional[Tuple[int, int, int, int]] = None,
    ) -> Optional[Tuple[int, int]]:
        """
        Attempt to find a multi-word phrase by reconstructing the OCR words
        (filtering by confidence) and matching the target phrase. Returns
        the center coordinates of the bounding box that contains the phrase.
        """
        words_data = []
        for i in range(len(data.get('text', []))):
            try:
                conf = int(data['conf'][i])
            except Exception:
                conf = -1
            word = data['text'][i].strip()
            if conf > configurator.CONFIDENCE_THRESHOLD and word != '':
                words_data.append({
                    'text': word,
                    'left': data['left'][i],
                    'top': data['top'][i],
                    'width': data['width'][i],
                    'height': data['height'][i]
                })

        full_text = " ".join([w['text'] for w in words_data]).lower()
        target = text_to_find.lower()
        logger.debug("Searching joined phrase '%s' in OCR text.", target)

        if target in full_text:
            target_words = target.split()
            ocr_words = [w['text'].lower() for w in words_data]
            for i in range(len(ocr_words) - len(target_words) + 1):
                if ocr_words[i:i + len(target_words)] == target_words:
                    start = words_data[i]
                    end = words_data[i + len(target_words) - 1]

                    x = start['left']
                    y = start['top']
                    w = (end['left'] + end['width']) - x
                    h = (end['top'] + end['height']) - y

                    if region_origin is not None:
                        x += region_origin[0]
                        y += region_origin[1]
                        logger.debug("Adjusting coords by region %s", region_origin)

                    center_x = x + w // 2
                    center_y = y + h // 2
                    logger.info("Phrase '%s' found at (%s, %s).", text_to_find, center_x, center_y)
                    return (center_x, center_y)

        logger.debug("Joined-words search did not match.")
        return None

    def _find_word_startswith(
        self,
        data: Dict[str, Any],
        text_to_find: str,
        region_origin: Optional[Tuple[int, int, int, int]] = None,
    ) -> Optional[Tuple[int, int]]:
        """
        Find the first OCR word whose text starts with the requested text.
        Returns the center coordinates of that word's bounding box.
        """
        n_boxes = len(data.get('level', []))
        logger.debug("_find_word_startswith scanning %d boxes.", n_boxes)

        for i in range(n_boxes):
            try:
                conf = int(data['conf'][i])
            except Exception:
                conf = -1

            if conf > configurator.CONFIDENCE_THRESHOLD:
                word_text = data['text'][i].strip()
                if word_text.lower().startswith(text_to_find.lower()):
                    x = data['left'][i]
                    y = data['top'][i]
                    w = data['width'][i]
                    h = data['height'][i]

                    if region_origin is not None:
                        x += region_origin[0]
                        y += region_origin[1]
                        logger.debug("Adjusting coords by region %s", region_origin)

                    center_x = x + w // 2
                    center_y = y + h // 2
                    logger.info("Word starting with '%s' found: '%s' at (%s,%s).",
                                text_to_find, word_text, center_x, center_y)
                    return (center_x, center_y)

        logger.debug("No word starts with '%s'.", text_to_find)
        return None
    
    