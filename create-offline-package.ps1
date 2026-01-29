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
    "$PackageDir\core",
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
Copy-Item -Recurse -Force "features" "$PackageDir\"
Copy-Item -Recurse -Force "util" "$PackageDir\"
Copy-Item -Recurse -Force "config" "$PackageDir\"
Copy-Item -Recurse -Force "resources" "$PackageDir\"
Copy-Item "behave_master.py" "$PackageDir\"
Copy-Item "requirements.txt" "$PackageDir\"

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
if not exist .venv (
    echo [ERROR] Virtual environment not found. Please run install.ps1 first.
    pause
    exit /b 1
)
call .venv\Scripts\activate
python backend\backend_server.py
"@
$startBackendOffline | Out-File -FilePath "$PackageDir\start-backend-offline.bat" -Encoding ascii

# 7. Generate installation script for the target machine
Write-Host "Generating install.ps1..."
$installScript = @"
# install.ps1 - Offline Installer for Pehape
`$ProjectRoot = Get-Location

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Pehape Offline Installer" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. Create Virtual Environment
if (-not (Test-Path ".venv")) {
    Write-Host "Creating virtual environment..."
    python -m venv .venv
}

# 2. Install Dependencies
Write-Host "Installing Python dependencies from local files..."
& .\.venv\Scripts\python.exe -m pip install --no-index --find-links="dependencies\python" -r requirements.txt

# 3. Configure Tesseract
if (Test-Path "tesseract-ocr\tesseract.exe") {
    Write-Host "Configuring local Tesseract OCR..."
    `$localTesseract = "`$ProjectRoot\tesseract-ocr\tesseract.exe"
    # Update config.py to use the local path
    `$configFile = "config\config.py"
    (Get-Content `$configFile) | ForEach-Object {
        `$_ -replace 'TESSERACT_CMD_PATH = r".*"', "TESSERACT_CMD_PATH = r'`$localTesseract'"
    } | Set-Content `$configFile
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Installation Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "Next steps:"
Write-Host "1. Run start-backend-offline.bat to start the server."
Write-Host "   (Frontend will be served at http://localhost:5000)"
"@

$installScript | Out-File -FilePath "$PackageDir\install.ps1" -Encoding utf8

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Offline Package Created Successfully!" -ForegroundColor Green
Write-Host "Location: $PackageDir" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
