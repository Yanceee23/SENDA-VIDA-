# run.ps1 - Ejecuta expo run:android asegurando local.properties con sdk.dir
# El prebuild de Expo borra android/local.properties; este script lo regenera antes de compilar.

$ErrorActionPreference = "Stop"

# Detectar ruta del SDK: ANDROID_HOME/ANDROID_SDK_ROOT, rutas típicas, o valor por defecto
$sdkDir = $env:ANDROID_HOME
if (-not $sdkDir) { $sdkDir = $env:ANDROID_SDK_ROOT }
if (-not $sdkDir -or -not (Test-Path -LiteralPath $sdkDir)) {
  $candidates = @(
    (Join-Path $env:LOCALAPPDATA "Android\Sdk"),
    (Join-Path $env:USERPROFILE "AppData\Local\Android\Sdk"),
    "C:\Users\Yancy\AppData\Local\Android\Sdk",
    "C:\Android\Sdk"
  )
  foreach ($c in $candidates) {
    if ($c -and (Test-Path -LiteralPath $c)) { $sdkDir = $c; break }
  }
}
if (-not $sdkDir -or -not (Test-Path -LiteralPath $sdkDir)) {
  Write-Host "SDK no encontrado. Configura ANDROID_HOME o instala Android Studio." -ForegroundColor Red
  exit 1
}

$env:ANDROID_HOME = $sdkDir
$env:ANDROID_SDK_ROOT = $sdkDir

# Gradle usa barras normales en local.properties
$sdkDirNorm = $sdkDir -replace '\\', '/'

# Escribir local.properties
$androidDir = Join-Path $PSScriptRoot "android"
if (-not (Test-Path -LiteralPath $androidDir)) {
  New-Item -ItemType Directory -Path $androidDir -Force | Out-Null
}
$localProps = Join-Path $androidDir "local.properties"
$content = "sdk.dir=$sdkDirNorm"
# Gradle no tolera BOM; PowerShell Set-Content -Encoding UTF8 lo añade.
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($localProps, $content, $utf8NoBom)
Write-Host "local.properties actualizado: sdk.dir=$sdkDirNorm" -ForegroundColor Green

# Ejecutar expo run:android
Set-Location $PSScriptRoot
npx expo run:android
