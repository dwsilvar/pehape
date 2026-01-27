@echo off
REM Script para iniciar backend y frontend en modo standalone sin permisos de administrador
REM Puentea la política de ejecución de PowerShell
REM Uso: startall-standalone.bat "D:\Aplicaciones\node-v24.13.0-win-x64\node.exe"

if "%~1"=="" (
    echo Error: Debes proporcionar la ruta al ejecutable de Node.js
    echo Uso: startall-standalone.bat "ruta\al\node.exe"
    echo Ejemplo: startall-standalone.bat "D:\Aplicaciones\node-v24.13.0-win-x64\node.exe"
    exit /b 1
)

echo Iniciando servidores en modo standalone con Node desde: %~1
powershell.exe -ExecutionPolicy Bypass -File "%~dp0startall-standalone.ps1" -NodeExePath "%~1"
