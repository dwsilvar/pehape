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

def get_image_path_from_feature_and_tag(feature_path_full: str, scenario_tags, text_to_find: str) -> str:
    """
    Obtiene el directorio base del feature, el primer tag del scenario, 
    y construye una ruta de archivo .png a partir de ellos.

    Paremeters:
        context: El objeto 'context' de behave.
        text_to_find: El texto que se busca, usado como nombre del archivo de imagen.

    Returns:
        Un string con la ruta completa y el nombre del archivo de imagen.
        Ej: 'features/modulo_A/critical/text_to_find.png'
    """
    
    # 1. Obtener el Directorio del Feature
    # Esto asegura que la ruta sea relativa a la ubicación del archivo .feature
    
    logger.info(f"params feature_path_full: {feature_path_full}, scenario_tags: {scenario_tags}, text_to_find: {text_to_find}")
    feature_dir_path = os.path.dirname(feature_path_full)
    # a continuacion obtenemos el nombre del fichero sin la extension
    feature_file_name = os.path.splitext(os.path.basename(feature_path_full))[0]
    feature_dir_path = os.path.join(feature_dir_path, feature_file_name)
    logger.info(f"Directorio del recurso a ubicar: {feature_dir_path}")

    
    # Usamos el primer tag como identificador de la imagen
    if not scenario_tags:
        raise ValueError("El Scenario debe tener al menos un tag para nombrar la imagen.")
        
    # El tag suele incluir el '@', lo limpiamos para usarlo como nombre de archivo
    tag = scenario_tags[0].lstrip('@')
    
    # 3. Construir la Ruta Final
    # Concatenamos el directorio base de recursos + el nombre del feature + el nombre del tag + la extensión
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    features_root = os.path.join(project_root, 'features')
    
    # Obtenemos el path relativo del feature desde la carpeta features
    # feature_path_full es absoluto o relativo al proyecto? 
    # Generalmente en runtime de behave context.feature.filename es relativo a la ejecución.
    
    # Simplificación robusta: Asumamos que feature_path_full es "features/modulo/feature.feature"
    # O "c:/proyecto/features/modulo/feature.feature"
    
    # Normalizamos a ruta absoluta primero para calcular la relativa a 'features'
    abs_feature_path = os.path.abspath(feature_path_full)
    abs_features_root = os.path.abspath(features_root)
    
    try:
        rel_path = os.path.relpath(abs_feature_path, abs_features_root)
    except ValueError:
        # Fallback si están en drives diferentes o algo raro
        rel_path = os.path.basename(abs_feature_path)

    # Quitamos la extensión y obtenemos el directorio base relativo (ej: modulo/mi_feature)
    rel_dir = os.path.dirname(rel_path)
    feature_name = os.path.splitext(os.path.basename(rel_path))[0]
    
    # La nueva ruta base es resources/images
    base_images_path = os.path.join(project_root, 'resources', 'images')
    
    # La estructura en resources será: resources/images/<modulo>/<feature_name>/<tag>/<texto>.png
    imagen_path = os.path.join(base_images_path, rel_dir, feature_name, tag, f"{text_to_find}.png")
    logger.info(f"Ruta de la imagen construida: {imagen_path}")
    return imagen_path
