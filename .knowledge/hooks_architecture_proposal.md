# Propuesta de Arquitectura Modular para Tareas en Hooks

Actualmente, la solución depende de una clase monolítica `FileTasks` que contiene tanto la lógica de mapeo (hardcodeada) como la implementación de las tareas. Esto dificulta la escalabilidad y diversificación.

## Problemas Detectados
1.  **Acoplamiento Fuerte**: El mapeo de tags a métodos está "quemado" en el código (`task_map`).
2.  **Dificultad de Extensión**: Agregar una nueva tarea requiere modificar la clase existente.
3.  **Responsabilidad Única Violada**: La clase mezcla la lógica de orquestación (leer tags, verificar hooks) con la lógica de negocio (borrar archivos).

## Solución Propuesta: Sistema de Tareas Basado en Registro

Recomendamos refactorizar hacia un sistema donde las tareas se autodefinen y registran, desacopladas del ejecutor.

### 1. Estructura de Clases

#### `TaskRegistry`
Un singleton o módulo encargado de almacenar las tareas disponibles.

#### `BaseTask` (Abstracta)
Define la interfaz que todas las tareas deben cumplir.

### 2. Implementación Técnica

```python
# executor/tasks_core/registry.py
_TASKS = {}

def register_task(task_name):
    """Decorador para registrar tareas automáticamente."""
    def decorator(cls):
        _TASKS[task_name] = cls
        return cls
    return decorator

def get_task(task_name):
    return _TASKS.get(task_name)
```

```python
# executor/tasks_core/base_task.py
from abc import ABC, abstractmethod

class BaseTask(ABC):
    @abstractmethod
    def execute(self, context, step, **kwargs):
        pass
        
    def should_run(self, hook_type, step) -> bool:
        """Lógica por defecto, puede ser sobreescrita."""
        return True
```

### 3. Ejemplo de Implementación de una Tarea

Las tareas ahora son clases independientes. Esto permite inyección de dependencias y estado propio si es necesario.

```python
# executor/tasks/log_tasks.py
from executor.tasks_core.registry import register_task
from executor.tasks_core.base_task import BaseTask
import os

@register_task("limpiar_log")
class CleanupLogTask(BaseTask):
    def should_run(self, hook_type, step):
        # Solo correr en 'before' step y si el paso es relevante
        return hook_type == 'before' and "Generar Reporte" in step.name

    def execute(self, context, step, **kwargs):
        log_file = kwargs.get('path', "C:\\temp\\activity.log")
        if os.path.exists(log_file):
            os.remove(log_file)
```

### 4. Orquestador Central (`TaskExecutor`)

En `environment.py`, en lugar de llamar a `FileTasks`, se llama a un orquestador genérico.

```python
# executor/task_executor.py
from executor.tasks_core.registry import get_task

class TaskExecutor:
    def run_tasks(self, context, step, hook_type):
        for tag in context.tags:
            if tag.startswith("task_"):
                task_name = tag.split("task_", 1)[1]
                task_class = get_task(task_name)
                
                if task_class:
                    task_instance = task_class()
                    if task_instance.should_run(hook_type, step):
                        task_instance.execute(context, step)
                else:
                    # Manejo de error o warning si la tarea no existe
                    pass
```

## Casos de Uso Recomendados

Con esta nueva arquitectura, se pueden diversificar las tareas en:

1.  **Database Seeding (`@task_seed_users`)**:
    -   Insertar usuarios de prueba en la DB antes de un escenario.
    -   Limpiar datos creados después del escenario.

2.  **API Mocking (`@task_mock_payment_gateway`)**:
    -   Levantar un servidor mock o configurar interceptores de red antes de pruebas de pago.

3.  **State Verification (`@task_check_audit_logs`)**:
    -   Verificar tablas de auditoría o logs del sistema después de pasos críticos.

4.  **feature Toggling (`@task_enable_beta_feature`)**:
    -   Activar flags de features en la configuración de la app antes de correr tests experimentales.

## Siguientes Pasos
1.  Crear el paquete `executor/tasks_core`.
2.  Mover `FileTasks` al nuevo formato en `executor/tasks/file_tasks.py`.
3.  Actualizar `environment.py` para usar `TaskExecutor`.
4.  Implementar mecanismo de auto-discovery (importar todos los módulos en `executor/tasks/` al iniciar).
