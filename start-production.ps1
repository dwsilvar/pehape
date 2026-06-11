param (
    [string]$ProjectRoot = $PSScriptRoot
)

# Cargar puerto desde config/network_config.json
$backendPort = 5001
$configFile = Join-Path $ProjectRoot "config\network_config.json"
if (Test-Path $configFile) {
    try {
        $json = Get-Content $configFile -Raw | ConvertFrom-Json
        if ($json.backend_port) {
            $backendPort = $json.backend_port
        }
    } catch {}
}


Write-Host 'Iniciando modo Producción / Remoto...'
Write-Host "El servidor estará disponible en http://localhost:$backendPort y en su IP de red."
Write-Host '----------------------------------------------------------------'

# Reutilizamos la lógica de inicio del backend, que ahora incluye el frontend servido
.\start-backend.ps1 -ProjectRoot $ProjectRoot
