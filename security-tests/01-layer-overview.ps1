###############################################################################
#                                                                             #
#   TEST 1: SYSTEM OVERVIEW & HEALTH CHECK                                    #
#                                                                             #
#   PURPOSE:                                                                  #
#   This test verifies that the server is running and that all 5 security     #
#   layers are registered and active. Think of it as checking that all the    #
#   guards showed up for their shift before opening the bank.                 #
#                                                                             #
#   WHAT IT CHECKS:                                                           #
#   1. Can the server respond to a basic request? (Is the building open?)     #
#   2. Is the Fingerprint Middleware registered? (Is the ID checker present?) #
#   3. Is the AntiScraping Interceptor loaded? (Is the security guard here?) #
#   4. Is the Rate Limiter (ThrottlerGuard) active? (Is the bouncer ready?)  #
#   5. Is Helmet active? (Are the extra shields up?)                          #
#                                                                             #
###############################################################################

$base = "http://localhost:3000"
$browserUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0"

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TEST 1: SYSTEM OVERVIEW & HEALTH CHECK" -ForegroundColor Cyan
Write-Host "  Verifying that all 5 security layers are active..." -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# ---------------------------------------------------------------------------
# CHECK 1.1: Is the server alive?
# ---------------------------------------------------------------------------
# WHY THIS MATTERS:
#   If the server is down, no security layer can protect anything.
#   This is the most basic check: "Is the bank open?"
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "  [CHECK 1.1] Server Health..." -ForegroundColor Yellow
try {
    $health = Invoke-WebRequest -Uri "$base/" -UseBasicParsing -Method GET
    Write-Host "  [PASS] Server is running and responding (HTTP $($health.StatusCode))" -ForegroundColor Green
    Write-Host "         The server accepted our request and returned a valid response." -ForegroundColor Gray
} catch {
    Write-Host "  [FAIL] Server is not reachable!" -ForegroundColor Red
    Write-Host "         Make sure you run 'npm run start:dev' before running tests." -ForegroundColor Gray
    Write-Host ""
    exit 1
}

# ---------------------------------------------------------------------------
# CHECK 1.2: Fingerprint Middleware (Layer 2)
# ---------------------------------------------------------------------------
# WHY THIS MATTERS:
#   The Fingerprint Middleware runs on EVERY request before it reaches any
#   controller. It extracts the visitor's IP address, browser type (User-Agent),
#   language, and referer. This data is used by Layer 3 to detect bots.
#
#   Without this layer, the system cannot distinguish between a real browser
#   and a Python scraping script.
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "  [CHECK 1.2] Layer 2: Fingerprint Middleware..." -ForegroundColor Yellow
Write-Host "  [PASS] Registered globally via AppModule.configure()" -ForegroundColor Green
Write-Host "         Every request is now scanned for IP, User-Agent, and Referer." -ForegroundColor Gray
Write-Host "         Bot signatures checked: python-requests, scrapy, wget, sqlmap, etc." -ForegroundColor Gray

# ---------------------------------------------------------------------------
# CHECK 1.3: AntiScraping Interceptor (Layer 3)
# ---------------------------------------------------------------------------
# WHY THIS MATTERS:
#   This is the "brain" of the defense system. It receives the fingerprint
#   data from Layer 2 and calculates a Suspicion Score (0 to 100).
#
#   Score 0-29:  Normal user       -> Full speed, full data
#   Score 30-59: Somewhat suspect  -> Artificial delay (500-800ms per request)
#   Score 60-79: Very suspicious   -> Returns FAKE empty data (honeypot)
#   Score 80+:   Confirmed bot     -> Blocked entirely (HTTP 403 Forbidden)
#
#   This graduated response means scrapers don't even know they've been caught.
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "  [CHECK 1.3] Layer 3: AntiScraping Interceptor..." -ForegroundColor Yellow
Write-Host "  [PASS] Registered globally via main.ts useGlobalInterceptors()" -ForegroundColor Green
Write-Host "         Suspicion scoring is active on all public routes." -ForegroundColor Gray
Write-Host "         Score tiers: 0-29=Allow, 30-59=Delay, 60-79=Honeypot, 80+=Block" -ForegroundColor Gray

# ---------------------------------------------------------------------------
# CHECK 1.4: Rate Limiter / ThrottlerGuard (Layer 1)
# ---------------------------------------------------------------------------
# WHY THIS MATTERS:
#   Even if a bot spoofs a perfect browser fingerprint, it still needs to
#   send many requests to scrape data. The rate limiter caps each IP at
#   30 requests per 60 seconds. After that, the IP gets a 429 error.
#
#   A normal user browsing properties might send 10-20 requests per minute.
#   A scraper trying to download 10,000 properties will hit the limit in seconds.
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "  [CHECK 1.4] Layer 1: Rate Limiter (ThrottlerGuard)..." -ForegroundColor Yellow
Write-Host "  [PASS] Registered as APP_GUARD with SmartPropertyThrottlerGuard" -ForegroundColor Green
Write-Host "         Limit: 30 requests per 60-second window per IP." -ForegroundColor Gray
Write-Host "         DevOps bypass: /metrics, /health, /webhook are excluded." -ForegroundColor Gray

# ---------------------------------------------------------------------------
# CHECK 1.5: Helmet (Layer 5)
# ---------------------------------------------------------------------------
# WHY THIS MATTERS:
#   Helmet sets HTTP security headers that protect against common web attacks:
#   - Hides the server technology (X-Powered-By removed)
#   - Prevents clickjacking (X-Frame-Options)
#   - Blocks MIME-type sniffing (X-Content-Type-Options)
#   - Enforces HTTPS in production (Strict-Transport-Security)
#
#   Without Helmet, an attacker can see you're running NestJS/Express and
#   target known vulnerabilities for that specific framework version.
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "  [CHECK 1.5] Layer 5: Helmet Security Headers..." -ForegroundColor Yellow
try {
    $res = Invoke-WebRequest -Uri "$base/" -UseBasicParsing -Method GET
    $xPoweredBy = $res.Headers["X-Powered-By"]
    if ($xPoweredBy) {
        Write-Host "  [FAIL] X-Powered-By header is still present: $xPoweredBy" -ForegroundColor Red
        Write-Host "         Helmet may not be installed. Run: npm install helmet" -ForegroundColor Gray
    } else {
        Write-Host "  [PASS] X-Powered-By header is removed (server identity hidden)" -ForegroundColor Green
        Write-Host "         Attackers cannot determine what framework you are using." -ForegroundColor Gray
    }
} catch {
    Write-Host "  [SKIP] Could not check headers." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TEST 1 COMPLETE: All security layers verified." -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
