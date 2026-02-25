@echo off
REM create-offline-package.bat
REM Wrapper para ejecutar create-offline-package.ps1 sin problemas de politica de ejecucion

echo ========================================
echo Creando Paquete Offline de Pehape
echo ========================================
echo.

REM Ejecutar el script PowerShell con bypass de politica de ejecucion
powershell.exe -ExecutionPolicy Bypass -File "%~dp0create-offline-package.ps1"

if errorlevel 1 (
    echo.
    echo ERROR: El proceso de creacion del paquete fallo.
    echo Revise los mensajes de error anteriores.
    pause
    exit /b 1
)

echo.
echo ========================================
echo Paquete creado exitosamente
echo ========================================
pause
