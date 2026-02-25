# Install NVM for Windows if not already installed
$nvmPath = "$env:USERPROFILE\AppData\Roaming\nvm\nvm.exe"
if (-not (Test-Path $nvmPath)) {
    Write-Host "Installing NVM for Windows..."
    $setupExe = "$env:TEMP\nvm-setup.exe"
    Invoke-WebRequest https://github.com/coreybutler/nvm-windows/releases/download/1.1.11/nvm-setup.exe -OutFile $setupExe
    Start-Process -Wait -FilePath $setupExe -ArgumentList /SILENT
    Remove-Item $setupExe
    
    # Refresh environment variables
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
}

# Add NVM directory to PATH if not already present
$nvmDir = "$env:USERPROFILE\AppData\Roaming\nvm"
if ($env:Path -notlike "*$nvmDir*") {
    $env:Path = "$nvmDir;$env:Path"
}

# Install Node.js LTS if not already installed
Write-Host "Installing Node.js LTS..."
& $nvmPath install lts
& $nvmPath use lts

# Refresh environment again to ensure we have access to node and npm
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

# Get the Node.js installation path from NVM
$nodePath = & $nvmPath root
$nodeVersion = (Get-ChildItem $nodePath | Where-Object { $_.PSIsContainer } | Sort-Object Name -Descending | Select-Object -First 1).Name
$npmPath = "$nodePath\$nodeVersion"

if ($env:Path -notlike "*$npmPath*") {
    $env:Path = "$npmPath;$env:Path"
}

# Verify installations
Write-Host "Verifying installations..."
& $nvmPath version
& "$npmPath\node.exe" -v
& "$npmPath\npm.cmd" -v

# Install frontend dependencies
Write-Host "Installing frontend dependencies..."
Set-Location frontend
& "$npmPath\npm.cmd" install