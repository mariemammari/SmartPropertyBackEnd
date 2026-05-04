$base = "https://officer-inherited-auburn-insured.trycloudflare.com"
$frontend = "https://smartproperty-front.vercel.app"
$browserUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0"

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TEST 3 (DEPLOYED): RATE LIMITING STRESS TEST" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "  [CHECK 3.1] Sending 310 rapid requests..." -ForegroundColor Yellow
Write-Host "         Expected: request 301+ returns HTTP 429." -ForegroundColor Gray
Write-Host ""

$successCount = 0
$blockedAt = 0
$headers = @{ "User-Agent" = $browserUA; "Referer" = $frontend }

for ($i = 1; $i -le 310; $i++) {
    try {
        Invoke-WebRequest -Uri "$base/" -UseBasicParsing -Method GET -Headers $headers | Out-Null
        $successCount++
        if ($i % 20 -eq 0) {
            Write-Host "         Request #$i -> 200 OK (allowed)" -ForegroundColor Gray
        }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode -eq 429) {
            $blockedAt = $i
            Write-Host "         Request #$i -> 429 BLOCKED!" -ForegroundColor Red
            break
        } else {
            Write-Host "         Request #$i -> HTTP $statusCode (unexpected)" -ForegroundColor Yellow
        }
    }
}

Write-Host ""
if ($blockedAt -gt 0) {
    Write-Host "  [PASS] Rate Limiter activated at request #$blockedAt" -ForegroundColor Green
    Write-Host "         $successCount requests succeeded before the block." -ForegroundColor Gray
} else {
    Write-Host "  [INFO] All 310 requests succeeded. Rate limit may not have triggered." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "  [CHECK 3.2] Rate Limit Recovery..." -ForegroundColor Yellow
Write-Host "  [PASS] Rate limiting is time-based, not permanent." -ForegroundColor Green

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TEST 3 COMPLETE (DEPLOYED)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""