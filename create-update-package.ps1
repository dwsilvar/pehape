# create-update-package.ps1
# Genera un paquete de ACTUALIZACION ligero (sin Tesseract, sin Allure, sin deps no cambiadas).
# Ideal para distribuir nuevas versiones a usuarios que ya tienen la instalacion base.
#
# Contenido del paquete de actualizacion:
#   - frontend/dist/     (build compilado, lo que mas cambia)
#   - api/               (modulos FastAPI)
#   - executor/          (motor de ejecucion)
#   - util/              (utilidades)
#   - orchestrator.py, orchestrator_api.py
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

$TargetDir = Join-Path $ProjectRoot "target"
if (-not (Test-Path $TargetDir)) {
    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
}
$UpdateDir = Join-Path $TargetDir "update_package"
$ZipFile   = Join-Path $TargetDir "pehape-update-$AppVersion-$BuildDate.zip"

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
    "$UpdateDir\api",
    "$UpdateDir\executor",
    "$UpdateDir\util"
)
foreach ($dir in $dirs) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
}
Write-Host "Estructura de directorios creada." -ForegroundColor Green

# --- 1. Compilar Frontend ---
Write-Host ""
Write-Host "[1/5] Compilando Frontend..." -ForegroundColor Cyan
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

# --- 2. Copiar modulos del proyecto ---
Write-Host ""
Write-Host "[2/5] Copiando modulos del proyecto..." -ForegroundColor Cyan
$modules = @("api", "executor", "util", "config")
foreach ($mod in $modules) {
    if (Test-Path $mod) {
        Copy-Item -Recurse -Force $mod "$UpdateDir\"
        Write-Host "  Copiado: $mod" -ForegroundColor Gray
    }
}

# Scripts raiz
$rootScripts = @("orchestrator.py", "orchestrator_api.py")
foreach ($script in $rootScripts) {
    if (Test-Path $script) {
        Copy-Item $script "$UpdateDir\"
        Write-Host "  Copiado: $script" -ForegroundColor Gray
    }
}

# Copiar features (solo .py y example.feature)
if (Test-Path "features") {
    $SourceFeaturesDir = Join-Path $ProjectRoot "features"
    $DestFeaturesDir = Join-Path $UpdateDir "features"
    New-Item -ItemType Directory -Path $DestFeaturesDir -Force | Out-Null
    
    $featuresPyCount = 0
    $files = Get-ChildItem -Path $SourceFeaturesDir -Recurse -File
    foreach ($file in $files) {
        $relativePath = $file.FullName.Substring($SourceFeaturesDir.Length + 1)
        $shouldCopy = $false
        
        if ($file.Extension -eq ".py") {
            $shouldCopy = $true
            $featuresPyCount++
        }
        elseif ($relativePath -eq "example.feature") {
            $shouldCopy = $true
        }
        
        if ($shouldCopy) {
            $destFilePath = Join-Path $DestFeaturesDir $relativePath
            $destFileDir = Split-Path $destFilePath
            if (-not (Test-Path $destFileDir)) {
                New-Item -ItemType Directory -Path $destFileDir -Force | Out-Null
            }
            Copy-Item $file.FullName $destFilePath -Force
        }
    }
    Write-Host "  Copiado: features (incluyendo $featuresPyCount archivos .py y example.feature)" -ForegroundColor Gray
}

Write-Host "Modulos copiados." -ForegroundColor Green

# --- 3. Copiar version.json y requirements.txt ---
Write-Host ""
Write-Host "[3/5] Copiando archivos de control de version..." -ForegroundColor Cyan
Copy-Item "version.json"    "$UpdateDir\"
Copy-Item "requirements.txt" "$UpdateDir\"
Write-Host "Archivos de control copiados." -ForegroundColor Green

# --- 4. Detectar si requirements.txt cambio y si hay que incluir nuevas deps ---
Write-Host ""
Write-Host "[4/5] Verificando dependencias Python..." -ForegroundColor Cyan

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

# --- 5. Generar update.ps1 y update.bat en el paquete ---
Write-Host ""
Write-Host "[5/5] Generando scripts de actualizacion..." -ForegroundColor Cyan

$updateScript = @"
param(
    [string]`$InstallDir = "",
    [switch]`$Silent = `$false,
    [switch]`$Restart = `$false,
    [string]`$Launcher = "",
    [string]`$NodePath = ""
)

# update.ps1 - Aplica una actualizacion de PeHaPe
# Ejecutar desde la raiz de la instalacion existente.

`$ErrorActionPreference = "Stop"
`$UpdateSource = `$PSScriptRoot
if (-not `$UpdateSource) { `$UpdateSource = (Get-Location).ToString() }

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PeHaPe - Instalador de Actualizacion" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# --- Verificar version.json del update ---
if (-not (Test-Path (Join-Path `$UpdateSource "version.json"))) {
    Write-Host "ERROR: No se encontro version.json en el paquete de actualizacion." -ForegroundColor Red
    if (-not `$Silent) { pause }
    exit 1
}
`$newVersion = (Get-Content (Join-Path `$UpdateSource "version.json") | ConvertFrom-Json).version
Write-Host "Aplicando actualizacion a version: `$newVersion" -ForegroundColor Green
Write-Host ""

# --- Archivos y carpetas protegidos (NO se sobrescriben) ---
`$ProtectedFiles = @(
    "features\example.feature"
)
`$ProtectedFolders = @(
    "resources\images",
    "resources\ocr_images",
    "reports"
)

# --- Pedir al usuario la ruta de instalacion si no se provee ---
if (-not `$InstallDir) {
    Write-Host "Ruta actual del paquete de actualizacion: `$UpdateSource"
    `$InstallDir = Read-Host "Ingrese la ruta de la instalacion de PeHaPe (donde esta install.ok)"
}

if (-not (Test-Path "`$InstallDir\install.ok")) {
    Write-Host "ERROR: No se encontro install.ok en '`$InstallDir'. Verifique la ruta." -ForegroundColor Red
    if (-not `$Silent) { pause }
    exit 1
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
`$skippedJsonFiles = @()

foreach (`$file in `$sourceFiles) {
    `$relative = `$file.FullName.Substring(`$UpdateSource.Length).TrimStart("\")
    
    # Validar si es un archivo de configuracion JSON en la carpeta config
    `$isJsonConfig = `$relative.StartsWith("config\") -and `$relative.EndsWith(".json")
    
    # Verificar si es un archivo protegido
    `$isProtectedFile = `$false
    foreach (`$p in `$ProtectedFiles) {
        if (`$relative -eq `$p) { `$isProtectedFile = `$true; break }
    }
    
    # Verificar si es una carpeta protegida
    `$isProtectedFolder = `$false
    foreach (`$pf in `$ProtectedFolders) {
        if (`$relative.StartsWith(`$pf)) { `$isProtectedFolder = `$true; break }
    }
    
    `$destPath = Join-Path `$InstallDir `$relative
    `$destDir  = Split-Path `$destPath

    # Comportamiento personalizado para JSON
    if (Test-Path `$destPath) {
        if (`$isJsonConfig) {
            Write-Host "  [SKIP - CONFIG] `$relative (Ya existe, requiere actualizacion manual)" -ForegroundColor Yellow
            `$skippedJsonFiles += `$relative
            `$skipped++
            continue
        }
        if (`$isProtectedFile -or `$isProtectedFolder) {
            Write-Host "  [SKIP] `$relative" -ForegroundColor Yellow
            `$skipped++
            continue
        }
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
if (Test-Path (Join-Path `$UpdateSource "dependencies\python")) {
    Write-Host ""
    Write-Host "Instalando nuevas dependencias Python..." -ForegroundColor Cyan
    `$venvPython = Join-Path `$InstallDir ".venv\Scripts\python.exe"
    if (Test-Path `$venvPython) {
        & `$venvPython -m pip install --no-index --find-links=(Join-Path `$UpdateSource "dependencies\python") -r (Join-Path `$UpdateSource "requirements.txt")
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
Copy-Item (Join-Path `$UpdateSource "version.json") (Join-Path `$InstallDir "version.json") -Force

# --- Alertar sobre configuraciones JSON omitidas que requieren actualizacion manual ---
if (`$skippedJsonFiles.Count -gt 0) {
    Write-Host ""
    Write-Host "======================================================================" -ForegroundColor Yellow
    Write-Host "  ATENCION: Archivos de configuracion JSON no sobrescritos" -ForegroundColor Yellow
    Write-Host "======================================================================" -ForegroundColor Yellow
    Write-Host "Los siguientes archivos ya existian y NO fueron sobrescritos para" -ForegroundColor Yellow
    Write-Host "proteger sus configuraciones actuales. Si esta version de PeHaPe" -ForegroundColor Yellow
    Write-Host "introduce nuevos parametros, debera agregarlos manualmente:" -ForegroundColor Yellow
    foreach (`$jsonFile in `$skippedJsonFiles) {
        Write-Host "  - `$jsonFile" -ForegroundColor Yellow
    }
    Write-Host "======================================================================" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Actualizacion completada: v`$newVersion"  -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

if (`$Restart) {
    Write-Host "Reiniciando la aplicacion..." -ForegroundColor Green
    `$restartScript = `$Launcher
    if (-not `$restartScript) {
        `$restartScript = "start-all.bat"
        if (Test-Path (Join-Path `$InstallDir "start-all-offline.bat")) {
            `$restartScript = "start-all-offline.bat"
        } elseif (Test-Path (Join-Path `$InstallDir "start-all.bat")) {
            `$restartScript = "start-all.bat"
        } elseif (Test-Path (Join-Path `$InstallDir "startall-standalone.bat")) {
            `$restartScript = "startall-standalone.bat"
        }
    }
    
    if (`$restartScript -eq "startall-standalone.bat" -and `$NodePath) {
        Write-Host "Iniciando standalone con Node: `$NodePath" -ForegroundColor Green
        Start-Process -FilePath (Join-Path `$InstallDir `$restartScript) -ArgumentList "`"`$NodePath`"" -WorkingDirectory `$InstallDir
    } else {
        Start-Process -FilePath (Join-Path `$InstallDir `$restartScript) -WorkingDirectory `$InstallDir
    }
} else {
    Write-Host "Reinicie la aplicacion para que los cambios surtan efecto."
    Write-Host "(start-all.bat o start-all-offline.bat)"
}
Write-Host ""
if (-not `$Silent) { pause }
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
Get-ChildItem -Path "$UpdateDir" | Compress-Archive -DestinationPath $ZipFile -Force

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
