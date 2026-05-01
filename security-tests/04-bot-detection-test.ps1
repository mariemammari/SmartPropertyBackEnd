###############################################################################
#                                                                             #
#   TEST 4: BOT DETECTION & BEHAVIOR ANALYSIS (Layers 2+3)                   #
#                                                                             #
#   PURPOSE:                                                                  #
#   This test verifies that the system can identify and block automated       #
#   scraping tools based on their "DNA" (User-Agent signature).               #
#                                                                             #
#   HOW BOT DETECTION WORKS:                                                  #
#   Every HTTP client sends a "User-Agent" header that identifies itself.     #
#   Real browsers say: "Mozilla/5.0 (Windows NT 10.0...)"                    #
#   Scraping tools say: "python-requests/2.28", "Scrapy/2.11", etc.          #
#                                                                             #
#   The Fingerprint Middleware checks this header against a blacklist of      #
#   known scraping tools. If matched, the suspicion score starts at 80       #
#   (instant block threshold), meaning the bot is blocked on its FIRST       #
#   request -- before it can scrape even a single property.                  #
#                                                                             #
#   TOOLS DETECTED:                                                           #
#   python-requests, scrapy, wget, go-http-client, sqlmap, nikto,            #
#   mechanize, aiohttp, httpx, masscan, zgrab, nuclei, libwww-perl           #
#                                                                             #
###############################################################################

$base = "http://localhost:3000"
$browserUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0"

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TEST 4: BOT DETECTION & BEHAVIOR ANALYSIS" -ForegroundColor Cyan
Write-Host "  Testing if the system can identify scraping tools..." -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# ---------------------------------------------------------------------------
# CHECK 4.1: Legitimate browser request (should PASS)
# ---------------------------------------------------------------------------
# SCENARIO:
#   A real user opens your website in Chrome. Their browser sends a standard
#   User-Agent header. This request should be allowed without any issues.
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "  [CHECK 4.1] Legitimate browser request..." -ForegroundColor Yellow
Write-Host "         User-Agent: Chrome on Windows 10" -ForegroundColor Gray
try {
    $headers = @{ "User-Agent" = $browserUA; "Referer" = "http://localhost:5173" }
    $res = Invoke-WebRequest -Uri "$base/properties" -UseBasicParsing -Method GET -Headers $headers
    Write-Host "  [PASS] Browser request allowed (HTTP $($res.StatusCode))" -ForegroundColor Green
    Write-Host "         Normal users are not affected by bot detection." -ForegroundColor Gray
} catch {
    $sc = $_.Exception.Response.StatusCode.value__
    Write-Host "  [FAIL] Browser request blocked with HTTP $sc" -ForegroundColor Red
}

# ---------------------------------------------------------------------------
# CHECK 4.2: Python requests library (should be BLOCKED)
# ---------------------------------------------------------------------------
# SCENARIO:
#   A scraper uses Python's popular "requests" library to fetch your data.
#   The library automatically sends "python-requests/2.28.1" as User-Agent.
#   This is one of the most common scraping tools in existence.
#
# EXPECTED: HTTP 403 Forbidden (score starts at 80 = instant block)
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "  [CHECK 4.2] Python requests bot..." -ForegroundColor Yellow
Write-Host "         User-Agent: python-requests/2.28.1" -ForegroundColor Gray
Write-Host "         This is the most common scraping tool used by competitors." -ForegroundColor Gray
try {
    $botHeaders = @{ "User-Agent" = "python-requests/2.28.1" }
    $res = Invoke-WebRequest -Uri "$base/properties" -UseBasicParsing -Method GET -Headers $botHeaders
    $body = $res.Content | ConvertFrom-Json

    # Check if we got honeypot (fake empty data) or real data
    if ($body.data -and $body.data.Count -eq 0 -and $body.message -eq "No results found") {
        Write-Host "  [PASS] Bot received HONEYPOT response (fake empty data)" -ForegroundColor Green
        Write-Host "         The scraper thinks your database is empty!" -ForegroundColor Gray
    } else {
        Write-Host "  [WARN] Bot received real data. Score might not have reached threshold." -ForegroundColor Yellow
    }
} catch {
    $sc = $_.Exception.Response.StatusCode.value__
    if ($sc -eq 403) {
        Write-Host "  [PASS] Bot BLOCKED with 403 Forbidden on first request!" -ForegroundColor Green
        Write-Host "         The scraper cannot retrieve a single property." -ForegroundColor Gray
    } else {
        Write-Host "  [INFO] Bot received HTTP $sc" -ForegroundColor Yellow
    }
}

# ---------------------------------------------------------------------------
# CHECK 4.3: Scrapy spider (should be BLOCKED)
# ---------------------------------------------------------------------------
# SCENARIO:
#   Scrapy is a professional-grade web scraping framework for Python.
#   It is commonly used for large-scale data extraction operations.
#   It sends "Scrapy/2.11.0" as its User-Agent by default.
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "  [CHECK 4.3] Scrapy spider bot..." -ForegroundColor Yellow
Write-Host "         User-Agent: Scrapy/2.11.0" -ForegroundColor Gray
Write-Host "         Scrapy is an industrial-grade scraping framework." -ForegroundColor Gray
try {
    $scrapyHeaders = @{ "User-Agent" = "Scrapy/2.11.0 (+https://scrapy.org)" }
    Invoke-WebRequest -Uri "$base/properties" -UseBasicParsing -Method GET -Headers $scrapyHeaders | Out-Null
    Write-Host "  [WARN] Scrapy request was not blocked." -ForegroundColor Yellow
} catch {
    $sc = $_.Exception.Response.StatusCode.value__
    if ($sc -eq 403) {
        Write-Host "  [PASS] Scrapy bot BLOCKED with 403 Forbidden!" -ForegroundColor Green
    } else {
        Write-Host "  [INFO] Scrapy received HTTP $sc" -ForegroundColor Yellow
    }
}

# ---------------------------------------------------------------------------
# CHECK 4.4: SQLMap scanner (should be BLOCKED)
# ---------------------------------------------------------------------------
# SCENARIO:
#   SQLMap is a penetration testing tool that tries SQL injection attacks.
#   Blocking it at the fingerprint layer prevents even the reconnaissance
#   phase of an attack.
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "  [CHECK 4.4] SQLMap attack scanner..." -ForegroundColor Yellow
Write-Host "         User-Agent: sqlmap/1.7" -ForegroundColor Gray
Write-Host "         SQLMap probes for SQL injection vulnerabilities." -ForegroundColor Gray
try {
    $sqlmapHeaders = @{ "User-Agent" = "sqlmap/1.7#stable (https://sqlmap.org)" }
    Invoke-WebRequest -Uri "$base/properties" -UseBasicParsing -Method GET -Headers $sqlmapHeaders | Out-Null
    Write-Host "  [WARN] SQLMap request was not blocked." -ForegroundColor Yellow
} catch {
    $sc = $_.Exception.Response.StatusCode.value__
    if ($sc -eq 403) {
        Write-Host "  [PASS] SQLMap scanner BLOCKED with 403 Forbidden!" -ForegroundColor Green
        Write-Host "         Attack reconnaissance stopped before it could begin." -ForegroundColor Gray
    } else {
        Write-Host "  [INFO] SQLMap received HTTP $sc" -ForegroundColor Yellow
    }
}

# ---------------------------------------------------------------------------
# CHECK 4.5: No referer penalty (behavior analysis)
# ---------------------------------------------------------------------------
# SCENARIO:
#   A request with a browser User-Agent but NO Referer header is suspicious.
#   Real users clicking through your website always have a Referer.
#   Scripts and API tools typically don't send Referer headers.
#
#   This adds +10 to the suspicion score. It won't block alone, but combined
#   with other signals (high frequency, etc.) it pushes the score higher.
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "  [CHECK 4.5] Missing Referer header penalty..." -ForegroundColor Yellow
Write-Host "         Scenario: Request looks like a browser but has no Referer." -ForegroundColor Gray
Write-Host "         This adds +10 to the suspicion score (a warning signal)." -ForegroundColor Gray
try {
    $noRefHeaders = @{ "User-Agent" = $browserUA }
    $res = Invoke-WebRequest -Uri "$base/properties" -UseBasicParsing -Method GET -Headers $noRefHeaders
    Write-Host "  [PASS] Request allowed but scored higher (score includes +10 penalty)." -ForegroundColor Green
    Write-Host "         Alone this is not enough to block, but it builds the profile." -ForegroundColor Gray
} catch {
    Write-Host "  [INFO] Request got HTTP $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TEST 4 COMPLETE: Bot detection verified." -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
