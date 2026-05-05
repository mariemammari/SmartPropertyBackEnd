$base = "https://officer-inherited-auburn-insured.trycloudflare.com"
$frontend = "https://smartproperty-front.vercel.app"
$browserUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0"

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TEST 5 (DEPLOYED): CORS & HARDENING VERIFICATION" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "  [CHECK 5.1] CORS: Allowed origin (frontend)..." -ForegroundColor Yellow
try {
    $corsRes = Invoke-WebRequest -Uri "$base/properties" -UseBasicParsing -Method OPTIONS -Headers @{
        "Origin" = $frontend
        "Access-Control-Request-Method" = "GET"
        "User-Agent" = $browserUA
    }
    $allowedOrigin = $corsRes.Headers["Access-Control-Allow-Origin"]
    if ($allowedOrigin -and $allowedOrigin -eq $frontend) {
        Write-Host "  [PASS] CORS allows your frontend: $allowedOrigin" -ForegroundColor Green
    } elseif ($allowedOrigin -eq "*") {
        Write-Host "  [WARN] CORS allows ALL origins (wildcard *)." -ForegroundColor Yellow
    } else {
        Write-Host "  [INFO] CORS origin: $allowedOrigin" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  [INFO] CORS preflight: $($_.Exception.Message)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "  [CHECK 5.2] Helmet: X-Powered-By removed..." -ForegroundColor Yellow
try {
    $headers = @{ "User-Agent" = $browserUA; "Referer" = $frontend }
    $res = Invoke-WebRequest -Uri "$base/" -UseBasicParsing -Method GET -Headers $headers
    $xPoweredBy = $res.Headers["X-Powered-By"]
    if ($xPoweredBy) {
        Write-Host "  [FAIL] Server reveals technology: X-Powered-By = $xPoweredBy" -ForegroundColor Red
    } else {
        Write-Host "  [PASS] X-Powered-By is removed. Server identity is hidden." -ForegroundColor Green
    }
} catch {
    Write-Host "  [SKIP] Could not check headers." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "  [CHECK 5.3] Helmet: MIME sniffing protection..." -ForegroundColor Yellow
try {
    $headers = @{ "User-Agent" = $browserUA; "Referer" = $frontend }
    $res = Invoke-WebRequest -Uri "$base/" -UseBasicParsing -Method GET -Headers $headers
    $contentTypeOpts = $res.Headers["X-Content-Type-Options"]
    if ($contentTypeOpts -eq "nosniff") {
        Write-Host "  [PASS] X-Content-Type-Options: nosniff" -ForegroundColor Green
    } else {
        Write-Host "  [WARN] X-Content-Type-Options header missing." -ForegroundColor Yellow
    }
} catch {
    Write-Host "  [SKIP] Could not check headers." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "  [CHECK 5.4] Helmet: Clickjacking protection..." -ForegroundColor Yellow
try {
    $headers = @{ "User-Agent" = $browserUA; "Referer" = $frontend }
    $res = Invoke-WebRequest -Uri "$base/" -UseBasicParsing -Method GET -Headers $headers
    $xFrame = $res.Headers["X-Frame-Options"]
    if ($xFrame) {
        Write-Host "  [PASS] X-Frame-Options: $xFrame" -ForegroundColor Green
    } else {
        Write-Host "  [WARN] X-Frame-Options header missing." -ForegroundColor Yellow
    }
} catch {
    Write-Host "  [SKIP] Could not check headers." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TEST 5 COMPLETE (DEPLOYED)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""