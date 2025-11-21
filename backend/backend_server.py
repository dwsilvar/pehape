import os
import json
import subprocess
from flask import Flask, jsonify, request, Response, send_from_directory
import sys
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

# --- Variables globales para el streaming de logs ---
log_queue = Queue() # Cola segura para hilos para almacenar logs
test_process = None # Para mantener una referencia al proceso de pruebas
# ----------------------------------------------------

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
        file_tree = build_tree(FEATURES_DIR)
        #print("***************************************************************************************************")
        #print(file_tree)
        #print("***************************************************************************************************")
        return jsonify(file_tree)
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
    La identificación del feature se pasa en el cuerpo de la solicitud.
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

def _stream_process_output(process, queue):
    """Lee la salida de un proceso línea por línea y la pone en una cola."""
    # Lee stdout
    for line in iter(process.stdout.readline, ''):
        queue.put(line)
    # Lee stderr
    for line in iter(process.stderr.readline, ''):
        queue.put(f"ERROR: {line}")
    process.stdout.close()
    process.stderr.close()
    process.wait()
    queue.put("---EXECUTION_FINISHED---") # Señal de fin

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
                report_url = "/api/report/index.html"
                yield f"data: {json.dumps({'log': '---EXECUTION_FINISHED---', 'reportUrl': report_url})}\n\n"
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
    global test_process
    if test_process and test_process.poll() is None: # .poll() is None si el proceso está corriendo
        try:
            # Enviar señal de terminación a todo el grupo de procesos.
            # Esto asegura que tanto behave_master.py como sus subprocesos (Allure) se detengan.
            if os.name == 'nt': # Windows
                os.kill(test_process.pid, subprocess.CTRL_BREAK_EVENT)
            else: # Unix/Linux/macOS
                os.killpg(os.getpgid(test_process.pid), subprocess.signal.SIGTERM)
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
        global test_process
        if test_process and test_process.poll() is None:
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

        test_process = subprocess.Popen(
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
            creationflags=creationflags # En Windows, crea un nuevo grupo de procesos
            # ---------------------------------------------------------
        )

        # Iniciar un hilo para leer la salida del proceso sin bloquear
        thread = threading.Thread(target=_stream_process_output, args=(test_process, log_queue))
        thread.start()

        return jsonify({"message": "La ejecución de pruebas ha comenzado."}), 202 # 202 Accepted
    except Exception as e:
        return jsonify({"error": f"Error al intentar iniciar la ejecución: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)