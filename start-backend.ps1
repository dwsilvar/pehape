param (
    [string]$ProjectRoot = $PSScriptRoot
)

Set-Location -Path $ProjectRoot # Cambia al directorio raíz del proyecto para que los comandos se ejecuten en el contexto correcto

# --- Configuración del Entorno Virtual y Dependencias ---

# Verificar si ya hay un entorno virtual activado
if ($env:VIRTUAL_ENV) {
    Write-Host "Usando el entorno virtual ya activado en: $env:VIRTUAL_ENV"
} else {
    # Si no hay un venv activo, buscar o crear uno local (.venv)
    $venvPath = Join-Path $ProjectRoot ".venv"
    
    if (Test-Path "$venvPath\Scripts\Activate.ps1") {
        Write-Host "Activando entorno virtual local en: $venvPath..."
        . "$venvPath\Scripts\Activate.ps1"
    } else {
        Write-Host "Entorno virtual no encontrado en la raíz (.venv). Creándolo ahora..."
        python -m venv .venv
        Write-Host "Activando entorno virtual local..."
        . "$venvPath\Scripts\Activate.ps1"
    }
}


Write-Host "Iniciando servidor backend de FastAPI..."
python (Join-Path $ProjectRoot "orchestrator_api.py")