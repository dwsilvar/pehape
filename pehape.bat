@echo off
set PROJECT_DIR=%~dp0
if exist "%PROJECT_DIR%.venv\Scripts\python.exe" (
    "%PROJECT_DIR%.venv\Scripts\python.exe" "%PROJECT_DIR%cli.py" %*
) else (
    python "%PROJECT_DIR%cli.py" %*
)
