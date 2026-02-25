# Inicia los servidores de backend y frontend en trabajos de segundo plano
# y muestra su salida en la consola actual.

Write-Host "Iniciando servidor de backend en segundo plano..."
$backendJob = Start-Job -FilePath (Join-Path $PSScriptRoot "start-backend.ps1") -ArgumentList $PSScriptRoot -Name "Backend"

Write-Host "Iniciando servidor de frontend en segundo plano..."
$frontendJob = Start-Job -FilePath (Join-Path $PSScriptRoot "start-frontend.ps1") -ArgumentList $PSScriptRoot -Name "Frontend"

Write-Host "Ambos servidores se están ejecutando. Presiona Ctrl+C para detenerlos."

try {
    # Bucle para recibir y mostrar la salida de ambos trabajos
    while ($true) {
        $backendJob | Receive-Job
        $frontendJob | Receive-Job

        # Pequeña pausa para no consumir 100% de CPU
        Start-Sleep -Milliseconds 500
    }
}
finally {
    # Este bloque se ejecuta cuando se presiona Ctrl+C
    Write-Host "`nDeteniendo todos los servidores..."
    Get-Job | Stop-Job
    Get-Job | Remove-Job
    Write-Host "Servidores detenidos y limpiados."
}