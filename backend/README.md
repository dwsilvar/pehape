# Backend Server

Este directorio contiene el servidor backend de la aplicación, desarrollado con Flask.

El servidor se encarga de interactuar con el sistema de archivos para leer y escribir los archivos `.feature` que utiliza la aplicación de frontend.

## Instalación

Para instalar las dependencias necesarias, se recomienda crear un entorno virtual y luego instalar los paquetes listados en `requirements.txt`.

1.  **Crear un entorno virtual (opcional pero recomendado):**
    ```bash
    python -m venv venv
    ```

2.  **Activar el entorno virtual:**
    -   En Windows:
        ```bash
        .\venv\Scripts\activate
        ```

3.  **Instalar las dependencias:**
    ```bash
    python -m pip install -r requirements.txt
    ```

## Ejecución

Para iniciar el servidor, ejecuta el script `start-backend.ps1` desde la raíz del proyecto, o directamente el servidor de Python desde este directorio:

```bash
python backend_server.py
```

El servidor se ejecutará en `http://localhost:5000`.