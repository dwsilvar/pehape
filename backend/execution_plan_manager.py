import os
import json
import re

class ExecutionPlanManager:
    def __init__(self, features_dir):
        self.features_dir = features_dir
        self.run_list_path = os.path.join(features_dir, 'run_list.json')
        self.ui_settings_path = os.path.join(features_dir, 'ui_settings.json')
        self.data = self._load()
        self.ui_settings = self._load_ui_settings()

    def _load(self):
        """Carga el plan de ejecución desde el archivo JSON."""
        try:
            if not os.path.exists(self.run_list_path):
                return {"execution_sequence": []}
            with open(self.run_list_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                # Limpieza retroactiva: elimina el color si existe en los datos cargados.
                for module in data.get('execution_sequence', []):
                    module.pop('color', None)
                return data
        except (json.JSONDecodeError, IOError):
            return {"execution_sequence": []}

    def _load_ui_settings(self):
        """Carga las configuraciones de UI desde su archivo JSON."""
        try:
            with open(self.ui_settings_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            # Devuelve una estructura por defecto si el archivo no existe o está corrupto.
            return {
                "module_colors": {},
                "module_hooks": {}
            }

    def _save(self):
        """Guarda la estructura de datos actual en el archivo JSON."""
        # Re-ordena la secuencia principal por la propiedad 'order' antes de guardar
        self.data['execution_sequence'].sort(key=lambda m: m.get('order', 0))
        
        # Crea una copia profunda para no modificar el estado en memoria
        data_to_save = json.loads(json.dumps(self.data['execution_sequence']))
        
        # Prepara los datos para run_list.json (sin campos de UI)
        for module in data_to_save:
            module.pop('color', None)
            module.pop('is_collapsed', None)
            module.pop('view_states', None)
            for feature in module.get('features', []):
                feature.pop('display_tags', None)
                feature.pop('scenarios', None)
                # NOTA: NO eliminamos 'ui_tasks' porque queremos que persista.

        with open(self.run_list_path, 'w', encoding='utf-8') as f:
            json.dump({"execution_sequence": data_to_save}, f, indent=2)

    def _save_ui_settings(self):
        """Guarda las configuraciones de UI en su archivo."""
        with open(self.ui_settings_path, 'w', encoding='utf-8') as f:
            json.dump(self.ui_settings, f, indent=2)

    def get_sequence(self, parser_func=None):
        """Obtiene la secuencia de ejecución completa, ordenada."""
        # Valida y corrige el orden al cargar.
        all_modules = self.data.get('execution_sequence', [])
        
        active_modules = [m for m in all_modules if m.get('active')]
        inactive_modules = [m for m in all_modules if not m.get('active')]

        # Ordena los módulos activos por su 'order' existente para mantener la consistencia.
        active_modules.sort(key=lambda m: m.get('order', 0))

        # Re-asigna el orden secuencial solo a los módulos activos.
        for index, module in enumerate(active_modules):
            module['order'] = index + 1

        # Asigna -1 a todos los inactivos.
        for module in inactive_modules:
            module['order'] = -1

        # Ordena las features dentro de cada módulo.
        for module in all_modules:
            # Inyecta el color desde la configuración de UI
            module['color'] = self.ui_settings.get('module_colors', {}).get(module['module_name'])
            # Inyecta la propiedad is_hook desde la configuración de UI
            module['is_hook'] = self.ui_settings.get('module_hooks', {}).get(module['module_name'], False)
            # Inyecta el estado de colapso (default: false/expandido)
            module['view_states'] = self.ui_settings.get('view_states', {})
            
            if 'features' in module:
                module['features'].sort(key=lambda f: f.get('order', 0))
                # Enriquece los datos del feature si se proporciona una función de parsing.
                for feature in module['features']:
                    if parser_func:
                        relative_path = os.path.join(feature.get('feature_dir', ''), feature.get('feature_file', ''))
                        full_path = os.path.join(self.features_dir, relative_path)
                        if os.path.exists(full_path):
                            parsed_data = parser_func(full_path)
                            feature['display_tags'] = parsed_data.get('tags', [])
                            feature['scenarios'] = parsed_data.get('scenarios', [])
                    else:
                        # Comportamiento de respaldo: asegura que las claves existan.
                        feature.setdefault('display_tags', [])
                        feature.setdefault('scenarios', [])
                    if 'tags' not in feature:
                        feature['tags'] = None

        return active_modules + inactive_modules

    def add_module(self, module_name, order, active=False, module_dir=""):
        """Añade un nuevo módulo a la secuencia de ejecución."""
        # Evita duplicados
        if any(m['module_name'].lower() == module_name.lower() for m in self.data['execution_sequence']):
            raise ValueError(f"El módulo '{module_name}' ya existe.")

        new_module = {
            "module_name": module_name,
            "active": active,
            "module_dir": module_dir,
            "order": order,
            "features": []
        }
        
        # Inserta el nuevo módulo en la posición correcta y ajusta los demás.
        # El 'order' del frontend es 1-based, el índice de la lista es 0-based.
        # Si el orden es mayor que la longitud de la lista, simplemente se añade al final.
        insert_index = max(0, order - 1)
        self.data['execution_sequence'].insert(insert_index, new_module)
        
        # Re-asigna todos los 'order' para que sean secuenciales (1, 2, 3...) después de la inserción.
        for i, module in enumerate(self.data['execution_sequence']):
            module['order'] = i + 1
            
        self._save()
        return self.get_sequence() # Devuelve la lista actualizada y ordenada

    def delete_module(self, module_name):
        """Elimina un módulo por su nombre."""
        initial_length = len(self.data['execution_sequence'])
        # Filtra la lista para excluir el módulo a eliminar (insensible a mayúsculas/minúsculas)
        self.data['execution_sequence'] = [
            m for m in self.data['execution_sequence']
            if m.get('module_name', '').lower() != module_name.lower()
        ]

        if len(self.data['execution_sequence']) == initial_length:
            raise ValueError(f"El módulo '{module_name}' no fue encontrado.")

        # Re-asigna todos los 'order' para que sean secuenciales (1, 2, 3...)
        self.update_sequence(self.data['execution_sequence'])
        
        # --- Limpieza de UI Settings ---
        settings_changed = False
        
        # 1. Eliminar color
        if 'module_colors' in self.ui_settings and module_name in self.ui_settings['module_colors']:
             del self.ui_settings['module_colors'][module_name]
             settings_changed = True
        
        # 2. Eliminar clasificación de hook
        if 'module_hooks' in self.ui_settings and module_name in self.ui_settings['module_hooks']:
             del self.ui_settings['module_hooks'][module_name]
             settings_changed = True

        # 3. Eliminar estados de vista (colapso)
        if 'view_states' in self.ui_settings:
            for view_name, sections in self.ui_settings['view_states'].items():
                # Identifica las claves que pertenecen al módulo (ej: "ModuleName::features", "ModuleName::setup")
                keys_to_remove = [k for k in sections if k.startswith(f"{module_name}::")]
                for k in keys_to_remove:
                    del sections[k]
                    settings_changed = True
        
        if settings_changed:
            self._save_ui_settings()
            
        return self.get_sequence()

    def toggle_module_activity(self, module_name, active):
        """Activa o desactiva un módulo y reordena la secuencia."""
        target_module = None
        for m in self.data['execution_sequence']:
            if m.get('module_name', '').lower() == module_name.lower():
                target_module = m
                break

        if not target_module:
            raise ValueError(f"El módulo '{module_name}' no fue encontrado.")

        target_module['active'] = active

        # Separar módulos activos e inactivos
        active_modules = [m for m in self.data['execution_sequence'] if m.get('active')]
        inactive_modules = [m for m in self.data['execution_sequence'] if not m.get('active')]

        # Reordenar solo los módulos activos
        active_modules.sort(key=lambda m: m.get('order', 0))
        for index, module in enumerate(active_modules):
            module['order'] = index + 1

        # Asignar -1 a los inactivos
        for module in inactive_modules:
            module['order'] = -1

        self.data['execution_sequence'] = active_modules + inactive_modules
        self._save()
        return self.get_sequence()

    def update_module_color(self, module_name, color):
        """Actualiza el color para un módulo específico."""
        target_module = None
        for m in self.data['execution_sequence']:
            if m.get('module_name', '').lower() == module_name.lower():
                target_module = m
                break

        if not target_module:
            raise ValueError(f"El módulo '{module_name}' no fue encontrado.")

        self.ui_settings.setdefault('module_colors', {})[module_name] = color
        self._save_ui_settings()
        return self.get_sequence()

    def update_view_collapse_state(self, view, section_id, is_collapsed):
        """Actualiza el estado de colapso para una sección específica en una vista específica."""
        self.ui_settings.setdefault('view_states', {})
        self.ui_settings['view_states'].setdefault(view, {})
        
        self.ui_settings['view_states'][view][section_id] = is_collapsed
        
        self._save_ui_settings()
        return {"status": "success", "view": view, "section_id": section_id, "is_collapsed": is_collapsed}

    def toggle_module_is_hook(self, module_name, is_hook):
        """Activa o desactiva la clasificación de hook para un módulo específico."""
        target_module = None
        for m in self.data['execution_sequence']:
            if m.get('module_name', '').lower() == module_name.lower():
                target_module = m
                break

        if not target_module:
            raise ValueError(f"El módulo '{module_name}' no fue encontrado.")

        self.ui_settings.setdefault('module_hooks', {})[module_name] = is_hook
        self._save_ui_settings()
        return self.get_sequence()

    def update_feature_tags(self, module_name, feature_file, feature_dir, tags):
        """Actualiza los tags de ejecución para un feature específico dentro de un módulo."""
        target_module = None
        for m in self.data['execution_sequence']:
            if m.get('module_name', '').lower() == module_name.lower():
                target_module = m
                break
        if not target_module:
            raise ValueError(f"El módulo '{module_name}' no fue encontrado.")

        target_feature = None
        for f in target_module.get('features', []):
            if f['feature_file'] == feature_file and f.get('feature_dir', '') == feature_dir:
                target_feature = f
                break
        if not target_feature:
            raise ValueError(f"El feature '{feature_file}' no fue encontrado en el módulo '{module_name}'.")

        # Acepta una lista de tags o null.
        target_feature['tags'] = tags
        self._save()
        return self.get_sequence()
        
    def update_sequence(self, new_sequence):
        """Reemplaza y guarda toda la secuencia de ejecución."""
        if not isinstance(new_sequence, list):
            raise TypeError("La secuencia debe ser una lista de módulos.")
        
        # Obtiene los nombres de los módulos que vienen en la nueva secuencia (los activos).
        active_module_names = {m['module_name'] for m in new_sequence}

        # Conserva los módulos inactivos que ya existían en memoria.
        inactive_modules = [
            m for m in self.data['execution_sequence'] 
            if not m.get('active') and m['module_name'] not in active_module_names
        ]

        # Re-asigna el orden secuencial solo a los módulos activos, respetando el orden de llegada.
        for i, module in enumerate(new_sequence):
            module['order'] = i + 1
        
        for module in inactive_modules:
            module['order'] = -1

        self.data['execution_sequence'] = new_sequence + inactive_modules
        self._save()
        return self.get_sequence()

    def add_feature_to_module(self, module_name, feature_path, parser_func=None):
        """Añade un feature a un módulo existente."""
        target_module = None
        for m in self.data['execution_sequence']:
            if m.get('module_name', '').lower() == module_name.lower():
                target_module = m
                break

        if not target_module:
            raise ValueError(f"El módulo '{module_name}' no fue encontrado.")

        # Extraer feature_file y feature_dir del path
        path_parts = feature_path.replace('\\', '/').split('/')
        feature_file = path_parts[-1]
        feature_dir = "/".join(path_parts[:-1])

        # Verificar si el feature ya existe en el módulo
        if any(f['feature_file'] == feature_file and f['feature_dir'] == feature_dir for f in target_module.get('features', [])):
            raise ValueError(f"El feature '{feature_file}' ya existe en el módulo '{module_name}'.")

        # Calcular el siguiente 'order' para el nuevo feature
        max_order = 0
        if 'features' in target_module and target_module['features']:
            max_order = max(f.get('order', 0) for f in target_module['features'])

        # Prepara el nuevo feature
        new_feature = {
            "feature_file": feature_file,
            "feature_dir": feature_dir,
            "active": True,
            "order": max_order + 1,
            "tags": None, # Tags seleccionados para ejecución, inicialmente nulos
            "display_tags": [], # Tags para mostrar, inicialmente vacíos
            "scenarios": [] # Escenarios, inicialmente vacíos
        }

        # Si se proporciona una función de parsing, úsala para enriquecer el feature
        if parser_func:
            full_path = os.path.join(self.features_dir, feature_path)
            if os.path.exists(full_path):
                parsed_data = parser_func(full_path)
                new_feature['display_tags'] = parsed_data.get('tags', [])
                new_feature['scenarios'] = parsed_data.get('scenarios', [])

        target_module.setdefault('features', []).append(new_feature)
        self._save()
        return self.get_sequence()

    def delete_feature_from_module(self, module_name, feature_file, feature_dir):
        """Elimina un feature de un módulo específico."""
        target_module = None
        for m in self.data['execution_sequence']:
            if m.get('module_name', '').lower() == module_name.lower():
                target_module = m
                break

        if not target_module:
            raise ValueError(f"El módulo '{module_name}' no fue encontrado.")

        initial_feature_count = len(target_module.get('features', []))
        
        # Filtra la lista de features para excluir el que se va a eliminar.
        target_module['features'] = [
            f for f in target_module.get('features', [])
            if not (f['feature_file'] == feature_file and f.get('feature_dir', '') == feature_dir)
        ]

        if len(target_module['features']) == initial_feature_count:
            raise ValueError(f"El feature '{feature_file}' no fue encontrado en el módulo '{module_name}'.")

        # Re-asigna el orden secuencial a los features restantes.
        target_module['features'].sort(key=lambda f: f.get('order', 0))
        for i, feature in enumerate(target_module['features']):
            feature['order'] = i + 1

        self._save()
        return self.get_sequence()

    def toggle_feature_activity(self, module_name, feature_file, feature_dir, active):
        """Activa o desactiva un feature específico dentro de un módulo."""
        target_module = None
        for m in self.data['execution_sequence']:
            if m.get('module_name', '').lower() == module_name.lower():
                target_module = m
                break
        if not target_module:
            raise ValueError(f"Módulo '{module_name}' no encontrado.")

        target_feature = None
        for f in target_module.get('features', []):
            if f['feature_file'] == feature_file and f.get('feature_dir', '') == feature_dir:
                target_feature = f
                break
        if not target_feature:
            raise ValueError(f"Feature '{os.path.join(feature_dir, feature_file)}' no encontrado en el módulo '{module_name}'.")

        target_feature['active'] = active
        self._save()
        return self.get_sequence()

    def reorder_features_in_module(self, module_name, reordered_features):
        """Reordena los features para un módulo específico."""
        target_module = None
        for m in self.data['execution_sequence']:
            if m.get('module_name', '').lower() == module_name.lower():
                target_module = m
                break

        if not target_module:
            raise ValueError(f"El módulo '{module_name}' no fue encontrado.")

        # Limpieza: Asegurarse de que los campos de solo UI no se guarden.
        for feature in reordered_features:
            feature.pop('display_tags', None)
            feature.pop('scenarios', None)
            feature.pop('color', None)

        # Re-asigna el orden secuencial a la nueva lista de features.
        for i, feature in enumerate(reordered_features):
            feature['order'] = i + 1

        target_module['features'] = reordered_features
        self._save()
        return self.get_sequence()

    def refresh_features_data(self, parser_func):
        """
        Recorre todos los features, los vuelve a analizar desde el disco
        y actualiza sus 'display_tags' y 'scenarios'.
        """
        for module in self.data.get('execution_sequence', []):
            for feature in module.get('features', []):
                relative_path = os.path.join(feature.get('feature_dir', ''), feature.get('feature_file', ''))
                full_path = os.path.join(self.features_dir, relative_path)

                if os.path.exists(full_path):
                    parsed_data = parser_func(full_path)
                    feature['display_tags'] = parsed_data.get('tags', [])
                    feature['scenarios'] = parsed_data.get('scenarios', [])
                else:
                    # Si el archivo no existe, limpia los datos para evitar inconsistencias.
                    print(f"Advertencia: El archivo feature no se encontró, se limpiarán sus datos: {full_path}")
                    feature['display_tags'] = []
                    feature['scenarios'] = []
        
        self._save()
        return self.get_sequence()

    def add_task_to_feature(self, module_name, feature_file, feature_dir, task_config):
        """
        Añade una configuración de tarea a un feature específico.
        task_config: { "name": "nombre_tarea", "scope": "feature|scenario|step", 
                       "hook": "before|after", "scenario_name": "..." }
        """
        target_module = next((m for m in self.data['execution_sequence'] 
                             if m['module_name'].lower() == module_name.lower()), None)
        if not target_module:
            raise ValueError(f"Módulo '{module_name}' no encontrado.")
            
        target_feature = next((f for f in target_module.get('features', []) 
                              if f['feature_file'] == feature_file and f.get('feature_dir', '') == feature_dir), None)
        if not target_feature:
            raise ValueError(f"Feature '{feature_file}' no encontrado en el módulo '{module_name}'.")

        if 'ui_tasks' not in target_feature:
            target_feature['ui_tasks'] = []
            
        target_feature['ui_tasks'].append(task_config)
        self._save()
        return self.get_sequence()

    def update_task_in_feature(self, module_name, feature_file, feature_dir, task_index, new_task_config):
        """Actualiza una tarea existente en un feature por su índice."""
        target_module = next((m for m in self.data['execution_sequence'] 
                             if m['module_name'].lower() == module_name.lower()), None)
        if not target_module:
            raise ValueError(f"Módulo '{module_name}' no encontrado.")
            
        target_feature = next((f for f in target_module.get('features', []) 
                              if f['feature_file'] == feature_file and f.get('feature_dir', '') == feature_dir), None)
        if not target_feature or 'ui_tasks' not in target_feature:
             raise ValueError("Feature o tareas no encontradas.")

        if 0 <= task_index < len(target_feature['ui_tasks']):
            target_feature['ui_tasks'][task_index] = new_task_config
            self._save()
        else:
            raise ValueError("Índice de tarea fuera de rango.")
            
        return self.get_sequence()

    def delete_task_from_feature(self, module_name, feature_file, feature_dir, task_index):
        """Elimina una tarea de un feature por su índice."""
        target_module = next((m for m in self.data['execution_sequence'] 
                             if m['module_name'].lower() == module_name.lower()), None)
        if not target_module:
            raise ValueError(f"Módulo '{module_name}' no encontrado.")
            
        target_feature = next((f for f in target_module.get('features', []) 
                              if f['feature_file'] == feature_file and f.get('feature_dir', '') == feature_dir), None)
        if not target_feature or 'ui_tasks' not in target_feature:
             raise ValueError("Feature o tareas no encontradas.")

        if 0 <= task_index < len(target_feature['ui_tasks']):
            target_feature['ui_tasks'].pop(task_index)
            self._save()
        else:
            raise ValueError("Índice de tarea fuera de rango.")
            
        return self.get_sequence()