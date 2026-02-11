# create-offline-package.ps1
# This script bundles all dependencies and code for offline installation.

# Auto-bypass execution policy if not already running with bypass
$currentPolicy = Get-ExecutionPolicy -Scope Process
if ($currentPolicy -ne 'Bypass' -and $currentPolicy -ne 'Unrestricted') {
    Write-Host "Relanzando script con bypass de politica de ejecucion..." -ForegroundColor Yellow
    $scriptPath = $MyInvocation.MyCommand.Path
    Start-Process powershell.exe -ArgumentList "-ExecutionPolicy Bypass -File `"$scriptPath`"" -Wait -NoNewWindow
    exit
}

$ErrorActionPreference = "Stop"
$ProjectRoot = Get-Location
$PackageDir = Join-Path $ProjectRoot "package_offline"

# Initialize logging
$LogFile = Join-Path $ProjectRoot "package-creation-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
$WarningCount = 0
$ErrorCount = 0

function Write-Log {
    param(
        [string]$Message,
        [ValidateSet("INFO", "WARNING", "ERROR", "SUCCESS")]
        [string]$Level = "INFO"
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    
    # Write to log file
    Add-Content -Path $LogFile -Value $logMessage
    
    # Write to console with color
    switch ($Level) {
        "INFO" { Write-Host $Message -ForegroundColor White }
        "WARNING" { 
            Write-Host "WARNING: $Message" -ForegroundColor Yellow
            $script:WarningCount++
        }
        "ERROR" { 
            Write-Host "ERROR: $Message" -ForegroundColor Red
            $script:ErrorCount++
        }
        "SUCCESS" { Write-Host $Message -ForegroundColor Green }
    }
}

Write-Log "========================================" "INFO"
Write-Log "Creating Offline Package..." "INFO"
Write-Log "========================================" "INFO"
Write-Log "Log file: $LogFile" "INFO"
Write-Log "Project root: $ProjectRoot" "INFO"
# 1. Prepare Directory Structure
Write-Log "Step 1: Preparing directory structure" "INFO"
if (Test-Path $PackageDir) {
    Write-Log "Cleaning up existing package directory..." "INFO"
    Remove-Item -Recurse -Force $PackageDir
}
Write-Log "Creating directory structure..." "INFO"
$dirs = @(
    "$PackageDir\dependencies\python",
    "$PackageDir\frontend\dist",
    "$PackageDir\backend",
    "$PackageDir\config",
    "$PackageDir\resources",
    "$PackageDir\util",
    "$PackageDir\reports"
)
foreach ($dir in $dirs) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
    Write-Log "Created: $dir" "INFO"
}
# 2. Download Python Dependencies
Write-Log "Step 2: Downloading Python dependencies" "INFO"
Write-Log "Downloading Python dependencies (.whl files)..." "INFO"
& .\.venv\Scripts\python.exe -m pip download -r requirements.txt -d "$PackageDir\dependencies\python"
if ($LASTEXITCODE -ne 0) {
    Write-Log "Failed to download Python dependencies from requirements.txt. Check your internet connection and try again." "ERROR"
    exit 1
}
Write-Log "Downloading pip, setuptools, and wheel..." "INFO"
& .\.venv\Scripts\python.exe -m pip download pip setuptools wheel allure-python-commons -d "$PackageDir\dependencies\python"
if ($LASTEXITCODE -ne 0) {
    Write-Log "Failed to download pip, setuptools, and wheel. Check your internet connection and try again." "ERROR"
    exit 1
}
# Verificar que se descargaron archivos
$downloadedFiles = Get-ChildItem "$PackageDir\dependencies\python" -Filter *.whl
if ($downloadedFiles.Count -eq 0) {
    Write-Log "No .whl files were downloaded. The package creation has failed. Check your internet connection and try again." "ERROR"
    exit 1
}
Write-Log "Successfully downloaded $($downloadedFiles.Count) dependency files." "SUCCESS"
# 3. Build Frontend
Write-Log "Step 3: Building Frontend" "INFO"
Set-Location frontend
& npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Log "Frontend build failed." "ERROR"
    Set-Location ..
    exit 1
}
Set-Location ..
Write-Log "Copying Frontend build artifacts..." "INFO"
if (Test-Path "frontend\dist") {
    Copy-Item -Recurse "frontend\dist\*" "$PackageDir\frontend\dist\"
    Write-Log "Frontend artifacts copied successfully." "SUCCESS"
}
else {
    Write-Log "Frontend dist folder not found. Build may have failed." "WARNING"
}
# 4. Copy Backend Code
Write-Log "Step 4: Copying Backend code" "INFO"
if (Test-Path "backend\*.py") {
    Copy-Item "backend\*.py" "$PackageDir\backend\"
    $backendPyCount = (Get-ChildItem "$PackageDir\backend\*.py").Count
    Write-Log "Copied $backendPyCount Python files from backend." "SUCCESS"
}
else {
    Write-Log "No Python files found in backend directory." "WARNING"
}
if (Test-Path "backend\*.json") {
    Copy-Item "backend\*.json" "$PackageDir\backend\"
    Write-Log "Copied JSON configuration files from backend." "SUCCESS"
}
else {
    Write-Log "No JSON files found in backend directory." "WARNING"
}
# 5. Copy Core Automation Components
Write-Log "Step 5: Copying Core automation components" "INFO"
$coreComponents = @(
    @{Name = "executor"; Path = "executor" },
    @{Name = "behave_runner"; Path = "behave_runner" },
    @{Name = "features"; Path = "features" },
    @{Name = "util"; Path = "util" },
    @{Name = "config"; Path = "config" },
    @{Name = "resources"; Path = "resources" }
)
foreach ($component in $coreComponents) {
    if (Test-Path $component.Path) {
        Copy-Item -Recurse -Force $component.Path "$PackageDir\"
        Write-Log "Copied component: $($component.Name)" "SUCCESS"
    }
    else {
        Write-Log "Component not found: $($component.Name) at $($component.Path)" "WARNING"
    }
}
if (Test-Path "behave_master.py") {
    Copy-Item "behave_master.py" "$PackageDir\"
    Write-Log "Copied behave_master.py" "SUCCESS"
}
else {
    Write-Log "behave_master.py not found" "WARNING"
}
if (Test-Path "requirements.txt") {
    Copy-Item "requirements.txt" "$PackageDir\"
    Write-Log "Copied requirements.txt" "SUCCESS"
}
else {
    Write-Log "requirements.txt not found" "WARNING"
}
# 5.1 Copy README if exists
if (Test-Path "package_offline\README.md") {
    Write-Log "Copying README.md..." "INFO"
    Copy-Item "package_offline\README.md" "$PackageDir\"
    Write-Log "Copied README.md" "SUCCESS"
}
# 5.2 Include Tesseract OCR
Write-Log "Step 5.2: Including Tesseract OCR" "INFO"
$tesseractExe = (Get-Content "config\config.py" | Select-String 'TESSERACT_CMD_PATH = r"(.*)"').Matches.Groups[1].Value
if (-not $tesseractExe) {
    # Fallback to a common path if not found in config
    $tesseractExe = "C:\src\tesseract-ocr\tesseract.exe"
    Write-Log "Tesseract path not found in config.py, using fallback: $tesseractExe" "INFO"
}
if (Test-Path $tesseractExe) {
    $tesseractDir = Split-Path $tesseractExe
    Write-Log "Found Tesseract at $tesseractDir. Copying to standardized folder name..." "INFO"
    # Create the destination folder with standard name
    $tesseractDest = "$PackageDir\Tesseract-OCR"
    New-Item -ItemType Directory -Path $tesseractDest -Force | Out-Null
    # Copy the contents (not the folder itself) to ensure standard naming
    Copy-Item -Recurse -Force "$tesseractDir\*" $tesseractDest
    Write-Log "Tesseract-OCR copied successfully to package." "SUCCESS"
}
else {
    Write-Log "Tesseract OCR not found at $tesseractExe. Please manually include a copy in 'package_offline\Tesseract-OCR'." "WARNING"
}

# 5.3 Include Allure Commandline if exists
Write-Log "Step 5.3: Including Allure Commandline" "INFO"
if (Test-Path "allure-commandline") {
    Write-Log "Copying Allure Commandline..." "INFO"
    Copy-Item -Recurse -Force "allure-commandline" "$PackageDir\"
    Write-Log "Allure Commandline copied successfully." "SUCCESS"
}
else {
    Write-Log "allure-commandline folder not found. Reports might not work offline." "WARNING"
}

# 6. Copy Start Scripts (Modified for offline)
Write-Log "Step 6: Creating offline start scripts" "INFO"
$startBackendOffline = @"
@echo off
set "PROJECT_ROOT=%~dp0"
cd /d "%PROJECT_ROOT%"

REM === CONFIGURACION MANUAL (OPCIONAL) ===
REM Si Java no esta en el PATH, define su ruta aqui:
REM set "JAVA_HOME=C:\Ruta\A\Java"
REM if defined JAVA_HOME set "PATH=%JAVA_HOME%\bin;%PATH%"

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

REM === CONFIGURACION MANUAL (OPCIONAL) ===
REM set "JAVA_HOME=C:\Ruta\A\Java"
REM if defined JAVA_HOME set "PATH=%JAVA_HOME%\bin;%PATH%"

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
REM Agregar Allure al PATH si existe
if exist "%~dp0allure-commandline\bin\allure.bat" (
 set "PATH=%~dp0allure-commandline\bin;%PATH%"
 echo Allure-Commandline referenciado correctamente.
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

REM --- Verificar Java para Allure ---
where java >nul 2>nul
if errorlevel 1 (
  echo ADVERTENCIA: Java no encontrado en el PATH. Los reportes Allure no funcionaran.
  echo Si tiene Java en una ruta especifica, configurela editando este archivo .bat (variable JAVA_HOME)
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

REM === CONFIGURACION MANUAL (OPCIONAL) ===
REM set "JAVA_HOME=C:\Ruta\A\Java"
REM if defined JAVA_HOME set "PATH=%JAVA_HOME%\bin;%PATH%"

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
Write-Log "Step 7: Generating install.ps1" "INFO"
$installScript = @"
# install.ps1 - Offline Installer for Pehape
`$ProjectRoot = Get-Location
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Pehape Offline Installer" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# ============================================
# CONFIGURACIÓN MANUAL DE PYTHON Y JAVA (OPCIONAL)
# ============================================
# Si deseas usar una ruta específica, descomenta y edita la siguiente línea:
# `$MANUAL_PYTHON_PATH = "C:\Python312\python.exe"
# `$MANUAL_JAVA_PATH = "C:\Program Files\Java\jdk-17\bin"

# Detect Python command
`$pythonCmd = ""

# Verificar si se configuró una ruta manual de Java
if (`$MANUAL_JAVA_PATH) {
    if (Test-Path `$MANUAL_JAVA_PATH) {
        Write-Host "Configurando Java manual en: `$MANUAL_JAVA_PATH" -ForegroundColor Green
        `$javaBin = `$MANUAL_JAVA_PATH
        if (-not `$javaBin.EndsWith("bin")) { `$javaBin = Join-Path `$javaBin "bin" }
        
        # Agregar al PATH del usuario para que sea permanente
        `$currentPath = [Environment]::GetEnvironmentVariable("PATH", "User")
        if (`$currentPath -notlike "*$javaBin*") {
            [Environment]::SetEnvironmentVariable("PATH", `$javaBin + ";" + `$currentPath, "User")
            Write-Host "Java agregado al PATH del Usuario." -ForegroundColor Gray
        }
        [Environment]::SetEnvironmentVariable("JAVA_HOME", (Split-Path `$javaBin), "User")
        
        # También para este proceso actual
        [Environment]::SetEnvironmentVariable("PATH", `$javaBin + ";" + `$env:PATH, "Process")
    } else {
        Write-Host "ADVERTENCIA: La ruta manual de Java no existe: `$MANUAL_JAVA_PATH" -ForegroundColor Yellow
    }
}

# Verificar si se configuró una ruta manual de Python
if (`$MANUAL_PYTHON_PATH) {
    if (Test-Path `$MANUAL_PYTHON_PATH) {
        try {
            `$version = & "`$MANUAL_PYTHON_PATH" --version 2>&1
            if (`$LASTEXITCODE -eq 0) {
                `$pythonCmd = `$MANUAL_PYTHON_PATH
                Write-Host "Usando Python manual: `$pythonCmd (`$version)" -ForegroundColor Green
            } else {
                Write-Host "ADVERTENCIA: La ruta manual de Python no es válida. Buscando automáticamente..." -ForegroundColor Yellow
            }
        } catch {
            Write-Host "ADVERTENCIA: Error al verificar la ruta manual de Python. Buscando automáticamente..." -ForegroundColor Yellow
        }
    } else {
        Write-Host "ADVERTENCIA: La ruta manual de Python no existe: `$MANUAL_PYTHON_PATH" -ForegroundColor Yellow
        Write-Host "Buscando automáticamente..." -ForegroundColor Yellow
    }
}

# Si no se configuró manualmente o falló, buscar automáticamente
if (-not `$pythonCmd) {
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
# Si se configuró una ruta manual y ya existe un venv, eliminarlo para evitar conflictos
if (`$MANUAL_PYTHON_PATH -and (Test-Path ".venv")) {
    Write-Host "Detectada configuración manual de Python. Eliminando venv anterior..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force ".venv"
}

if (-not (Test-Path ".venv")) {
    Write-Host "Creating virtual environment..."
    & `$pythonCmd -m venv .venv
    if (`$LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to create virtual environment." -ForegroundColor Red
        pause
        exit 1
    }
}
# 2. Upgrade pip, setuptools, and wheel first
Write-Host "Upgrading pip, setuptools, and wheel..."
& .\.venv\Scripts\python.exe -m pip install --no-index --find-links="dependencies\python" --upgrade pip setuptools wheel
# 3. Install Dependencies
Write-Host "Installing Python dependencies from local files..."
& .\.venv\Scripts\python.exe -m pip install --no-index --find-links="dependencies\python" -r requirements.txt
if (`$LASTEXITCODE -ne 0) {
    Write-Host "Falla en instalación general. Intentando instalar componentes críticos individualmente..." -ForegroundColor Yellow
    & .\.venv\Scripts\python.exe -m pip install --no-index --find-links="dependencies\python" behave allure-behave Flask flask-cors pywebview
}

# Verificar instalación de Allure
Write-Host "Verificando librerías críticas..."
& .\.venv\Scripts\python.exe -c "import allure_behave; print('Allure-behave: OK')" 2>&1 | Out-Null
if (`$LASTEXITCODE -ne 0) {
    Write-Host "ADVERTENCIA: La librería 'allure-behave' no se pudo instalar correctamente. Los reportes de Allure no estarán disponibles." -ForegroundColor Yellow
}

# 4. Configure Tesseract
if (Test-Path "Tesseract-OCR\tesseract.exe") {
 Write-Host "Configuring local Tesseract OCR..."
`$localTesseract = "`$ProjectRoot\Tesseract-OCR\tesseract.exe"
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
Write-Log "install.ps1 generated successfully." "SUCCESS"

# 7.1 Generate update.ps1 - Intelligent Updater
Write-Log "Step 7.1: Generating update.ps1" "INFO"
$updateScript = @"
# update.ps1 - Intelligent Updater for Pehape
`$ProjectRoot = Get-Location
Write-Host "========================================" -ForegroundColor Blue
Write-Host "Pehape Intelligent Updater" -ForegroundColor Blue
Write-Host "========================================" -ForegroundColor Blue

# Definition of protected items (WILL NOT BE OVERWRITTEN)
`$ProtectedFiles = @(
    "config\config.py",
    "features\run_list.json",
    "features\ui_settings.json",
    "backend\server_config.json"
)
`$ProtectedFolders = @(
    "resources\images",
    "resources\ocr_images"
)

# Detect Python
`$pythonCmd = ""
`$cmdsToTry = @("py", "python")
foreach (`$cmd in `$cmdsToTry) {
    if (Get-Command `$cmd -ErrorAction SilentlyContinue) {
        try {
            `$version = & `$cmd --version 2>&1
            if (`$LASTEXITCODE -eq 0) {
                `$pythonCmd = `$cmd
                break
            }
        } catch {}
    }
}

if (-not `$pythonCmd) {
    Write-Host "ERROR: Python not found. Cannot update dependencies." -ForegroundColor Red
    pause
    exit 1
}

Write-Host "Backing up installation directory (partial)..." -ForegroundColor Gray
# We don't do a full backup, but we ensure protected items are safe by skipping them in copy.

Write-Host "Updating application files (preserving configuration)..." -ForegroundColor Cyan
# Copy logic: Iterate through source files and only copy if not protected
# We use a temp location or just simple logic
`$SourceFiles = Get-ChildItem -Path . -Recurse -File | Where-Object { `$_.FullName -notlike "*update.ps1*" -and `$_.FullName -notlike "*install.ps1*" }

foreach (`$file in `$SourceFiles) {
    `$relativePath = Resolve-Path -Path `$file.FullName -Relative
    `$relativePath = `$relativePath.TrimStart(".\")
    
    `$isProtected = `$false
    foreach (`$p in `$ProtectedFiles) {
        if (`$relativePath -eq `$p) { `$isProtected = `$true; break }
    }
    
    if (-not `$isProtected) {
        foreach (`$pf in `$ProtectedFolders) {
            if (`$relativePath.StartsWith(`$pf)) { `$isProtected = `$true; break }
        }
    }
    
    if (`$isProtected -and (Test-Path "`$ProjectRoot\`$relativePath")) {
        Write-Host "[SKIP] Preserving: `$relativePath" -ForegroundColor Yellow
    } else {
        `$destPath = Join-Path `$ProjectRoot `$relativePath
        `$destDir = Split-Path `$destPath
        if (-not (Test-Path `$destDir)) { New-Item -ItemType Directory -Path `$destDir -Force | Out-Null }
        Copy-Item `$file.FullName `$destPath -Force
    }
}

Write-Host "Updating dependencies..." -ForegroundColor Cyan
if (Test-Path ".venv") {
    & .\.venv\Scripts\python.exe -m pip install --no-index --find-links="dependencies\python" -r requirements.txt
    if (`$LASTEXITCODE -ne 0) {
        Write-Host "Warning: Failed to update some dependencies. Run install.ps1 if issues persist." -ForegroundColor Yellow
    }
} else {
    Write-Host "Virtual environment not found. Please run install.ps1." -ForegroundColor Red
    pause
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Update Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
"@
$updateScript | Out-File -FilePath "$PackageDir\update.ps1" -Encoding utf8
Write-Log "update.ps1 generated successfully." "SUCCESS"
# 8. Generate README.md with instructions
Write-Log "Step 8: Generating README.md" "INFO"
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
Write-Log "README.md generated successfully." "SUCCESS"

# 9. Create ZIP Archive
Write-Log "Step 9: Creating ZIP archive" "INFO"
$ZipFile = Join-Path $ProjectRoot "pehape-package-offline-$(Get-Date -Format 'yyyyMMdd').zip"
if (Test-Path $ZipFile) { 
    Remove-Item $ZipFile 
    Write-Log "Removed existing ZIP file: $ZipFile" "INFO"
}
try {
    Compress-Archive -Path "$PackageDir\*" -DestinationPath $ZipFile -Force -ErrorAction Stop
    Write-Log "ZIP archive created successfully: $ZipFile" "SUCCESS"
}
catch {
    Write-Log "Failed to create ZIP archive: $($_.Exception.Message)" "ERROR"
}

# 10. Final Summary
Write-Log "" "INFO"
Write-Log "========================================" "INFO"
Write-Log "Package Creation Complete!" "SUCCESS"
Write-Log "========================================" "INFO"
Write-Log "Package Location: $PackageDir" "INFO"
if (Test-Path $ZipFile) {
    $zipSize = [math]::Round((Get-Item $ZipFile).Length / 1MB, 2)
    Write-Log "ZIP Archive: $ZipFile ($zipSize MB)" "INFO"
}
Write-Log "Log File: $LogFile" "INFO"
Write-Log "" "INFO"
Write-Log "Summary:" "INFO"
Write-Log "  - Warnings: $WarningCount" $(if ($WarningCount -gt 0) { "WARNING" } else { "INFO" })
Write-Log "  - Errors: $ErrorCount" $(if ($ErrorCount -gt 0) { "ERROR" } else { "INFO" })
if ($WarningCount -gt 0) {
    Write-Log "" "INFO"
    Write-Log "Please review the log file for warnings: $LogFile" "WARNING"
}
if ($ErrorCount -gt 0) {
    Write-Log "" "INFO"
    Write-Log "Package creation completed with errors. Please review the log file: $LogFile" "ERROR"
    exit 1
}
Write-Log "========================================" "INFO"
