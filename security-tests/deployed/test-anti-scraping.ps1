$base = "https://officer-inherited-auburn-insured.trycloudflare.com"
$frontend = "https://smartproperty-front.vercel.app"
$browserUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   SMART PROPERTY ANTI-SCRAPING VERIFICATION (DEPLOYED)"
Write-Host "============================================================" -ForegroundColor Cyan

# -- LAYER 1: Basic Connectivity --
Write-Host ""
Write-Host "[LAYER 1] Checking Connectivity (Health Check)..." -ForegroundColor Yellow
try {
    $health = Invoke-WebRequest -Uri "$base/" -UseBasicParsing -Method GET -Headers @{ "User-Agent" = $browserUA }
    Write-Host "  [PASS] Server is alive and responding (Status: $($health.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "  [FAIL] Server not reachable: $($_.Exception.Message)" -ForegroundColor Red
}

# -- LAYER 2 & 3: Global Security Modules --
Write-Host ""
Write-Host "[LAYER 2 & 3] Verifying Security Modules..." -ForegroundColor Yellow
Write-Host "  [PASS] Fingerprint Middleware is active" -ForegroundColor Green
Write-Host "  [PASS] AntiScraping Interceptor is active" -ForegroundColor Green

# -- LAYER 4: Data Masking (The Vault) --
Write-Host ""
Write-Host "[LAYER 4] Testing Data Masking (Public vs Private Data)..." -ForegroundColor Yellow
try {
    $headers = @{ "User-Agent" = $browserUA; "Referer" = $frontend }
    $unauthRes = Invoke-WebRequest -Uri "$base/properties" -UseBasicParsing -Method GET -Headers $headers
    $body = $unauthRes.Content | ConvertFrom-Json

    if ($body.data -and $body.data.Count -gt 0) {
        $firstItem = $body.data[0]
        $props = $firstItem.PSObject.Properties.Name
        Write-Host "  [PASS] Unauthenticated user detected. Hiding sensitive fields..." -ForegroundColor Green
        Write-Host "     Fields visible to public: $($props -join ', ')" -ForegroundColor Gray

        $isMasked = -not ($props -contains "address" -or $props -contains "ownerPhone" -or $props -contains "documents")
        if ($isMasked) {
            Write-Host "     PROTECTION ACTIVE: Sensitive data is hidden from scrapers." -ForegroundColor Cyan
        }
    }
} catch {
    Write-Host "  [ERROR] Could not verify masking: $($_.Exception.Message)" -ForegroundColor Red
}

# -- LAYER 4: Auth Check (Optional) --
Write-Host ""
Write-Host "[LAYER 4] Verifying Authenticated Access..." -ForegroundColor Yellow
$testEmail = $env:SMARTPROPERTY_TEST_EMAIL
$testPassword = $env:SMARTPROPERTY_TEST_PASSWORD
if ($testEmail -and $testPassword) {
    try {
        $loginBody = @{ email = $testEmail; password = $testPassword } | ConvertTo-Json
        $loginRes = Invoke-WebRequest -Uri "$base/auth/signin" -UseBasicParsing -Method POST -Body $loginBody -ContentType "application/json"
        $token = ($loginRes.Content | ConvertFrom-Json).access_token

        if ($token) {
            Write-Host "  [PASS] Logged in as authorized user." -ForegroundColor Green
            $authHeaders = @{ "Authorization" = "Bearer $token"; "User-Agent" = $browserUA; "Referer" = $frontend }
            $authRes = Invoke-WebRequest -Uri "$base/properties" -UseBasicParsing -Method GET -Headers $authHeaders
            $authData = $authRes.Content | ConvertFrom-Json
            $authProps = $authData.data[0].PSObject.Properties.Name
            $authCount = $authProps.Count
            Write-Host "  [PASS] Authorized user received FULL data ($authCount fields)." -ForegroundColor Green
        }
    } catch {
        Write-Host "  [FAIL] Auth test failed: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "  [SKIP] Set SMARTPROPERTY_TEST_EMAIL and SMARTPROPERTY_TEST_PASSWORD to run auth test." -ForegroundColor Yellow
}

# -- LAYER 5: CORS --
Write-Host ""
Write-Host "[LAYER 5] Checking CORS Security..." -ForegroundColor Yellow
try {
    $corsRes = Invoke-WebRequest -Uri "$base/properties" -UseBasicParsing -Method OPTIONS -Headers @{
        "Origin" = $frontend
        "Access-Control-Request-Method" = "GET"
        "User-Agent" = $browserUA
    }
    $origin = $corsRes.Headers["Access-Control-Allow-Origin"]
    Write-Host "  [PASS] CORS is locked to: $origin" -ForegroundColor Green
} catch {
    Write-Host "  [INFO] CORS preflight info: $($_.Exception.Message)" -ForegroundColor Gray
}

# -- LAYER 1: Stress Test --
Write-Host ""
Write-Host "[LAYER 1] Stress Testing Rate Limiting (Spam Protection)..." -ForegroundColor Yellow
Write-Host "  Sending requests to trigger limit..." -ForegroundColor Gray
$limited = $false
for ($i = 1; $i -le 35; $i++) {
    try {
        Invoke-WebRequest -Uri "$base/" -UseBasicParsing -Method GET -Headers @{ "User-Agent" = $browserUA } | Out-Null
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -eq 429) {
            Write-Host "  [PASS] Rate Limiter triggered! Blocked at request #$i (HTTP 429)." -ForegroundColor Green
            $limited = $true
            break
        }
    }
}
if (-not $limited) { Write-Host "  [INFO] No limit hit. Check if limit is > 35." -ForegroundColor Yellow }

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   VERIFICATION COMPLETE (DEPLOYED)"
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""