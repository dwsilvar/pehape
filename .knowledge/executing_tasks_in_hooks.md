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
4.  Implemente la lógica en `execute`.
5.  (Opcional) Sobrescriba `should_run` para controlar cuándo se ejecuta.

**Ejemplo:**

```python
# executor/tasks/db_tasks.py
from executor.tasks_core.registry import register_task
from executor.tasks_core.base_task import BaseTask

@register_task("setup_db")
class SetupDBTask(BaseTask):
    def should_run(self, hook_type, step) -> bool:
        # Solo correr al inicio del escenario
        return hook_type == 'before_scenario'

    def execute(self, context, step, **kwargs):
        # Lógica para insertar datos de prueba
        pass
```

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
