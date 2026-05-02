###############################################################################
#                                                                             #
#   SMART PROPERTY - COMPLETE SECURITY TEST SUITE                             #
#   ==============================================================            #
#                                                                             #
#   This script runs ALL 5 security tests in sequence and produces a          #
#   comprehensive security audit report for the Smart Property Backend.       #
#                                                                             #
#   ARCHITECTURE OVERVIEW:                                                    #
#   The Smart Property backend implements a 5-Layer Defense System            #
#   inspired by bank-grade security architecture:                             #
#                                                                             #
#        INCOMING REQUEST                                                     #
#              |                                                              #
#   Layer 1: RATE LIMITING      - The "Bouncer" (300 req/60s per IP)         #
#              |                                                              #
#   Layer 2: FINGERPRINTING     - The "ID Checker" (IP, UA, Referer)         #
#              |                                                              #
#   Layer 3: BEHAVIOR ANALYSIS  - The "Security Guard" (Score 0-100)         #
#              |                                                              #
#   Layer 4: ACCESS CONTROL     - The "Vault" (JWT + Data Masking)           #
#              |                                                              #
#   Layer 5: HARDENING          - The "Extra Shields" (CORS, Helmet)         #
#              |                                                              #
#        YOUR CONTROLLER (returns data)                                       #
#                                                                             #
#   HOW SCORING WORKS:                                                        #
#                                                                             #
#   Each request receives a "suspicion score" from 0 to 100:                 #
#                                                                             #
#     +80 points: Known bot User-Agent (python-requests, scrapy, etc.)       #
#     +40 points: More than 100 requests in 60 seconds                       #
#     +20 points: More than 60 requests in 60 seconds                        #
#     +10 points: Missing Referer header                                     #
#                                                                             #
#   Response tiers based on score:                                            #
#                                                                             #
#     Score 0-29:   ALLOW    - Normal response, full speed                   #
#     Score 30-59:  DELAY    - Add 500-800ms artificial delay                #
#     Score 60-79:  HONEYPOT - Return fake empty data (200 OK)               #
#     Score 80+:    BLOCK    - Return 403 Forbidden                          #
#                                                                             #
#   PREREQUISITE:                                                             #
#   The backend server must be running: npm run start:dev                     #
#                                                                             #
###############################################################################

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "================================================================" -ForegroundColor Magenta
Write-Host ""
Write-Host "   SMART PROPERTY - COMPLETE SECURITY AUDIT" -ForegroundColor White
Write-Host "   5-Layer Defense System Verification" -ForegroundColor White
Write-Host ""
Write-Host "================================================================" -ForegroundColor Magenta
Write-Host ""
Write-Host "  This audit will verify all 5 security layers:" -ForegroundColor Gray
Write-Host ""
Write-Host "    Test 1: System Overview     - Are all guards on duty?" -ForegroundColor Gray
Write-Host "    Test 2: Data Masking        - Is the vault locked?" -ForegroundColor Gray
Write-Host "    Test 3: Rate Limiting       - Is the bouncer active?" -ForegroundColor Gray
Write-Host "    Test 4: Bot Detection       - Can we detect scrapers?" -ForegroundColor Gray
Write-Host "    Test 5: CORS & Hardening    - Are the shields up?" -ForegroundColor Gray
Write-Host ""
Write-Host "  Starting in 2 seconds..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

# ── Run Test 1 ──────────────────────────────────────────────────────────────
& "$scriptDir\01-layer-overview.ps1"
Start-Sleep -Seconds 1

# ── Run Test 2 ──────────────────────────────────────────────────────────────
& "$scriptDir\02-data-masking-test.ps1"
Start-Sleep -Seconds 1

# ── Run Test 3 ──────────────────────────────────────────────────────────────
& "$scriptDir\03-rate-limiting-test.ps1"
Start-Sleep -Seconds 1

# ── Run Test 4 ──────────────────────────────────────────────────────────────
& "$scriptDir\04-bot-detection-test.ps1"
Start-Sleep -Seconds 1

# ── Run Test 5 ──────────────────────────────────────────────────────────────
& "$scriptDir\05-cors-hardening-test.ps1"

# ── Final Summary ───────────────────────────────────────────────────────────
Write-Host ""
Write-Host "================================================================" -ForegroundColor Magenta
Write-Host ""
Write-Host "   SECURITY AUDIT COMPLETE" -ForegroundColor White
Write-Host ""
Write-Host "   All 5 layers of the defense system have been tested." -ForegroundColor White
Write-Host ""
Write-Host "   Layer 1: Rate Limiting      - Blocks high-frequency scrapers" -ForegroundColor Green
Write-Host "   Layer 2: Fingerprinting     - Identifies bots by signature" -ForegroundColor Green
Write-Host "   Layer 3: Behavior Analysis  - Scores and responds adaptively" -ForegroundColor Green
Write-Host "   Layer 4: Access Control     - Masks data for public users" -ForegroundColor Green
Write-Host "   Layer 5: Hardening          - CORS, Helmet, DNS security" -ForegroundColor Green
Write-Host ""
Write-Host "   Review any [FAIL] or [WARN] items above for action." -ForegroundColor Yellow
Write-Host ""
Write-Host "================================================================" -ForegroundColor Magenta
Write-Host ""
