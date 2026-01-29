@echo off
REM Script independiente para iniciar el frontend sin usar PowerShell
REM No requiere permisos de administrador

echo ========================================
echo Iniciando servidor de frontend...
echo ========================================
echo.

REM Guardar el directorio actual
set "ORIGINAL_DIR=%CD%"

REM Definir rutas
set "PROJECT_ROOT=%~dp0"
set "FRONTEND_DIR=%PROJECT_ROOT%frontend"

REM Cambiar al directorio del frontend
cd /d "%FRONTEND_DIR%"

REM Verificar que npm está disponible
where npm >nul 2>nul
if errorlevel 1 (
    echo.
    echo ERROR: npm no esta disponible en el PATH.
    echo Asegurate de tener Node.js instalado y en el PATH.
    pause
    cd /d "%ORIGINAL_DIR%"
    exit /b 1
)

echo Asegurando que las dependencias de npm esten instaladas...
call npm install
if errorlevel 1 (
    echo.
    echo ERROR: Fallo la instalacion de dependencias npm.
    pause
    cd /d "%ORIGINAL_DIR%"
    exit /b 1
)

echo.
echo Iniciando servidor de desarrollo de Vite...
echo Puedes acceder a la aplicacion en http://localhost:3000
echo Presiona Ctrl+C para detener el servidor.
echo.

call npm run dev

REM Restaurar directorio original al salir
cd /d "%ORIGINAL_DIR%"
