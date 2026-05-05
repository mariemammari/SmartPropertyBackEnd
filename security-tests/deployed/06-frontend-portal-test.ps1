$base = "https://officer-inherited-auburn-insured.trycloudflare.com"
$frontend = "https://smartproperty-front.vercel.app"
$browserUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0"

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TEST 6 (DEPLOYED): FRONTEND PORTAL FLOW" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "  [CHECK 6.1] Frontend reachable..." -ForegroundColor Yellow
try {
    $frontRes = Invoke-WebRequest -Uri "$frontend/" -UseBasicParsing -Method GET -Headers @{ "User-Agent" = $browserUA }
    Write-Host "  [PASS] Frontend is reachable (HTTP $($frontRes.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "  [FAIL] Frontend not reachable: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "  [CHECK 6.2] Backend request with frontend Referer..." -ForegroundColor Yellow
try {
    $headers = @{ "User-Agent" = $browserUA; "Referer" = $frontend }
    $res = Invoke-WebRequest -Uri "$base/properties" -UseBasicParsing -Method GET -Headers $headers
    Write-Host "  [PASS] Backend accepted request from frontend (HTTP $($res.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "  [FAIL] Backend rejected frontend-referer request: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "  [CHECK 6.3] CORS preflight with frontend Origin..." -ForegroundColor Yellow
try {
    $corsRes = Invoke-WebRequest -Uri "$base/properties" -UseBasicParsing -Method OPTIONS -Headers @{
        "Origin" = $frontend
        "Access-Control-Request-Method" = "GET"
        "User-Agent" = $browserUA
    }
    $allowedOrigin = $corsRes.Headers["Access-Control-Allow-Origin"]
    if ($allowedOrigin -and $allowedOrigin -eq $frontend) {
        Write-Host "  [PASS] CORS allows frontend origin." -ForegroundColor Green
    } else {
        Write-Host "  [INFO] CORS origin: $allowedOrigin" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  [INFO] CORS preflight: $($_.Exception.Message)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "  [CHECK 6.4] Authenticated portal flow (optional)..." -ForegroundColor Yellow
$testEmail = $env:SMARTPROPERTY_TEST_EMAIL
$testPassword = $env:SMARTPROPERTY_TEST_PASSWORD
if ($testEmail -and $testPassword) {
    try {
        $loginBody = @{ email = $testEmail; password = $testPassword } | ConvertTo-Json
        $loginRes = Invoke-WebRequest -Uri "$base/auth/signin" -UseBasicParsing -Method POST -Body $loginBody -ContentType "application/json"
        $token = ($loginRes.Content | ConvertFrom-Json).access_token

        if ($token) {
            $authHeaders = @{ "Authorization" = "Bearer $token"; "User-Agent" = $browserUA; "Referer" = $frontend }
            $authRes = Invoke-WebRequest -Uri "$base/properties" -UseBasicParsing -Method GET -Headers $authHeaders
            Write-Host "  [PASS] Authenticated request succeeded (HTTP $($authRes.StatusCode))" -ForegroundColor Green
        } else {
            Write-Host "  [FAIL] No access token returned from signin." -ForegroundColor Red
        }
    } catch {
        Write-Host "  [FAIL] Auth flow failed: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "  [SKIP] Set SMARTPROPERTY_TEST_EMAIL and SMARTPROPERTY_TEST_PASSWORD to run auth flow." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TEST 6 COMPLETE (DEPLOYED)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""