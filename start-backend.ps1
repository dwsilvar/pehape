param (
    [string]$ProjectRoot = $PSScriptRoot
)

# Definir la ruta al directorio del backend
$backendDir = Join-Path $ProjectRoot "backend"
Set-Location -Path $backendDir # Cambia al directorio del backend para que los comandos se ejecuten en el contexto correcto

# --- Configuración del Entorno Virtual y Dependencias ---

# Verificar si ya hay un entorno virtual activado
if ($env:VIRTUAL_ENV) {
    Write-Host "Usando el entorno virtual ya activado en: $env:VIRTUAL_ENV"
} else {
    # Si no hay un venv activo, buscar o crear uno local
    $venvPath = Join-Path $ProjectRoot ".venv"
    if (-not (Test-Path $venvPath)) {
        $venvPath = Join-Path $backendDir "venv"
    }
    
    if (Test-Path "$venvPath\Scripts\Activate.ps1") {
        Write-Host "Activando entorno virtual local en: $venvPath..."
        . "$venvPath\Scripts\Activate.ps1"
    } else {
        Write-Host "Entorno virtual no encontrado en root (.venv) ni backend (venv). Creándolo ahora en 'backend\venv'..."
        $venvPath = Join-Path $backendDir "venv"
        python -m venv venv
        Write-Host "Activando entorno virtual local..."
        . "$venvPath\Scripts\Activate.ps1"
    }
}


Write-Host "Iniciando servidor backend de Flask..."
python (Join-Path $backendDir "backend_server.py")