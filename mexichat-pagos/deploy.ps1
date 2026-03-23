#!/usr/bin/env pwsh
# Deploy all Edge Functions to Supabase

$ErrorActionPreference = "Stop"

Write-Host "🚀 Deploying MexiChat Pagos Edge Functions..." -ForegroundColor Cyan

# Set secrets
Write-Host "  Setting secrets..." -ForegroundColor DarkGray
supabase secrets set --env-file .env.local

# Deploy each function
$functions = @(
    "payment-send",
    "payment-history",
    "payment-status",
    "oauth-connect",
    "oauth-callback",
    "oauth-status",
    "webhook-mercadopago"
)

foreach ($fn in $functions) {
    Write-Host "  Deploying $fn..." -ForegroundColor DarkGray
    supabase functions deploy $fn --project-ref cchakgecusfybcokbmau
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ❌ Failed to deploy $fn" -ForegroundColor Red
        exit 1
    }
    Write-Host "  ✅ $fn deployed" -ForegroundColor Green
}

# Note: webhook function should NOT require JWT
Write-Host "  Disabling JWT for webhook-mercadopago..." -ForegroundColor DarkGray
supabase functions deploy webhook-mercadopago --project-ref cchakgecusfybcokbmau --no-verify-jwt

Write-Host ""
Write-Host "✅ All functions deployed!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Function URLs:" -ForegroundColor Yellow
foreach ($fn in $functions) {
    Write-Host "  https://cchakgecusfybcokbmau.supabase.co/functions/v1/$fn" -ForegroundColor White
}
Write-Host ""
