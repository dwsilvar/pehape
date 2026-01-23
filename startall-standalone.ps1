param (
    [Parameter(Mandatory=$true)]
    [string]$NodeExePath
)

# Validar que el archivo existe
if (-not (Test-Path $NodeExePath -PathType Leaf)) {
    Write-Error "El archivo especificado no existe: $NodeExePath"
    exit 1
}

# Obtener el directorio del ejecutable de Node
$NodeDir = Split-Path -Parent $NodeExePath

Write-Host "Configurando entorno para usar Node desde: $NodeDir"

# Agregar el directorio de Node al inicio del PATH para la sesión actual
# Esto asegura que 'node' y 'npm' (si está en la misma carpeta) se ejecuten desde esta ubicación
$env:Path = "$NodeDir;$env:Path"

# Verificar versión de node y npm para confirmar el entorno
try {
    $nodeVersion = node --version
    Write-Host "Versión de Node detectada: $nodeVersion"
    
    # Intentar verificar npm también, ya que se usará en start-frontend.ps1
    # Nota: npm puede ser npm.cmd o npm.ps1 en Windows
    try {
        $npmVersion = npm --version
        Write-Host "Versión de NPM detectada: $npmVersion"
    } catch {
        Write-Warning "No se pudo detectar 'npm'. Asegúrate de que npm eata en la misma carpeta que node.exe"
    }
} catch {
    Write-Warning "Hubo un problema verificando 'node' en el PATH actual."
}

# --- Lógica basada en start-all.ps1 ---

Write-Host "Iniciando servidor de backend en segundo plano..."
# El backend usa Python, por lo que el cambio de PATH de node no debería afectarlo negativamente
$backendJob = Start-Job -FilePath (Join-Path $PSScriptRoot "start-backend.ps1") -ArgumentList $PSScriptRoot -Name "Backend"

Write-Host "Iniciando servidor de frontend en segundo plano..."
# Start-Job hereda las variables de entorno del proceso actual (incluyendo el PATH modificado)
$frontendJob = Start-Job -FilePath (Join-Path $PSScriptRoot "start-frontend.ps1") -ArgumentList $PSScriptRoot -Name "Frontend"

Write-Host "Ambos servidores se están ejecutando con la configuración standalone. Presiona Ctrl+C para detenerlos."

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
    # Este bloque se ejecuta cuando se presiona Ctrl+C o si ocurre un error fatal
    Write-Host "`nDeteniendo todos los servidores..."
    Get-Job | Stop-Job
    Get-Job | Remove-Job
    Write-Host "Servidores detenidos y limpiados."
}
