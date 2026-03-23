# Deploy MexiChat Pagos Edge Functions
$ErrorActionPreference = "Stop"
$ref = "cchakgecusfybcokbmau"
$fns = @("payment-send","payment-history","payment-status","oauth-connect","oauth-callback","oauth-status")

Write-Host "Setting secrets..." -ForegroundColor Cyan
supabase secrets set --env-file .env.local --project-ref $ref

foreach ($fn in $fns) {
  Write-Host "  Deploying $fn..." -ForegroundColor DarkGray
  supabase functions deploy $fn --project-ref $ref
  if ($LASTEXITCODE -ne 0) { Write-Host "FAILED: $fn" -ForegroundColor Red; exit 1 }
  Write-Host "  ✅ $fn" -ForegroundColor Green
}

# Webhook: no JWT verification (Mercado Pago can't send JWTs)
Write-Host "  Deploying webhook-mercadopago (no-verify-jwt)..." -ForegroundColor DarkGray
supabase functions deploy webhook-mercadopago --project-ref $ref --no-verify-jwt
Write-Host "  ✅ webhook-mercadopago" -ForegroundColor Green

Write-Host "`n✅ All deployed!`n" -ForegroundColor Green
Write-Host "Webhook URL (set in MP dashboard):" -ForegroundColor Yellow
Write-Host "  https://$ref.supabase.co/functions/v1/webhook-mercadopago" -ForegroundColor White
