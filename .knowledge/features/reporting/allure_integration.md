# Documentación de Integración con Allure Report

Este documento detalla la integración de Allure Report en el proyecto para la generación de reportes de ejecución de pruebas automatizadas con Behave.

## 1. Documentación Funcional

### Descripción General
El sistema genera automáticamente un reporte detallado y visualmente atractivo al finalizar la ejecución de las pruebas automatizadas. Este reporte permite a los usuarios (QAs, desarrolladores, stakeholders) analizar los resultados de las pruebas, ver pasos detallados, y visualizar evidencias como capturas de pantalla.

### Características Principales
- **Reporte Automático**: Se genera automáticamente al finalizar una ejecución de pruebas (siempre que haya resultados).
- **Evidencia Visual**: Se adjuntan capturas de pantalla automáticamente cuando falla un paso o después de pasos específicos, facilitando la depuración.
- **Historial y Tendencias**: Permite visualizar la evolución de las pruebas (aunque esto depende de la persistencia del historial, actualmente se limpia en cada ejecución con `--clean`).
- **Acceso Web**: El reporte es accesible directamente desde la interfaz web de la aplicación de gestión de pruebas.
- **Evidencias Técnicas (GIF/Video)**: Además del reporte Allure, el sistema genera automáticamente animaciones y videos de la ejecución para facilitar la reproducción visual de los pasos.

### Flujo de Uso
1.  **Ejecutar Pruebas**: El usuario inicia las pruebas desde el frontend.
2.  **Monitoreo**: Durante la ejecución, se pueden ver logs en tiempo real.
3.  **Finalización**: Al terminar, el sistema procesa los resultados.
4.  **Visualización**: El frontend recibe una notificación con la URL del reporte (`/api/report/index.html`) y puede mostrarlo o redirigir al usuario.

---

## 2. Documentación Técnica

### Arquitectura de la Integración

La integración se compone de varios módulos que interactúan para capturar, procesar y servir el reporte.

#### A. Captura de Datos (Behave Hooks)
-   **Archivo**: `features/environment.py`
-   **Mecanismo**: Se utilizan los hooks de Behave (`after_step`, `before_scenario`, etc.) para interactuar con Allure.
-   **Evidencias**:
    -   En `after_step`, se captura una captura de pantalla usando `executor.driver.capture_evidence_screenshot()`.
    -   Esta imagen se adjunta al reporte Allure usando `allure.attach(...)`.

#### B. Motor de Reportes (Python Wrapper)
-   **Archivo**: `behave_runner/report_allure.py`
-   **Clase**: `ReportAllure`
-   **Métodos**:
    -   `generate_report(allure_results_dir, allure_report_dir)`: Ejecuta el comando de sistema `allure generate`.
        -   Argumentos:
            -   `allure_results_dir`: Directorio con los JSONs crudos de resultados (ej. `reports/allure_results`).
            -   `allure_report_dir`: Directorio destino para el sitio estático (ej. `reports/allure-report`).
            -   Flag `--clean`: Limpia el directorio de reporte previo.
    -   `run_report_server(...)`: (Opcional/Dev) Ejecuta `allure serve` para levantar un servidor temporal.

#### C. Orquestador de Ejecución
-   **Archivo**: `behave_master.py`
-   **Flujo**:
    1.  Ejecuta las pruebas con `BehaveRunner`.
    2.  Verifica si existen resultados en `reports/allure_results`.
    3.  Instancia `ReportAllure` y llama a `generate_report`.

#### D. Servidor Web (Backend)
-   **Archivo**: `backend/backend_server.py`
-   **Endpoint**: `/api/report/<path:path>`
-   **Función**: `serve_allure_report(path)`
-   **Implementación**:
    -   Utiliza `flask.send_from_directory` para servir los archivos estáticos generados en `reports/allure-report`.
    -   Esto permite que el frontend consuma el reporte como si fuera parte de la aplicación web, sin necesitar un servidor de Allure separado ejecutándose constantemente.

### Requisitos del Sistema
-   **Herramienta CLI**: `allure` debe estar instalado en el sistema operativo y accesible en el `PATH` global.
    -   Verificación: Ejecutar `allure --version` en la terminal.
-   **Python Packages**: `allure-behave` debe estar instalado en el entorno virtual (listado en `requirements.txt` implícitamente o como dependencia).

### Comandos Clave Internos
El sistema ejecuta internamente comandos similares a:
```bash
# Generación del reporte estático
allure generate reports/allure_results -o reports/allure-report --clean
```

### Estructura de Directorios
```
pehape/
├── reports/
│   ├── allure_results/    # Archivos JSON/XML crudos generados durante la prueba
│   └── allure-report/     # Sitio web estático generado (HTML, JS, CSS)
├── behave_runner/
│   └── report_allure.py   # Lógica de generación
└── feature/
    └── environment.py     # Hooks para adjuntar evidencias
```

---

## 3. Mantenimiento del Sistema (MaintenancePage)

### Descripción Funcional
Para gestionar el ciclo de vida de los reportes y optimizar el espacio en disco, se ha implementado un módulo de mantenimiento accesible desde la navegación principal (`System Maintenance`).

**Funcionalidades:**
- **Monitoreo de Espacio**: Visualización en tiempo real del tamaño ocupado por las distintas evidencias.
- **Limpieza Selectiva**: Controles para eliminar de forma independiente:
  - **Allure Raw Results**: Archivos JSON/XML brutos (`reports/allure_results`).
  - **Generated Report**: Sitio web estático generado (`reports/allure-report`).
  - **Screenshots**: Imágenes capturadas durante las pruebas (`reports/screenshots`).
- **Limpieza Total**: Botón "Clean All" para eliminar todos los artefactos de prueba de una sola vez.

### Documentación Técnica de Mantenimiento

#### Frontend (`MaintenancePage.tsx`)
- **Ruta**: `/maintenance`
- **Diseño**: Utiliza un layout responsivo basado en CSS Grid (`display: grid`) dentro de un `Box` de MUI, adaptándose a diferentes tamaños de pantalla (1 columna en móvil, hasta 4 columnas en desktop grande).
- **Interacción**: Solicita confirmación antes de cualquier acción destructiva mediante un `Dialog` modal.

#### Backend API (`backend_server.py`)

1.  **Obtener Uso de Disco**
    -   **Endpoint**: `GET /api/reports/usage`
    -   **Respuesta**:
        ```json
        {
          "results_size": 1024,
          "report_size": 2048,
          "screenshots_size": 512,
          "total_size": 3584
        }
        ```

2.  **Limpiar Directorios**
    -   **Endpoint**: `POST /api/reports/clean`
    -   **Payload**: `{ "target": "tipo" }`
    -   **Targets Soportados**:
        -   `results`: Borra `reports/allure_results`.
        -   `report`: Borra `reports/allure-report`.
        -   `screenshots`: Borra `reports/screenshots`.
        -   `all`: Borra los tres directorios anteriores.
    -   **Lógica**: Utiliza `shutil.rmtree` para eliminar y vuelve a crear la carpeta vacía inmediatamente para evitar errores en futuras ejecuciones.
### 4. Evidencias Técnicas: GIFs y Videos de Ejecución

Además de las capturas integradas en Allure, el framework genera archivos multimedia independientes para cada escenario.

#### Generación de Artefactos
1. **Captura por Paso**: Durante la ejecución, se guarda una imagen PNG por cada paso en un directorio temporal (`reports/temp_gif/<execution_id>`).
2. **Generación de GIF**: Se concatenan las imágenes de los pasos con una duración lógica de 1 segundo por paso.
3. **Generación de Video (MP4)**:
   - Se procesan las imágenes PNG usando OpenCV (cv2).
   - **Calidad y Fluidez**: El video se genera a **10 FPS**. Cada imagen de paso se repite internamente para mantener la duración de 1 segundo, lo que permite una visualización fluida y compatible con reproductores estándar.
   - **Compatibilidad**: Se utiliza una lógica de selección de codecs (`mp4v` o `avc1`) para asegurar que el video sea reproducible sin necesidad de software adicional.

#### Acceso y Descarga
Desde la pantalla de **Execution Order**, el usuario puede:
- **Descargar GIF**: Obtener una animación cíclica del escenario (ideal para compartir rápido).
- **Descargar Video**: Obtener un archivo MP4 de alta compatibilidad (ideal para documentación técnica y evidencias legales).

*Nota: Estas evidencias se sirven mediante los endpoints `/api/execution/<id>/gif` y `/api/execution/<id>/video`.*
