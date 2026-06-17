@echo off
REM create-offline-package.bat
REM Wrapper para ejecutar create-offline-package.ps1
REM Genera un paquete offline completo con todas las dependencias Python,
REM el frontend compilado, los componentes del backend, api, executor,
REM orchestrator, Tesseract-OCR y Allure Commandline.

setlocal

echo.
echo ========================================
echo   PeHaPe - Generador de Paquete Offline
echo ========================================
echo.
echo Este script realizara las siguientes tareas:
echo   1. Descargar dependencias Python (.whl)
echo   2. Compilar el frontend (npm run build)
echo   3. Copiar backend, api, executor, orchestrator
echo   4. Incluir Tesseract-OCR y Allure Commandline
echo   5. Generar scripts de instalacion y arranque
echo   6. Crear archivo ZIP listo para distribuir
echo.

REM Verificar que estamos en el directorio correcto
if not exist "%~dp0create-offline-package.ps1" (
    echo ERROR: No se encontro create-offline-package.ps1
    echo Asegurese de ejecutar este script desde la raiz del proyecto.
    pause
    exit /b 1
)

REM Verificar que Python este disponible
where python >nul 2>nul
if errorlevel 1 (
    where py >nul 2>nul
    if errorlevel 1 (
        echo ERROR: Python no encontrado en PATH.
        echo Instale Python 3.8+ y agréguelo al PATH antes de continuar.
        pause
        exit /b 1
    )
)

REM Verificar que Node/npm este disponible
where npm >nul 2>nul
if errorlevel 1 (
    echo ERROR: npm no encontrado en PATH.
    echo Instale Node.js y agréguelo al PATH antes de continuar.
    pause
    exit /b 1
)

REM Verificar que el venv exista
if not exist "%~dp0.venv\Scripts\python.exe" (
    echo ERROR: No se encontro el entorno virtual .venv
    echo Cree el entorno con: python -m venv .venv
    echo Luego instale dependencias: .venv\Scripts\pip install -r requirements.txt
    pause
    exit /b 1
)

echo Iniciando proceso de empaquetado...
echo.

REM Ejecutar el script PowerShell con bypass de politica de ejecucion
powershell.exe -ExecutionPolicy Bypass -File "%~dp0create-offline-package.ps1"

if errorlevel 1 (
    echo.
    echo ========================================
    echo   ERROR: El empaquetado fallo
    echo ========================================
    echo Revise los mensajes de error anteriores.
    echo Tambien puede revisar el archivo de log generado en la raiz del proyecto.
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Paquete creado exitosamente
echo ========================================
echo.
echo El archivo ZIP se encuentra en la raiz del proyecto:
echo   pehape-package-offline-[fecha].zip
echo.
echo Para instalar en otra PC:
echo   1. Copie el ZIP al equipo destino
echo   2. Extraiga el contenido
echo   3. Ejecute: install.ps1
echo   4. Luego ejecute: start-app-window.bat (RECOMENDADO)
echo.

endlocal
pause
