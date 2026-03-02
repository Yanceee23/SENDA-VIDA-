$ErrorActionPreference = "Stop"

Write-Host "Preparando variables Android (ANDROID_SDK_ROOT/adb)..." -ForegroundColor Cyan
. "$PSScriptRoot\android-env.ps1"

Write-Host ""
Write-Host "Dispositivos ADB (debe aparecer tu emulador como 'device'):" -ForegroundColor Cyan
adb devices | Out-Host

Write-Host ""
Write-Host "Iniciando Expo para Android (Expo Go)..." -ForegroundColor Cyan
cmd /c "set CI=1&& npx expo start --android --port 8085"

