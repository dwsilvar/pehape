@echo off
REM Script para iniciar solo el backend sin permisos de administrador
REM Puentea la política de ejecución de PowerShell

echo Iniciando servidor de backend...
powershell.exe -ExecutionPolicy Bypass -File "%~dp0start-backend.ps1"
