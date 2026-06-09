param (
    [string]$ProjectRoot = $PSScriptRoot
)

Write-Host 'Iniciando modo Producción / Remoto...'
Write-Host 'El servidor estará disponible en http://localhost:5001 y en su IP de red.'
Write-Host '----------------------------------------------------------------'

# Reutilizamos la lógica de inicio del backend, que ahora incluye el frontend servido
.\start-backend.ps1 -ProjectRoot $ProjectRoot
