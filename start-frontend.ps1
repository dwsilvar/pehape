param (
    [string]$ProjectRoot = $PSScriptRoot
)
# Definir la ruta absoluta al directorio del frontend y cambiar a ella
$frontendDir = Join-Path $ProjectRoot "frontend"
Set-Location -Path $frontendDir

Write-Host "Asegurando que las dependencias de npm estén instaladas..."
npm install

Write-Host "Iniciando servidor de desarrollo de Vite..."
Write-Host "Puedes acceder a la aplicación en http://localhost:3000"

# Ejecuta el servidor de desarrollo directamente. El script se mantendrá en ejecución
# hasta que se detenga manualmente (Ctrl+C).
npm run dev