# PowerShell helper to install dependencies and build the frontend
param(
    [switch]$InstallOnly
)

$ErrorActionPreference = 'Stop'

Write-Host "Running frontend build script..."
Push-Location $PSScriptRoot

if (-not (Test-Path "node_modules")) {
    Write-Host "Installing npm dependencies..."
    npm install
} elseif ($InstallOnly) {
    Write-Host "node_modules already present; exiting (InstallOnly)"
    Pop-Location
    exit 0
}

Write-Host "Building TypeScript project..."
npm run build

Write-Host "Frontend build completed. Output in: $PSScriptRoot\dist"
Pop-Location
