@echo off
REM Script independiente para iniciar backend y frontend sin usar PowerShell
REM No requiere permisos de administrador
REM Inicia cada servidor en su propia ventana

echo ========================================
echo Iniciando servidores de backend, frontend y orquestador...
echo ========================================
echo.

REM Definir rutas
set "PROJECT_ROOT=%~dp0"

echo Iniciando servidor de backend en una nueva ventana...
start "Backend Server - Pehape" cmd /k "%PROJECT_ROOT%start-backend.bat"

echo Iniciando servidor de frontend en una nueva ventana...
start "Frontend Server - Pehape" cmd /k "%PROJECT_ROOT%start-frontend.bat"

echo Iniciando servidor del orquestador en una nueva ventana...
start "Orchestrator Server - Pehape" cmd /k "cd /d %PROJECT_ROOT% && .venv\Scripts\uvicorn orchestrator_api:app --host 0.0.0.0 --port 5001 --reload"

echo.
echo ========================================
echo Todos los servidores se estan iniciando en ventanas separadas.
echo.
echo Backend: http://localhost:5000
echo Frontend: http://localhost:3000
echo Orchestrator: http://localhost:5001
echo.
echo Cierra las ventanas de los servidores para detenerlos.
echo ========================================
echo.
echo Presiona cualquier tecla para cerrar esta ventana...
pause >nul
