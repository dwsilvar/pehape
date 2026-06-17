# Frontend Application

Este directorio contiene la aplicación frontend desarrollada con React y Vite.

> Para la **documentación completa, instalación y dependencias**, por favor consulta el [README principal](../README.md#frontend-ui).

## Configuración ⚙️

El puerto de desarrollo y la conexión con el backend se cargan desde el archivo compartido `config/network_config.json`:

```json
{
  "backend_host": "0.0.0.0",
  "backend_port": 5001,
  "frontend_port": 3000
}
```

- **frontend_port**: Puerto donde se ejecutará la interfaz web de desarrollo (usando Vite).
- **backend_port** y **backend_host**: Puerto y host del servidor Backend (para redirigir las llamadas del proxy de API).


## Ejecución

Si ya has instalado las dependencias (ver README raíz), puedes iniciar el servidor de desarrollo con:

```bash
cd frontend
npm run dev
```

La aplicación estará disponible en `http://localhost:3000` (o el puerto que asigne Vite).
