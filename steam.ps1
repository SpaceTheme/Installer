function Check-Admin {
    $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) {
        Write-Output "Script is not running with elevated privileges. Please run as Administrator."
        exit
    }
}

Check-Admin

$tempPath = "$env:TEMP\SpaceTheme_for_Steam.zip"
$skinsFolder = "C:\Program Files (x86)\Steam\steamui\skins"
$extractedFolderPath = "$skinsFolder\Steam-main"
$destinationFolder = "$skinsFolder\SpaceTheme For Steam"

if (Test-Path $skinsFolder) {
    Write-Output "Millennium installed! Proceeding with SpaceTheme installation..."

    Write-Output "Downloading SpaceTheme for Steam..."
    Invoke-WebRequest -Uri "https://github.com/SpaceTheme/Steam/archive/refs/heads/main.zip" -OutFile $tempPath

    Write-Output "Extracting files..."
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::ExtractToDirectory($tempPath, $skinsFolder)

    if (Test-Path $extractedFolderPath) {
        Rename-Item -Path $extractedFolderPath -NewName "SpaceTheme For Steam"
        Write-Output "SpaceTheme installed successfully as 'SpaceTheme For Steam'."
    } else {
        Write-Output "Failed to find the extracted 'Steam-main' folder."
    }

    Remove-Item $tempPath -Force
} else {
    Write-Output "You don't have Millennium installed."
    
    if (Test-Path $tempPath) {
        Remove-Item $tempPath -Force
    }
}
