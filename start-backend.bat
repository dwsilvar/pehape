@echo off
REM Script independiente para iniciar el backend sin usar PowerShell
REM No requiere permisos de administrador

echo ========================================
echo Iniciando servidor de backend...
echo ========================================
echo.

REM Guardar el directorio actual
set "ORIGINAL_DIR=%CD%"

REM Definir rutas
set "PROJECT_ROOT=%~dp0"

REM Cambiar al directorio raíz
cd /d "%PROJECT_ROOT%"

REM --- Configuración del Entorno Virtual ---

REM Verificar si ya hay un entorno virtual activado
if defined VIRTUAL_ENV (
    echo Usando el entorno virtual ya activado en: %VIRTUAL_ENV%
    goto :run_server
)

REM Buscar entorno virtual en la raíz del proyecto (.venv)
set "VENV_PATH=%PROJECT_ROOT%.venv"
if exist "%VENV_PATH%\Scripts\activate.bat" (
    echo Activando entorno virtual en: %VENV_PATH%
    call "%VENV_PATH%\Scripts\activate.bat"
    goto :run_server
)

REM Si no existe, crear entorno virtual en la raíz (.venv)
echo.
echo Entorno virtual no encontrado. Creandolo en: %VENV_PATH%
python -m venv .venv
if errorlevel 1 (
    echo.
    echo ERROR: No se pudo crear el entorno virtual.
    echo Asegurate de tener Python instalado y en el PATH.
    pause
    cd /d "%ORIGINAL_DIR%"
    exit /b 1
)

echo Activando entorno virtual...
call "%VENV_PATH%\Scripts\activate.bat"

:run_server
echo.
echo Iniciando servidor backend de FastAPI...
echo El servidor estara disponible en http://localhost:5001
echo Presiona Ctrl+C para detener el servidor.
echo.

python "%PROJECT_ROOT%\orchestrator_api.py"

REM Restaurar directorio original al salir
cd /d "%ORIGINAL_DIR%"
