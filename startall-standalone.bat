@echo off
REM Script independiente para iniciar backend y frontend en modo standalone sin usar PowerShell
REM Permite especificar una ruta personalizada de Node.js
REM No requiere permisos de administrador
REM Uso: startall-standalone.bat ["ruta\al\node.exe"]

REM ============================================
REM CONFIGURACIÓN: Ruta por defecto de Node.js
REM Modifica esta variable según tu instalación
REM ============================================
set "DEFAULT_NODE_PATH=D:\Aplicaciones\node-v24.13.0-win-x64\node.exe"

REM Si se pasa un argumento, usarlo; si no, usar la ruta por defecto
if "%~1"=="" (
    set "NODE_PATH=%DEFAULT_NODE_PATH%"
    echo Usando ruta por defecto de Node.js: %DEFAULT_NODE_PATH%
) else (
    set "NODE_PATH=%~1"
    echo Usando ruta de Node.js proporcionada: %~1
)

REM Verificar que el archivo existe
if not exist "%NODE_PATH%" (
    echo.
    echo ERROR: No se encontro el ejecutable de Node.js en: %NODE_PATH%
    echo.
    echo Por favor:
    echo   1. Verifica la ruta en la variable DEFAULT_NODE_PATH dentro de este script, o
    echo   2. Proporciona la ruta correcta como argumento:
    echo      startall-standalone.bat "ruta\completa\al\node.exe"
    echo.
    pause
    exit /b 1
)

REM Obtener el directorio del ejecutable de Node
for %%I in ("%NODE_PATH%") do set "NODE_DIR=%%~dpI"
REM Remover la barra final
set "NODE_DIR=%NODE_DIR:~0,-1%"

echo.
echo ========================================
echo Configurando entorno standalone
echo ========================================
echo Node.js directory: %NODE_DIR%
echo.

REM Agregar el directorio de Node al inicio del PATH para esta sesión
set "PATH=%NODE_DIR%;%PATH%"

REM Verificar versión de node y npm
echo Verificando versiones...
node --version
if errorlevel 1 (
    echo ERROR: No se pudo ejecutar node
    pause
    exit /b 1
)

npm --version
if errorlevel 1 (
    echo WARNING: No se pudo ejecutar npm
    echo Asegurate de que npm este en la misma carpeta que node.exe
)

echo.
echo ========================================
echo Iniciando servidores en modo standalone
echo ========================================
echo.

REM Definir rutas
set "PROJECT_ROOT=%~dp0"

echo Iniciando servidor de backend en una nueva ventana...
start "Backend Server - Pehape (Standalone)" cmd /k "%PROJECT_ROOT%start-backend.bat"

echo Iniciando servidor de frontend en una nueva ventana...
REM El frontend heredará el PATH modificado con la ruta de Node personalizada
start "Frontend Server - Pehape (Standalone)" cmd /k "set PATH=%NODE_DIR%;%PATH% && %PROJECT_ROOT%start-frontend.bat"

echo.
echo ========================================
echo Ambos servidores se estan iniciando en ventanas separadas.
echo Usando Node.js desde: %NODE_DIR%
echo.
echo Backend: http://localhost:5001
echo Frontend: http://localhost:3000
echo.
echo Cierra las ventanas de los servidores para detenerlos.
echo ========================================
echo.
echo Presiona cualquier tecla para cerrar esta ventana...
pause >nul
