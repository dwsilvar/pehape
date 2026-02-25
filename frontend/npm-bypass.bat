@echo off
REM Script genérico para ejecutar cualquier comando npm sin permisos de administrador
REM Uso: npm-bypass.bat <comando> [argumentos]
REM Ejemplo: npm-bypass.bat run dev
REM Ejemplo: npm-bypass.bat install axios

if "%~1"=="" (
    echo Error: Debes proporcionar un comando npm
    echo Uso: npm-bypass.bat ^<comando^> [argumentos]
    echo Ejemplo: npm-bypass.bat run dev
    exit /b 1
)

echo Ejecutando: npm %*
powershell.exe -ExecutionPolicy Bypass -Command "& 'D:\Aplicaciones\node-v24.13.0-win-x64\npm.cmd' %*"
