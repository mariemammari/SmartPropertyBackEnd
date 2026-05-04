$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Optional: set test credentials here for the deployed auth checks.
# Use a dedicated test account, not a personal account.
$testEmail = "emnaammri@gmail.com"
$testPassword = "EmnaPass123!"

if ($testEmail -and $testPassword) {
	$env:SMARTPROPERTY_TEST_EMAIL = $testEmail
	$env:SMARTPROPERTY_TEST_PASSWORD = $testPassword
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor Magenta
Write-Host "   SMART PROPERTY - DEPLOYED SECURITY AUDIT" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor Magenta
Write-Host ""

& "$scriptDir\01-layer-overview.ps1"
& "$scriptDir\02-data-masking-test.ps1"
& "$scriptDir\03-rate-limiting-test.ps1"
& "$scriptDir\04-bot-detection-test.ps1"
& "$scriptDir\05-cors-hardening-test.ps1"
& "$scriptDir\06-frontend-portal-test.ps1"
& "$scriptDir\test-anti-scraping.ps1"

Write-Host ""
Write-Host "================================================================" -ForegroundColor Magenta
Write-Host "   DEPLOYED SECURITY AUDIT COMPLETE" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor Magenta
Write-Host ""