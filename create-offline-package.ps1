# create-offline-package.ps1
# This script bundles all dependencies and code for offline installation.
$ErrorActionPreference = "Stop"
$ProjectRoot = Get-Location
$PackageDir = Join-Path $ProjectRoot "package_offline"
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Creating Offline Package..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
# 1. Prepare Directory Structure
if (Test-Path $PackageDir) {
    Write-Host "Cleaning up existing package directory..."
    Remove-Item -Recurse -Force $PackageDir
}
Write-Host "Creating directory structure..."
$dirs = @(
    "$PackageDir\dependencies\python",
    "$PackageDir\frontend\dist",
    "$PackageDir\backend",
    "$PackageDir\config",
    "$PackageDir\resources",
    "$PackageDir\util"
)
foreach ($dir in $dirs) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
}
# 2. Download Python Dependencies
Write-Host "Downloading Python dependencies (.whl files)..."
& .\.venv\Scripts\python.exe -m pip download -r requirements.txt -d "$PackageDir\dependencies\python"
if ($LASTEXITCODE -ne 0) {
    Write-Error "ERROR: Failed to download Python dependencies from requirements.txt. Check your internet
connection and try again."
    exit 1
}
Write-Host "Downloading pip, setuptools, and wheel..."
& .\.venv\Scripts\python.exe -m pip download pip setuptools wheel -d "$PackageDir\dependencies\python"
if ($LASTEXITCODE -ne 0) {
    Write-Error "ERROR: Failed to download pip, setuptools, and wheel. Check your internet connection and try
again."
    exit 1
}
# Verificar que se descargaron archivos
$downloadedFiles = Get-ChildItem "$PackageDir\dependencies\python" -Filter *.whl
if ($downloadedFiles.Count -eq 0) {
    Write-Error "ERROR: No .whl files were downloaded. The package creation has failed. Check your internet
connection and try again."
    exit 1
}
Write-Host "Successfully downloaded $($downloadedFiles.Count) dependency files." -ForegroundColor Green
# 3. Build Frontend
Write-Host "Building Frontend..."
Set-Location frontend
& npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Frontend build failed."
}
Set-Location ..
Write-Host "Copying Frontend build artifacts..."
Copy-Item -Recurse "frontend\dist\*" "$PackageDir\frontend\dist\"
# 4. Copy Backend Code
Write-Host "Copying Backend code..."
Copy-Item "backend\*.py" "$PackageDir\backend\"
Copy-Item "backend\*.json" "$PackageDir\backend\"
# 5. Copy Core Automation Components
Write-Host "Copying Core components..."
Copy-Item -Recurse -Force "executor" "$PackageDir\"
Copy-Item -Recurse -Force "behave_runner" "$PackageDir\"
Copy-Item -Recurse -Force "features" "$PackageDir\"
Copy-Item -Recurse -Force "util" "$PackageDir\"
Copy-Item -Recurse -Force "config" "$PackageDir\"
Copy-Item -Recurse -Force "resources" "$PackageDir\"
Copy-Item "behave_master.py" "$PackageDir\"
Copy-Item "requirements.txt" "$PackageDir\"
# 5.1 Copy README if exists
if (Test-Path "package_offline\README.md") {
    Write-Host "Copying README.md..."
    Copy-Item "package_offline\README.md" "$PackageDir\"
}
# 5.1 Include Tesseract OCR
Write-Host "Including Tesseract OCR copy..."
$tesseractExe = (Get-Content "config\config.py" | Select-String 'TESSERACT_CMD_PATH = r"(.*)"').Matches.Groups[1].Value
if (-not $tesseractExe) {
    # Fallback to a common path if not found in config
    $tesseractExe = "C:\src\tesseract-ocr\tesseract.exe"
}
if (Test-Path $tesseractExe) {
    $tesseractDir = Split-Path $tesseractExe
    Write-Host "Found Tesseract at $tesseractDir. Copying..."
    Copy-Item -Recurse -Force $tesseractDir "$PackageDir\tesseract-ocr"
}
else {
    Write-Warning "Tesseract OCR not found. Please manually include a copy in 'package_offline\tesseract-ocr'."
}
# 6. Copy Start Scripts (Modified for offline)
Write-Host "Creating offline start scripts..."
$startBackendOffline = @"
@echo off
set "PROJECT_ROOT=%~dp0"
cd /d "%PROJECT_ROOT%"

REM === Validar instalación previa ===
if not exist install.ok (
 echo.
 echo ERROR: No se detecta instalacion previa de dependencias.
 echo Por favor, ejecute install.ps1 antes de continuar.
 pause
 exit /b 1
)

if not exist .venv (
 echo [ERROR] Virtual environment not found. Pero install.ok existe? Re-ejecute install.ps1.
 pause
 exit /b 1
)

REM --- Detect Python Command ---
set "PYTHON_CMD=python"
where python >nul 2>nul
if errorlevel 1 (
  where py >nul 2>nul
  if errorlevel 1 (
    echo [ERROR] Python not found in PATH.
    pause
    exit /b 1
  ) else (
    set "PYTHON_CMD=py"
  )
)

call .venv\Scripts\activate
"%PYTHON_CMD%" backend\backend_server.py --network
"@
$startBackendOffline | Out-File -FilePath "$PackageDir\start-backend-offline.bat" -Encoding ascii

# Generate start-app-window.bat (MODO VENTANA NATIVA)
$startAppWindow = @"
@echo off
REM Script para iniciar la aplicacion en modo ventana nativa con pywebview
cd /d "%~dp0"
REM === Validar instalacion previa ===
if not exist install.ok (
 echo.
 echo ADVERTENCIA: No se detecta instalacion previa de dependencias.
 echo.
 choice /C SN /M "Desea ejecutar el script de instalacion ahora"
 if errorlevel 2 (
 echo.
 echo Por favor, ejecute install.ps1 antes de continuar.
 pause
 exit /b 1
 )
 echo.
 echo Ejecutando install.ps1...
 powershell -ExecutionPolicy Bypass -File install.ps1
 if errorlevel 1 (
 echo.
 echo ERROR: La instalacion fallo. Por favor, revise los errores e intente nuevamente.
 pause
 exit /b 1
 )
 if not exist install.ok (
 echo.
 echo ERROR: La instalacion no se completo correctamente.
 pause
 exit /b 1
 )
 echo.
 echo Instalacion completada. Continuando con el inicio del sistema...
 echo.
)
REM Verificar existencia del entorno virtual
if not exist .venv (
 echo [ERROR] Virtual environment not found. Please run install.ps1 first.
 pause
 exit /b 1
)
REM Agregar Tesseract-OCR al PATH temporalmente
set "TESSERACT_DIR=%~dp0Tesseract-OCR"
if exist "%TESSERACT_DIR%\tesseract.exe" (
 set "PATH=%TESSERACT_DIR%;%PATH%"
 echo Tesseract-OCR referenciado correctamente.
) else (
 echo ADVERTENCIA: No se encontro Tesseract-OCR en %TESSERACT_DIR%
)
echo.
echo ========================================
echo Iniciando PeHaPe en modo ventana nativa
echo ========================================
echo.
REM --- Detect Python Command ---
set "PYTHON_CMD=python"
where python >nul 2>nul
if errorlevel 1 (
  where py >nul 2>nul
  if errorlevel 1 (
    echo [ERROR] Python not found in PATH.
    pause
    exit /b 1
  ) else (
    set "PYTHON_CMD=py"
  )
)

REM Activar entorno virtual y ejecutar backend con ventana nativa
call .venv\Scripts\activate
"%PYTHON_CMD%" backend\backend_server.py --window
pause
"@
$startAppWindow | Out-File -FilePath "$PackageDir\start-app-window.bat" -Encoding ascii

# Generate start-all-offline.bat (MODO NAVEGADOR)
Write-Host "Generating start-all-offline.bat..."
$startAllOffline = @"
@echo off
REM Script para iniciar backend, frontend y asegurar referencia a Tesseract-OCR
REM Cambiar a la carpeta donde está el script
cd /d "%~dp0"
REM === Validar instalación previa ===
if not exist install.ok (
 echo.
 echo ADVERTENCIA: No se detecta instalacion previa de dependencias.
 echo.
 choice /C SN /M "Desea ejecutar el script de instalacion ahora"
 if errorlevel 2 (
 echo.
 echo Por favor, ejecute install.ps1 antes de continuar.
 pause
 exit /b 1
 )
 echo.
 echo Ejecutando install.ps1...
 powershell -ExecutionPolicy Bypass -File install.ps1
 if errorlevel 1 (
 echo.
 echo ERROR: La instalacion fallo. Por favor, revise los errores e intente nuevamente.
 pause
 exit /b 1
 )
 if not exist install.ok (
 echo.
 echo ERROR: La instalacion no se completo correctamente.
 pause
 exit /b 1
 )
 echo.
 echo Instalacion completada. Continuando con el inicio del sistema...
 echo.
)
REM Definir variables de ruta
setlocal enableextensions enabledelayedexpansion
set "BASE_DIR=%~dp0"
set "BACKEND_DIR=%BASE_DIR%backend"
set "FRONTEND_DIR=%BASE_DIR%frontend"
set "TESSERACT_DIR=%BASE_DIR%Tesseract-OCR"

REM --- Detect Python Command ---
set "PYTHON_CMD=python"
where python >nul 2>nul
if errorlevel 1 (
  where py >nul 2>nul
  if errorlevel 1 (
    echo [ERROR] Python not found in PATH.
    pause
    exit /b 1
  ) else (
    set "PYTHON_CMD=py"
  )
)
echo Python encontrado: %PYTHON_CMD%
REM Verificar existencia de Tesseract-OCR
if not exist "%TESSERACT_DIR%\tesseract.exe" (
 echo ERROR: No se encontró Tesseract-OCR en %TESSERACT_DIR%
 exit /b 1
)
REM Agregar Tesseract-OCR al PATH temporalmente
set "PATH=%TESSERACT_DIR%;%PATH%"
echo Tesseract-OCR referenciado correctamente.
REM Iniciar backend
set "BACKEND_STARTED=0"
if exist "%BASE_DIR%start-backend-offline.bat" (
 echo Iniciando servidor backend...
 start "Backend Server" cmd /k "%BASE_DIR%start-backend-offline.bat"
 set "BACKEND_STARTED=1"
) else (
 echo ERROR: No se encontró el backend para iniciar.
)
REM Esperar a que el backend se inicie
if "%BACKEND_STARTED%"=="1" (
 echo Esperando que el servidor backend se inicie...
 timeout /t 3 /nobreak >nul
 REM Verificar que el backend esté corriendo
 powershell -Command "`$maxRetries = 10; `$retries = 0; while (`$retries -lt `$maxRetries) { try { `$response =
Invoke-WebRequest -Uri 'http://localhost:5000' -TimeoutSec 2 -UseBasicParsing; if (`$response.StatusCode -eq
200) { exit 0 } } catch {} `$retries++; Start-Sleep -Seconds 1 } exit 1"
 if errorlevel 1 (
 echo ADVERTENCIA: No se pudo verificar que el backend este corriendo en http://localhost:5000
 echo Verifique manualmente que el servidor este activo antes de ejecutar pruebas.
 ) else (
 echo Backend corriendo correctamente en http://localhost:5000
 )
)
REM Iniciar frontend
set "FRONTEND_FOUND=0"
if exist "%FRONTEND_DIR%\dist\index.html" (
 echo El frontend compilado se encuentra en frontend\dist.
 echo.
 echo IMPORTANTE:
 echo 1. Abra su navegador y diríjase a la siguiente URL:
 echo http://localhost:5000
 echo (El backend sirve el frontend automaticamente)
 echo 2. Asegúrese de que el backend esté corriendo antes de ejecutar pruebas.
 echo 3. Ejecute las pruebas desde la interfaz o desde el script correspondiente.
 set "FRONTEND_FOUND=1"
)
if "%FRONTEND_FOUND%"=="0" (
 echo ERROR: No se encontró el frontend para iniciar.
)
echo.
if "%BACKEND_STARTED%"=="1" (
 echo ========================================
 echo SISTEMA INICIADO CORRECTAMENTE
 echo ========================================
 echo Backend: http://localhost:5000
 echo Frontend: Abra el navegador y vaya a http://localhost:5000
 echo.
 echo NOTA: Para usar ventana nativa sin navegador, ejecute:
 echo start-app-window.bat
 echo.
) else (
 echo ========================================
 echo ADVERTENCIA
 echo ========================================
 echo El backend no se inició correctamente.
 echo.
)
echo RECOMENDACIONES:
echo - No cierre las ventanas de consola del Backend mientras use el sistema.
echo - Asegurese de que ambos servicios esten corriendo antes de ejecutar pruebas.
echo - Ejecute las pruebas desde la interfaz web o desde los scripts correspondientes.
echo - Para modo ventana sin navegador: start-app-window.bat (RECOMENDADO)
echo.
endlocal
pause
"@
$startAllOffline | Out-File -FilePath "$PackageDir\start-all-offline.bat" -Encoding ascii
# 7. Generate installation script for the target machine
Write-Host "Generating install.ps1..."
$installScript = @"
# install.ps1 - Offline Installer for Pehape
`$ProjectRoot = Get-Location
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Pehape Offline Installer" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
# Detect Python command
`$pythonCmd = ""
`$cmdsToTry = @("py", "python")
foreach (`$cmd in `$cmdsToTry) {
    if (Get-Command `$cmd -ErrorAction SilentlyContinue) {
        # Verify it's a real python and not the Microsoft Store mock
        try {
            `$version = & `$cmd --version 2>&1
            if (`$LASTEXITCODE -eq 0) {
                `$pythonCmd = `$cmd
                Write-Host "Using '`$pythonCmd' as Python command (`$version)"
                break
            }
        } catch {}
    }
}

if (-not `$pythonCmd) {
    # Last resort: check common absolute paths
    `$pathsToCheck = @("C:\Python39\python.exe", "C:\Python310\python.exe", "C:\Python311\python.exe", "C:\Python312\python.exe", "`$env:ProgramFiles\Python39\python.exe", "`$env:ProgramFiles\Python310\python.exe", "`$env:ProgramFiles\Python311\python.exe", "`$env:ProgramFiles\Python312\python.exe")
    foreach (`$p in `$pathsToCheck) {
        if (Test-Path `$p) {
            try {
                `$version = & "`$p" --version 2>&1
                if (`$LASTEXITCODE -eq 0) {
                    `$pythonCmd = "`$p"
                    Write-Host "Using absolute path: `$pythonCmd (`$version)"
                    break
                }
            } catch {}
        }
    }
}

if (-not `$pythonCmd) {
    Write-Host "ERROR: Python not found or is a mock (Microsoft Store). Please install Python and add it to PATH." -ForegroundColor Red
    pause
    exit 1
}

# 1. Create Virtual Environment
if (-not (Test-Path ".venv")) {
    Write-Host "Creating virtual environment..."
    & `$pythonCmd -m venv .venv
}
# 2. Upgrade pip, setuptools, and wheel first
Write-Host "Upgrading pip, setuptools, and wheel..."
& .\.venv\Scripts\python.exe -m pip install --no-index --find-links="dependencies\python" --upgrade pip setuptools wheel
# 3. Install Dependencies
Write-Host "Installing Python dependencies from local files..."
& .\.venv\Scripts\python.exe -m pip install --no-index --find-links="dependencies\python" -r requirements.txt
if (`$LASTEXITCODE -ne 0) {
 Write-Host ""
 Write-Host "========================================" -ForegroundColor Red
 Write-Host "ERROR: Installation Failed!" -ForegroundColor Red
 Write-Host "========================================" -ForegroundColor Red
 Write-Host "Some dependencies could not be installed."
 Write-Host "Please check that all .whl files are present in dependencies\python folder."
 pause
 exit 1
}
# 4. Configure Tesseract
if (Test-Path "tesseract-ocr\tesseract.exe") {
 Write-Host "Configuring local Tesseract OCR..."
`$localTesseract = "`$ProjectRoot\tesseract-ocr\tesseract.exe"
 # Update config.py to use the local path
`$configFile = "config\config.py"
 (Get-Content `$configFile) | ForEach-Object {
`$_ -replace 'TESSERACT_CMD_PATH = r".*"', "TESSERACT_CMD_PATH = r'`$localTesseract'"
 } | Set-Content `$configFile
}
# Crear archivo de bandera para instalación exitosa
New-Item -ItemType File -Path "install.ok" -Force | Out-Null
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Installation Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "Next steps:"
Write-Host "1. Run start-app-window.bat for native window mode (RECOMMENDED)."
Write-Host "2. Or run start-all-offline.bat to use browser mode."
Write-Host "3. See README.md for more options and troubleshooting."
"@
$installScript | Out-File -FilePath "$PackageDir\install.ps1" -Encoding utf8
# 8. Generate README.md with instructions
Write-Host "Generating README.md..."
$readmeContent = @"
# PeHaPe - Offline Package

## Instalación

1. Ejecute ``install.ps1`` para instalar todas las dependencias:

``````powershell
powershell -ExecutionPolicy Bypass -File install.ps1
``````

## Opciones de Ejecución

### Opción 1: Ventana Nativa (RECOMENDADO) ⭐

Ejecuta la aplicación en una ventana independiente **sin necesitar navegador**:

``````batch
start-app-window.bat
``````

**Ventajas:**
- ✅ **No necesita navegador externo** - funciona sin Internet Explorer
- ✅ Se ve como aplicación de escritorio nativa
- ✅ Más rápida y ligera
- ✅ Usa Edge WebView2 (incluido en Windows 10/11)
- ✅ Soporta todas las funcionalidades modernas de React

**Requisitos:**
- Windows 10/11 con Edge WebView2 Runtime (preinstalado)
- Si aparece error de WebView2, descargue desde: https://developer.microsoft.com/microsoft-edge/webview2/

### Opción 2: Servidor con Navegador

Ejecuta el servidor backend y accede desde el navegador:

``````batch
start-all-offline.bat
``````

Luego abra su navegador en: ``http://localhost:5000``

**Ventajas:**
- ✅ Puede acceder desde múltiples dispositivos en la misma red
- ✅ Compatible con cualquier navegador moderno

**NOTA:** Internet Explorer NO es compatible. Use Edge, Chrome o Firefox.

### Opción 3: Acceso desde Red Local

Para acceder desde otras PCs en la misma red:

``````batch
start-backend-offline.bat
``````

Luego desde otras PCs: ``http://<IP-DEL-SERVIDOR>:5000``

## Requisitos del Sistema

- **Windows 10/11** (con Edge WebView2 Runtime para modo ventana)
- **Python 3.8+** (incluido como ``python`` o ``py`` en PATH)
- **RAM:** 2GB mínimo, 4GB recomendado
- **Espacio:** ~500MB para aplicación + dependencias

## Solución de Problemas

### Error: "pywebview no está instalado"

Si al ejecutar ``start-app-window.bat`` aparece este error, reinstale:

``````powershell
.\\.venv\\Scripts\\python.exe -m pip install --no-index --find-links="dependencies\\python" pywebview
``````

### Error: "Edge WebView2 no encontrado"

**Opción A (Recomendada):** Descargue e instale Edge WebView2 Runtime desde:
https://developer.microsoft.com/microsoft-edge/webview2/

**Opción B (Alternativa):** Use el modo navegador con ``start-all-offline.bat`` en lugar del modo ventana.

### Backend no inicia

Verifique que Python esté correctamente instalado:

``````batch
python --version
``````

o

``````batch
py --version
``````

### Error: "No se puede abrir en Internet Explorer"

Internet Explorer **NO es compatible** con esta aplicación. Use:
- **Opción 1 (Recomendada):** Modo ventana nativa (``start-app-window.bat``)
- **Opción 2:** Instale un navegador moderno (Edge, Chrome, Firefox)

## Estructura de Archivos

``````
package_offline/
├── install.ps1                 # Script de instalación
├── start-app-window.bat        # ⭐ RECOMENDADO: Ventana nativa
├── start-all-offline.bat       # Servidor + instrucciones navegador
├── start-backend-offline.bat   # Solo servidor (acceso red)
├── backend/                    # Código del servidor Flask
├── frontend/dist/              # Interfaz compilada
├── dependencies/python/        # Paquetes Python (.whl)
├── Tesseract-OCR/              # Motor OCR incluido
├── features/                   # Tests BDD
├── executor/                   # Motor de ejecución
├── behave_runner/              # Runner Behave
├── config/                     # Configuración
├── resources/                  # Recursos (imágenes, etc)
└── util/                       # Utilidades
``````

## Modos de Ejecución Detallados

### Modo Ventana Nativa (``--window``)
- Inicia Flask en localhost (127.0.0.1)
- Crea ventana nativa con pywebview
- No requiere navegador externo
- Ideal para uso local sin internet

### Modo Servidor (``--network``)
- Inicia Flask en todas las interfaces (0.0.0.0)
- Permite acceso desde red local
- Requiere navegador moderno
- Ideal para acceso remoto o múltiples usuarios

## Soporte

Para más información, consulte la documentación principal del proyecto.
"@
$readmeContent | Out-File -FilePath "$PackageDir\README.md" -Encoding utf8
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Offline Package Created Successfully!" -ForegroundColor Green
Write-Host "Location: $PackageDir" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
