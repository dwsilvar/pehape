# Fallback de Imágenes para OCR (Asociación Texto-Imagen)

Esta funcionalidad permite que el sistema de automatización continúe funcionando incluso cuando el motor OCR (Tesseract) falla al identificar un texto específico en la pantalla. Funciona asociando una imagen de referencia (".png") al texto que se busca.

## ¿Cómo funciona?

El mecanismo está implementado en el `OCRDriver` y funciona en dos pasos:

1.  **Intento Principal (OCR)**: El driver intenta localizar el texto usando Tesseract OCR en la pantalla actual.
2.  **Fallback (Imagen)**: Si el OCR no encuentra el texto (retorna `None`), el driver busca automáticamente una imagen asociada en el disco. Si encuentra la imagen en la pantalla, interactúa con sus coordenadas como si hubiera encontrado el texto.

## Estructura de Directorios

El sistema busca las imágenes de fallback siguiendo una estructura estricta basada en el archivo `.feature` y los tags del escenario.

La ruta base es: `resources/images/`

La estructura completa generada es:
```
resources/images/<ruta_relativa_feature>/<nombre_feature>/<tag>/<texto_buscado>.png
```

### Ejemplo Práctico

Supongamos que tenemos el siguiente archivo `.feature` en `features/ventas/checkout.feature`:

```gherkin
Feature: Checkout de Venta

  @pago_con_tarjeta
  Scenario: Realizar pago con tarjeta de crédito
    Given I am on the checkout page
    When I click on "Confirmar Pago"
    Then the payment should be processed
```

Si el sistema falla al encontrar el texto "Confirmar Pago" mediante OCR en el paso `When`, buscará una imagen de respaldo en la siguiente ruta exacta:

`resources/images/ventas/checkout/pago_con_tarjeta/Confirmar Pago.png`

**Desglose de la ruta:**
1.  `resources/images/`: Raíz de imágenes.
2.  `ventas/checkout`: Ruta relativa del archivo feature (sin extensión).
3.  `pago_con_tarjeta`: El primer tag del escenario (limpio de `@`).
4.  `Confirmar Pago.png`: El texto buscado + extensión `.png`.

## Cómo usar esta funcionalidad

### 1. Identificar el fallo de OCR
Si una prueba falla porque "No se encontró el texto 'X'", es candidato para usar esta funcionalidad.

### 2. Capturar la imagen
Tome una captura de pantalla (recorte) pequeña y precisa del elemento (botón, etiqueta) que contiene el texto.

### 3. Guardar la imagen (Automático vía API/UI)
El sistema cuenta con un endpoint `/api/images/upload` que permite subir la imagen desde la interfaz si está implementada. Este endpoint utiliza la utilidad `get_image_path_from_feature_and_tag` para guardar el archivo automáticamente en la ruta correcta.

### 4. Guardar la imagen (Manual)
Si lo hace manualmente:
1.  Navegue a `resources/images`.
2.  Replique la estructura de carpetas de su feature.
3.  Cree una carpeta con el nombre del tag (sin @).
4.  Guarde la imagen con el nombre exacto del texto buscado (`.png`).


## Fallback Genérico

Adicionalmente, el driver soporta un fallback genérico. Si no encuentra la imagen específica del escenario, buscará en:
`resources/images/features/generic/<texto_buscado>.png`

Esto es útil para botones comunes como "Aceptar", "Cancelar", etc. que son iguales en toda la aplicación.

## Comportamiento de Coincidencia de Texto OCR

El motor OCR utiliza **coincidencia exacta de frases** con normalización de caracteres para evitar falsos positivos.

### Estrategias de Búsqueda

El OCR intenta dos estrategias en orden:

1. **Coincidencia de Palabra Exacta**: Busca una palabra individual que coincida exactamente con el texto buscado.
2. **Coincidencia de Frase Exacta**: Une palabras detectadas por OCR y busca la frase completa usando límites de palabra (`\b`).

### Normalización de Caracteres

OCR a menudo detecta caracteres especiales como espacios o los omite. El sistema normaliza automáticamente:

- Guiones (`-`) → Espacios
- Guiones bajos (`_`) → Espacios
- Puntos (`.`) → Espacios
- Barras (`/`) → Espacios
- Múltiples espacios → Un solo espacio
- Mayúsculas → Minúsculas (case-insensitive)

**Ejemplos**:
- Buscar `"boton-card"` → Encuentra `"boton card"` en pantalla ✅
- Buscar `"Usuario_Admin"` → Encuentra `"usuario admin"` ✅
- Buscar `"awesome-copilot"` → Encuentra `"github/awesome copilot"` ✅

### Coincidencia Exacta (No Subcadenas)

El sistema **NO** coincide con subcadenas para evitar falsos positivos:

- Buscar `"Retirar dinero"` → Encuentra solo `"Retirar dinero"` ✅
- Buscar `"Retirar dinero"` → **NO** encuentra `"Retirar dinero y voucher"` ❌
- Buscar `"OK"` → Encuentra solo `"OK"` ✅
- Buscar `"OK"` → **NO** encuentra `"BOOK"` o `"OKAY"` ❌

### Concatenación de Palabras

El OCR puede detectar palabras separadas que visualmente están juntas. El sistema las concatena automáticamente:

**Ejemplo**:
```
OCR detecta: ["boton", "card"] (dos palabras separadas)
Texto unido: "boton card"
Buscar: "boton-card" (normalizado a "boton card")
Resultado: ✅ MATCH
Click: En la primera palabra detectada ("boton")
```

Esto permite encontrar elementos incluso cuando OCR los detecta fragmentados.
