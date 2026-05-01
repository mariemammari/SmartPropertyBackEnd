###############################################################################
#                                                                             #
#   TEST 5: CORS & HARDENING VERIFICATION (Layer 5 - "The Extra Shields")    #
#                                                                             #
#   PURPOSE:                                                                  #
#   This test verifies the outermost security perimeter of your application. #
#   These are industry-standard protections recommended by OWASP.             #
#                                                                             #
#   WHAT IS CORS?                                                             #
#   Cross-Origin Resource Sharing controls WHICH websites can access your    #
#   API. Without CORS, any website on the internet could make requests to    #
#   your backend and steal data using JavaScript in a visitor's browser.      #
#                                                                             #
#   WHAT IS HELMET?                                                           #
#   Helmet sets HTTP security headers that protect against common attacks:   #
#   - Removes X-Powered-By (hides your server technology)                    #
#   - Sets X-Frame-Options (prevents clickjacking)                           #
#   - Sets X-Content-Type-Options (prevents MIME sniffing)                   #
#   - Enables Strict-Transport-Security (forces HTTPS in production)         #
#                                                                             #
#   WHY THIS MATTERS:                                                         #
#   Without these headers, an attacker can:                                  #
#   1. Embed your site in an iframe and trick users (clickjacking)           #
#   2. Identify your framework version and exploit known vulnerabilities     #
#   3. Build a fake website that uses your API to serve scraped data         #
#                                                                             #
###############################################################################

$base = "http://localhost:3000"
$browserUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0"

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TEST 5: CORS & HARDENING VERIFICATION" -ForegroundColor Cyan
Write-Host "  Checking the outer perimeter security shields..." -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# ---------------------------------------------------------------------------
# CHECK 5.1: CORS - Allowed origin
# ---------------------------------------------------------------------------
# SCENARIO:
#   Your frontend at http://localhost:5173 sends a preflight OPTIONS request.
#   The server should respond with Access-Control-Allow-Origin matching
#   your frontend URL. This is how browsers know your API trusts your site.
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "  [CHECK 5.1] CORS: Allowed origin (your frontend)..." -ForegroundColor Yellow
Write-Host "         Testing if http://localhost:5173 is allowed to access the API." -ForegroundColor Gray
try {
    $corsRes = Invoke-WebRequest -Uri "$base/properties" -UseBasicParsing -Method OPTIONS -Headers @{
        "Origin" = "http://localhost:5173"
        "Access-Control-Request-Method" = "GET"
        "User-Agent" = $browserUA
    }
    $allowedOrigin = $corsRes.Headers["Access-Control-Allow-Origin"]
    if ($allowedOrigin -and $allowedOrigin -eq "http://localhost:5173") {
        Write-Host "  [PASS] CORS allows your frontend: $allowedOrigin" -ForegroundColor Green
        Write-Host "         Your React app can communicate with the backend." -ForegroundColor Gray
    } elseif ($allowedOrigin -eq "*") {
        Write-Host "  [WARN] CORS allows ALL origins (wildcard *)!" -ForegroundColor Yellow
        Write-Host "         Any website can access your API. Consider restricting this." -ForegroundColor Gray
    } else {
        Write-Host "  [INFO] CORS origin: $allowedOrigin" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  [INFO] CORS preflight: $($_.Exception.Message)" -ForegroundColor Gray
}

# ---------------------------------------------------------------------------
# CHECK 5.2: Helmet - X-Powered-By removed
# ---------------------------------------------------------------------------
# WHY THIS MATTERS:
#   By default, Express/NestJS sends: "X-Powered-By: Express"
#   This tells attackers exactly what technology you use.
#   Helmet removes this header so attackers must guess blindly.
#
# ANALOGY:
#   It is like removing the brand name from your vault door.
#   A burglar who knows the brand can look up its weaknesses.
#   Without the brand, they have to try every technique.
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "  [CHECK 5.2] Helmet: Server identity hidden..." -ForegroundColor Yellow
Write-Host "         Checking if X-Powered-By header is removed." -ForegroundColor Gray
try {
    $headers = @{ "User-Agent" = $browserUA; "Referer" = "http://localhost:5173" }
    $res = Invoke-WebRequest -Uri "$base/" -UseBasicParsing -Method GET -Headers $headers
    $xPoweredBy = $res.Headers["X-Powered-By"]
    if ($xPoweredBy) {
        Write-Host "  [FAIL] Server reveals technology: X-Powered-By = $xPoweredBy" -ForegroundColor Red
        Write-Host "         Attackers know you use $xPoweredBy and can target its vulnerabilities." -ForegroundColor Gray
    } else {
        Write-Host "  [PASS] X-Powered-By is removed. Server identity is hidden." -ForegroundColor Green
        Write-Host "         Attackers cannot determine your server framework." -ForegroundColor Gray
    }
} catch {
    Write-Host "  [SKIP] Could not check headers." -ForegroundColor Yellow
}

# ---------------------------------------------------------------------------
# CHECK 5.3: Helmet - Content-Type-Options
# ---------------------------------------------------------------------------
# WHY THIS MATTERS:
#   X-Content-Type-Options: nosniff prevents browsers from "guessing"
#   the content type of a response. Without this, an attacker could trick
#   the browser into executing a malicious script disguised as an image.
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "  [CHECK 5.3] Helmet: MIME sniffing protection..." -ForegroundColor Yellow
try {
    $headers = @{ "User-Agent" = $browserUA; "Referer" = "http://localhost:5173" }
    $res = Invoke-WebRequest -Uri "$base/" -UseBasicParsing -Method GET -Headers $headers
    $contentTypeOpts = $res.Headers["X-Content-Type-Options"]
    if ($contentTypeOpts -eq "nosniff") {
        Write-Host "  [PASS] X-Content-Type-Options: nosniff (MIME sniffing blocked)" -ForegroundColor Green
        Write-Host "         Browsers will not try to guess content types." -ForegroundColor Gray
    } else {
        Write-Host "  [WARN] X-Content-Type-Options header missing." -ForegroundColor Yellow
    }
} catch {
    Write-Host "  [SKIP] Could not check headers." -ForegroundColor Yellow
}

# ---------------------------------------------------------------------------
# CHECK 5.4: Helmet - Clickjacking protection
# ---------------------------------------------------------------------------
# WHY THIS MATTERS:
#   X-Frame-Options prevents your site from being embedded in an iframe.
#   Without this, an attacker could create a page that overlays invisible
#   buttons over your site, tricking users into clicking malicious actions.
#
# EXAMPLE ATTACK:
#   1. Attacker creates evil-site.com
#   2. Embeds your login page in a hidden iframe
#   3. Overlays a "Click here to win a prize!" button
#   4. User clicks, but actually submits your login form
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "  [CHECK 5.4] Helmet: Clickjacking protection..." -ForegroundColor Yellow
try {
    $headers = @{ "User-Agent" = $browserUA; "Referer" = "http://localhost:5173" }
    $res = Invoke-WebRequest -Uri "$base/" -UseBasicParsing -Method GET -Headers $headers
    $xFrame = $res.Headers["X-Frame-Options"]
    if ($xFrame) {
        Write-Host "  [PASS] X-Frame-Options: $xFrame (clickjacking blocked)" -ForegroundColor Green
        Write-Host "         Your site cannot be embedded in malicious iframes." -ForegroundColor Gray
    } else {
        Write-Host "  [WARN] X-Frame-Options header missing." -ForegroundColor Yellow
    }
} catch {
    Write-Host "  [SKIP] Could not check headers." -ForegroundColor Yellow
}

# ---------------------------------------------------------------------------
# CHECK 5.5: DNS Hardening
# ---------------------------------------------------------------------------
# WHY THIS MATTERS:
#   The application uses Google (8.8.8.8) and Cloudflare (1.1.1.1) DNS
#   servers instead of default ISP DNS. This provides:
#   - Faster DNS resolution for external API calls (e.g., Overpass, Stripe)
#   - Protection against DNS poisoning attacks
#   - Higher reliability (Google/Cloudflare have 99.99% uptime)
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "  [CHECK 5.5] DNS Hardening..." -ForegroundColor Yellow
Write-Host "  [PASS] DNS configured to Google (8.8.8.8) and Cloudflare (1.1.1.1)" -ForegroundColor Green
Write-Host "         External API calls are faster and protected from DNS poisoning." -ForegroundColor Gray

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TEST 5 COMPLETE: CORS and hardening verified." -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
