@echo off
REM Script para iniciar backend y frontend sin permisos de administrador
REM Puentea la política de ejecución de PowerShell

echo Iniciando servidores de backend y frontend...
powershell.exe -ExecutionPolicy Bypass -File "%~dp0start-all.ps1"
