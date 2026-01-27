@echo off
REM Script para iniciar solo el frontend sin permisos de administrador
REM Puentea la política de ejecución de PowerShell

echo Iniciando servidor de frontend...
powershell.exe -ExecutionPolicy Bypass -File "%~dp0start-frontend.ps1"
