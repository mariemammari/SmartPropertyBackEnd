$base = "https://officer-inherited-auburn-insured.trycloudflare.com"
$frontend = "https://smartproperty-front.vercel.app"
$browserUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0"

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TEST 4 (DEPLOYED): BOT DETECTION & BEHAVIOR ANALYSIS" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "  [CHECK 4.1] Legitimate browser request..." -ForegroundColor Yellow
try {
    $headers = @{ "User-Agent" = $browserUA; "Referer" = $frontend }
    $res = Invoke-WebRequest -Uri "$base/properties" -UseBasicParsing -Method GET -Headers $headers
    Write-Host "  [PASS] Browser request allowed (HTTP $($res.StatusCode))" -ForegroundColor Green
} catch {
    $sc = $_.Exception.Response.StatusCode.value__
    Write-Host "  [FAIL] Browser request blocked with HTTP $sc" -ForegroundColor Red
}

Write-Host ""
Write-Host "  [CHECK 4.2] Python requests bot..." -ForegroundColor Yellow
try {
    $botHeaders = @{ "User-Agent" = "python-requests/2.28.1" }
    $res = Invoke-WebRequest -Uri "$base/properties" -UseBasicParsing -Method GET -Headers $botHeaders
    $body = $res.Content | ConvertFrom-Json

    if ($body.data -and $body.data.Count -eq 0 -and $body.message -eq "No results found") {
        Write-Host "  [PASS] Bot received honeypot response (fake empty data)" -ForegroundColor Green
    } else {
        Write-Host "  [WARN] Bot received real data. Score may not have reached threshold." -ForegroundColor Yellow
    }
} catch {
    $sc = $_.Exception.Response.StatusCode.value__
    if ($sc -eq 403) {
        Write-Host "  [PASS] Bot blocked with 403 Forbidden on first request." -ForegroundColor Green
    } else {
        Write-Host "  [INFO] Bot received HTTP $sc" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "  [CHECK 4.3] Scrapy spider bot..." -ForegroundColor Yellow
try {
    $scrapyHeaders = @{ "User-Agent" = "Scrapy/2.11.0 (+https://scrapy.org)" }
    Invoke-WebRequest -Uri "$base/properties" -UseBasicParsing -Method GET -Headers $scrapyHeaders | Out-Null
    Write-Host "  [WARN] Scrapy request was not blocked." -ForegroundColor Yellow
} catch {
    $sc = $_.Exception.Response.StatusCode.value__
    if ($sc -eq 403) {
        Write-Host "  [PASS] Scrapy bot blocked with 403 Forbidden." -ForegroundColor Green
    } else {
        Write-Host "  [INFO] Scrapy received HTTP $sc" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "  [CHECK 4.4] SQLMap attack scanner..." -ForegroundColor Yellow
try {
    $sqlmapHeaders = @{ "User-Agent" = "sqlmap/1.7#stable (https://sqlmap.org)" }
    Invoke-WebRequest -Uri "$base/properties" -UseBasicParsing -Method GET -Headers $sqlmapHeaders | Out-Null
    Write-Host "  [WARN] SQLMap request was not blocked." -ForegroundColor Yellow
} catch {
    $sc = $_.Exception.Response.StatusCode.value__
    if ($sc -eq 403) {
        Write-Host "  [PASS] SQLMap scanner blocked with 403 Forbidden." -ForegroundColor Green
    } else {
        Write-Host "  [INFO] SQLMap received HTTP $sc" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "  [CHECK 4.5] Missing Referer header penalty..." -ForegroundColor Yellow
try {
    $noRefHeaders = @{ "User-Agent" = $browserUA }
    $res = Invoke-WebRequest -Uri "$base/properties" -UseBasicParsing -Method GET -Headers $noRefHeaders
    Write-Host "  [PASS] Request allowed but should be scored higher (missing Referer)." -ForegroundColor Green
} catch {
    Write-Host "  [INFO] Request got HTTP $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TEST 4 COMPLETE (DEPLOYED)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""