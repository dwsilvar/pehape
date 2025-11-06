import os
import json
from flask import Flask, jsonify, request
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

@app.route('/api/features', methods=['GET'])
def list_features():
    """
    Endpoint para listar todos los archivos .feature y sus directorios.
    """
    def build_tree(path):
        tree = []
        for item in sorted(os.listdir(path)):
            full_path = os.path.join(path, item)
            relative_path = os.path.relpath(full_path, FEATURES_DIR).replace('\\', '/')
            if os.path.isdir(full_path):
                children = build_tree(full_path)
                if children: # Solo agregar directorios si no están vacíos
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

@app.route('/api/execution-order', methods=['GET'])
def get_execution_order():
    """
    Endpoint para leer y devolver el contenido de run_list.json.
    """
    try:
        execution_sequence = plan_manager.get_sequence()
        # Asignar un ID único a cada feature para que React lo use como 'key'
        for module in execution_sequence:
            for feature in module.get('features', []):
                feature['id'] = f"{module['module_name']}-{feature['feature_file']}"
        return jsonify(execution_sequence)
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
        return jsonify(updated_sequence)
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
        return jsonify(updated_sequence), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/api/modules/<string:module_name>', methods=['DELETE'])
def delete_module(module_name):
    """
    Endpoint para eliminar un módulo del plan de ejecución.
    """
    try:
        updated_sequence = plan_manager.delete_module(module_name)
        return jsonify(updated_sequence)
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
        return jsonify(updated_sequence)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)