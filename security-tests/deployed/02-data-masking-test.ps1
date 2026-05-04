$base = "https://officer-inherited-auburn-insured.trycloudflare.com"
$frontend = "https://smartproperty-front.vercel.app"
$browserUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0"

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TEST 2 (DEPLOYED): DATA MASKING & ACCESS CONTROL" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "  [CHECK 2.1] Public /properties list (no authentication)..." -ForegroundColor Yellow
try {
    $headers = @{ "User-Agent" = $browserUA; "Referer" = $frontend }
    $res = Invoke-WebRequest -Uri "$base/properties" -UseBasicParsing -Method GET -Headers $headers
    $body = $res.Content | ConvertFrom-Json

    if ($body.data -and $body.data.Count -gt 0) {
        $first = $body.data[0]
        $props = $first.PSObject.Properties.Name
        $hasSensitive = $props -contains "description" -or $props -contains "address" -or $props -contains "ownerId" -or $props -contains "ownerPhone"
        if ($hasSensitive) {
            Write-Host "  [FAIL] Sensitive fields exposed to public users." -ForegroundColor Red
        } else {
            Write-Host "  [PASS] Data is masked for public users." -ForegroundColor Green
        }
    } else {
        Write-Host "  [SKIP] No properties in database to verify masking." -ForegroundColor Yellow
    }
} catch {
    Write-Host "  [FAIL] Could not reach endpoint: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "  [CHECK 2.2] Single property /properties/:id (no authentication)..." -ForegroundColor Yellow
try {
    $headers = @{ "User-Agent" = $browserUA; "Referer" = $frontend }
    $listRes = Invoke-WebRequest -Uri "$base/properties" -UseBasicParsing -Method GET -Headers $headers
    $listBody = $listRes.Content | ConvertFrom-Json

    if ($listBody.data -and $listBody.data.Count -gt 0) {
        $firstId = $listBody.data[0].id
        if (-not $firstId) { $firstId = $listBody.data[0]._id }

        $singleRes = Invoke-WebRequest -Uri "$base/properties/$firstId" -UseBasicParsing -Method GET -Headers $headers
        $singleBody = $singleRes.Content | ConvertFrom-Json
        $singleProps = $singleBody.PSObject.Properties.Name
        $hasSensitive = $singleProps -contains "description" -or $singleProps -contains "address" -or $singleProps -contains "ownerId"
        if ($hasSensitive) {
            Write-Host "  [FAIL] Single property exposes sensitive fields without auth." -ForegroundColor Red
        } else {
            Write-Host "  [PASS] Single property is masked for public users." -ForegroundColor Green
        }
    } else {
        Write-Host "  [SKIP] No properties found to test single-item masking." -ForegroundColor Yellow
    }
} catch {
    Write-Host "  [FAIL] Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "  [CHECK 2.3] Write protection (POST without authentication)..." -ForegroundColor Yellow
try {
    $headers = @{ "User-Agent" = $browserUA; "Referer" = $frontend }
    Invoke-WebRequest -Uri "$base/properties" -UseBasicParsing -Method POST -Body "{}" -ContentType "application/json" -Headers $headers | Out-Null
    Write-Host "  [FAIL] POST /properties succeeded without authentication!" -ForegroundColor Red
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 401) {
        Write-Host "  [PASS] POST /properties returns 401 Unauthorized." -ForegroundColor Green
    } else {
        Write-Host "  [INFO] POST returned HTTP $statusCode (expected 401)." -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "  [CHECK 2.4] Fake JWT token test..." -ForegroundColor Yellow
try {
    $fakeHeaders = @{
        "User-Agent" = $browserUA
        "Referer" = $frontend
        "Authorization" = "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmYWtlIn0.fake_signature_here"
    }
    $fakeRes = Invoke-WebRequest -Uri "$base/properties" -UseBasicParsing -Method GET -Headers $fakeHeaders
    $fakeBody = $fakeRes.Content | ConvertFrom-Json

    if ($fakeBody.data -and $fakeBody.data.Count -gt 0) {
        $fakeProps = $fakeBody.data[0].PSObject.Properties.Name
        $hasSensitive = $fakeProps -contains "description" -or $fakeProps -contains "address" -or $fakeProps -contains "ownerId"
        if ($hasSensitive) {
            Write-Host "  [FAIL] Fake JWT token revealed sensitive data." -ForegroundColor Red
        } else {
            Write-Host "  [PASS] Fake token treated as public user. Data is masked." -ForegroundColor Green
        }
    } else {
        Write-Host "  [PASS] No data returned for fake token (treated as unauthorized)." -ForegroundColor Green
    }
} catch {
    $sc = $_.Exception.Response.StatusCode.value__
    if ($sc -eq 401) {
        Write-Host "  [PASS] Fake token rejected with 401 Unauthorized." -ForegroundColor Green
    } else {
        Write-Host "  [INFO] Returned HTTP $sc" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TEST 2 COMPLETE (DEPLOYED)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""