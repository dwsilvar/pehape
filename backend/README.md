# Backend Server

Este directorio contiene el servidor backend de la aplicación, desarrollado con Flask.

> [!NOTE]
> Para la **documentación completa, instalación y dependencias**, por favor consulta el [README principal](../README.md#backend-api).

## Descripción

El servidor se encarga de interactuar con el sistema de archivos para leer y escribir los archivos `.feature` que utiliza la aplicación de frontend, así como de gestionar los planes de ejecución.

## Ejecución Rápida

Si ya has instalado las dependencias (ver README raíz), puedes iniciar el servidor con:

```bash
# Desde la raíz del proyecto
./start-backend.ps1

# O directamente con Python
python backend/backend_server.py
```

El servidor escucha en `http://localhost:5000`.