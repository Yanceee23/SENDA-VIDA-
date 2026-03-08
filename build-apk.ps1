# Script para generar APK de producción (SENDA VIDA)
# Ejecutar desde: c:\APPS\MOVIL
# La APK usara https://senda-vida.onrender.com/api como backend

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

Write-Host "=== SENDA VIDA - Build APK Produccion ===" -ForegroundColor Cyan
Write-Host "Backend: https://senda-vida.onrender.com/api" -ForegroundColor Gray
Write-Host ""

# npm install
Write-Host "Instalando dependencias..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) { exit 1 }

# eas build
Write-Host ""
Write-Host "Iniciando build en EAS Cloud..." -ForegroundColor Yellow
Write-Host "La APK se descargara desde expo.dev cuando termine." -ForegroundColor Gray
Write-Host ""

npx eas build --platform android --profile production --non-interactive
