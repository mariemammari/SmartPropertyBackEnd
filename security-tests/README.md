# Smart Property - Security Test Suite

## Overview
This folder contains a comprehensive security verification suite for the Smart Property Backend API.  
The system implements a **5-Layer Defense Architecture** inspired by bank-grade security:

| Layer | Name | Purpose |
|-------|------|---------|
| 1 | Rate Limiting | Blocks IPs that send too many requests (the "Bouncer") |
| 2 | Fingerprinting | Identifies each visitor by IP, browser, and behavior (the "ID Checker") |
| 3 | Behavior Analysis | Scores each request 0-100 for suspicion (the "Security Guard") |
| 4 | Access Control | Masks sensitive data for unauthenticated users (the "Vault") |
| 5 | Hardening | CORS, Helmet, logging (the "Extra Shields") |

## How to Run

### Prerequisites
- Backend server must be running (`npm run start:dev`)
- PowerShell terminal

### Run ALL tests at once:
```powershell
.\security-tests\run-all-tests.ps1
```

### Run individual tests:
```powershell
.\security-tests\01-layer-overview.ps1        # System overview & health
.\security-tests\02-data-masking-test.ps1      # Vault / data privacy test
.\security-tests\03-rate-limiting-test.ps1     # Bouncer / spam protection
.\security-tests\04-bot-detection-test.ps1     # Bot identity detection
.\security-tests\05-cors-hardening-test.ps1    # Perimeter security
```

## Expected Results
All tests should show `[PASS]` in green. Any `[FAIL]` in red indicates a security gap.
