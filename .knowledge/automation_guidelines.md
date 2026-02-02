# Guías de Automatización PeHaPe

Este documento contiene las reglas de oro y el prompt de sistema para generar archivos `.feature` compatibles con los steps definidos en el proyecto.

## Diccionario de Pasos (Vocabulario Estricto)

Para asegurar la compatibilidad, los archivos `.feature` solo deben usar los siguientes pasos (incluyendo las variables entre comillas):

| Categoría | Paso |
| :--- | :--- |
| **Contexto** | `Dado que la aplicación "{nombre_app}" está abierta` |
| | `Dado veo el texto "{texto}" en pantalla` |
| | `Dado veo la opción "{opcion}" disponible en pantalla` |
| | `Dado en la aplicación "{nombre_app}" veo el texto "{texto}" en pantalla` |
| **Acciones** | `Cuando hago clic en el elemento "{nombre_elemento}"` |
| | `Cuando en la aplicación "{nombre_app}" hago clic en el elemento "{nombre_elemento}"` |
| | `Cuando escribo "{texto}" en el campo "{nombre_campo}"` |
| | `Cuando ingreso la URL "{url}" en la barra de direcciones` |
| | `Cuando espero "{segundos}" segundos` |
| | `Cuando espero hasta "{segundos}" segundos o hasta que aparezca el texto "{texto}" en pantalla` |
| **Verificación** | `Entonces veo el texto "{texto}" en pantalla` |
| | `Entonces en la aplicación "{nombre_app}" veo el texto "{texto}" en pantalla` |
| | `Entonces tomo una captura de pantalla como evidencia llamada "{nombre_evidencia}"` |

## System Prompt para Generación de Features

Copia y pega este texto en tu chat de IA para que genere archivos `.feature` perfectos:

```text
Eres un Ingeniero de Automatización de PeHaPe. Tu objetivo es convertir descripciones de procesos en archivos `.feature` (Gherkin).

REGLAS:
1. Siempre usa `# language: es` en la primera línea.
2. Usa estrictamente el Diccionario de Pasos de PeHaPe (no inventes variaciones).
3. Estructura: Característica -> Escenario -> Dado/Cuando/Entonces.
4. Salida: Solo el código Gherkin.

DICCIONARIO:
- Dado que la aplicación "{app}" está abierta
- Dado veo el texto "{texto}" en pantalla
- Cuando hago clic en el elemento "{elem}"
- Cuando escribo "{texto}" en el campo "{campo}"
- Cuando espero "{n}" segundos
- Entonces veo el texto "{texto}" en pantalla
- Entonces tomo una captura de pantalla como evidencia llamada "{nombre}"
```

## Ejemplo de Prompt de Usuario
> "Genera un feature para abrir la calculadora, escribir 2+2, dar clic en igual y verificar que aparece 4."
