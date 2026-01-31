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
    y devuelve su estructura jerárquica plana.
    Estructura esperada: resources/images/<modulo>/<feature>/<tag>/<texto>.png
    """
    images_data = []
    
    if not os.path.exists(RESOURCES_IMAGES_DIR):
        return jsonify([])

    try:
        for root, dirs, files in os.walk(RESOURCES_IMAGES_DIR):
            for file in files:
                if file.lower().endswith(('.png', '.jpg', '.jpeg')):
                    abs_path = os.path.join(root, file)
                    rel_path = os.path.relpath(abs_path, RESOURCES_IMAGES_DIR)
                    path_parts = rel_path.split(os.sep)
                    
                    # Intentar inferir estructura si es posible
                    # <modulo relative path>/<feature>/<tag>/<filename>
                    # Esto puede variar, así que lo hacemos genérico pero intentamos extraer info útil
                    
                    item = {
                        "relative_path": rel_path.replace("\\", "/"),
                        "filename": file,
                        "key_text": os.path.splitext(file)[0],
                        "full_path_parts": path_parts
                    }
                    images_data.append(item)
                    
        return jsonify(images_data)
    except Exception as e:
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
            with open(full_path, 'r', encoding='utf-8') as f:
                content = f.read()
            return jsonify({"path": filepath, "content": content})
        else:
            return jsonify({"error": "File not found or access denied"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500



@app.route('/api/images/upload', methods=['POST'])
def upload_image():
    """
    Endpoint para subir una imagen de fallback OCR.
    """
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file part"}), 400
        
        file = request.files['file']
        feature_path_rel = request.form.get('feature_path')
        tag = request.form.get('tag')
        text = request.form.get('text')

        if not file or not feature_path_rel or not tag or not text:
            return jsonify({"error": "Missing required fields"}), 400

        # Construct absolute path to feature file
        # feature_path_rel comes as 'features/path/to/file.feature' or similar from frontend
        # We need to make sure we map it correctly using FEATURES_DIR
        # Use simple join, frontend typically sends path relative to 'features' if we set it up that way.
        # But 'selectedFile.path' in frontend is usually relative to features root.
        
        # We need the full absolute path to the feature file for the utility function
        # FEATURES_DIR is .../pehape/features
        # feature_path_rel should be relative to FEATURES_DIR
        
        full_feature_path = os.path.join(FEATURES_DIR, feature_path_rel)
        
        # Ensure tag has @
        if not tag.startswith('@'):
            tag = f"@{tag}"
            
        # Get target image path
        # Pass tag as a list as expected by the utility
        target_path = get_image_path_from_feature_and_tag(full_feature_path, [tag], text)
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(target_path), exist_ok=True)
        
        # Save file
        file.save(target_path)
        
        return jsonify({"message": f"Image saved successfully at {target_path}", "path": target_path})

    except Exception as e:
        print(f"Error uploading image: {e}")
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
            with open(full_path, 'w', encoding='utf-8') as f:
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
        with open(full_path, 'w', encoding='utf-8') as f:
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
    scenario_names = []
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        parser = Parser()
        feature = parser.parse(content, file_path) # Pasamos el contenido y el path para errores

        if isinstance(feature, Feature):
            # 1. Extraer tags a nivel de Feature
            # (La extracción de tags se omite para no guardarlos en 'display_tags')
            for tag in feature.tags:
                all_tags.add(f"@{tag}")

            # 2. Iterar sobre los escenarios
            for scenario in feature.scenarios:
                # Behave modela Scenarios y ScenarioOutlines de forma similar
                if isinstance(scenario, (Scenario, ScenarioOutline)):
                    # Añadimos el nombre del escenario a nuestra lista
                    scenario_names.append(scenario.name)
                    
                    # También extraemos los tags a nivel de Scenario
                    for tag in scenario.tags:
                        all_tags.add(f"@{tag}")

    except Exception as e:
        # Es buena idea registrar el error si el archivo .feature tiene sintaxis inválida
        print(f"Error parsing feature file '{file_path}' with Behave parser: {e}")
        return {"tags": [], "scenarios": []}

    return {
        "tags": sorted(list(all_tags)),
        "scenarios": scenario_names
    }

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
        # Using 'avc1' (H.264) for better compatibility and no audio track
        fourcc = cv2.VideoWriter_fourcc(*'avc1')
        fps = 1  # 1 frame per second (matching the 1000ms GIF duration)
        out = cv2.VideoWriter(temp_video_path, fourcc, fps, (width, height))
        
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
                
                out.write(frame)
            except Exception as ex:
                print(f"Error processing video frame {image_path}: {ex}")
        
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
    """
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
        webview.create_window(
            'PeHaPe - OCR Test Automation',
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
