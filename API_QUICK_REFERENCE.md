# 📋 API Quick Reference - Rental Payments

## Endpoints Overview

```
POST   /rentals/:id/payment-intent         Regular monthly payment
POST   /rentals/:id/payment-intent/bulk    Multi-month upfront (bulk)
POST   /rentals/:id/payment-intent/tranche Multi-tranche single month
GET    /rentals/:id/payment-schedule       Full payment schedule with status
GET    /rentals/:id/payment-status?...     Check payment status for period
```

---

## 1. Regular Payment
```bash
POST /rentals/69d07705e79bbb2a397cf115/payment-intent
Authorization: Bearer eyJ...

{
  "amount": 750,
  "currency": "eur",
  "billingPeriodStart": "2026-04-01T00:00:00Z",
  "billingPeriodEnd": "2026-05-01T00:00:00Z"
}

Response 200:
{
  "clientSecret": "pi_..._secret_...",
  "paymentId": "69d1643689e57bd71c09932a"
}
```

---

## 2. Bulk Multi-Month Payment
```bash
POST /rentals/69d07705e79bbb2a397cf115/payment-intent/bulk
Authorization: Bearer eyJ...

{
  "monthsCount": 5,
  "startFromMonth": "2026-04-01T00:00:00Z"
}

Response 200:
{
  "clientSecret": "pi_..._secret_...",
  "paymentId": "69d188d345821b8b916f4cc6",
  "coveredMonths": 5
}
```

**Use when:** Client wants to pay multiple months upfront (April-August)
**Amount calculated by:** monthlyRent × monthsCount

---

## 3. Tranche Payment
```bash
POST /rentals/69d07705e79bbb2a397cf115/payment-intent/tranche
Authorization: Bearer eyJ...

{
  "trancheAmount": 250,
  "trancheNumber": 1,
  "forMonth": "2026-04-01T00:00:00Z"
}

Response 200:
{
  "clientSecret": "pi_..._secret_...",
  "paymentId": "69d1643689e57bd71c09932a",
  "trancheInfo": "Tranche 1 of month April 2026 - 250 EUR"
}
```

**Use when:** Client pays single month in multiple installments
**Repeat:** Call 2-3 times with trancheNumber: 1, 2, 3...

---

## 4. Payment Status for Period
```bash
GET /rentals/69d07705e79bbb2a397cf115/payment-status?periodStart=2026-04-01&periodEnd=2026-05-01
Authorization: Bearer eyJ...

Response 200:
{
  "status": "PAID | UNPAID | OVERDUE | PARTIAL",
  "totalPaid": 500,
  "totalDue": 750,
  "tranches": [
    {
      "amount": 250,
      "status": "succeeded",
      "trancheNumber": 1,
      "paidAt": "2026-04-05T10:30:00Z"
    }
  ]
}
```

---

## 5. Full Payment Schedule
```bash
GET /rentals/69d07705e79bbb2a397cf115/payment-schedule
Authorization: Bearer eyJ...

Response 200:
{
  "schedule": [
    {
      "month": "April 2026",
      "dueDate": "2026-05-01",
      "amount": 750,
      "status": "PAID",
      "paidDate": "2026-04-04"
    },
    {
      "month": "May 2026",
      "dueDate": "2026-06-01",
      "amount": 750,
      "status": "UNPAID",
      "paidDate": null
    }
  ]
}
```

---

## Status Values

| Status | Meaning | Action |
|--------|---------|--------|
| `PAID` | Month fully paid | Show ✅ |
| `UNPAID` | No payment yet | Show button to pay |
| `PARTIAL` | Only some tranches paid | Show progress (e.g., 2/3) |
| `OVERDUE` | Past due date, unpaid | Show 🔴 warning |

---

## Database Fields (RentalPayment)

```javascript
{
  rentalId: ObjectId,
  amount: Number,                    // Total for this payment
  currency: "eur",
  stripePaymentIntentId: String,    // Stripe ID
  status: "pending|succeeded|failed",
  paidAt: Date,                      // When succeeded
  
  // NEW FIELDS:
  billingPeriodStart: Date,          // Month start
  billingPeriodEnd: Date,            // Month end
  trancheNumber: Number,             // 1, 2, 3... (for splits)
  isMultiMonth: Boolean,             // true if 5+ months
}
```

---

## Frontend Integration Steps

1. **Get payment intent** (any endpoint above)
2. **Use clientSecret with Stripe.js**
   ```javascript
   const { paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
     payment_method: { card: cardElement }
   });
   ```
3. **Show success/error UI**
   ```javascript
   if (paymentIntent.status === 'succeeded') {
     // ✅ Show success
   }
   ```
4. **Refresh payment schedule**
   ```javascript
   const schedule = await fetch(`/rentals/${id}/payment-schedule`);
   ```

---

## Test Cards

| Card | Result |
|------|--------|
| `4242 4242 4242 4242` | ✅ Succeeds |
| `4000 0000 0000 0002` | ❌ Declines |
| `4000 0025 0000 3155` | 🔐 Requires auth |

Expiry: Any future date (e.g., 12/27)
CVC: Any 3 digits

---

## Stripe CLI (Local Testing)

```bash
# Start listening for webhooks
.\stripe.exe listen --forward-to localhost:3000/rentals/webhook/stripe

# Simulate payment event (optional)
.\stripe.exe trigger payment_intent.succeeded
```

---

## Error Responses

```javascript
// 400 Bad Request
{
  "message": "Invalid currency: tnd. Use eur|usd|gbp...",
  "statusCode": 400
}

// 404 Not Found
{
  "message": "Rental not found",
  "statusCode": 404
}

// 500 Server Error
{
  "message": "Stripe webhook is not configured",
  "statusCode": 500
}
```

---

## Full Example: Pay 5 Months Upfront

```javascript
// User selects "Pay 5 months upfront" from rental detail
async function payBulk(rentalId, monthsCount) {
  // 1. Create bulk payment intent
  const res = await fetch(`/rentals/${rentalId}/payment-intent/bulk`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ monthsCount })
  });

  const { clientSecret, coveredMonths } = await res.json();
  console.log(`💰 Bulk payment for ${coveredMonths} months`);

  // 2. Show Stripe payment form
  const { paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
    payment_method: { card: cardElement }
  });

  // 3. Handle result
  if (paymentIntent.status === 'succeeded') {
    // ✅ Payment successful, show confirmation
    showToast(`✅ Paid for ${coveredMonths} months!`);
    
    // Refresh UI
    const schedule = await fetch(`/rentals/${rentalId}/payment-schedule`);
    updatePaymentTable(schedule);
  } else {
    showToast('❌ Payment failed');
  }
}
```

---

## Property Status Timeline (Rental Lifecycle)

### **New Status: `RENTAL_ENDED`**

```
AVAILABLE → RENTED → RENTAL_ENDED → AVAILABLE
             ↓
          [Tenant lives]
             ↓
       [moveOutDate passes]
             ↓
        [Scheduler runs daily at 00:00]
             ↓
      [Status auto-changes to RENTAL_ENDED]
             ↓
      [Owner confirms readiness]
             ↓
        [Back to AVAILABLE]
```

### **PropertyStatus Enum**

```typescript
enum PropertyStatus {
  'available',      // Ready to rent
  'rented',         // Currently leased
  'rental_ended',   // ← NEW: Lease expired, awaiting readiness confirmation
  'sold',           // Removed from market
  'inactive',       // Temporarily unavailable
}
```

### **When Status Changes**

| Event | Old Status | New Status | Triggered By |
|-------|-----------|-----------|-------------|
| User creates rental | AVAILABLE | RENTED | RentalController.create() |
| **moveOutDate passes** | RENTED | **RENTAL_ENDED** | **@Cron scheduler (daily midnight)** |
| Owner confirms ready | RENTAL_ENDED | AVAILABLE | API call (to implement) |

### **Scheduler Details**

```
Task: RentalScheduler.handleExpiredRentals()
Schedule: Every day at 00:00:00 (midnight)
Logic:
  1. Find all rentals where moveOutDate < today
  2. For each rental, update linked Property
  3. Set property.status = 'rental_ended'
  4. Log: "Property ABC reverted to RENTAL_ENDED after rental expiry"
```

---

**Full guide:** [RENTAL_PAYMENT_FRONTEND_GUIDE.md](./RENTAL_PAYMENT_FRONTEND_GUIDE.md)
