$ErrorActionPreference = "Stop"

function Add-ToPathIfExists([string] $dir) {
  if ([string]::IsNullOrWhiteSpace($dir)) { return }
  if (-not (Test-Path -LiteralPath $dir)) { return }
  $parts = ($env:Path -split ";") | Where-Object { $_ -and $_.Trim() -ne "" }
  if ($parts -contains $dir) { return }
  $env:Path = ($dir + ";" + $env:Path)
}

$candidateSdkRoots = @(
  (Join-Path $env:LOCALAPPDATA "Android\Sdk"),
  (Join-Path $env:USERPROFILE "AppData\Local\Android\Sdk"),
  "C:\Android\Sdk"
) | Where-Object { $_ -and $_.Trim() -ne "" } | Select-Object -Unique

$sdkRoot = $null
foreach ($c in $candidateSdkRoots) {
  if (Test-Path -LiteralPath $c) { $sdkRoot = $c; break }
}

if (-not $sdkRoot) {
  Write-Host "No encontré Android SDK en ubicaciones típicas." -ForegroundColor Yellow
  Write-Host "Instala Android Studio (SDK + Platform-Tools) o ajusta ANDROID_SDK_ROOT manualmente." -ForegroundColor Yellow
  Write-Host "Ejemplo (solo para esta terminal):" -ForegroundColor Yellow
  Write-Host '  $env:ANDROID_SDK_ROOT="C:\Android\Sdk"' -ForegroundColor Yellow
  Write-Host '  $env:ANDROID_HOME=$env:ANDROID_SDK_ROOT' -ForegroundColor Yellow
  Write-Host '  $env:Path="$env:ANDROID_SDK_ROOT\platform-tools;$env:ANDROID_SDK_ROOT\emulator;$env:Path"' -ForegroundColor Yellow
  exit 1
}

$env:ANDROID_SDK_ROOT = $sdkRoot
$env:ANDROID_HOME = $sdkRoot

Add-ToPathIfExists (Join-Path $sdkRoot "platform-tools")
Add-ToPathIfExists (Join-Path $sdkRoot "emulator")
Add-ToPathIfExists (Join-Path $sdkRoot "cmdline-tools\latest\bin")

Write-Host "ANDROID_SDK_ROOT = $env:ANDROID_SDK_ROOT"
Write-Host "ANDROID_HOME     = $env:ANDROID_HOME"

$adb = Get-Command adb -ErrorAction SilentlyContinue
if (-not $adb) {
  Write-Host "ADB no está disponible en PATH. Revisa que exista $sdkRoot\platform-tools\adb.exe" -ForegroundColor Red
  exit 1
}

Write-Host "ADB encontrado: $($adb.Source)"
adb version | Out-Host

