# Frontend Application

Este directorio contiene la aplicación frontend desarrollada con React y Vite.

> Para la **documentación completa, instalación y dependencias**, por favor consulta el [README principal](../README.md#frontend-ui).

## Configuración ⚙️

El puerto de desarrollo y la conexión con el backend se pueden configurar en el archivo `app_config.json`.

```json
{
  "port": 3000,
  "api_url": "http://localhost:5001"
}
```

- **port**: Puerto donde se ejecutará la interfaz web.
- **api_url**: URL del servidor Backend (para el proxy de API).


## Ejecución

Si ya has instalado las dependencias (ver README raíz), puedes iniciar el servidor de desarrollo con:

```bash
cd frontend
npm run dev
```

La aplicación estará disponible en `http://localhost:3000` (o el puerto que asigne Vite).
