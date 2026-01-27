@echo off
REM Script para iniciar backend y frontend en modo standalone sin permisos de administrador
REM Puentea la política de ejecución de PowerShell
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
    exit /b 1
)

echo Iniciando servidores en modo standalone con Node desde: %NODE_PATH%
powershell.exe -ExecutionPolicy Bypass -File "%~dp0startall-standalone.ps1" -NodeExePath "%NODE_PATH%"
