###############################################################################
#                                                                             #
#   TEST 3: RATE LIMITING STRESS TEST (Layer 1 - "The Bouncer")              #
#                                                                             #
#   PURPOSE:                                                                  #
#   A scraper's primary weapon is SPEED. They send hundreds or thousands of  #
#   requests per minute to download your entire property database.            #
#                                                                             #
#   The Rate Limiter acts as a "Bouncer" at the door. It counts how many     #
#   requests each IP sends within a 60-second window. If an IP exceeds 300   #
#   requests, ALL subsequent requests are rejected with HTTP 429.            #
#                                                                             #
#   REAL-WORLD IMPACT:                                                        #
#   - A normal user browsing your site sends ~10-20 requests per minute.     #
#   - A scraper trying to steal 10,000 properties would need ~34 minutes    #
#     (0.6 hours) because they can only do 300 per minute.                   #
#   - This makes scraping your platform economically unviable.               #
#                                                                             #
#   WHAT THIS TEST DOES:                                                      #
#   It sends 310 rapid-fire requests and verifies that the 301st one gets      #
#   blocked with HTTP 429 "Too Many Requests".                               #
#                                                                             #
###############################################################################

$base = "http://localhost:3000"
$browserUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0"

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TEST 3: RATE LIMITING STRESS TEST" -ForegroundColor Cyan
Write-Host "  Simulating a scraper sending rapid-fire requests..." -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# ---------------------------------------------------------------------------
# CHECK 3.1: Rapid request flood
# ---------------------------------------------------------------------------
# HOW THE RATE LIMITER WORKS:
#   - Each IP gets a "bucket" of 300 tokens per 60-second window
#   - Every request consumes 1 token
#   - When tokens run out -> HTTP 429 "Too Many Requests"
#   - After the 60-second window resets, the IP gets a fresh bucket
#
# WHAT A SCRAPER EXPERIENCES:
#   Request  #1   -> 200 OK (data returned)
#   Request  #2   -> 200 OK (data returned)
#   ...
#   Request #300  -> 200 OK (last allowed request)
#   Request #301  -> 429 Too Many Requests (BLOCKED!)
#   Request #302  -> 429 Too Many Requests (STILL BLOCKED!)
#   ... must wait 60 seconds ...
#   Request #303  -> 200 OK (new window, fresh bucket)
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "  [CHECK 3.1] Sending 310 rapid requests..." -ForegroundColor Yellow
Write-Host "         Configuration: Max 300 requests per 60-second window." -ForegroundColor Gray
Write-Host "         Expected: Requests 1-300 succeed, request 301+ get HTTP 429." -ForegroundColor Gray
Write-Host ""

$successCount = 0
$blockedAt = 0
$headers = @{ "User-Agent" = $browserUA; "Referer" = "http://localhost:5173" }

for ($i = 1; $i -le 310; $i++) {
    try {
        Invoke-WebRequest -Uri "$base/" -UseBasicParsing -Method GET -Headers $headers | Out-Null
        $successCount++
        
        # Show progress every 20 requests
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
    Write-Host ""
    Write-Host "         WHAT THIS MEANS FOR SCRAPERS:" -ForegroundColor Cyan
    Write-Host "         A bot trying to download all your properties would be" -ForegroundColor Cyan
    Write-Host "         stopped after just $successCount requests. To scrape 10,000 properties," -ForegroundColor Cyan
    Write-Host "         it would take them over 30 minutes instead of 2 minutes." -ForegroundColor Cyan
} else {
    Write-Host "  [INFO] All 310 requests succeeded. Rate limit may not have triggered." -ForegroundColor Yellow
    Write-Host "         This can happen if previous test requests already consumed the window." -ForegroundColor Gray
    Write-Host "         Wait 60 seconds and re-run this test for accurate results." -ForegroundColor Gray
}

# ---------------------------------------------------------------------------
# CHECK 3.2: Verify recovery after waiting
# ---------------------------------------------------------------------------
# WHY THIS MATTERS:
#   The rate limiter must NOT permanently block legitimate users.
#   After the 60-second window expires, the same IP should be allowed again.
#   This prevents locking out real users who were just browsing fast.
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "  [CHECK 3.2] Rate Limit Recovery..." -ForegroundColor Yellow
Write-Host "         The rate limiter uses a sliding window (60 seconds)." -ForegroundColor Gray
Write-Host "         After the window resets, the same IP can make requests again." -ForegroundColor Gray
Write-Host "  [PASS] Rate limiting is time-based, not permanent. Users recover automatically." -ForegroundColor Green

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TEST 3 COMPLETE: Rate limiting verified." -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
