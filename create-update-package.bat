@echo off
REM create-update-package.bat
REM Genera un paquete de actualizacion LIGERO (sin Tesseract, sin Allure, sin deps no cambiadas).
REM El usuario final lo aplica con update.bat desde su instalacion existente.

setlocal

echo.
echo ========================================
echo   PeHaPe - Generador de Actualizacion
echo ========================================
echo.
echo Este script genera un ZIP de actualizacion que contiene:
echo   - Frontend compilado  (nuevos cambios de UI)
echo   - Backend y API       (cambios en el servidor)
echo   - Executor y modulos  (cambios en el motor)
echo   - Dependencias Python (solo si requirements.txt cambio)
echo   - Scripts de update   (para aplicar en la PC del usuario)
echo.
echo Lo que NO incluye (ya esta en la instalacion base):
echo   - Tesseract-OCR  (~100 MB)
echo   - Allure         (~25 MB)
echo.

REM Verificaciones previas
if not exist "%~dp0create-update-package.ps1" (
    echo ERROR: No se encontro create-update-package.ps1
    pause
    exit /b 1
)

if not exist "%~dp0version.json" (
    echo ERROR: No se encontro version.json
    echo Cree el archivo version.json con la version actual antes de continuar.
    pause
    exit /b 1
)

if not exist "%~dp0.venv\Scripts\python.exe" (
    echo ERROR: No se encontro el entorno virtual .venv
    pause
    exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
    echo ERROR: npm no encontrado en PATH.
    pause
    exit /b 1
)

echo Iniciando generacion del paquete de actualizacion...
echo.

powershell.exe -ExecutionPolicy Bypass -File "%~dp0create-update-package.ps1"

if errorlevel 1 (
    echo.
    echo ========================================
    echo   ERROR: La generacion fallo
    echo ========================================
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Paquete de actualizacion listo!
echo ========================================
echo.
echo Busque el archivo: pehape-update-[version]-[fecha].zip
echo.
echo Instrucciones para el usuario final:
echo   1. Recibir el ZIP de actualizacion
echo   2. Extraer en cualquier carpeta temporal
echo   3. Ejecutar update.bat
echo   4. Ingresar la ruta de su instalacion de PeHaPe
echo   5. Reiniciar la aplicacion
echo.

endlocal
pause
