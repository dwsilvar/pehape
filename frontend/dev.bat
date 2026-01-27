@echo off
REM Script para ejecutar el servidor de desarrollo sin permisos de administrador
REM Puentea la política de ejecución de PowerShell

echo Iniciando servidor de desarrollo...
powershell.exe -ExecutionPolicy Bypass -Command "& 'D:\Aplicaciones\node-v24.13.0-win-x64\npm.cmd' run dev"
