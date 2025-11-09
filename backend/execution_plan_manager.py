import os
import json

class ExecutionPlanManager:
    def __init__(self, features_dir):
        self.run_list_path = os.path.join(features_dir, 'run_list.json')
        self.data = self._load()

    def _load(self):
        """Carga el plan de ejecución desde el archivo JSON."""
        try:
            if not os.path.exists(self.run_list_path):
                return {"execution_sequence": []}
            with open(self.run_list_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return {"execution_sequence": []}

    def _save(self):
        """Guarda la estructura de datos actual en el archivo JSON."""
        # Re-ordena la secuencia principal por la propiedad 'order' antes de guardar
        self.data['execution_sequence'].sort(key=lambda m: m.get('order', 0))
        with open(self.run_list_path, 'w', encoding='utf-8') as f:
            json.dump(self.data, f, indent=2)

    def get_sequence(self):
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
            if 'features' in module:
                module['features'].sort(key=lambda f: f.get('order', 0))
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

    def update_sequence(self, new_sequence):
        """Reemplaza y guarda toda la secuencia de ejecución."""
        if not isinstance(new_sequence, list):
            raise TypeError("La secuencia debe ser una lista de módulos.")
        
        # Separa la nueva secuencia en módulos activos e inactivos.
        active_modules = [
            m for m in new_sequence if m.get('active')
        ]
        inactive_modules = [
            m for m in new_sequence if not m.get('active')
        ]
        # Re-asigna el orden secuencial solo a los módulos activos, respetando el orden de llegada.
        for i, module in enumerate(active_modules):
            if module.get('active'):
                module['order'] = i + 1
        
        for module in inactive_modules:
            module['order'] = -1

        self.data['execution_sequence'] = active_modules + inactive_modules
        self._save()
        return self.get_sequence()