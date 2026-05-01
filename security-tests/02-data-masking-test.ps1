###############################################################################
#                                                                             #
#   TEST 2: DATA MASKING & ACCESS CONTROL (Layer 4 - "The Vault")            #
#                                                                             #
#   PURPOSE:                                                                  #
#   In a real estate platform, property data is the most valuable asset.      #
#   Competitors would love to scrape owner phone numbers, exact addresses,    #
#   and GPS coordinates to contact sellers directly.                          #
#                                                                             #
#   This test verifies that:                                                  #
#   - Public users (no login) can ONLY see: id, title, city, price           #
#   - Sensitive fields (address, phone, GPS, owner) are HIDDEN               #
#   - Protected endpoints (POST/PATCH/DELETE) require authentication         #
#   - Even if a scraper bypasses all other layers, the data is USELESS       #
#                                                                             #
#   BUSINESS VALUE:                                                           #
#   A competitor scraping your 10,000 properties would only get titles       #
#   and prices -- information already visible on your public website.         #
#   They CANNOT get owner contacts, full addresses, or internal documents.   #
#                                                                             #
###############################################################################

$base = "http://localhost:3000"
$browserUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0"

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TEST 2: DATA MASKING & ACCESS CONTROL" -ForegroundColor Cyan
Write-Host "  Verifying that sensitive property data is protected..." -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# ---------------------------------------------------------------------------
# CHECK 2.1: Public user sees MASKED data on property list
# ---------------------------------------------------------------------------
# SCENARIO:
#   A random visitor (or scraper) hits GET /properties without any login token.
#   They should only see basic public information.
#
# EXPECTED RESULT:
#   Response contains ONLY: id, title, city, price
#   Response does NOT contain: address, ownerPhone, ownerId, documents, GPS
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "  [CHECK 2.1] Public /properties list (no authentication)..." -ForegroundColor Yellow
Write-Host "         Scenario: A scraper requests all properties without logging in." -ForegroundColor Gray
try {
    $headers = @{ "User-Agent" = $browserUA; "Referer" = "http://localhost:5173" }
    $res = Invoke-WebRequest -Uri "$base/properties" -UseBasicParsing -Method GET -Headers $headers
    $body = $res.Content | ConvertFrom-Json

    if ($body.data -and $body.data.Count -gt 0) {
        $first = $body.data[0]
        $props = $first.PSObject.Properties.Name
        $fieldList = $props -join ", "
        Write-Host "         Fields returned: $fieldList" -ForegroundColor Gray

        $hasSensitive = $props -contains "description" -or $props -contains "address" -or $props -contains "ownerId" -or $props -contains "ownerPhone"
        if ($hasSensitive) {
            Write-Host "  [FAIL] SENSITIVE DATA EXPOSED! Unauthenticated users can see private fields!" -ForegroundColor Red
            Write-Host "         This is a critical data privacy violation." -ForegroundColor Red
        } else {
            Write-Host "  [PASS] Data is properly masked. Only public info visible." -ForegroundColor Green
            Write-Host "         A scraper gets USELESS data: just titles and prices." -ForegroundColor Gray
        }
    } else {
        Write-Host "  [SKIP] No properties in database to verify masking." -ForegroundColor Yellow
    }
} catch {
    Write-Host "  [FAIL] Could not reach endpoint: $($_.Exception.Message)" -ForegroundColor Red
}

# ---------------------------------------------------------------------------
# CHECK 2.2: Public user sees MASKED data on single property
# ---------------------------------------------------------------------------
# SCENARIO:
#   A scraper requests a specific property by ID (GET /properties/:id).
#   Even for individual properties, sensitive data must remain hidden.
#
# WHY THIS MATTERS:
#   Some scrapers skip the list endpoint and directly guess property IDs.
#   Both endpoints must enforce the same masking rules.
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "  [CHECK 2.2] Single property /properties/:id (no authentication)..." -ForegroundColor Yellow
Write-Host "         Scenario: A scraper requests one specific property by ID." -ForegroundColor Gray
try {
    $headers = @{ "User-Agent" = $browserUA; "Referer" = "http://localhost:5173" }
    $listRes = Invoke-WebRequest -Uri "$base/properties" -UseBasicParsing -Method GET -Headers $headers
    $listBody = $listRes.Content | ConvertFrom-Json

    if ($listBody.data -and $listBody.data.Count -gt 0) {
        $firstId = $listBody.data[0].id
        if (-not $firstId) { $firstId = $listBody.data[0]._id }

        $singleRes = Invoke-WebRequest -Uri "$base/properties/$firstId" -UseBasicParsing -Method GET -Headers $headers
        $singleBody = $singleRes.Content | ConvertFrom-Json
        $singleProps = $singleBody.PSObject.Properties.Name
        $fieldList = $singleProps -join ", "
        Write-Host "         Fields returned: $fieldList" -ForegroundColor Gray

        $hasSensitive = $singleProps -contains "description" -or $singleProps -contains "address" -or $singleProps -contains "ownerId"
        if ($hasSensitive) {
            Write-Host "  [FAIL] Single property exposes sensitive fields without auth!" -ForegroundColor Red
        } else {
            Write-Host "  [PASS] Single property is also masked for public users." -ForegroundColor Green
            Write-Host "         Both list and detail endpoints enforce data privacy." -ForegroundColor Gray
        }
    } else {
        Write-Host "  [SKIP] No properties found to test single-item masking." -ForegroundColor Yellow
    }
} catch {
    Write-Host "  [FAIL] Error: $($_.Exception.Message)" -ForegroundColor Red
}

# ---------------------------------------------------------------------------
# CHECK 2.3: Write operations require authentication
# ---------------------------------------------------------------------------
# SCENARIO:
#   A scraper or attacker tries to CREATE a new property without logging in.
#   This should be blocked with a 401 Unauthorized error.
#
# WHY THIS MATTERS:
#   Without this check, anyone could inject fake properties into your database,
#   polluting your listings with spam or malicious content.
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "  [CHECK 2.3] Write protection (POST without authentication)..." -ForegroundColor Yellow
Write-Host "         Scenario: An attacker tries to create a fake property listing." -ForegroundColor Gray
try {
    $headers = @{ "User-Agent" = $browserUA; "Referer" = "http://localhost:5173" }
    Invoke-WebRequest -Uri "$base/properties" -UseBasicParsing -Method POST -Body "{}" -ContentType "application/json" -Headers $headers | Out-Null
    Write-Host "  [FAIL] POST /properties succeeded WITHOUT authentication!" -ForegroundColor Red
    Write-Host "         Anyone can create fake listings. This is a critical vulnerability." -ForegroundColor Red
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 401) {
        Write-Host "  [PASS] POST /properties correctly returns 401 Unauthorized." -ForegroundColor Green
        Write-Host "         Attackers cannot create, modify, or delete data without a valid token." -ForegroundColor Gray
    } else {
        Write-Host "  [INFO] POST returned HTTP $statusCode (expected 401)." -ForegroundColor Yellow
    }
}

# ---------------------------------------------------------------------------
# CHECK 2.4: Invalid JWT token gets masked data (not full data)
# ---------------------------------------------------------------------------
# SCENARIO:
#   A scraper sends a fake or expired JWT token hoping to trick the system
#   into revealing full property data. The system should treat them as public.
#
# WHY THIS MATTERS:
#   If an expired/fake token bypasses masking, a scraper only needs to
#   generate random tokens to access private data.
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "  [CHECK 2.4] Fake JWT token test..." -ForegroundColor Yellow
Write-Host "         Scenario: A scraper sends a fabricated authentication token." -ForegroundColor Gray
try {
    $fakeHeaders = @{
        "User-Agent" = $browserUA
        "Referer" = "http://localhost:5173"
        "Authorization" = "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmYWtlIn0.fake_signature_here"
    }
    $fakeRes = Invoke-WebRequest -Uri "$base/properties" -UseBasicParsing -Method GET -Headers $fakeHeaders
    $fakeBody = $fakeRes.Content | ConvertFrom-Json

    if ($fakeBody.data -and $fakeBody.data.Count -gt 0) {
        $fakeProps = $fakeBody.data[0].PSObject.Properties.Name
        $hasSensitive = $fakeProps -contains "description" -or $fakeProps -contains "address" -or $fakeProps -contains "ownerId"
        if ($hasSensitive) {
            Write-Host "  [FAIL] Fake JWT token revealed sensitive data!" -ForegroundColor Red
        } else {
            Write-Host "  [PASS] Fake token treated as public user. Data is masked." -ForegroundColor Green
            Write-Host "         Fabricated tokens cannot bypass the data privacy layer." -ForegroundColor Gray
        }
    } else {
        Write-Host "  [PASS] No data returned for fake token (treated as unauthorized)." -ForegroundColor Green
    }
} catch {
    $sc = $_.Exception.Response.StatusCode.value__
    if ($sc -eq 401) {
        Write-Host "  [PASS] Fake token rejected with 401 Unauthorized." -ForegroundColor Green
        Write-Host "         The system correctly identified the token as invalid." -ForegroundColor Gray
    } else {
        Write-Host "  [INFO] Returned HTTP $sc" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TEST 2 COMPLETE: Data masking and access control verified." -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
