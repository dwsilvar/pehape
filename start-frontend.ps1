param (
    [string]$ProjectRoot = $PSScriptRoot
)
# Definir la ruta absoluta al directorio del frontend y cambiar a ella
$frontendDir = Join-Path $ProjectRoot "frontend"
Set-Location -Path $frontendDir

# Cargar puerto desde config/network_config.json
$frontendPort = 3000
$configFile = Join-Path $ProjectRoot "config\network_config.json"
if (Test-Path $configFile) {
    try {
        $json = Get-Content $configFile -Raw | ConvertFrom-Json
        if ($json.frontend_port) {
            $frontendPort = $json.frontend_port
        }
    } catch {}
}



Write-Host "Asegurando que las dependencias de npm estén instaladas..."
# Usar npm.cmd en lugar de npm.ps1 para evitar problemas de política de ejecución
& "npm.cmd" install

Write-Host "Iniciando servidor de desarrollo de Vite..."
Write-Host "Puedes acceder a la aplicación en http://localhost:$frontendPort"

# Ejecuta el servidor de desarrollo directamente. El script se mantendrá en ejecución
# hasta que se detenga manualmente (Ctrl+C).
& "npm.cmd" run dev