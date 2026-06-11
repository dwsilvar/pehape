# create-update-package.ps1
# Genera un paquete de ACTUALIZACION ligero (sin Tesseract, sin Allure, sin deps no cambiadas).
# Ideal para distribuir nuevas versiones a usuarios que ya tienen la instalacion base.
#
# Contenido del paquete de actualizacion:
#   - frontend/dist/     (build compilado, lo que mas cambia)
#   - backend/           (archivos .py del servidor)
#   - api/               (modulos FastAPI)
#   - executor/          (motor de ejecucion)
#   - behave_runner/     (runner de Behave)
#   - util/              (utilidades)
#   - orchestrator.py, orchestrator_api.py, run_behave.py, behave_master.py
#   - version.json       (para que el cliente sepa a que version actualizo)
#   - requirements.txt   (para detectar si hay nuevas deps)
#   - update.ps1         (script inteligente que aplica los cambios)
#   - update.bat         (lanzador del update.ps1)
#
# Lo que NO incluye (ya esta en la instalacion base):
#   - Tesseract-OCR/     (~100 MB)
#   - allure-commandline/ (~25 MB)
#   - dependencies/python/ (~10 MB de .whl) - a menos que requirements.txt haya cambiado

# Auto-bypass execution policy
$currentPolicy = Get-ExecutionPolicy -Scope Process
if ($currentPolicy -ne 'Bypass' -and $currentPolicy -ne 'Unrestricted') {
    $scriptPath = $MyInvocation.MyCommand.Path
    Start-Process powershell.exe -ArgumentList "-ExecutionPolicy Bypass -File `"$scriptPath`"" -Wait -NoNewWindow
    exit
}

$ErrorActionPreference = "Stop"
$ProjectRoot = Get-Location

# --- Leer version actual ---
$VersionFile = Join-Path $ProjectRoot "version.json"
if (-not (Test-Path $VersionFile)) {
    Write-Host "ERROR: No se encontro version.json. Cree el archivo antes de continuar." -ForegroundColor Red
    exit 1
}
$VersionInfo = Get-Content $VersionFile | ConvertFrom-Json
$AppVersion  = $VersionInfo.version
$BuildDate   = Get-Date -Format 'yyyyMMdd'

$UpdateDir = Join-Path $ProjectRoot "update_package"
$ZipFile   = Join-Path $ProjectRoot "pehape-update-$AppVersion-$BuildDate.zip"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PeHaPe - Generador de Actualizacion" -ForegroundColor Cyan
Write-Host "  Version: $AppVersion" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# --- Limpiar directorio de update anterior ---
if (Test-Path $UpdateDir) {
    Write-Host "Limpiando directorio de update anterior..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $UpdateDir
}

# --- Crear estructura ---
$dirs = @(
    "$UpdateDir\frontend\dist",
    "$UpdateDir\backend",
    "$UpdateDir\api",
    "$UpdateDir\executor",
    "$UpdateDir\behave_runner",
    "$UpdateDir\util"
)
foreach ($dir in $dirs) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
}
Write-Host "Estructura de directorios creada." -ForegroundColor Green

# --- 1. Compilar Frontend ---
Write-Host ""
Write-Host "[1/6] Compilando Frontend..." -ForegroundColor Cyan
Set-Location frontend
& npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Fallo la compilacion del frontend." -ForegroundColor Red
    Set-Location ..
    exit 1
}
Set-Location ..
Copy-Item -Recurse "frontend\dist\*" "$UpdateDir\frontend\dist\"
Write-Host "Frontend compilado y copiado." -ForegroundColor Green

# --- 2. Copiar Backend ---
Write-Host ""
Write-Host "[2/6] Copiando Backend..." -ForegroundColor Cyan
Copy-Item "backend\*.py"   "$UpdateDir\backend\" -ErrorAction SilentlyContinue
Copy-Item "backend\*.json" "$UpdateDir\backend\" -ErrorAction SilentlyContinue
Write-Host "Backend copiado." -ForegroundColor Green

# --- 3. Copiar modulos del proyecto ---
Write-Host ""
Write-Host "[3/6] Copiando modulos del proyecto..." -ForegroundColor Cyan
$modules = @("api", "executor", "behave_runner", "util")
foreach ($mod in $modules) {
    if (Test-Path $mod) {
        Copy-Item -Recurse -Force $mod "$UpdateDir\"
        Write-Host "  Copiado: $mod" -ForegroundColor Gray
    }
}

# Scripts raiz
$rootScripts = @("orchestrator.py", "orchestrator_api.py", "run_behave.py", "behave_master.py")
foreach ($script in $rootScripts) {
    if (Test-Path $script) {
        Copy-Item $script "$UpdateDir\"
        Write-Host "  Copiado: $script" -ForegroundColor Gray
    }
}
Write-Host "Modulos copiados." -ForegroundColor Green

# --- 4. Copiar version.json y requirements.txt ---
Write-Host ""
Write-Host "[4/6] Copiando archivos de control de version..." -ForegroundColor Cyan
Copy-Item "version.json"    "$UpdateDir\"
Copy-Item "requirements.txt" "$UpdateDir\"
Write-Host "Archivos de control copiados." -ForegroundColor Green

# --- 5. Detectar si requirements.txt cambio y si hay que incluir nuevas deps ---
Write-Host ""
Write-Host "[5/6] Verificando dependencias Python..." -ForegroundColor Cyan

# Comparar requirements.txt actual con el de la ultima instalacion (si existe hash guardado)
$depsHashFile = Join-Path $ProjectRoot ".last_pkg_requirements_hash"
$currentHash  = (Get-FileHash "requirements.txt" -Algorithm SHA256).Hash

$requirementsChanged = $true
if (Test-Path $depsHashFile) {
    $lastHash = Get-Content $depsHashFile
    if ($lastHash -eq $currentHash) {
        $requirementsChanged = $false
    }
}

if ($requirementsChanged) {
    Write-Host "  requirements.txt cambio. Descargando nuevas dependencias..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path "$UpdateDir\dependencies\python" -Force | Out-Null
    & .\.venv\Scripts\python.exe -m pip download -r requirements.txt -d "$UpdateDir\dependencies\python"
    if ($LASTEXITCODE -eq 0) {
        # Guardar el hash actual para la proxima comparacion
        $currentHash | Out-File -FilePath $depsHashFile -Encoding ascii -NoNewline
        Write-Host "  Dependencias incluidas en el paquete de actualizacion." -ForegroundColor Green
    } else {
        Write-Host "  ADVERTENCIA: No se pudieron descargar dependencias. El paquete no las incluira." -ForegroundColor Yellow
        Remove-Item -Recurse -Force "$UpdateDir\dependencies" -ErrorAction SilentlyContinue
    }
} else {
    Write-Host "  requirements.txt sin cambios. No se incluyen .whl (el cliente ya los tiene)." -ForegroundColor Gray
}

# --- 6. Generar update.ps1 y update.bat en el paquete ---
Write-Host ""
Write-Host "[6/6] Generando scripts de actualizacion..." -ForegroundColor Cyan

$updateScript = @"
# update.ps1 - Aplica una actualizacion de PeHaPe
# Ejecutar desde la raiz de la instalacion existente.

`$ErrorActionPreference = "Stop"
`$UpdateSource = Get-Location

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PeHaPe - Instalador de Actualizacion" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# --- Verificar version.json del update ---
if (-not (Test-Path "version.json")) {
    Write-Host "ERROR: No se encontro version.json en el paquete de actualizacion." -ForegroundColor Red
    pause; exit 1
}
`$newVersion = (Get-Content "version.json" | ConvertFrom-Json).version
Write-Host "Aplicando actualizacion a version: `$newVersion" -ForegroundColor Green
Write-Host ""

# --- Archivos y carpetas protegidos (NO se sobrescriben) ---
`$ProtectedFiles = @(
    "config\network_config.json",
    "config\ocr_config.json",
    "features\run_list.json",
    "features\ui_settings.json"
)
`$ProtectedFolders = @(
    "resources\images",
    "resources\ocr_images",
    "reports",
    "features"
)

# --- Pedir al usuario la ruta de instalacion ---
Write-Host "Ruta actual del paquete de actualizacion: `$UpdateSource"
`$InstallDir = Read-Host "Ingrese la ruta de la instalacion de PeHaPe (donde esta install.ok)"
if (-not (Test-Path "`$InstallDir\install.ok")) {
    Write-Host "ERROR: No se encontro install.ok en '`$InstallDir'. Verifique la ruta." -ForegroundColor Red
    pause; exit 1
}
Write-Host ""
Write-Host "Actualizando instalacion en: `$InstallDir" -ForegroundColor Cyan
Write-Host ""

# --- Copiar archivos nuevos (respetando protegidos) ---
`$sourceFiles = Get-ChildItem -Path `$UpdateSource -Recurse -File | Where-Object {
    `$_.Name -ne "update.ps1" -and `$_.Name -ne "update.bat"
}

`$updated  = 0
`$skipped  = 0
`$newFiles = 0

foreach (`$file in `$sourceFiles) {
    `$relative = `$file.FullName.Substring(`$UpdateSource.Path.Length).TrimStart("\")
    
    # Verificar si es un archivo protegido
    `$isProtected = `$false
    foreach (`$p in `$ProtectedFiles) {
        if (`$relative -eq `$p) { `$isProtected = `$true; break }
    }
    if (-not `$isProtected) {
        foreach (`$pf in `$ProtectedFolders) {
            if (`$relative.StartsWith(`$pf)) { `$isProtected = `$true; break }
        }
    }
    
    `$destPath = Join-Path `$InstallDir `$relative
    `$destDir  = Split-Path `$destPath

    if (`$isProtected -and (Test-Path `$destPath)) {
        Write-Host "  [SKIP] `$relative" -ForegroundColor Yellow
        `$skipped++
        continue
    }

    if (-not (Test-Path `$destDir)) { New-Item -ItemType Directory -Path `$destDir -Force | Out-Null }
    
    `$isNew = -not (Test-Path `$destPath)
    Copy-Item `$file.FullName `$destPath -Force
    if (`$isNew) {
        Write-Host "  [NEW]  `$relative" -ForegroundColor Green
        `$newFiles++
    } else {
        `$updated++
    }
}

Write-Host ""
Write-Host "Archivos actualizados: `$updated"  -ForegroundColor White
Write-Host "Archivos nuevos:       `$newFiles" -ForegroundColor Green
Write-Host "Archivos protegidos:   `$skipped"  -ForegroundColor Yellow

# --- Instalar nuevas dependencias si vienen en el paquete ---
if (Test-Path "dependencies\python") {
    Write-Host ""
    Write-Host "Instalando nuevas dependencias Python..." -ForegroundColor Cyan
    `$venvPython = Join-Path `$InstallDir ".venv\Scripts\python.exe"
    if (Test-Path `$venvPython) {
        & `$venvPython -m pip install --no-index --find-links="dependencies\python" -r "requirements.txt"
        if (`$LASTEXITCODE -eq 0) {
            Write-Host "Dependencias instaladas correctamente." -ForegroundColor Green
        } else {
            Write-Host "ADVERTENCIA: Algunas dependencias no se instalaron. Ejecute install.ps1 si hay problemas." -ForegroundColor Yellow
        }
    } else {
        Write-Host "ADVERTENCIA: No se encontro el entorno virtual en `$InstallDir. Ejecute install.ps1 primero." -ForegroundColor Yellow
    }
}

# --- Actualizar version en la instalacion ---
Copy-Item "version.json" (Join-Path `$InstallDir "version.json") -Force

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Actualizacion completada: v`$newVersion"  -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Reinicie la aplicacion para que los cambios surtan efecto."
Write-Host "(start-app-window.bat o start-all-offline.bat)"
Write-Host ""
pause
"@
$updateScript | Out-File -FilePath "$UpdateDir\update.ps1" -Encoding utf8

$updateBat = @"
@echo off
echo ========================================
echo   PeHaPe - Aplicar Actualizacion
echo ========================================
echo.
echo Este script aplicara la actualizacion a su instalacion existente de PeHaPe.
echo NO sobreescribira sus archivos de configuracion ni datos de pruebas.
echo.
powershell.exe -ExecutionPolicy Bypass -File "%~dp0update.ps1"
if errorlevel 1 (
    echo.
    echo ERROR: La actualizacion fallo. Revise los mensajes anteriores.
    pause
    exit /b 1
)
"@
$updateBat | Out-File -FilePath "$UpdateDir\update.bat" -Encoding ascii

Write-Host "Scripts de actualizacion generados." -ForegroundColor Green

# --- Crear ZIP del paquete de actualizacion ---
Write-Host ""
Write-Host "Creando ZIP del paquete de actualizacion..." -ForegroundColor Cyan
if (Test-Path $ZipFile) { Remove-Item $ZipFile }
Compress-Archive -Path "$UpdateDir\*" -DestinationPath $ZipFile -Force

$zipSizeMB = [math]::Round((Get-Item $ZipFile).Length / 1MB, 2)

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Paquete de Actualizacion Listo!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Version:   $AppVersion" -ForegroundColor White
Write-Host "  Archivo:   $ZipFile" -ForegroundColor White
Write-Host "  Tamano:    $zipSizeMB MB" -ForegroundColor White
Write-Host ""
Write-Host "Para distribuir:" -ForegroundColor Cyan
Write-Host "  1. Envie el ZIP al usuario"
Write-Host "  2. El usuario extrae el ZIP"
Write-Host "  3. El usuario ejecuta: update.bat"
Write-Host "  4. Reinicia la aplicacion"
Write-Host ""
