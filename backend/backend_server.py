import os
import pathlib
import json
import shutil
import subprocess
from flask import Flask, jsonify, request, Response, send_from_directory, send_file
import sys, signal
import threading
from queue import Queue

# Add project root to sys.path before imports that depend on it
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from behave.parser import Parser
from behave.model import Feature, Scenario, ScenarioOutline
from flask_cors import CORS
from PIL import Image, ImageDraw, ImageFont
import glob
import io
import logging
import mimetypes

# Asegurar que mimetypes conoce .js y .json
mimetypes.init()
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('application/json', '.json')
mimetypes.add_type('text/css', '.css')
mimetypes.add_type('image/svg+xml', '.svg')
mimetypes.add_type('image/png', '.png')
mimetypes.add_type('image/x-icon', '.ico')

from execution_plan_manager import ExecutionPlanManager
import config.logging_config as logging_config

# Configurar logging centralizado
logging_config.setup_logging()
logger = logging.getLogger(__name__)

try:
    from util.system_utils import get_image_path_from_feature_and_tag
except ImportError:
    # Fallback or logging if import fails (though it shouldn't if structure is correct)
    print("Warning: Could not import util.system_utils")

app = Flask(__name__)

# Cargar configuración para CORS
config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'server_config.json')
frontend_origin = "http://localhost:3000"

if os.path.exists(config_path):
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
            frontend_origin = config.get('frontend_origin', frontend_origin)
    except Exception:
        pass

# Permitir peticiones desde el frontend configurado
CORS(app, resources={r"/api/*": {"origins": frontend_origin}})

# Definir la ruta base donde están los features.
# Se necesita subir un nivel desde la ubicación actual del script (backend/).
FEATURES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'features')

# Instanciar el manejador del plan de ejecución
plan_manager = ExecutionPlanManager(FEATURES_DIR)

# Register validation blueprint
from validation_api import validation_bp
app.register_blueprint(validation_bp)

# --- OCR Image Migration Helpers ---
def get_ocr_images_directory(feature_rel_path: str) -> str:
    """
    Convierte una ruta relativa de feature a su directorio de imágenes OCR correspondiente.
    
    Args:
        feature_rel_path: Ruta relativa del feature desde FEATURES_DIR (ej: "login/auth.feature")
    
    Returns:
        Ruta absoluta al directorio de imágenes OCR (ej: "resources/images/login/auth/")
    """
    project_root = os.path.dirname(os.path.dirname(__file__))
    
    # Remover extensión .feature si existe
    if feature_rel_path.endswith('.feature'):
        feature_rel_path = feature_rel_path[:-8]  # Remove '.feature'
    
    # Construir ruta a directorio de imágenes
    images_dir = os.path.join(project_root, 'resources', 'images', feature_rel_path)
    return images_dir

def migrate_ocr_images(old_rel_path: str, new_rel_path: str, is_file: bool) -> dict:
    """
    Migra imágenes OCR de una ubicación antigua a una nueva después de renombrar.
    También actualiza las entradas en ocr_mapping.json.
    
    Args:
        old_rel_path: Ruta relativa antigua del recurso (desde FEATURES_DIR)
        new_rel_path: Ruta relativa nueva del recurso
        is_file: True si es un archivo, False si es un directorio
    
    Returns:
        Diccionario con estadísticas de migración
    """
    import json
    result = {
        "migrated": False,
        "count": 0,
        "old_path": None,
        "new_path": None,
        "errors": []
    }
    
    try:
        mapping_path = os.path.join(RESOURCES_IMAGES_DIR, 'ocr_mapping.json')
        
        # 1. Actualizar ocr_mapping.json si existe
        if os.path.exists(mapping_path):
            try:
                mapping = {}
                with open(mapping_path, 'r', encoding='utf-8') as f:
                    mapping = json.load(f)
                
                new_mapping = {}
                mapping_changed = False
                
                # Normalizar rutas para comparación (usar forward slash)
                old_key_prefix = old_rel_path.replace('\\', '/')
                new_key_prefix = new_rel_path.replace('\\', '/')
                
                for key, value in mapping.items():
                    # Caso 1: Renombrar un archivo específico
                    if is_file:
                        if key == old_key_prefix:
                            new_mapping[new_key_prefix] = value
                            mapping_changed = True
                            logger.info(f"Mapping: Renamed file key from {key} to {new_key_prefix}")
                        else:
                            new_mapping[key] = value
                    # Caso 2: Renombrar un directorio (afecta a múltiples features hijos)
                    else:
                        if key.startswith(old_key_prefix + "/") or key == old_key_prefix:
                            new_key = key.replace(old_key_prefix, new_key_prefix, 1)
                            new_mapping[new_key] = value
                            mapping_changed = True
                            logger.info(f"Mapping: Updated directory-based key from {key} to {new_key}")
                        else:
                            new_mapping[key] = value
                
                if mapping_changed:
                    with open(mapping_path, 'w', encoding='utf-8') as f:
                        json.dump(new_mapping, f, indent=2, ensure_ascii=False)
                    logger.info("ocr_mapping.json updated successfully after rename")
            except Exception as e:
                logger.error(f"Error updating ocr_mapping.json during migration: {e}")
                result["errors"].append(f"Error updating mapping: {str(e)}")

        # 2. Mover directorios físicos (Opción A)
        old_images_dir = get_ocr_images_directory(old_rel_path)
        new_images_dir = get_ocr_images_directory(new_rel_path)
        
        # Verificar si existe el directorio de imágenes antiguo
        if not os.path.exists(old_images_dir):
            logger.info(f"No physical OCR images directory found for {old_rel_path}")
            return result
        
        # Contar imágenes antes de migrar
        image_count = 0
        for root, dirs, files in os.walk(old_images_dir):
            image_count += len([f for f in files if f.endswith(('.png', '.jpg', '.jpeg'))])
        
        if image_count == 0:
            logger.info(f"OCR images directory exists but is physicaly empty: {old_images_dir}")
            # Aun así intentamos mover el directorio para mantener limpieza
        
        # Crear directorio padre de destino si no existe
        os.makedirs(os.path.dirname(new_images_dir), exist_ok=True)
        
        # Mover el directorio completo
        try:
            if os.path.exists(new_images_dir):
                # Si por alguna razón ya existe el destino, fusionamos o borramos (aquí borramos el destino vacío por simplicidad)
                if not os.listdir(new_images_dir):
                    os.rmdir(new_images_dir)
                    shutil.move(old_images_dir, new_images_dir)
                else:
                    logger.warning(f"Destination image directory already exists and is not empty: {new_images_dir}")
                    # En este caso particular de "renombrar", si el destino existe es un conflicto raro.
            else:
                shutil.move(old_images_dir, new_images_dir)
                
            result["migrated"] = True
            result["count"] = image_count
            result["old_path"] = old_images_dir
            result["new_path"] = new_images_dir
            logger.info(f"Successfully migrated physical OCR images from {old_images_dir} to {new_images_dir}")
        except Exception as e:
            error_msg = f"Error moving physical OCR images: {str(e)}"
            result["errors"].append(error_msg)
            logger.error(error_msg)
    
    except Exception as e:
        error_msg = f"Error during OCR image migration: {str(e)}"
        result["errors"].append(error_msg)
        logger.error(error_msg)
    
    return result


# Importar el registro de tareas y asegurar que se carguen los módulos de tareas
from executor.tasks_core.registry import get_all_tasks
# Importar módulos de tareas conocidos para asegurar su registro
# En un entorno real, esto podría ser dinámico (auto-discovery)
import executor.tasks.log_tasks
import executor.tasks.text_verification_tasks

# --- Herramientas / Tareas Predefinidas ---
@app.route('/api/tools/check-literal', methods=['POST'])
def check_literal_in_file():
    """
    Herramienta simple para buscar un literal en un archivo.
    Entrada: { "path": "ruta/al/archivo", "literal": "texto_a_buscar" }
    """
    try:
        data = request.json
        rel_path = data.get('path')
        literal = data.get('literal')

        if not rel_path or not literal:
            return jsonify({"error": "Se requieren 'path' y 'literal'"}), 400

        # Validemos que el path sea seguro y dentro del proyecto
        project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        full_path = os.path.abspath(os.path.join(project_root, rel_path))

        if not os.path.normcase(full_path).startswith(os.path.normcase(project_root)):
             return jsonify({"error": f"Acceso denegado: Ruta fuera del proyecto. ({full_path} vs {project_root})"}), 403
             
        if not os.path.exists(full_path):
             return jsonify({"error": f"Archivo no encontrado: {rel_path}"}), 404
             
        if not os.path.isfile(full_path):
             return jsonify({"error": f"La ruta no corresponde a un archivo: {rel_path}"}), 400

        matches = []
        try:
            with open(full_path, 'r', encoding='utf-8') as f:
                for line_num, line in enumerate(f, 1):
                    if literal in line:
                        matches.append({
                            "line": line_num,
                            "content": line.strip()
                        })
        except UnicodeDecodeError:
             return jsonify({"error": "No se pudo leer el archivo (posible binario o codificación incorrecta)"}), 400

        return jsonify({
            "found": len(matches) > 0,
            "count": len(matches),
            "matches": matches[:100] # Limitar a 100 resultados por seguridad
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/tools/running-apps', methods=['GET'])
def get_running_apps():
    """
    Devuelve una lista de ventanas activas con detalles (solo Windows).
    Usa pygetwindow para obtener geometría y estado.
    """
    import platform
    if platform.system() != 'Windows':
        return jsonify({
            "error": "Esta función solo está disponible en Windows.",
            "platform": platform.system()
        }), 400

    try:
        import pygetwindow as gw
        windows = gw.getAllWindows()
        apps_data = []

        for w in windows:
            title = w.title.strip()
            if not title:
                continue
                
            # Extract available attributes safely
            app_info = {
                "title": title,
                "id": getattr(w, '_hWnd', 0), # Internal handle as ID
                "isActive": getattr(w, 'isActive', False),
                "isMaximized": getattr(w, 'isMaximized', False),
                "isMinimized": getattr(w, 'isMinimized', False),
                "geometry": {
                    "left": getattr(w, 'left', 0),
                    "top": getattr(w, 'top', 0),
                    "width": getattr(w, 'width', 0),
                    "height": getattr(w, 'height', 0)
                }
            }
            apps_data.append(app_info)

        return jsonify({
            "platform": "Windows",
            "count": len(apps_data),
            "windows": apps_data
        })
    except ImportError:
        return jsonify({"error": "El modulo 'pygetwindow' no está instalado."}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# -----------------------------------------------

@app.route('/api/tasks', methods=['GET'])
def list_tasks():
    """
    Endpoint para listar todas las tareas registradas y su documentación.
    """
    try:
        tasks_data = []
        registered_tasks = get_all_tasks()
        
        for task_name, task_class in registered_tasks.items():
            tasks_data.append({
                "name": task_name,
                "class_name": task_class.__name__,
                "module": task_class.__module__,
                "scope": getattr(task_class, "scope", "General"),
                "doc": task_class.__doc__.strip() if task_class.__doc__ else "Sin documentación",
                "args_schema": task_class.get_args_schema()
            })
            
        return jsonify({"tasks": tasks_data})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Path to resources/images
RESOURCES_IMAGES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'resources', 'images')

@app.route('/api/ocr-images', methods=['GET'])
def list_ocr_images():
    """
    Lista recursivamente todas las imágenes en resources/images
    y devuelve su estructura jerárquica plana con metadatos del mapeo.
    """
    import json
    images_data = []
    mapping_path = os.path.join(RESOURCES_IMAGES_DIR, 'ocr_mapping.json')
    mapping = {}
    
    if os.path.exists(mapping_path):
        try:
            with open(mapping_path, 'r', encoding='utf-8') as f:
                mapping = json.load(f)
        except Exception as e:
            logger.error(f"Error reading ocr_mapping.json: {e}")

    if not os.path.exists(RESOURCES_IMAGES_DIR):
        return jsonify([])

    try:
        seen_ids = set()
        for root, dirs, files in os.walk(RESOURCES_IMAGES_DIR):
            for file in files:
                if file.lower().endswith(('.png', '.jpg', '.jpeg', '.gif')):
                    if file in seen_ids:
                        continue
                    seen_ids.add(file)
                    
                    abs_path = os.path.join(root, file)
                    rel_path = os.path.relpath(abs_path, RESOURCES_IMAGES_DIR)
                    path_parts = rel_path.split(os.sep)
                    
                    # Normalizar rel_path para el frontend
                    rel_path_web = rel_path.replace("\\", "/")
                    
                    # Buscar si esta imagen física está en el mapeo
                    associated_texts = []
                    mapped_to = [] # List of {feature, tag}
                    is_mapped = False
                    key_text = os.path.splitext(file)[0] # Default (ID)
                    
                    # El mapeo se organiza por: feature_path -> tag -> steps -> {id, texts, original_text}
                    # Esta es una búsqueda inversa costosa pero necesaria para enriquecer los datos
                    for feat_key, feat_data in mapping.items():
                        if feat_key == 'generic' and isinstance(feat_data, list):
                            for step in feat_data:
                                if step.get('id') == file:
                                    key_text = step.get('original_text', key_text)
                                    associated_texts.extend(step.get('texts', []))
                                    is_mapped = True
                                    if {"feature": "generic", "tag": None, "text": step.get('original_text'), "full_steps": step.get('texts', [])} not in mapped_to:
                                        mapped_to.append({"feature": "generic", "tag": None, "text": step.get('original_text'), "full_steps": step.get('texts', [])})
                        elif isinstance(feat_data, dict):
                            for tag_name, tag_info in feat_data.items():
                                if not isinstance(tag_info, dict): continue
                                steps = tag_info.get('steps', [])
                                for step in steps:
                                    if step.get('id') == file:
                                        key_text = step.get('original_text', key_text)
                                        associated_texts.extend(step.get('texts', []))
                                        is_mapped = True
                                        mapping_entry = {
                                            "feature": feat_key, 
                                            "tag": tag_name, 
                                            "text": step.get('original_text'),
                                            "full_steps": step.get('texts', [])
                                        }
                                        if mapping_entry not in mapped_to:
                                            mapped_to.append(mapping_entry)


                    # Fallback: Si no está en el mapeo, extraer feature del path
                    # Estructura legacy: [feature_path]/[subfolder]/[tag_or_scenario]/imagen.png
                    # Ejemplo: retiro/retiro/ok/img.png o access_no_card/deposit/movistar/successful/img.png
                    if not is_mapped and len(path_parts) >= 2:
                        # Verificar que no sea una imagen genérica
                        if not (len(path_parts) >= 2 and path_parts[0] == 'features' and path_parts[1] == 'generic'):
                            # Construir el feature path desde las primeras partes del path
                            # Típicamente: path_parts[0] o path_parts[0]/path_parts[1]
                            if len(path_parts) >= 3:
                                # Caso: retiro/retiro/ok/ -> feature: "retiro/retiro", tag: "ok"
                                legacy_feature = f"{path_parts[0]}/{path_parts[1]}"
                                legacy_tag = path_parts[2] if len(path_parts) > 2 else None
                            else:
                                # Caso simple: feature/imagen.png
                                legacy_feature = path_parts[0]
                                legacy_tag = None
                            
                            # Agregar entrada de mapeo legacy
                            legacy_entry = {
                                "feature": legacy_feature,
                                "tag": legacy_tag,
                                "text": key_text,
                                "full_steps": []
                            }
                            if legacy_entry not in mapped_to:
                                mapped_to.append(legacy_entry)
                                is_mapped = True

                    item = {
                        "relative_path": rel_path_web,
                        "filename": file,
                        "key_text": key_text,
                        "full_path_parts": path_parts,
                        "associated_texts": list(set(associated_texts)),
                        "mapped_to": mapped_to,
                        "is_mapped": is_mapped
                    }
                    images_data.append(item)
                    
        return jsonify(images_data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/resources/images/<path:filename>', methods=['DELETE'])
def delete_ocr_image(filename):
    """
    Elimina una imagen física y todas sus referencias en ocr_mapping.json.
    """
    import json
    try:
        # 1. Ruta absoluta de la imagen
        abs_image_path = os.path.join(RESOURCES_IMAGES_DIR, filename)
        
        # Seguridad: Evitar que salgan de RESOURCES_IMAGES_DIR
        if os.path.commonpath([abs_image_path, os.path.abspath(RESOURCES_IMAGES_DIR)]) != os.path.abspath(RESOURCES_IMAGES_DIR):
            return jsonify({"error": "Ruta inválida o acceso denegado"}), 403

        # 2. Actualizar ocr_mapping.json
        mapping_path = os.path.join(RESOURCES_IMAGES_DIR, 'ocr_mapping.json')
        if os.path.exists(mapping_path):
            try:
                with open(mapping_path, 'r', encoding='utf-8') as f:
                    mapping = json.load(f)
                
                mapping_changed = False
                # Nombre del archivo base (el ID único)
                target_id = os.path.basename(filename)
                
                # Recorrer el mapeo y limpiar referencias
                for feat_path in list(mapping.keys()):
                    feat_data = mapping[feat_path]
                    
                    # Caso genérico
                    if feat_path == 'generic' and isinstance(feat_data, list):
                        original_len = len(feat_data)
                        mapping[feat_path] = [s for s in feat_data if s.get('id') != target_id]
                        if len(mapping[feat_path]) != original_len:
                            mapping_changed = True
                    # Caso específico (feature -> tag -> steps)
                    elif isinstance(feat_data, dict):
                        for tag_name in list(feat_data.keys()):
                            tag_info = feat_data[tag_name]
                            if isinstance(tag_info, dict) and 'steps' in tag_info:
                                steps = tag_info['steps']
                                original_len = len(steps)
                                tag_info['steps'] = [s for s in steps if s.get('id') != target_id]
                                if len(tag_info['steps']) != original_len:
                                    mapping_changed = True
                                    
                                # Opcional: limpiar tags vacíos
                                if not tag_info['steps']:
                                    del feat_data[tag_name]
                        
                        # Opcional: limpiar features vacíos
                        if not feat_data:
                            del mapping[feat_path]

                if mapping_changed:
                    with open(mapping_path, 'w', encoding='utf-8') as f:
                        json.dump(mapping, f, indent=2, ensure_ascii=False)
                    logger.info(f"Ocr_mapping.json updated: records for {target_id} removed.")
            except Exception as e:
                logger.error(f"Error updating mapping during deletion: {e}")

        # 3. Eliminar archivo físico
        if os.path.exists(abs_image_path):
            os.remove(abs_image_path)
            logger.info(f"Physical image deleted: {abs_image_path}")
            
            # 4. Limpiar directorios vacíos hacia arriba (hasta RESOURCES_IMAGES_DIR)
            parent = os.path.dirname(abs_image_path)
            while parent != RESOURCES_IMAGES_DIR and os.path.commonpath([parent, RESOURCES_IMAGES_DIR]) == os.path.abspath(RESOURCES_IMAGES_DIR):
                try:
                    if not os.listdir(parent):
                        os.rmdir(parent)
                        parent = os.path.dirname(parent)
                    else:
                        break
                except Exception:
                    break

        return jsonify({"message": "Imagen eliminada correctamente"}), 200
    except Exception as e:
        logger.error(f"Error deleting OCR image: {e}")
        return jsonify({"error": str(e)}), 500
@app.route('/api/resources/images/<path:filename>', methods=['GET'])
def serve_ocr_image(filename):
    """
    Sirve las imágenes estáticas.
    """
    try:
        return send_from_directory(RESOURCES_IMAGES_DIR, filename)
    except Exception as e:
        return jsonify({"error": str(e)}), 404

@app.route('/api/open-in-editor', methods=['POST'])
def open_in_editor():
    """
    Intenta abrir el archivo especificado en el editor predeterminado del sistema (o VS Code).
    """
    try:
        data = request.json
        # path relativo desde 'features' o absoluto?
        # Asumamos path relativo a le raíz del proyecto (donde está features, backend, etc)
        # El frontend enviará algo como "features/modulo/archivo.feature"
        
        rel_path = data.get('path')
        if not rel_path:
            return jsonify({"error": "Path required"}), 400
            
        project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        full_path = os.path.abspath(os.path.join(project_root, rel_path))
        
        # Security check: ensure strictly within project root? 
        # For a local dev tool, loose check is okay, but let's be reasonably safe.
        if not full_path.startswith(project_root):
             return jsonify({"error": "Access denied"}), 403
             
        if not os.path.exists(full_path):
             return jsonify({"error": f"File not found: {rel_path}"}), 404

        print(f"Opening file in editor: {full_path}")
        
        # Platform specific
        if os.name == 'nt':
            # Try opening with 'code' (VS Code) first, looking in PATH
            # If that fails (not in path), fallback to os.startfile
            try:
                # shell=True helps with finding command in PATH
                subprocess.run(f'code "{full_path}"', shell=True, check=True)
            except subprocess.CalledProcessError:
                os.startfile(full_path)
        elif sys.platform == 'darwin':
            subprocess.run(['open', full_path])
        else:
            subprocess.run(['xdg-open', full_path])
            
        return jsonify({"message": "Opened"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- Estado de Ejecución de Pruebas y Watchdog ---
log_queue = Queue()  # Cola segura para hilos para almacenar logs

# Usamos un diccionario para mantener el estado de la ejecución activa.
# Esto incluye el proceso y el temporizador del watchdog.
active_test_state = {
    "process": None,  # Para mantener una referencia al proceso de pruebas
    "inactivity_timer": None  # Para el temporizador del watchdog
}

# Tiempo en segundos antes de বিষiderar que un proceso está congelado si no hay salida.
# 5 minutos por defecto.
INACTIVITY_TIMEOUT_SECONDS = 5 * 60

# Estado global para la ejecución programada
scheduled_test_state = {
    "timer": None,
    "time": None
}
# -------------------------------------------------

@app.route('/api/features', methods=['GET'])
def list_features():
    """
    Endpoint para listar todos los archivos .feature y sus directorios.
    """
    def build_tree(path):
        tree = []
        for item in sorted(os.listdir(path)):
            # Excluir la carpeta 'steps' de la vista del explorador de archivos.
            if os.path.isdir(os.path.join(path, item)) and item == 'steps':
                continue

            full_path = os.path.join(path, item)
            relative_path = os.path.relpath(full_path, FEATURES_DIR).replace('\\', '/')
            if os.path.isdir(full_path):
                children = build_tree(full_path)
                # Se elimina la condición 'if children:' para incluir directorios vacíos.
                tree.append({
                    "name": item,
                    "type": "directory",
                    "path": relative_path,
                    "children": children
                })
            elif item.endswith('.feature'):
                tree.append({
                    "name": item,
                    "type": "file",
                    "path": relative_path
                })
        return tree

    try:
        children_tree = build_tree(FEATURES_DIR)
        # Envolver el árbol de archivos en un nodo raíz "Features"
        root_node = [{
            "name": "Features",
            "type": "directory",
            "path": "", # El path de la raíz es vacío
            "children": children_tree
        }]
        return jsonify(root_node)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/features/<path:filepath>', methods=['GET'])
def get_feature_content(filepath):
    """
    Endpoint para obtener el contenido de un archivo .feature específico.
    """
    try:
        # Aseguramos que el path es seguro y no sale del directorio de features
        full_path = os.path.abspath(os.path.join(FEATURES_DIR, filepath))
        if os.path.commonpath([full_path, os.path.abspath(FEATURES_DIR)]) == os.path.abspath(FEATURES_DIR):
            with open(full_path, 'r', encoding='utf-8', newline='') as f:
                content = f.read()
            return jsonify({"path": filepath, "content": content})
        else:
            return jsonify({"error": "File not found or access denied"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500



@app.route('/api/images/upload', methods=['POST'])
def upload_image():
    """
    Endpoint para subir una imagen OCR.
    Mantiene un mapeo en ocr_mapping.json para permitir múltiples textos por imagen
    y manejar caracteres especiales.
    """
    import json
    import time
    import hashlib
    
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file part"}), 400
        
        file = request.files['file']
        text = request.form.get('text')
        step_text = request.form.get('step_text') # El texto completo de la línea
        is_generic = request.form.get('is_generic', 'false').lower() == 'true'

        if not file or not text:
            return jsonify({"error": "Missing required fields: file and text"}), 400

        mapping_path = os.path.join(RESOURCES_IMAGES_DIR, 'ocr_mapping.json')
        
        # Cargar mapeo existente
        mapping = {}
        if os.path.exists(mapping_path):
            with open(mapping_path, 'r', encoding='utf-8') as f:
                mapping = json.load(f)

        # Generar un ID único para la imagen (evita caracteres especiales del texto)
        timestamp = int(time.time())
        text_hash = hashlib.md5(text.encode()).hexdigest()[:8]
        unique_id = f"img_{timestamp}_{text_hash}.png"

        if is_generic:
            # Lógica genérica
            generic_dir = os.path.join(RESOURCES_IMAGES_DIR, 'features', 'generic')
            os.makedirs(generic_dir, exist_ok=True)
            target_path = os.path.join(generic_dir, unique_id)
            file.save(target_path)
            
            # Actualizar mapeo genérico
            if 'generic' not in mapping:
                mapping['generic'] = []
            
            # Buscar si ya existe una entrada para esta imagen (por si acaso)
            # o simplemente agregar una nueva asociación
            mapping['generic'].append({
                "id": unique_id,
                "texts": [step_text] if step_text else [text],
                "original_text": text
            })
            
            with open(mapping_path, 'w', encoding='utf-8') as f:
                json.dump(mapping, f, indent=2, ensure_ascii=False)
                
            return jsonify({"message": "Generic image saved", "id": unique_id, "is_generic": True})
        else:
            feature_path_rel = request.form.get('feature_path')
            tag = request.form.get('tag')

            if not feature_path_rel or not tag:
                return jsonify({"error": "Missing feature_path or tag"}), 400

            if not tag.startswith('@'):
                tag = f"@{tag}"
                
            # Obtener el path de destino (físico)
            # Usamos unique_id en lugar de text para el nombre del archivo
            full_feature_path = os.path.join(FEATURES_DIR, feature_path_rel)
            target_path = get_image_path_from_feature_and_tag(full_feature_path, [tag], unique_id)
            
            # Asegurar que el nombre del archivo en la ruta sea el unique_id (a veces la ruta antigua metía .png)
            target_dir = os.path.dirname(target_path)
            os.makedirs(target_dir, exist_ok=True)
            final_save_path = os.path.join(target_dir, unique_id)
            file.save(final_save_path)
            
            # Actualizar mapeo específico
            if feature_path_rel not in mapping:
                mapping[feature_path_rel] = {}
            
            if tag not in mapping[feature_path_rel]:
                mapping[feature_path_rel][tag] = {"steps": []}
            
            mapping[feature_path_rel][tag]["steps"].append({
                "id": unique_id,
                "texts": [step_text] if step_text else [text],
                "original_text": text
            })
            
            with open(mapping_path, 'w', encoding='utf-8') as f:
                json.dump(mapping, f, indent=2, ensure_ascii=False)
                
            return jsonify({"message": "Image saved and mapped", "id": unique_id, "path": final_save_path})

    except Exception as e:
        logger.error(f"Error uploading image: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/images/link', methods=['POST'])
def link_image():
    """
    Víncula una imagen física existente con un nuevo texto/tag/feature.
    Copia el archivo a la nueva ubicación y lo registra en el mapeo.
    """
    import json
    import shutil
    try:
        data = request.json
        source_rel_path = data.get('source_relative_path')
        text = data.get('text')
        step_text = data.get('step_text')
        feature_path_rel = data.get('feature_path')
        tag = data.get('tag')
        is_generic = data.get('is_generic', False)

        if not source_rel_path or not text:
            return jsonify({"error": "Missing source_relative_path or text"}), 400

        source_abs_path = os.path.join(RESOURCES_IMAGES_DIR, source_rel_path)
        if not os.path.exists(source_abs_path):
            return jsonify({"error": f"Source image not found: {source_rel_path}"}), 404

        mapping_path = os.path.join(RESOURCES_IMAGES_DIR, 'ocr_mapping.json')
        mapping = {}
        if os.path.exists(mapping_path):
            with open(mapping_path, 'r', encoding='utf-8') as f:
                mapping = json.load(f)

        filename = os.path.basename(source_abs_path)
        filename_no_ext = os.path.splitext(filename)[0]
        
        if is_generic:
            generic_dir = os.path.join(RESOURCES_IMAGES_DIR, 'features', 'generic')
            os.makedirs(generic_dir, exist_ok=True)
            target_path = os.path.join(generic_dir, filename)
            
            if source_abs_path != target_path:
                shutil.copy2(source_abs_path, target_path)
            
            if 'generic' not in mapping:
                mapping['generic'] = []
            
            # Evitar duplicados exactos
            exists = any(s.get('id') == filename and s.get('original_text') == text for s in mapping['generic'])
            if not exists:
                mapping['generic'].append({
                    "id": filename,
                    "texts": [step_text] if step_text else [text],
                    "original_text": text
                })
        else:
            if not feature_path_rel or not tag:
                return jsonify({"error": "Missing feature_path or tag"}), 400

            if not tag.startswith('@'):
                tag = f"@{tag}"

            full_feature_path = os.path.join(FEATURES_DIR, feature_path_rel)
            # Pasamos filename_no_ext para evitar doble .png
            target_path = get_image_path_from_feature_and_tag(full_feature_path, [tag], filename_no_ext)
            
            target_dir = os.path.dirname(target_path)
            os.makedirs(target_dir, exist_ok=True)
            
            if source_abs_path != target_path:
                shutil.copy2(source_abs_path, target_path)
            
            if feature_path_rel not in mapping:
                mapping[feature_path_rel] = {}
            if tag not in mapping[feature_path_rel]:
                mapping[feature_path_rel][tag] = {"steps": []}
            
            # Evitar duplicados exactos
            steps = mapping[feature_path_rel][tag]["steps"]
            exists = any(s.get('id') == filename and s.get('original_text') == text for s in steps)
            if not exists:
                mapping[feature_path_rel][tag]["steps"].append({
                    "id": filename,
                    "texts": [step_text] if step_text else [text],
                    "original_text": text
                })

        with open(mapping_path, 'w', encoding='utf-8') as f:
            json.dump(mapping, f, indent=2, ensure_ascii=False)

        return jsonify({"message": "Image linked successfully", "id": filename})

    except Exception as e:
        logger.error(f"Error linking image: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/features/<path:filepath>', methods=['POST'])
def save_feature_content(filepath):
    """
    Endpoint para guardar el contenido de un archivo .feature.
    """
    try:
        data = request.json
        content = data.get('content')

        if content is None:
            return jsonify({"error": "No content provided"}), 400

        # Aseguramos que el path es seguro y no sale del directorio de features
        full_path = os.path.abspath(os.path.join(FEATURES_DIR, filepath))
        if os.path.commonpath([full_path, os.path.abspath(FEATURES_DIR)]) == os.path.abspath(FEATURES_DIR):
            with open(full_path, 'w', encoding='utf-8', newline='') as f:
                f.write(content)
            return jsonify({"message": f"File '{filepath}' saved successfully."})
        else:
            return jsonify({"error": "Invalid path or access denied"}), 403
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/directories', methods=['POST'])
def create_directory():
    """
    Endpoint para crear un nuevo directorio.
    """
    try:
        data = request.json
        path = data.get('path')
        if not path:
            return jsonify({"error": "Se requiere 'path' en el cuerpo de la solicitud"}), 400

        # Aseguramos que el path es seguro y no sale del directorio de features
        full_path = os.path.abspath(os.path.join(FEATURES_DIR, path))
        if os.path.commonpath([full_path, os.path.abspath(FEATURES_DIR)]) != os.path.abspath(FEATURES_DIR):
            return jsonify({"error": "Ruta inválida o acceso denegado"}), 403

        if os.path.exists(full_path):
            return jsonify({"error": f"El directorio o archivo '{path}' ya existe."}), 409

        os.makedirs(full_path)
        return jsonify({"message": f"Directorio '{path}' creado exitosamente."}), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/files', methods=['POST'])
def create_file():
    """
    Endpoint para crear un nuevo archivo .feature.
    """
    try:
        data = request.json
        path = data.get('path')
        if not path:
            return jsonify({"error": "Se requiere 'path' en el cuerpo de la solicitud"}), 400

        # Aseguramos que el path es seguro y termina en .feature
        if not path.endswith('.feature'):
            path += '.feature'

        full_path = os.path.abspath(os.path.join(FEATURES_DIR, path))
        if os.path.commonpath([full_path, os.path.abspath(FEATURES_DIR)]) != os.path.abspath(FEATURES_DIR):
            return jsonify({"error": "Ruta inválida o acceso denegado"}), 403

        if os.path.exists(full_path):
            return jsonify({"error": f"El archivo '{path}' ya existe."}), 409

        # Crear el archivo con contenido por defecto
        default_content = "Feature: Nuevo Feature\n\n  Scenario: Nuevo escenario\n    Given \n    When \n    Then "
        with open(full_path, 'w', encoding='utf-8', newline='') as f:
            f.write(default_content)
        return jsonify({"message": f"Archivo '{path}' creado exitosamente.", "path": path}), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/resource/<path:resource_path>', methods=['DELETE'])
def delete_resource(resource_path):
    """
    Endpoint genérico para eliminar un archivo o directorio.
    """
    try:
        # Aseguramos que el path es seguro y no sale del directorio de features
        full_path = os.path.abspath(os.path.join(FEATURES_DIR, resource_path))
        if os.path.commonpath([full_path, os.path.abspath(FEATURES_DIR)]) != os.path.abspath(FEATURES_DIR):
            return jsonify({"error": "Ruta inválida o acceso denegado"}), 403

        if not os.path.exists(full_path):
            return jsonify({"error": f"El recurso '{resource_path}' no fue encontrado."}), 404

        if os.path.isfile(full_path):
            os.remove(full_path)
            message = f"Archivo '{resource_path}' eliminado exitosamente."
        elif os.path.isdir(full_path):
            shutil.rmtree(full_path)
            message = f"Directorio '{resource_path}' y todo su contenido eliminado exitosamente."
        else:
            return jsonify({"error": "El recurso no es ni un archivo ni un directorio."}), 400

        return jsonify({"message": message}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/resource/<path:resource_path>/rename', methods=['PUT'])
def rename_resource(resource_path):
    """
    Endpoint para renombrar un archivo o directorio.
    También migra las imágenes OCR asociadas a la nueva ubicación.
    """
    try:
        data = request.json
        new_name = data.get('new_name')
        
        if not new_name:
            return jsonify({"error": "Se requiere 'new_name' en el cuerpo de la solicitud"}), 400

        # Aseguramos que el path original es seguro y no sale del directorio de features
        full_path = os.path.abspath(os.path.join(FEATURES_DIR, resource_path))
        if os.path.commonpath([full_path, os.path.abspath(FEATURES_DIR)]) != os.path.abspath(FEATURES_DIR):
            return jsonify({"error": "Ruta inválida o acceso denegado"}), 403

        if not os.path.exists(full_path):
            return jsonify({"error": f"El recurso '{resource_path}' no fue encontrado."}), 404

        # Validar caracteres inválidos en el nuevo nombre
        invalid_chars = ['/', '\\', ':', '*', '?', '"', '<', '>', '|']
        if any(char in new_name for char in invalid_chars):
            return jsonify({"error": f"El nombre contiene caracteres inválidos: {', '.join(invalid_chars)}"}), 400

        # Si es un archivo .feature, asegurar que mantenga la extensión
        is_file = os.path.isfile(full_path)
        if is_file and full_path.endswith('.feature'):
            if not new_name.endswith('.feature'):
                new_name += '.feature'

        # Construir el nuevo path
        parent_dir = os.path.dirname(full_path)
        new_full_path = os.path.abspath(os.path.join(parent_dir, new_name))

        # Verificar que el nuevo path también esté dentro de FEATURES_DIR
        if os.path.commonpath([new_full_path, os.path.abspath(FEATURES_DIR)]) != os.path.abspath(FEATURES_DIR):
            return jsonify({"error": "El nuevo nombre resultaría en una ruta inválida"}), 403

        # Verificar que no exista ya un recurso con ese nombre
        if os.path.exists(new_full_path):
            return jsonify({"error": f"Ya existe un recurso con el nombre '{new_name}'"}), 409

        # Calcular paths relativos para la migración de imágenes
        old_relative_path = os.path.relpath(full_path, FEATURES_DIR).replace('\\', '/')
        new_relative_path = os.path.relpath(new_full_path, FEATURES_DIR).replace('\\', '/')

        # Renombrar el recurso
        os.rename(full_path, new_full_path)
        logger.info(f"Successfully renamed {resource_path} to {new_relative_path}")
        
        # Migrar imágenes OCR asociadas
        migration_result = migrate_ocr_images(old_relative_path, new_relative_path, is_file)
        
        # Actualizar referencias en módulos (run_list.json)
        module_update_result = plan_manager.update_feature_paths_after_rename(old_relative_path, new_relative_path, is_file)
        
        resource_type = "archivo" if is_file else "directorio"
        response_data = {
            "message": f"{resource_type.capitalize()} renombrado exitosamente.",
            "new_path": new_relative_path
        }
        
        # Incluir información de migración si hubo imágenes
        if migration_result["migrated"]:
            response_data["images_migrated"] = {
                "count": migration_result["count"],
                "old_path": migration_result["old_path"],
                "new_path": migration_result["new_path"]
            }
            logger.info(f"Migrated {migration_result['count']} OCR images")
        
        # Incluir información de actualización de módulos
        if module_update_result["updated"]:
            response_data["modules_updated"] = {
                "count": module_update_result["count"],
                "modules": module_update_result["modules"]
            }
            logger.info(f"Updated {module_update_result['count']} feature references in {len(module_update_result['modules'])} module(s)")
        
        # Incluir errores de migración si los hubo (pero no fallar la operación)
        if migration_result["errors"]:
            response_data["migration_warnings"] = migration_result["errors"]
        
        return jsonify(response_data), 200

    except Exception as e:
        logger.error(f"Error renaming resource: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/resource/<path:resource_path>/move', methods=['PUT'])
def move_resource(resource_path):
    """
    Endpoint para mover un archivo o directorio a una nueva ubicación.
    También migra las imágenes OCR asociadas y actualiza el run_list.json.
    """
    try:
        data = request.json
        destination_dir = data.get('destination_dir')
        
        if destination_dir is None:
            return jsonify({"error": "Se requiere 'destination_dir' en el cuerpo de la solicitud"}), 400

        # Aseguramos que el path original es seguro
        full_path = os.path.abspath(os.path.join(FEATURES_DIR, resource_path))
        if os.path.commonpath([full_path, os.path.abspath(FEATURES_DIR)]) != os.path.abspath(FEATURES_DIR):
            return jsonify({"error": "Ruta original inválida o acceso denegado"}), 403

        if not os.path.exists(full_path):
            return jsonify({"error": f"El recurso '{resource_path}' no fue encontrado."}), 404

        # Aseguramos que el directorio de destino es seguro
        dest_full_dir = os.path.abspath(os.path.join(FEATURES_DIR, destination_dir))
        if os.path.commonpath([dest_full_dir, os.path.abspath(FEATURES_DIR)]) != os.path.abspath(FEATURES_DIR):
            return jsonify({"error": "Directorio de destino inválido o acceso denegado"}), 403

        if not os.path.exists(dest_full_dir) or not os.path.isdir(dest_full_dir):
            # Intentar crear el directorio si no existe (opcional)
            # os.makedirs(dest_full_dir, exist_ok=True)
            return jsonify({"error": f"El directorio de destino '{destination_dir}' no existe o no es un directorio."}), 404

        # Construir el nuevo path conservando el nombre original
        resource_name = os.path.basename(full_path)
        new_full_path = os.path.join(dest_full_dir, resource_name)

        # Validaciones de seguridad para evitar mover una carpeta dentro de sí misma
        if os.path.commonpath([new_full_path, full_path]) == full_path:
            return jsonify({"error": "No se puede mover un directorio dentro de sí mismo o de sus subdirectorios."}), 400

        # Verificar que no exista ya un recurso con ese nombre en el destino
        if os.path.exists(new_full_path):
            return jsonify({"error": f"Ya existe un recurso con el nombre '{resource_name}' en el destino."}), 409

        # Calcular paths relativos para la migración
        is_file = os.path.isfile(full_path)
        old_relative_path = os.path.relpath(full_path, FEATURES_DIR).replace('\\', '/')
        new_relative_path = os.path.relpath(new_full_path, FEATURES_DIR).replace('\\', '/')

        # Mover el recurso
        os.rename(full_path, new_full_path)
        logger.info(f"Successfully moved {resource_path} to {new_relative_path}")
        
        # Migrar imágenes OCR asociadas
        migration_result = migrate_ocr_images(old_relative_path, new_relative_path, is_file)
        
        # Actualizar referencias en módulos (run_list.json)
        module_update_result = plan_manager.update_feature_paths_after_rename(old_relative_path, new_relative_path, is_file)
        
        resource_type = "archivo" if is_file else "directorio"
        response_data = {
            "message": f"{resource_type.capitalize()} movido exitosamente.",
            "new_path": new_relative_path
        }
        
        # Incluir información de migración
        if migration_result["migrated"]:
            response_data["images_migrated"] = {
                "count": migration_result["count"],
                "old_path": migration_result["old_path"],
                "new_path": migration_result["new_path"]
            }
        
        # Incluir información de actualización de módulos
        if module_update_result["updated"]:
            response_data["modules_updated"] = {
                "count": module_update_result["count"],
                "modules": module_update_result["modules"]
            }
        
        # Incluir warnings
        if migration_result["errors"]:
            response_data["migration_warnings"] = migration_result["errors"]
        
        return jsonify(response_data), 200

    except Exception as e:
        logger.error(f"Error moving resource: {str(e)}")
        return jsonify({"error": str(e)}), 500


def _add_ids_to_sequence(sequence):
    """Función auxiliar para añadir IDs únicos a los features para el frontend."""
    for module in sequence:
        for feature in module.get('features', []):
            # Usamos una combinación que sea estable y única dentro del módulo.
            # Se usa un separador claro y se maneja el caso de feature_dir vacío.
            feature['id'] = f"feature::{module['module_name']}::{feature.get('feature_dir', '')}/{feature['feature_file']}"
    return sequence

@app.route('/api/execution-order', methods=['GET'])
def get_execution_order():
    """
    Endpoint para leer y devolver el contenido de run_list.json.
    """
    try:
        # Parámetro para decidir si se incluyen los módulos inactivos.
        # Por defecto, solo se muestran los activos.
        include_inactive = request.args.get('include_inactive', 'false').lower() == 'true'

        execution_sequence = plan_manager.get_sequence(parser_func=parse_feature_file_with_behave)

        if include_inactive:
            return jsonify(_add_ids_to_sequence(execution_sequence))
        else:
            active_modules = [m for m in execution_sequence if m.get('active')]
            return jsonify(_add_ids_to_sequence(active_modules))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/execution-order', methods=['PUT'])
def save_execution_order():
    """
    Endpoint para recibir una nueva secuencia de ejecución y guardarla en run_list.json.
    """
    try:
        new_sequence = request.json
        updated_sequence = plan_manager.update_sequence(new_sequence)
        return jsonify(_add_ids_to_sequence(updated_sequence))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/modules', methods=['POST'])
def add_module():
    """
    Endpoint para agregar un nuevo módulo al plan de ejecución.
    """
    try:
        data = request.json
        module_name = data.get('module_name')
        order = data.get('order')
        if not module_name or order is None:
            return jsonify({"error": "Se requiere 'module_name' y 'order'"}), 400

        updated_sequence = plan_manager.add_module(module_name, int(order))
        return jsonify(_add_ids_to_sequence(updated_sequence)), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/api/modules/<string:module_name>/features/tags', methods=['PUT'])
def update_feature_tags(module_name):
    """
    Endpoint para actualizar los tags de ejecución de un feature específico.
    """
    try:
        data = request.json
        feature_file = data.get('feature_file')
        feature_dir = data.get('feature_dir', '')
        tags = data.get('tags')

        if not feature_file:
            return jsonify({"error": "Se requiere 'feature_file'"}), 400

        updated_sequence = plan_manager.update_feature_tags(module_name, feature_file, feature_dir, tags)
        return jsonify(_add_ids_to_sequence(updated_sequence))
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/modules/<string:module_name>/color', methods=['PUT'])
def update_module_color(module_name):
    """
    Endpoint para actualizar el color de un módulo.
    """
    try:
        data = request.json
        color = data.get('color')
        if not color:
            return jsonify({"error": "Se requiere 'color' en el cuerpo de la solicitud"}), 400

        updated_sequence = plan_manager.update_module_color(module_name, color)
        return jsonify(_add_ids_to_sequence(updated_sequence))
    except ValueError as e:
        return jsonify({"error": str(e)}), 404

@app.route('/api/ui-settings/module-collapse', methods=['PUT'])
def update_module_collapse():
    """
    Endpoint para guardar el estado de colapso (expandido/contraído) de un módulo.
    """
    try:
        data = request.json
        view = data.get('view')
        section_id = data.get('section_id')
        is_collapsed = data.get('is_collapsed')

        if not view or not section_id or is_collapsed is None:
            return jsonify({"error": "Se requiere 'view', 'section_id' y 'is_collapsed'"}), 400

        result = plan_manager.update_view_collapse_state(view, section_id, is_collapsed)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/modules/<string:module_name>', methods=['DELETE'])
def delete_module(module_name):
    """
    Endpoint para eliminar un módulo del plan de ejecución.
    """
    try:
        updated_sequence = plan_manager.delete_module(module_name)
        return jsonify(_add_ids_to_sequence(updated_sequence))
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/api/modules/<string:module_name>/activity', methods=['PUT'])
def toggle_module_activity(module_name):
    """
    Endpoint para activar o desactivar un módulo.
    """
    try:
        data = request.json
        active = data.get('active')
        if active is None:
            return jsonify({"error": "Se requiere el estado 'active'"}), 400

        updated_sequence = plan_manager.toggle_module_activity(module_name, bool(active))
        return jsonify(_add_ids_to_sequence(updated_sequence))
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/api/modules/<string:module_name>/is_hook', methods=['PUT'])
def toggle_module_is_hook(module_name):
    """
    Endpoint para marcar/desmarcar un módulo como hook.
    """
    try:
        data = request.json
        is_hook = data.get('is_hook')
        if is_hook is None:
            return jsonify({"error": "Se requiere 'is_hook' en el cuerpo de la solicitud"}), 400

        updated_sequence = plan_manager.toggle_module_is_hook(module_name, bool(is_hook))
        return jsonify(_add_ids_to_sequence(updated_sequence))
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/modules/<string:module_name>/features', methods=['POST'])
def add_feature_to_module(module_name):
    """
    Endpoint para añadir un nuevo feature a un módulo existente.
    """
    try:
        data = request.json
        feature_path = data.get('path')
        if not feature_path:
            return jsonify({"error": "Se requiere el 'path' del feature"}), 400

        updated_sequence = plan_manager.add_feature_to_module(module_name, feature_path, parse_feature_file_with_behave)
        return jsonify(_add_ids_to_sequence(updated_sequence)), 201
    except ValueError as e: # Captura errores de lógica de negocio (ej. duplicados)
        return jsonify({"error": str(e)}), 409 # 409 Conflict
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/modules/<string:module_name>/features', methods=['DELETE'])
def delete_feature_from_module(module_name):
    """
    Endpoint para eliminar un feature de un módulo existente.
    Se usa DELETE con un body para la identificación del feature.
    """
    try:
        data = request.json
        feature_file = data.get('feature_file')
        feature_dir = data.get('feature_dir', '') # El directorio puede no existir

        if not feature_file:
            return jsonify({"error": "Se requiere 'feature_file' en el cuerpo de la solicitud"}), 400

        updated_sequence = plan_manager.delete_feature_from_module(module_name, feature_file, feature_dir)
        return jsonify(_add_ids_to_sequence(updated_sequence))

    except ValueError as e: # Captura errores como "no encontrado"
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/modules/<string:module_name>/features/activity', methods=['PUT'])
def toggle_feature_activity(module_name):
    """
    Endpoint para activar o desactivar un feature dentro de un módulo.
    """
    try:
        data = request.json
        feature_file = data.get('feature_file')
        feature_dir = data.get('feature_dir', '')
        active = data.get('active')

        if not feature_file or active is None:
            return jsonify({"error": "Se requiere 'feature_file' y 'active'"}), 400

        updated_sequence = plan_manager.toggle_feature_activity(module_name, feature_file, feature_dir, bool(active))
        return jsonify(_add_ids_to_sequence(updated_sequence))
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/modules/<string:module_name>/features/reorder', methods=['PUT'])
def reorder_features(module_name):
    """
    Endpoint para reordenar los features dentro de un módulo.
    """
    try:
        reordered_features = request.json
        if not isinstance(reordered_features, list):
            return jsonify({"error": "El cuerpo de la solicitud debe ser una lista de features"}), 400

        updated_sequence = plan_manager.reorder_features_in_module(module_name, reordered_features)
        return jsonify(_add_ids_to_sequence(updated_sequence))

    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def parse_feature_file_with_behave(file_path):
    """
    Analiza un archivo .feature usando el parser interno de Behave
    para extraer sus tags y escenarios.
    
    Args:
        file_path (str): La ruta completa al archivo .feature.

    Returns:
        dict: Un diccionario con "tags" y "scenarios".
    """
    all_tags = set()
    scenarios_data = []
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        parser = Parser()
        feature = parser.parse(content, file_path)

        if isinstance(feature, Feature):
            # 1. Extraer tags a nivel de Feature
            for tag in feature.tags:
                all_tags.add(f"@{tag}")

            # 2. Iterar sobre los escenarios
            for scenario in feature.scenarios:
                if isinstance(scenario, (Scenario, ScenarioOutline)):
                    # Extraer tags del escenario
                    scenario_tags = [f"@{tag}" for tag in scenario.tags]
                    for tag in scenario_tags:
                        all_tags.add(tag)

                    # Añadir objeto con nombre y tags
                    scenarios_data.append({
                        "name": scenario.name,
                        "tags": scenario_tags
                    })

    except Exception as e:
        print(f"Error parsing feature file '{file_path}' with Behave parser: {e}")
        return {"tags": [], "scenarios": []}

    return {
        "tags": sorted(list(all_tags)),
        "scenarios": scenarios_data
    }

@app.route('/api/steps/catalog', methods=['GET'])
def get_steps_catalog():
    """
    Endpoint para obtener todos los pasos (Given, When, Then) registrados en el proyecto.
    """
    from behave.step_registry import registry
    import importlib.util
    
    steps_dir = os.path.join(FEATURES_DIR, 'steps')
    if not os.path.exists(steps_dir):
        return jsonify([])

    # Aseguramos que el directorio de features esté en el path para las importaciones
    if FEATURES_DIR not in sys.path:
        sys.path.append(FEATURES_DIR)

    # Cargar dinámicamente todos los archivos de steps si aún no se han cargado por completo
    # Nota: En un entorno de producción, esto debería hacerse una vez al inicio.
    for root, _, files in os.walk(steps_dir):
        for file in files:
            if file.endswith('.py') and file != '__init__.py':
                file_path = os.path.join(root, file)
                module_name = f"steps.{os.path.relpath(file_path, steps_dir).replace(os.sep, '.')[:-3]}"
                if module_name not in sys.modules:
                    try:
                        spec = importlib.util.spec_from_file_location(module_name, file_path)
                        module = importlib.util.module_from_spec(spec)
                        sys.modules[module_name] = module
                        spec.loader.exec_module(module)
                    except Exception as e:
                        logger.warning(f"No se pudo cargar el módulo de steps {module_name}: {e}")

    steps_data = []
    for step_type in ['given', 'when', 'then']:
        definitions = registry.steps.get(step_type, [])
        for step in definitions:
            steps_data.append({
                "type": step_type,
                "pattern": step.string,
                "location": f"{os.path.relpath(step.location.filename, FEATURES_DIR)}:{step.location.line}"
            })
    
    return jsonify(steps_data)

@app.route('/api/features/validate', methods=['POST'])
def validate_feature():
    """
    Valida un archivo .feature usando behave --dry-run para encontrar pasos no definidos.
    """
    try:
        data = request.json
        rel_path = data.get('path')
        if not rel_path:
            return jsonify({"error": "Path required"}), 400

        full_path = os.path.abspath(os.path.join(FEATURES_DIR, rel_path))
        if not full_path.startswith(os.path.abspath(FEATURES_DIR)):
             return jsonify({"error": "Access denied"}), 403

        # Intentar localizar el ejecutable de python del venv
        project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        venv_python = os.path.join(project_root, '.venv', 'Scripts', 'python.exe')
        if not os.path.exists(venv_python):
            venv_python = sys.executable # Fallback al actual

        # Usar la ruta absoluta para evitar ambigüedades
        cmd = [venv_python, "-m", "behave", "--dry-run", "-f", "json", full_path]
        
        logger.info(f"Running validation command: {' '.join(cmd)}")
        # Ejecutar en el directorio raiz
        result = subprocess.run(cmd, cwd=project_root, capture_output=True, text=True, encoding='utf-8')
        
        output = result.stdout
        error_output = result.stderr
        
        logger.debug(f"Behave output: {output[:200]}...")
        if error_output:
            logger.debug(f"Behave error output: {error_output[:200]}...")
        
        undefined_steps = []
        snippets = []
        is_valid = True
        parse_error = None
        report_data = None
        
        # Intentar extraer el JSON de stdout
        # Behave --dry-run suele imprimir texto antes ([USING RUNNER]) y después (snippets) del JSON
        json_start = output.find('[')
        json_end = output.rfind(']')
        
        if json_start != -1 and json_end != -1 and json_end > json_start:
            try:
                report_json = output[json_start:json_end+1]
                report = json.loads(report_json)
                report_data = report
                for feature in report:
                    if feature.get('status') == 'error':
                        is_valid = False
                    for element in feature.get('elements', []):
                        if element.get('status') == 'error':
                            is_valid = False
                        for step in element.get('steps', []):
                            # En dry-run, el resultado puede ser 'undefined' o 'untested'
                            status = step.get('result', {}).get('status')
                            if status == 'undefined':
                                is_valid = False
                                undefined_steps.append({
                                    "keyword": step.get('keyword', '').strip(),
                                    "name": step.get('name', '')
                                })
                            elif not status and (element.get('status') == 'error' or feature.get('status') == 'error'):
                                # Si no hay status pero el escenario/feature tiene error, 
                                # es probable que este sea el paso problema
                                undefined_steps.append({
                                    "keyword": step.get('keyword', '').strip(),
                                    "name": step.get('name', ''),
                                    "note": "Potencialmente no definido"
                                })
            except Exception as e:
                parse_error = str(e)
                logger.error(f"Error parsing behave JSON output from matches: {e}")
        else:
            # Si no hay JSON estructurado, chequeamos si hay errores críticos en stderr
            if result.returncode != 0 and not snippets:
                is_valid = False

        # Extraer snippets del output (stdout o stderr)
        # Los snippets empiezan con @given, @when, @then
        import re
        snippet_pattern = re.compile(r"(@(?:given|when|then)\(u?'.*?'\)\s+def step_impl\(context\):.*?)(?=@|$)", re.DOTALL)
        
        all_output = output + "\n" + error_output
        found_snippets = snippet_pattern.findall(all_output)
        snippets = [s.strip() for s in found_snippets]

        # Si encontramos snippets, definitivamente no es válido
        if snippets:
            is_valid = False

        return jsonify({
            "valid": is_valid,
            "undefined_steps": undefined_steps,
            "snippets": snippets,
            "raw_output": all_output if not is_valid else ""
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/modules/<string:module_name>/features/tasks', methods=['POST'])
def add_task_to_feature(module_name):
    """
    Endpoint para añadir una tarea de UI a un feature.
    """
    try:
        data = request.json
        feature_file = data.get('feature_file')
        feature_dir = data.get('feature_dir', '')
        task_config = data.get('task_config') # { name, scope, hook, scenario_name? }

        if not feature_file or not task_config:
            return jsonify({"error": "feature_file y task_config son requeridos"}), 400

        updated_sequence = plan_manager.add_task_to_feature(module_name, feature_file, feature_dir, task_config)
        return jsonify(_add_ids_to_sequence(updated_sequence))
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/modules/<string:module_name>/features/tasks', methods=['PUT'])
def update_task_in_feature(module_name):
    """
    Endpoint para editar una tarea de UI existente en un feature.
    """
    try:
        data = request.json
        feature_file = data.get('feature_file')
        feature_dir = data.get('feature_dir', '')
        task_index = data.get('task_index')
        new_task_config = data.get('task_config')

        if not feature_file or task_index is None or not new_task_config:
            return jsonify({"error": "feature_file, task_index y task_config son requeridos"}), 400

        updated_sequence = plan_manager.update_task_in_feature(module_name, feature_file, feature_dir, int(task_index), new_task_config)
        return jsonify(_add_ids_to_sequence(updated_sequence))
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/modules/<string:module_name>/features/tasks', methods=['DELETE'])
def delete_task_from_feature(module_name):
    """
    Endpoint para eliminar una tarea de UI de un feature.
    """
    try:
        data = request.json
        feature_file = data.get('feature_file')
        feature_dir = data.get('feature_dir', '')
        task_index = data.get('task_index')

        if not feature_file or task_index is None:
            return jsonify({"error": "feature_file y task_index son requeridos"}), 400

        updated_sequence = plan_manager.delete_task_from_feature(module_name, feature_file, feature_dir, int(task_index))
        return jsonify(_add_ids_to_sequence(updated_sequence))
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/execution/<string:execution_id>/gif', methods=['GET'])
def get_execution_gif(execution_id):
    """
    Generates and downloads a GIF for the specified execution ID.
    """
    try:
        # PROJECT_ROOT is parent of 'features'
        project_root = os.path.dirname(FEATURES_DIR)
        gif_source_dir = os.path.join(project_root, 'reports', 'temp_gif', execution_id)
        
        if not os.path.exists(gif_source_dir):
            return jsonify({"error": "Execution data not found"}), 404
            
        # Get all PNGs
        images = sorted(glob.glob(os.path.join(gif_source_dir, "*.png")))
        if not images:
            return jsonify({"error": "No images found for this execution"}), 404
            
        # Load images
        frames = []
        for index, image_path in enumerate(images):
            try:
                img = Image.open(image_path).convert('RGB')
                
                # Draw frame number
                draw = ImageDraw.Draw(img)
                # Try to use a large font if possible, otherwise default
                try:
                    # Try Arial or generic sans-serif
                    font = ImageFont.truetype("arial.ttf", 36)
                except IOError:
                    # Fallback to default
                    font = ImageFont.load_default()
                
                text = f"#{index + 1}"
                
                # Calculate position (bottom right)
                # bbox = draw.textbbox((0, 0), text, font=font) # Needs newer Pillow
                # text_width = bbox[2] - bbox[0]
                # text_height = bbox[3] - bbox[1]
                
                # Simple positioning (Top Left)
                x, y = 10, 10
                
                # Draw background rectangle for visibility
                text_bbox = draw.textbbox((x, y), text, font=font)
                draw.rectangle(text_bbox, fill="black")
                draw.text((x, y), text, font=font, fill="white")
                
                frames.append(img)
            except Exception as ex:
                print(f"Error processing frame {image_path}: {ex}")

        if not frames:
             return jsonify({"error": "Failed to process frames"}), 500
        
        # Output buffer
        output = io.BytesIO()
        
        # Save GIF
        # duration in ms, loop=0 means infinite
        # Duration 1000ms = 1s per frame
        frames[0].save(output, format="GIF", save_all=True, append_images=frames[1:], duration=1000, loop=0)
        output.seek(0)
        
        return send_file(output, mimetype='image/gif', as_attachment=True, download_name=f"execution_{execution_id}.gif")
        
    except Exception as e:
        print(f"Error generating GIF: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/execution/<string:execution_id>/video', methods=['GET'])
def get_execution_video(execution_id):
    """
    Generates and downloads a Video (MP4) for the specified execution ID.
    """
    try:
        import cv2
        import numpy as np
        
        # PROJECT_ROOT is parent of 'features'
        project_root = os.path.dirname(FEATURES_DIR)
        video_source_dir = os.path.join(project_root, 'reports', 'temp_gif', execution_id)
        
        if not os.path.exists(video_source_dir):
            return jsonify({"error": "Execution data not found"}), 404
            
        # Get all PNGs
        images = sorted(glob.glob(os.path.join(video_source_dir, "*.png")))
        if not images:
            return jsonify({"error": "No images found for this execution"}), 404
        
        # Read first image to get dimensions
        first_frame = cv2.imread(images[0])
        if first_frame is None:
            return jsonify({"error": "Failed to read first frame"}), 500
            
        height, width, _ = first_frame.shape
        
        # Create temporary video file
        import tempfile
        temp_video = tempfile.NamedTemporaryFile(delete=False, suffix='.mp4')
        temp_video_path = temp_video.name
        temp_video.close()
        
        # Define codec and create VideoWriter
        # Using 'mp4v' for better compatibility on Windows/Linux by default
        # 'avc1' is better but often requires extra DLLs
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        base_fps = 1  # Logic 1 frame per second
        output_fps = 10 # 10 frames per second for smoother seek/playback
        repeat_count = output_fps // base_fps
        
        out = cv2.VideoWriter(temp_video_path, fourcc, output_fps, (width, height))
        
        if not out.isOpened():
            logger.error("Failed to open VideoWriter with mp4v, trying avc1...")
            fourcc = cv2.VideoWriter_fourcc(*'avc1')
            out = cv2.VideoWriter(temp_video_path, fourcc, output_fps, (width, height))
            
        if not out.isOpened():
             return jsonify({"error": "Failed to initialize video writer with available codecs"}), 500
        
        # Process each frame
        for index, image_path in enumerate(images):
            try:
                frame = cv2.imread(image_path)
                if frame is None:
                    print(f"Warning: Could not read {image_path}")
                    continue
                
                # Draw frame number
                text = f"#{index + 1}"
                font = cv2.FONT_HERSHEY_SIMPLEX
                font_scale = 1.2
                thickness = 3
                
                # Get text size for background rectangle
                (text_width, text_height), baseline = cv2.getTextSize(text, font, font_scale, thickness)
                
                # Position (top-left)
                x, y = 10, 10 + text_height
                
                # Draw black background rectangle
                cv2.rectangle(frame, (x - 5, y - text_height - 5), (x + text_width + 5, y + baseline + 5), (0, 0, 0), -1)
                
                # Draw white text
                cv2.putText(frame, text, (x, y), font, font_scale, (255, 255, 255), thickness)
                
                # Write frame multiple times for smoothness
                for _ in range(repeat_count):
                    out.write(frame)
            except Exception as ex:
                logger.error(f"Error processing video frame {image_path}: {ex}")
        
        out.release()
        
        # Send the video file
        return send_file(temp_video_path, mimetype='video/mp4', as_attachment=True, download_name=f"execution_{execution_id}.mp4")
        
    except ImportError:
        return jsonify({"error": "OpenCV (cv2) is not installed. Install with: pip install opencv-python"}), 500
    except Exception as e:
        print(f"Error generating video: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/execution-order/refresh', methods=['POST'])
def refresh_execution_order():
    """
    Re-lee todos los archivos .feature listados en execution_order.json
    y actualiza sus 'display_tags' y 'scenarios'.
    """
    try:
        updated_sequence = plan_manager.refresh_features_data(parse_feature_file_with_behave)
        return jsonify(_add_ids_to_sequence(updated_sequence))
    except Exception as e:
        return jsonify({"error": f"Un error inesperado ocurrió: {str(e)}"}), 500

def _cleanup_test_state():
    """Función centralizada para limpiar el estado de la prueba activa."""
    global active_test_state
    if active_test_state["inactivity_timer"]:
        active_test_state["inactivity_timer"].cancel()
    active_test_state["process"] = None
    active_test_state["inactivity_timer"] = None
    print("Estado de la prueba limpiado. Listo para una nueva ejecución.")

def _handle_inactivity_timeout():
    """Función que se ejecuta cuando el watchdog de inactividad se dispara."""
    global active_test_state
    if active_test_state["process"]:
        pid = active_test_state["process"].pid
        print(f"¡WATCHDOG ACTIVADO! El proceso de prueba (PID: {pid}) no ha mostrado actividad en {INACTIVITY_TIMEOUT_SECONDS} segundos. Se considera congelado.")
        log_queue.put(f"WATCHDOG: Proceso de prueba inactivo. Intentando terminarlo...")
        
        # Usar SIGKILL para forzar la terminación de un proceso que no responde.
        try:
            if os.name == 'nt':
                os.kill(pid, signal.CTRL_BREAK_EVENT)
            else:
                os.killpg(os.getpgid(pid), signal.SIGKILL)
            log_queue.put("---EXECUTION_KILLED_BY_WATCHDOG---")
        except Exception as e:
            print(f"Error al intentar terminar el proceso congelado con el watchdog: {e}")

def _reset_inactivity_timer():
    """Reinicia el temporizador de inactividad."""
    global active_test_state
    if active_test_state["inactivity_timer"]:
        active_test_state["inactivity_timer"].cancel()
    
    timer = threading.Timer(INACTIVITY_TIMEOUT_SECONDS, _handle_inactivity_timeout)
    timer.daemon = True
    timer.start()
    active_test_state["inactivity_timer"] = timer

def _stream_process_output(process):
    """Lee la salida de un proceso, la pone en la cola y reinicia el watchdog."""
    def stream_reader(stream, is_stderr=False):
        for line in iter(stream.readline, ''):
            _reset_inactivity_timer()  # El proceso está vivo, reinicia el watchdog.
            
            # 1. Registrar la salida de behave en el log general (app.log)
            # Esto asegura que app.log tenga tanto las trazas internas como la salida del test.
            clean_line = line.strip()
            if clean_line:
                if is_stderr:
                    logger.error(f"[BEHAVE-STDERR] {clean_line}")
                else:
                    logger.info(f"[BEHAVE-STDOUT] {clean_line}")

            # 2. Enviar a la cola para el frontend (UI)
            log_queue.put(f"ERROR: {line}" if is_stderr else line)
        stream.close()

    # Iniciar hilos para leer stdout y stderr de forma no bloqueante.
    stdout_thread = threading.Thread(target=stream_reader, args=(process.stdout, False))
    stderr_thread = threading.Thread(target=stream_reader, args=(process.stderr, True))
    stdout_thread.start()
    stderr_thread.start()
    process.wait()  # Esperar a que el proceso termine.
    log_queue.put("---EXECUTION_FINISHED---")  # Señal de fin.

@app.route('/api/stream-logs')
def stream_logs():
    """Endpoint de Server-Sent Events para transmitir logs al frontend."""
    def generate():
        while True:
            line = log_queue.get() # Bloquea hasta que haya un nuevo item
            line_strip = line.strip()

            # Intenta parsear la línea como JSON
            try:
                data = json.loads(line_strip)
                # Si es un reporte de estado (escenario o tarea), envíalo con su tipo
                if data.get("type") in ["scenario_status", "task_status"]:
                    if data.get("type") == "task_status":
                        logger.info(f"[STREAM_LOGS] Sending task_status event: {data}")
                    yield f"data: {json.dumps(data)}\n\n"
                    continue # Pasa a la siguiente línea sin tratarlo como un log normal
            except (json.JSONDecodeError, TypeError):
                # Si no es JSON, trátalo como un log normal
                pass
            
            if line_strip == "---EXECUTION_FINISHED---":
                # Cuando la ejecución termina, generamos la URL del reporte
                # y la enviamos al frontend con una señal especial.
                # Paso 1: Enviar la URL del reporte como un evento separado.
                # Usar la ruta con slash al final para que los recursos relativos carguen bien
                report_url = "/api/report/"
                yield f"data: {json.dumps({'type': 'report_ready', 'reportUrl': report_url})}\n\n"
                # Paso 2: Enviar la señal de finalización para que el frontend pueda cerrar la conexión.
                yield f"data: {json.dumps({'log': '---EXECUTION_FINISHED---'})}\n\n"
                break
            elif line_strip in ("---EXECUTION_STOPPED_BY_USER---", "---EXECUTION_KILLED_BY_WATCHDOG---"):
                # Si la ejecución fue detenida, solo envía la señal y termina.
                yield f"data: {json.dumps({'log': line_strip})}\n\n"
                break
            yield f"data: {json.dumps({'log': line_strip})}\n\n"
    return Response(generate(), mimetype='text/event-stream')

@app.route('/api/report/')
@app.route('/api/report/')
@app.route('/api/report/<path:path>')
def serve_allure_report(path=None):
    """
    Sirve los archivos estáticos del reporte de Allure.
    """
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    report_dir = os.path.abspath(os.path.join(project_root, 'reports', 'allure-report'))
    
    if not os.path.exists(report_dir):
        return jsonify({"error": "Directorio de reportes no encontrado."}), 404

    # Si no hay path, servir index.html
    if not path or path == "":
        path = "index.html"
    
    response = send_from_directory(report_dir, path)
    
    # FORZAR MODOS MODERNOS Y EVITAR CACHE
    # X-UA-Compatible indica a Edge que no use el modo de compatibilidad de IE
    response.headers["X-UA-Compatible"] = "IE=edge,chrome=1"
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    
    # Forzar MIME types si la PC tiene el registro corrupto
    if path.endswith('.js'):
        response.mimetype = 'application/javascript'
    elif path.endswith('.json'):
        response.mimetype = 'application/json'
    elif path.endswith('.css'):
        response.mimetype = 'text/css'
        
    return response

@app.route('/api/reports/usage', methods=['GET'])
def get_reports_usage():
    """
    Endpoint para obtener el uso de disco de los directorios de reportes.
    """
    try:
        project_root = pathlib.Path(__file__).parent.parent
        results_dir = project_root / 'reports' / 'allure_results'
        report_dir = project_root / 'reports' / 'allure-report'
        screenshots_dir = project_root / 'reports' / 'screenshots'

        def get_dir_size(path):
            total = 0
            if path.exists():
                for entry in path.rglob('*'):
                    if entry.is_file():
                        total += entry.stat().st_size
            return total

        results_size = get_dir_size(results_dir)
        report_size = get_dir_size(report_dir)
        screenshots_size = get_dir_size(screenshots_dir)

        return jsonify({
            "results_size": results_size,
            "report_size": report_size,
            "screenshots_size": screenshots_size,
            "total_size": results_size + report_size + screenshots_size
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/reports/clean', methods=['POST'])
def clean_reports():
    """
    Endpoint para limpiar los directorios de reportes.
    Body: { "target": "results" | "report" | "screenshots" | "all" }
    """
    try:
        data = request.json
        target = data.get('target')
        
        project_root = pathlib.Path(__file__).parent.parent
        results_dir = project_root / 'reports' / 'allure_results'
        report_dir = project_root / 'reports' / 'allure-report'
        screenshots_dir = project_root / 'reports' / 'screenshots'

        cleaned = []

        if target in ['results', 'all']:
            if results_dir.exists():
                shutil.rmtree(results_dir)
                results_dir.mkdir(parents=True, exist_ok=True)
                cleaned.append("Resultados Raw")

        if target in ['report', 'all']:
            if report_dir.exists():
                shutil.rmtree(report_dir)
                report_dir.mkdir(parents=True, exist_ok=True)
                cleaned.append("Reporte Generado")

        if target in ['screenshots', 'all']:
            if screenshots_dir.exists():
                shutil.rmtree(screenshots_dir)
                screenshots_dir.mkdir(parents=True, exist_ok=True)
                cleaned.append("Screenshots")

        if not cleaned:
            return jsonify({"error": "Target inválido o nada que limpiar"}), 400

        return jsonify({"message": f"Se han limpiado: {', '.join(cleaned)}"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/stop-tests', methods=['POST'])
def stop_tests():
    """
    Endpoint para detener la ejecución de pruebas en curso.
    """
    global active_test_state
    process = active_test_state["process"]
    if process and process.poll() is None: # .poll() is None si el proceso está corriendo
        try:
            # Enviar señal de terminación a todo el grupo de procesos.
            # Esto asegura que tanto behave_master.py como sus subprocesos (Allure) se detengan.
            print(f"Petición manual para cancelar el proceso de tests con PID: {process.pid}")
            if os.name == 'nt': # Windows
                os.kill(process.pid, signal.CTRL_BREAK_EVENT)
            else: # Unix/Linux/macOS
                os.killpg(os.getpgid(process.pid), signal.SIGTERM)
            log_queue.put("---EXECUTION_STOPPED_BY_USER---") # Señal para el frontend
            return jsonify({"message": "Se ha enviado la solicitud para detener la ejecución."}), 200
        except Exception as e:
            return jsonify({"error": f"No se pudo detener el proceso: {str(e)}"}), 500
    else:
        return jsonify({"message": "No hay ninguna ejecución de pruebas en curso para detener."}), 404





from datetime import datetime
import time

def _start_test_process():
    """
    Función interna para iniciar el proceso de pruebas.
    Retorna el proceso o lanza una excepción.
    """
    global active_test_state
    
    # Verificación de estado
    if active_test_state["process"] and active_test_state["process"].poll() is None:
        raise Exception("Ya hay una ejecución de pruebas en curso.")

    # Limpiar la cola de logs de ejecuciones anteriores
    while not log_queue.empty():
        log_queue.get()

    # La ruta a la raíz del proyecto, subiendo un nivel desde la carpeta 'backend'
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    script_path = os.path.join(project_root, 'behave_master.py')

    if not os.path.exists(script_path):
        raise FileNotFoundError("El script behave_master.py no fue encontrado.")

    # Ejecutar el script de Python en un nuevo proceso
    preexec_fn = None if os.name == 'nt' else os.setsid
    creationflags = subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0

    # Forzar la codificación UTF-8 para el subproceso.
    env = os.environ.copy()
    env['PYTHONIOENCODING'] = 'utf-8'

    process = subprocess.Popen(
        [sys.executable, script_path],
        cwd=project_root,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding='utf-8',
        errors='replace',
        bufsize=1, # Line-buffered
        preexec_fn=preexec_fn,
        creationflags=creationflags,
        env=env
    )

    active_test_state["process"] = process
    print(f"Ejecución de pruebas iniciada con PID: {process.pid}")

    # Iniciar el watchdog por primera vez.
    _reset_inactivity_timer()

    # Iniciar un hilo para leer la salida del proceso sin bloquear
    def process_handler_thread():
        _stream_process_output(process)
        _cleanup_test_state() # Limpia el estado cuando el proceso ha terminado.
    
    thread = threading.Thread(target=process_handler_thread)
    thread.start()
    
    return process

@app.route('/api/run-tests', methods=['POST'])
def run_tests():
    """
    Endpoint para iniciar la ejecución de las pruebas inmediatamente.
    """
    try:
        _start_test_process()
        return jsonify({"message": "La ejecución de pruebas ha comenzado."}), 202
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        if "Ya hay una ejecución" in str(e):
             return jsonify({"message": str(e)}), 409
        return jsonify({"error": f"Error al intentar iniciar la ejecución: {str(e)}"}), 500

@app.route('/api/schedule-tests', methods=['POST'])
def schedule_tests():
    """
    Endpoint para programar la ejecución de pruebas en una fecha/hora específica.
    Body: { "execution_time": "YYYY-MM-DDTHH:MM:SS" }
    """
    try:
        data = request.json
        execution_time_str = data.get('execution_time')
        
        if not execution_time_str:
             return jsonify({"error": "Se requiere parameter 'execution_time'"}), 400
             
        # Parsear con/sin timezone (asumiendo local time si no trae)
        # Frontend enviará ISO string. 
        # Para simplificar, convertimos todo a timestamps de sistema.
        
        try:
            target_time = datetime.fromisoformat(execution_time_str)
        except ValueError:
            return jsonify({"error": "Formato de fecha inválido. Use ISO 8601"}), 400

        now = datetime.now().astimezone() if target_time.tzinfo else datetime.now()
        
        delay = (target_time - now).total_seconds()
        
        if delay <= 0:
             return jsonify({"error": "La hora programada debe ser en el futuro."}), 400
             
        print(f"Programando ejecución en {delay} segundos (Target: {target_time})")
        
        # Cancelar cualquier temporizador existente antes de poner uno nuevo
        if scheduled_test_state["timer"]:
            scheduled_test_state["timer"].cancel()
            print("Temporizador anterior cancelado.")

        def scheduled_execution():
            print(f"Ejecutando pruebas programadas para {target_time}")
            scheduled_test_state["timer"] = None
            scheduled_test_state["time"] = None
            try:
                # Ponemos un mensaje en el log para que el frontend sepa que arrancó
                log_queue.put(f"--- INICIO DE EJECUCIÓN PROGRAMADA ({target_time}) ---")
                _start_test_process()
            except Exception as e:
                print(f"Error en ejecución programada: {e}")
                log_queue.put(f"Error al iniciar ejecución programada: {e}")

        # Usar threading.Timer para la ejecución diferida
        timer = threading.Timer(delay, scheduled_execution)
        timer.start()
        
        scheduled_test_state["timer"] = timer
        scheduled_test_state["time"] = target_time.isoformat()

        return jsonify({
            "message": f"Ejecución programada exitosamente para {execution_time_str}",
            "delay_seconds": delay
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/schedule-status', methods=['GET'])
def get_schedule_status():
    """
    Endpoint para obtener el estado de la ejecución programada.
    """
    try:
        is_scheduled = scheduled_test_state["timer"] is not None
        execution_time = scheduled_test_state["time"]
        return jsonify({
            "scheduled": is_scheduled,
            "execution_time": execution_time
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/cancel-schedule', methods=['POST'])
def cancel_schedule():
    """
    Endpoint para cancelar una ejecución programada.
    """
    try:
        if scheduled_test_state["timer"]:
            scheduled_test_state["timer"].cancel()
            scheduled_test_state["timer"] = None
            scheduled_test_state["time"] = None
            return jsonify({"message": "Ejecución programada cancelada exitosamente."}), 200
        else:
            return jsonify({"message": "No hay ejecuciones programadas para cancelar."}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/execution-status', methods=['GET'])
def get_execution_status():
    """
    Endpoint para obtener el estado actual de la ejecución de pruebas (si hay un proceso activo).
    """
    try:
        is_running = active_test_state["process"] is not None and active_test_state["process"].poll() is None
        pid = active_test_state["process"].pid if is_running else None
        return jsonify({
            "running": is_running,
            "pid": pid
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react_app(path):
    """
    Sirve la aplicación React (Single Page Application).
    Si el archivo existe en frontend/dist, lo sirve.
    Si no, sirve index.html para que el router de React maneje la ruta.
    Para rutas que comienzan con /api/, devolvemos un error JSON 404 en lugar de index.html.
    """
    if path.startswith('api/'):
        return jsonify({"error": f"API endpoint not found: /{path}"}), 404

    frontend_dist = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'frontend', 'dist')
    
    # Seguridad: Evitar salir del directorio
    # En producción real, nginx manejaría esto mejor.
    
    if path and os.path.exists(os.path.join(frontend_dist, path)):
        return send_from_directory(frontend_dist, path)
    
    return send_from_directory(frontend_dist, 'index.html')

if __name__ == '__main__':
    import argparse
    
    # Parse command-line arguments
    parser = argparse.ArgumentParser(description='PeHaPe Backend Server')
    parser.add_argument('--window', action='store_true', 
                        help='Launch in native window mode (uses pywebview with Edge WebView2)')
    parser.add_argument('--no-window', action='store_true', 
                        help='Launch as server only for network access (default)')
    parser.add_argument('--network', action='store_true',
                        help='Alias for --no-window, launch as network server')
    args = parser.parse_args()
    
    # Cargar configuración desde JSON si existe
    config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'server_config.json')
    
    # Default to localhost for window mode, all interfaces for server mode
    host = '127.0.0.1' if args.window else '0.0.0.0'
    port = 5000
    
    if os.path.exists(config_path):
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                config = json.load(f)
                # Only override host from config in server mode
                if not args.window:
                    host = config.get('host', host)
                port = config.get('port', port)
                print(f"Loaded configuration from {config_path}")
        except Exception as e:
            print(f"Error loading config: {e}. Using defaults.")
    
    if args.window:
        # ========================================
        # NATIVE WINDOW MODE (pywebview)
        # ========================================
        print("=" * 50)
        print("Starting PeHaPe in NATIVE WINDOW MODE")
        print("=" * 50)
        
        try:
            import webview
        except ImportError:
            print("\n" + "=" * 50)
            print("ERROR: pywebview is not installed!")
            print("=" * 50)
            print("\nPlease install it with:")
            print("  pip install pywebview")
            print("\nOr reinstall all dependencies:")
            print("  pip install -r requirements.txt")
            print("\n" + "=" * 50)
            sys.exit(1)
        
        # Start Flask in a background thread
        def start_flask():
            app.run(host='127.0.0.1', port=port, debug=False, use_reloader=False)
        
        flask_thread = threading.Thread(target=start_flask, daemon=True)
        flask_thread.start()
        
        # Wait for Flask to start
        print(f"Starting Flask server on http://127.0.0.1:{port}...")
        import time
        time.sleep(2)
        
        # Create native window
        print(f"Creating native window...")
        
        # Note: Icon support in pywebview varies by version and platform
        # The favicon in index.html will be used automatically by the browser engine
        window = webview.create_window(
            'PeHaPe - Automation Framework',
            f'http://127.0.0.1:{port}',
            width=1280,
            height=800,
            resizable=True,
            fullscreen=False,
            min_size=(800, 600)
        )
        
        print("Launching application window...")
        webview.start()
        
    else:
        # ========================================
        # SERVER MODE (network access)
        # ========================================
        print("=" * 50)
        print("Starting PeHaPe in SERVER MODE")
        print(f"Server will be accessible at http://{host}:{port}")
        print("=" * 50)
        print("\nOpen your browser and navigate to:")
        print(f"  http://localhost:{port}")
        if host == '0.0.0.0':
            print(f"\nOr from other devices on the network:")
            print(f"  http://<YOUR-IP>:{port}")
        print("\n" + "=" * 50)
        
        # Listen on all interfaces (or configured host)
        app.run(host=host, port=port, debug=True)
