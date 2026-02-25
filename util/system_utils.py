# poc/system_utils.py
"""
Utilidades del sistema, como la verificación de procesos y ventanas.
"""
import os
import psutil
import pyautogui
from typing import List, Optional
import logging
from datetime import datetime

import config.config as configurator

try:
    import pytesseract
    from PIL import Image
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False

logger = logging.getLogger(__name__)

def is_process_running(process_name: str) -> bool:
    """
    Verifica si un proceso con un nombre específico está actualmente en ejecución.

    Paremeters:
        process_name: El nombre del ejecutable del proceso (ej: "edge.exe").

    Returns:
        True si el proceso está en ejecución, False en caso contrario.
    """
    for proc in psutil.process_iter(['name']):
        if proc.info['name'].lower() == process_name.lower():
            logger.info(f"Proceso '{process_name}' encontrado en ejecución.")
            return True
    logger.info(f"Proceso '{process_name}' NO encontrado en ejecución.")
    return False

def get_visible_windows_titles() -> List[str]:
    """
    Obtiene los títulos de todas las ventanas visibles.

    Returns:
        Una lista de strings, donde cada string es el título de una ventana.
    """
    titles = pyautogui.getAllTitles()
    logger.info(f"Se encontraron {len(titles)} ventanas visibles.")
    return titles

def get_active_window_title() -> Optional[str]:
    """
    Obtiene el título de la ventana que está actualmente activa (en primer plano).

    Returns:
        El título de la ventana activa, o None si no hay ninguna.
    """
    active_window = pyautogui.getActiveWindow()
    if active_window:
        logger.info(f"La ventana activa es '{active_window.title}'.")
        return active_window.title
    logger.info("No hay ninguna ventana activa.")
    return None

def is_window_visible(title_substring: str) -> bool:
    """
    Verifica si una ventana que contiene un texto en su título está visible.

    Paremeters:
        title_substring: El texto a buscar en los títulos de las ventanas.

    Returns:
        True si se encuentra una ventana, False en caso contrario.
    """
    for title in pyautogui.getAllTitles():
        if title and title_substring.lower() in title.lower():
            logger.info(f"Ventana con título '{title_substring}' encontrada: '{title}'")
            return True
    logger.info(f"Ventana con título '{title_substring}' NO encontrada.")
    return False

def find_image_on_screen(image_name: str) -> bool:
    """
    Verifica si una imagen específica se encuentra en la pantalla usando pyautogui.

    Paremeters:
        image_name: El nombre del archivo de la imagen (ej: "test_button.png").

    Returns:
        True si la imagen es encontrada, False en caso contrario.
    """
    import config.config as configurator # Importación local para evitar dependencia circular a nivel de módulo
    image_path = os.path.join(configurator.IMAGES_BASE_PATH, image_name)
    logger.info(f"Buscando la imagen '{image_path}' en la pantalla...")
    if not os.path.exists(image_path):
        logger.warning(f"La imagen no existe en la ruta especificada.")
        return False
    try:
        location = pyautogui.locateOnScreen(image_path, confidence=0.9)
        if location:
            logger.info(f"Imagen encontrada en la ubicación: {location}")
            return True
        else:
            logger.info(f"La imagen no se encontró en la pantalla.")
            return False
    except pyautogui.PyAutoGUIException as e:
        logger.error(f"Ocurrió un error con PyAutoGUI al buscar la imagen. ¿Está el monitor activo?")
        logger.error(f"Detalle: {e}")
        return False






def get_screenshot_path(image_name: str =None) -> str:
        """
        Construye la ruta completa para guardar una captura de pantalla.

        Paremeters:
            image_name: El nombre del archivo de la imagen (ej: "screenshot").

        Returns:
            La ruta completa donde se guardará la captura de pantalla.
        """
        screenshots_dir = configurator.IMAGES_REPORT_PATH
        os.makedirs(screenshots_dir, exist_ok=True)
        if image_name is None:
            image_name = "screenshot"
            
        # Tomar y guardar la captura de pantalla con un nombre único
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        screenshot_total_path = os.path.join(screenshots_dir, f"{image_name}_{timestamp}.png")
        return screenshot_total_path

def get_image_path_from_feature_and_tag(feature_path_full: str, scenario_tags, text_to_find: str, full_step_text: str = None) -> str:
    """
    Obtiene la ruta de la imagen OCR. Intenta primero usar ocr_mapping.json para una coincidencia
    precisa y luego recurre a la lógica basada en nombres de archivo.

    Paremeters:
        feature_path_full: Ruta completa al archivo .feature.
        scenario_tags: Tags del escenario actual.
        text_to_find: El texto que se busca (parámetro).
        full_step_text: El texto completo de la línea del paso para desambiguación.

    Returns:
        Ruta completa al archivo de imagen.
    """
    import json
    
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    mapping_path = os.path.join(project_root, 'resources', 'images', 'ocr_mapping.json')
    features_root = os.path.join(project_root, 'features')
    
    # 1. Intentar buscar en el mapeo (ocr_mapping.json)
    if os.path.exists(mapping_path):
        try:
            with open(mapping_path, 'r', encoding='utf-8') as f:
                mapping = json.load(f)
            
            # Normalizar feature_path_full para obtener la ruta relativa a 'features'
            abs_feature_path = os.path.abspath(feature_path_full)
            abs_features_root = os.path.abspath(features_root)
            rel_feature_path = os.path.relpath(abs_feature_path, abs_features_root).replace('\\', '/')
            
            if rel_feature_path in mapping:
                feature_mapping = mapping[rel_feature_path]
                # Buscar en cada tag (incluyendo el primero de scenario_tags)
                tags_to_check = [t.lstrip('@') for t in scenario_tags] if scenario_tags else ["untagged"]
                
                for tag in tags_to_check:
                    # En el JSON los tags suelen guardarse con @ o sin él, seamos flexibles
                    tag_key = tag if tag in feature_mapping else f"@{tag}"
                    
                    if tag_key in feature_mapping:
                        tag_data = feature_mapping[tag_key]
                        steps = tag_data.get('steps', [])
                        
                        for step_entry in steps:
                            # Prioridad 1: Coincidencia exacta del texto completo del paso
                            if full_step_text and full_step_text in step_entry.get('texts', []):
                                img_id = step_entry.get('id')
                                return os.path.join(project_root, 'resources', 'images', rel_feature_path.replace('.feature', ''), tag, img_id)
                            
                            # Prioridad 2: Coincidencia del original_text si no hay full_step_text
                            if not full_step_text and step_entry.get('original_text') == text_to_find:
                                img_id = step_entry.get('id')
                                return os.path.join(project_root, 'resources', 'images', rel_feature_path.replace('.feature', ''), tag, img_id)
        except Exception as e:
            logger.error(f"Error reading ocr_mapping.json: {e}")

    # 2. Fallback: Lógica antigua basada en nombres de archivos
    logger.info(f"Fallback to legacy path generation for: {text_to_find}")
    
    abs_feature_path = os.path.abspath(feature_path_full)
    abs_features_root = os.path.abspath(features_root)
    
    try:
        rel_path = os.path.relpath(abs_feature_path, abs_features_root)
    except ValueError:
        rel_path = os.path.basename(abs_feature_path)

    rel_dir = os.path.dirname(rel_path)
    feature_name = os.path.splitext(os.path.basename(rel_path))[0]
    
    if not scenario_tags:
        tag = "untagged"
    else:
        tag = scenario_tags[0].lstrip('@')
    
    base_images_path = os.path.join(project_root, 'resources', 'images')
    imagen_path = os.path.join(base_images_path, rel_dir, feature_name, tag, f"{text_to_find}.png")
    
    return imagen_path
