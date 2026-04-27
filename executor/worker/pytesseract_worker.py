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
    
    def _normalize_text(self, text: str) -> str:
        """
        Normaliza texto para comparación OCR.
        
        OCR a menudo detecta caracteres especiales como espacios o los omite.
        Esta función normaliza el texto para mejorar la coincidencia.
        
        Transformaciones:
        - Convierte a minúsculas
        - Reemplaza guiones (-), guiones bajos (_), puntos (.), barras (/) por espacios
        - Elimina espacios múltiples
        - Elimina espacios al inicio/final
        
        Ejemplos:
            "boton-card" -> "boton card"
            "Usuario_Admin" -> "usuario admin"
            "github/awesome-copilot" -> "github awesome copilot"
            "Retirar  Dinero" -> "retirar dinero"
        """
        import re
        normalized = text.lower()
        # Reemplazar caracteres especiales por espacios (incluyendo /)
        normalized = re.sub(r'[-_./]', ' ', normalized)
        # Eliminar espacios múltiples
        normalized = re.sub(r'\s+', ' ', normalized)
        return normalized.strip()
        

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

        # First attempt: exact word match
        coords = self._find_exact_word(data_ocr, text_to_find, coordinates_origin)
        if coords is not None:
            logger.info(f"OCR: Exact word match found for '{text_to_find}'")
            return coords

        # Second attempt: join words to match exact phrase
        coords = self._find_text_by_joined_words(data_ocr, text_to_find, coordinates_origin)
        if coords is not None:
            logger.info(f"OCR: Exact phrase match found for '{text_to_find}'")
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
        (filtering by confidence) and matching the target phrase using exact
        word boundaries. Returns the center coordinates of the bounding box 
        that contains the phrase.
        
        This method concatenates separate OCR words (e.g., "boton" + "card")
        and uses exact phrase matching with word boundaries to avoid false
        positives (e.g., "Retirar dinero" won't match "Retirar dinero y voucher").
        """
        import re
        
        words_data = []
        for i in range(len(data.get('text', []))):
            try:
                conf = int(data['conf'][i])
            except Exception:
                conf = -1
            word = data['text'][i].strip()
            if conf > configurator.OCR_CONFIDENCE_THRESHOLD and word != '':
                words_data.append({
                    'text': word,
                    'left': data['left'][i],
                    'top': data['top'][i],
                    'width': data['width'][i],
                    'height': data['height'][i]
                })

        # Construir texto completo y normalizar
        full_text = " ".join([w['text'] for w in words_data])
        full_text_normalized = self._normalize_text(full_text)
        target_normalized = self._normalize_text(text_to_find)
        
        logger.debug(f"Searching exact phrase '{target_normalized}' in OCR text: '{full_text_normalized}'")

        # Buscar con word boundaries para coincidencia exacta de frase
        # \b asegura que coincida con palabras completas, no subcadenas
        pattern = r'\b' + re.escape(target_normalized) + r'\b'
        match = re.search(pattern, full_text_normalized)
        
        if match:
            # Encontrar las palabras que forman la frase exacta
            target_words = target_normalized.split()
            ocr_words_normalized = [self._normalize_text(w['text']) for w in words_data]
            
            # Buscar la secuencia exacta de palabras
            for i in range(len(ocr_words_normalized) - len(target_words) + 1):
                if ocr_words_normalized[i:i + len(target_words)] == target_words:
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
                    logger.info("Exact phrase '%s' found at (%s, %s).", text_to_find, center_x, center_y)
                    return (center_x, center_y)

        logger.debug("Exact phrase match not found.")
        return None

    def _find_exact_word(
        self,
        data: Dict[str, Any],
        text_to_find: str,
        region_origin: Optional[Tuple[int, int, int, int]] = None,
    ) -> Optional[Tuple[int, int]]:
        """
        Find the first OCR word that exactly matches the requested text
        (not startswith, not substring). Returns the center coordinates 
        of that word's bounding box.
        
        Applies character normalization to handle special characters that
        OCR may detect differently (e.g., "boton-card" matches "boton card").
        """
        n_boxes = len(data.get('level', []))
        target_normalized = self._normalize_text(text_to_find)
        logger.debug("_find_exact_word scanning %d boxes for '%s'.", n_boxes, target_normalized)

        for i in range(n_boxes):
            try:
                conf = int(data['conf'][i])
            except Exception:
                conf = -1

            if conf > configurator.OCR_CONFIDENCE_THRESHOLD:
                word_text = data['text'][i].strip()
                word_normalized = self._normalize_text(word_text)
                
                # Exact match (not startswith)
                if word_normalized == target_normalized:
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
                    logger.info("Exact word match: '%s' (normalized: '%s') found at (%s,%s).",
                                word_text, word_normalized, center_x, center_y)
                    return (center_x, center_y)

        logger.debug("No exact word match for '%s'.", target_normalized)
        return None
    
    