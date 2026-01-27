# Sistema de Tareas (Hooks)

El sistema de tareas permite automatizar acciones específicas durante el ciclo de vida de las pruebas (antes/después de escenarios o pasos) mediante el uso de **tags** en los archivos `.feature`.

## Documentación de la Funcionalidad

Esta sección está dividida en dos guías principales:

1.  **[Ejecución de Tareas en Hooks](file:///c:/Proyectos/ocr_test/pehape/.knowledge/features/tasks/execution.md)**: Guía técnica para desarrolladores sobre cómo implementar y registrar nuevas tareas, y cómo se ejecutan en los hooks de Behave.
2.  **[Gestión de Tareas en la UI](file:///c:/Proyectos/ocr_test/pehape/.knowledge/features/tasks/ui_management.md)**: Guía para usuarios sobre cómo visualizar y entender las tareas disponibles desde la interfaz web del framework.

## Conceptos Clave

-   **Tags**: Los escenarios activan tareas mediante tags con el prefijo `@task_`.
-   **Scopes**: Las tareas pueden ejecutarse en diferentes momentos (Before Scenario, After Step, etc.).
-   **Registro Automático**: Gracias al decorador `@register_task`, las tareas se autodescubren y se muestran en la UI automáticamente.

## Referencia Rápida de Convenciones
- `@task_setup_...`: Preparación de datos.
- `@task_clean_...`: Limpieza post-prueba.
- `@task_check_...`: Verificaciones adicionales.
