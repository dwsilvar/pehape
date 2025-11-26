import os
import json
import shutil
import subprocess
from flask import Flask, jsonify, request, Response, send_from_directory
import sys, signal
import threading
from queue import Queue
from behave.parser import Parser
from behave.model import Feature, Scenario, ScenarioOutline

from flask_cors import CORS

from execution_plan_manager import ExecutionPlanManager
app = Flask(__name__)
# Permitir peticiones desde el frontend de Vite (localhost:3000)
CORS(app, resources={r"/api/*": {"origins": "http://localhost:3000"}})

# Definir la ruta base donde están los features.
# Se necesita subir un nivel desde la ubicación actual del script (backend/).
FEATURES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'features')

# Instanciar el manejador del plan de ejecución
plan_manager = ExecutionPlanManager(FEATURES_DIR)

# --- Estado de Ejecución de Pruebas y Watchdog ---
log_queue = Queue()  # Cola segura para hilos para almacenar logs

# Usamos un diccionario para mantener el estado de la ejecución activa.
# Esto incluye el proceso y el temporizador del watchdog.
active_test_state = {
    "process": None,  # Para mantener una referencia al proceso de pruebas
    "inactivity_timer": None  # Para el temporizador del watchdog
}

# Tiempo en segundos antes de considerar que un proceso está congelado si no hay salida.
# 5 minutos por defecto.
INACTIVITY_TIMEOUT_SECONDS = 5 * 60
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
                # Si es un reporte de estado de escenario, envíalo con su tipo
                if data.get("type") == "scenario_status":
                    yield f"data: {json.dumps(data)}\n\n"
                    continue # Pasa a la siguiente línea sin tratarlo como un log normal
            except (json.JSONDecodeError, TypeError):
                # Si no es JSON, trátalo como un log normal
                pass
            
            if line_strip == "---EXECUTION_FINISHED---":
                # Cuando la ejecución termina, generamos la URL del reporte
                # y la enviamos al frontend con una señal especial.
                # Paso 1: Enviar la URL del reporte como un evento separado.
                report_url = "/api/report/index.html"
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

@app.route('/api/report/<path:path>')
def serve_allure_report(path):
    """
    Sirve los archivos estáticos del reporte de Allure.
    """
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    report_dir = os.path.join(project_root, 'reports', 'allure-report')
    return send_from_directory(report_dir, path)

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




@app.route('/api/run-tests', methods=['POST'])
def run_tests():
    """
    Endpoint para iniciar la ejecución de las pruebas con behave_master.py.
    Ejecuta el script en un proceso separado para no bloquear el servidor.
    """
    try:
        global active_test_state
        if active_test_state["process"] and active_test_state["process"].poll() is None:
            return jsonify({"message": "Ya hay una ejecución de pruebas en curso."}), 409 # Conflict

        # Limpiar la cola de logs de ejecuciones anteriores
        while not log_queue.empty():
            log_queue.get()

        # La ruta a la raíz del proyecto, subiendo un nivel desde la carpeta 'backend'
        project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        script_path = os.path.join(project_root, 'behave_master.py')

        if not os.path.exists(script_path):
            return jsonify({"error": "El script behave_master.py no fue encontrado."}), 404

        # Ejecutar el script de Python en un nuevo proceso
        # Se ejecuta desde la raíz del proyecto para que las rutas relativas dentro del script funcionen
        # Se crea un nuevo grupo de procesos para poder terminar el proceso principal y todos sus hijos.
        preexec_fn = None if os.name == 'nt' else os.setsid
        creationflags = subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0

        # Forzar la codificación UTF-8 para el subproceso.
        # Esto resuelve los UnicodeEncodeError en Windows al imprimir en stdout/stderr.
        env = os.environ.copy()
        env['PYTHONIOENCODING'] = 'utf-8'

        process = subprocess.Popen(
            [sys.executable, script_path],
            cwd=project_root,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding='utf-8',
            errors='replace', # Añade manejo de errores de decodificación
            bufsize=1, # Line-buffered
            # --- Parámetros para la creación del grupo de procesos ---
            preexec_fn=preexec_fn, # En Unix, crea una nueva sesión
            creationflags=creationflags, # En Windows, crea un nuevo grupo de procesos
            env=env # Pasa el entorno modificado al subproceso
            # ---------------------------------------------------------
        )

        active_test_state["process"] = process
        print(f"Ejecución de pruebas iniciada con PID: {process.pid}")

        # Iniciar el watchdog por primera vez.
        _reset_inactivity_timer()

        # Iniciar un hilo para leer la salida del proceso sin bloquear
        # y manejar la limpieza cuando termine.
        def process_handler_thread():
            _stream_process_output(process)
            _cleanup_test_state() # Limpia el estado cuando el proceso ha terminado.
        thread = threading.Thread(target=process_handler_thread)
        thread.start()

        return jsonify({"message": "La ejecución de pruebas ha comenzado."}), 202 # 202 Accepted
    except Exception as e:
        return jsonify({"error": f"Error al intentar iniciar la ejecución: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)