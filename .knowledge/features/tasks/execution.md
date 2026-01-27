# Ejecución de Tareas en Hooks

Esta característica permite ejecutar lógica específica (tareas) automáticamente durante el ciclo de vida de las pruebas (hooks de Behave), controlada mediante **tags** en los escenarios de Gherkin.

## Objetivo
Permitir que los desarrolladores y QAs inyecten comportamientos adicionales (Setup, Teardown, Verificaciones, Mocks) en los hooks `before_scenario`, `after_scenario`, `before_step` y `after_step` de manera modular y mantenible.

## Arquitectura Modular (Registro de Tareas)

A diferencia de la versión anterior monolítica, ahora cada tarea es una clase independiente que se registra automáticamente.

### Estructura
- **`executor/tasks_core/registry.py`**: Maneja el registro de tareas.
- **`executor/tasks_core/base_task.py`**: Clase base para crear nuevas tareas.
- **`executor/tasks/`**: Directorio donde residen las implementaciones de las tareas.

## Cómo agregar una Nueva Tarea

1.  Cree un nuevo archivo python en `executor/tasks/`.
2.  Defina una clase que herede de `BaseTask`.
3.  Decore la clase con `@register_task("nombre_tarea")`.
4.  **Importante:** Añada un **Docstring** descriptivo (se mostrará en la documentación web).
5.  **Importante:** Defina el atributo de clase `scope` (ej. "Before Scenario", "After Step") para categorizarla en la UI.
6.  Implemente la lógica en `execute`.
7.  (Opcional) Sobrescriba `should_run` para controlar cuándo se ejecuta.

**Ejemplo:**

```python
# executor/tasks/db_tasks.py
from executor.tasks_core.registry import register_task
from executor.tasks_core.base_task import BaseTask

@register_task("setup_db")
class SetupDBTask(BaseTask):
    """
    Inicializa la base de datos con datos de prueba básicos.
    Requiere que el entorno esté levantado.
    """
    scope = "Before Scenario"

    def should_run(self, hook_type, step) -> bool:
        # Solo correr al inicio del escenario
        return hook_type == 'before_scenario'

    def execute(self, context, step, **kwargs):
        # Lógica para insertar datos de prueba
        pass
```

## Parámetros Configurables en Tareas

Las tareas pueden aceptar parámetros configurables que se definen en la interfaz gráfica. Esto permite reutilizar la misma tarea con diferentes valores sin necesidad de crear múltiples clases.

### Cómo Agregar Parámetros

1. Implemente el método de clase `get_args_schema()` que retorna una lista de diccionarios.
2. Cada diccionario define un parámetro con:
   - `name`: Nombre del parámetro (usado en kwargs)
   - `label`: Etiqueta mostrada en la UI
   - `type`: Tipo de input (`text`, `number`, etc.)
   - `default`: Valor por defecto

3. En el método `execute()`, acceda a los parámetros desde `kwargs`.

**Ejemplo con Parámetros:**

```python
# executor/tasks/log_tasks.py
from executor.tasks_core.registry import register_task
from executor.tasks_core.base_task import BaseTask
import os
import logging

logger = logging.getLogger(__name__)

@register_task("limpiar_log")
class CleanupLogTask(BaseTask):
    """
    Elimina un archivo log antes de la generación.
    Permite configurar la ruta del archivo a eliminar.
    """
    scope = "Before Scenario / Before Step"

    @classmethod
    def get_args_schema(cls) -> list:
        return [
            {
                "name": "log_file_path",
                "label": "Ruta del Archivo Log",
                "type": "text",
                "default": "C:\\temp\\activity.log"
            }
        ]

    def execute(self, context, step, **kwargs):
        log_file_path = kwargs.get('log_file_path', "C:\\temp\\activity.log")
        
        logger.info(f"Intentando eliminar log en '{log_file_path}'...")
        
        if os.path.exists(log_file_path):
            os.remove(log_file_path)
            logger.info(f"Archivo '{log_file_path}' eliminado exitosamente.")
        else:
            logger.info(f"Archivo '{log_file_path}' no existe, nada que eliminar.")

    def should_run(self, hook_type, step) -> bool:
        return hook_type == 'before' and "Generar Reporte" in step.name
```

### Configuración en la UI

Cuando se agrega una tarea con parámetros configurables:
1. La UI mostrará automáticamente campos de entrada basados en `get_args_schema()`
2. El usuario puede modificar los valores por defecto
3. Los valores se guardan en el archivo `execution_order.json`
4. Durante la ejecución, los valores se pasan a `execute()` vía `kwargs`

## Guía de Clasificación y Nombres (Best Practices)

Para mantener el orden y que los tags sean auto-explicativos, recomendamos la siguiente convención de nombres basada en el ámbito de ejecución:

| Ámbito (Scope) | Tag Recomendado | Hook Principal | Propósito | Ejemplo |
| :--- | :--- | :--- | :--- | :--- |
| **Setup** | `@task_setup_...` | `before_scenario` | Preparar datos, usuarios o estado inicial. | `@task_setup_crear_usuario` |
| **Mock** | `@task_mock_...` | `before_scenario` | Configurar mocks de servicios externos. | `@task_mock_pasarela` |
| **Check** | `@task_check_...` | `after_step` | Verificaciones granulares post-paso. | `@task_check_no_errores` |
| **Clean** | `@task_clean_...` | `after_scenario` | Limpieza de archivos o datos temporales. | `@task_clean_archivos` |
| **Action** | `@task_do_...` | `before_step` | Acciones puntuales antes de un paso específico. | `@task_do_borrar_cache` |

### Integración en Gherkin

```gherkin
@task_setup_crear_usuario @task_clean_archivos
Escenario: Proceso de compra completo
  Dado que el usuario existe
  ...
```

## Hooks Soportados
El `TaskExecutor` está conectado a:
-   `before_scenario` (step es None)
-   `before_step`
-   `after_step`
-   `after_scenario` (step es None)

Asegúrese de manejar el caso donde `step` es `None` si su tarea corre en hooks de escenario pero también intenta acceder a información del paso.
