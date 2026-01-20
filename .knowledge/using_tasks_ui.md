# Gestión y Visualización de Tareas en la Interfaz Gráfica

Esta guía describe cómo utilizar la nueva sección "Tasks" de la interfaz web para explorar y entender las tareas (hooks) disponibles en el sistema de pruebas automatizadas.

## 1. Acceso a la Documentación de Tareas

Para acceder a la documentación de tareas:
1.  Abra la aplicación web del framework.
2.  En la barra lateral izquierda (Sidebar), busque el icono de **Asignación** (📋 o similar).
3.  Haga clic en él para navegar a la página **"Documentación de Tareas"**.

## 2. Información Visualizada

La página muestra una lista de todas las tareas registradas en el sistema, agrupadas por **Módulo** (el archivo Python donde están definidas).

Para cada tarea, se muestra una tarjeta con la siguiente información:

*   **Tag de Gherkin**: El nombre del tag que debe usar en sus archivos `.feature` para invocar la tarea (ej. `@task_limpiar_log`). Aparece resaltado en azul.
*   **Scope (Alcance)**: Una etiqueta que indica cuándo se ejecuta la tarea:
    *   **After Step** (Naranja): Se ejecuta después de cada paso.
    *   **Before Scenario** (Violeta): Se ejecuta antes de comenzar el escenario.
    *   *Nota*: Este color ayuda a identificar rápidamente el impacto de la tarea.
*   **Nombre de la Clase**: El nombre técnico de la clase Python que implementa la lógica (ej. `CleanupLogTask`).
*   **Documentación**: La descripción detallada de lo que hace la tarea. Esta información se extrae directamente del *docstring* del código.

## 3. Para Desarrolladores: Cómo documentar una nueva tarea

Para que su nueva tarea aparezca correctamente en esta interfaz, debe seguir estas convenciones al crear su clase en Python:

1.  **Registro**: Asegúrese de usar el decorador `@register_task("nombre_tag")`.
2.  **Docstring**: Escriba un comentario multilínea (docstring) `""" ... """` justo debajo de la definición de la clase. Este texto es el que se mostrará en la interfaz web.
3.  **Atributo Scope**: Defina un atributo de clase `scope` con una descripción corta de cuándo se ejecuta.

### Ejemplo de Código

```python
@register_task("mi_nueva_tarea")
class MiNuevaTarea(BaseTask):
    """
    Esta descripción aparecerá en la web.
    Explique aquí qué hace la tarea, qué parámetros usa, etc.
    """
    scope = "Before Scenario"  # Esto aparecerá en el badge violeta

    def should_run(self, hook_type, step) -> bool:
        return hook_type == 'before'

    def execute(self, context, step, **kwargs):
        pass
```

### Actualización

La interfaz web lee la información dinámicamente desde el backend. Si modifica el código de una tarea, es posible que necesite reiniciar el servidor backend para que los cambios se reflejen en la documentación web.
