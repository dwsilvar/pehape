@echo off
REM Script para instalar dependencias sin permisos de administrador
REM Puentea la política de ejecución de PowerShell

echo Instalando dependencias...
powershell.exe -ExecutionPolicy Bypass -Command "& 'D:\Aplicaciones\node-v24.13.0-win-x64\npm.cmd' install"
