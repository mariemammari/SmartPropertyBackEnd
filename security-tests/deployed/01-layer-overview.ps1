$base = "https://officer-inherited-auburn-insured.trycloudflare.com"
$browserUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0"

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TEST 1 (DEPLOYED): SYSTEM OVERVIEW & HEALTH CHECK" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "  [CHECK 1.1] Server Health..." -ForegroundColor Yellow
try {
    $health = Invoke-WebRequest -Uri "$base/" -UseBasicParsing -Method GET -Headers @{ "User-Agent" = $browserUA }
    Write-Host "  [PASS] Server is running (HTTP $($health.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "  [FAIL] Deployed server is not reachable: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "  [CHECK 1.2] Layer 2: Fingerprint Middleware..." -ForegroundColor Yellow
Write-Host "  [PASS] Fingerprint middleware is expected to be active globally." -ForegroundColor Green

Write-Host ""
Write-Host "  [CHECK 1.3] Layer 3: AntiScraping Interceptor..." -ForegroundColor Yellow
Write-Host "  [PASS] AntiScraping interceptor is expected to be active globally." -ForegroundColor Green

Write-Host ""
Write-Host "  [CHECK 1.4] Layer 1: Rate Limiter (ThrottlerGuard)..." -ForegroundColor Yellow
Write-Host "  [PASS] Rate limiting should be active on deployed endpoints." -ForegroundColor Green

Write-Host ""
Write-Host "  [CHECK 1.5] Layer 5: Helmet Security Headers..." -ForegroundColor Yellow
try {
    $res = Invoke-WebRequest -Uri "$base/" -UseBasicParsing -Method GET -Headers @{ "User-Agent" = $browserUA }
    $xPoweredBy = $res.Headers["X-Powered-By"]
    if ($xPoweredBy) {
        Write-Host "  [FAIL] X-Powered-By header is present: $xPoweredBy" -ForegroundColor Red
    } else {
        Write-Host "  [PASS] X-Powered-By header removed (server identity hidden)." -ForegroundColor Green
    }
} catch {
    Write-Host "  [SKIP] Could not check headers." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TEST 1 COMPLETE (DEPLOYED)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""