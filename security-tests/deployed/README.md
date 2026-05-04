# Deployed Security Tests

This folder contains security tests that target the deployed SmartProperty backend and frontend.

## Targets
- Backend: https://officer-inherited-auburn-insured.trycloudflare.com
- Frontend: https://smartproperty-front.vercel.app

## How to Run
From the repo root:

```powershell
.\security-tests\deployed\test_deployed.ps1
```

## Optional Auth Test
Some tests can verify authenticated access. Set these environment variables first:

```powershell
$env:SMARTPROPERTY_TEST_EMAIL="your-email"
$env:SMARTPROPERTY_TEST_PASSWORD="your-password"
```

## Files
- test_deployed.ps1: master runner for deployed tests
- 01-05: core security layers (health, data masking, rate limiting, bot detection, CORS/helmet)
- 06-frontend-portal-test.ps1: validates frontend-origin flow
- test-anti-scraping.ps1: end-to-end anti-scraping verification on deployed environment
