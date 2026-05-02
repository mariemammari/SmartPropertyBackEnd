# 🔄 Rental Payment System - Frontend Integration Guide

## Overview
The rental payment system now supports **three payment scenarios**:
1. **Regular monthly payment** (standard)
2. **Bulk multi-month upfront** (Client A: pay 5 months at once)
3. **Tranche-based payments** (Client B: pay 1 month in 3 tranches)

All use Stripe for payment processing and return billing period information to track which month(s) were paid.

---

## API Endpoints

### **1. Regular Monthly Payment (Standard)**
**Endpoint:** `POST /rentals/:rentalId/payment-intent`

**Request:**
```json
{
  "amount": 750,
  "currency": "eur",
  "billingPeriodStart": "2026-04-01T00:00:00Z",
  "billingPeriodEnd": "2026-05-01T00:00:00Z"
}
```

**Response:**
```json
{
  "clientSecret": "pi_1TIZizQ8H1AOxDQK23etJBXh_secret_...",
  "paymentId": "69d1643689e57bd71c09932a"
}
```

**Frontend Flow:**
```javascript
// 1. Get payment intent
const res = await fetch(`/rentals/${rentalId}/payment-intent`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({
    amount: 750,
    billingPeriodStart: new Date(2026, 3, 1),  // April 1, 2026
    billingPeriodEnd: new Date(2026, 4, 1)     // May 1, 2026
  })
});
const { clientSecret, paymentId } = await res.json();

// 2. Process with Stripe.js
const { paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
  payment_method: { card: cardElement }
});

if (paymentIntent.status === 'succeeded') {
  console.log('✅ Payment successful!');
}
```

---

### **2. Bulk Multi-Month Payment (Scenario A)**
**Endpoint:** `POST /rentals/:rentalId/payment-intent/bulk`

**Use Case:** Client wants to pay 5 months upfront (April-August)

**Request:**
```json
{
  "monthsCount": 5,
  "startFromMonth": "2026-04-01T00:00:00Z"
}
```

**Response:**
```json
{
  "clientSecret": "pi_1TIZizQ8H1AOxDQK...",
  "paymentId": "69d188d345821b8b916f4cc6",
  "coveredMonths": 5
}
```

**Example (Frontend):**
```javascript
// Client A selects: Pay 5 months upfront
const monthsCount = 5;
const startDate = new Date(2026, 3, 1);  // April 1

const res = await fetch(`/rentals/${rentalId}/payment-intent/bulk`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({ monthsCount, startFromMonth: startDate })
});

const { clientSecret, coveredMonths } = await res.json();

// Show in UI: "You're paying for 5 months (April-August) = 3,750 EUR"
console.log(`💰 Bulk payment covers ${coveredMonths} months`);

// Process payment
const { paymentIntent } = await stripe.confirmCardPayment(clientSecret, {...});
```

**Database Record Created:**
```json
{
  "amount": 3750,
  "billingPeriodStart": "2026-04-01",
  "billingPeriodEnd": "2026-09-01",
  "isMultiMonth": true,
  "trancheNumber": 1,
  "status": "pending" → "succeeded" (after webhook)
}
```

---

### **3. Tranche-Based Payment (Scenario B)**
**Endpoint:** `POST /rentals/:rentalId/payment-intent/tranche`

**Use Case:** Client negotiated to pay April in 3 tranches (250+250+250)

**Request (Tranche #1):**
```json
{
  "trancheAmount": 250,
  "trancheNumber": 1,
  "forMonth": "2026-04-01T00:00:00Z"
}
```

**Response:**
```json
{
  "clientSecret": "pi_1TIZizQ8H1AOxDQK...",
  "paymentId": "69d1643689e57bd71c09932a",
  "trancheInfo": "Tranche 1 of month April 2026 - 250 EUR"
}
```

**Example (Frontend):**
```javascript
// Client B wants to split April payment into 3 tranches
const forMonth = new Date(2026, 3, 1);  // April 1

// Tranche 1 (Due: April 5)
await createTranche(rentalId, 250, 1, forMonth);

// Tranche 2 (Due: April 12)
await createTranche(rentalId, 250, 2, forMonth);

// Tranche 3 (Due: April 20)
await createTranche(rentalId, 250, 3, forMonth);

async function createTranche(rentalId, amount, trancheNum, month) {
  const res = await fetch(`/rentals/${rentalId}/payment-intent/tranche`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      trancheAmount: amount,
      trancheNumber: trancheNum,
      forMonth: month
    })
  });
  
  const { clientSecret, trancheInfo } = await res.json();
  console.log(trancheInfo);  // "Tranche 1 of month April 2026 - 250 EUR"
  
  // Process each tranche independently
  const { paymentIntent } = await stripe.confirmCardPayment(clientSecret, {...});
}
```

**Database Records Created:**
```json
[
  {
    "amount": 250,
    "billingPeriodStart": "2026-04-01",
    "billingPeriodEnd": "2026-05-01",
    "trancheNumber": 1,
    "status": "succeeded"
  },
  {
    "amount": 250,
    "billingPeriodStart": "2026-04-01",  // SAME period
    "billingPeriodEnd": "2026-05-01",
    "trancheNumber": 2,
    "status": "succeeded"
  },
  {
    "amount": 250,
    "billingPeriodStart": "2026-04-01",  // SAME period
    "billingPeriodEnd": "2026-05-01",
    "trancheNumber": 3,
    "status": "pending"
  }
]
```

---

## Checking Payment Status

### **New Endpoint: Get Payment Status for a Period**
**Endpoint:** `GET /rentals/:rentalId/payment-status?periodStart=2026-04-01&periodEnd=2026-05-01`

**Response:**
```json
{
  "status": "PARTIAL",
  "totalPaid": 500,
  "totalDue": 750,
  "tranches": [
    {
      "amount": 250,
      "status": "succeeded",
      "trancheNumber": 1,
      "paidAt": "2026-04-05T10:30:00Z"
    },
    {
      "amount": 250,
      "status": "succeeded",
      "trancheNumber": 2,
      "paidAt": "2026-04-10T15:45:00Z"
    },
    {
      "amount": 250,
      "status": "pending",
      "trancheNumber": 3,
      "paidAt": null
    }
  ]
}
```

**Frontend Usage:**
```javascript
async function checkMonthlyPaymentStatus(rentalId, month) {
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 1);

  const res = await fetch(
    `/rentals/${rentalId}/payment-status?periodStart=${start.toISOString()}&periodEnd=${end.toISOString()}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );

  const { status, totalPaid, totalDue, tranches } = await res.json();

  if (status === 'PAID') {
    console.log('✅ Month paid in full');
  } else if (status === 'PARTIAL') {
    console.log(`⚠️  Partial payment: ${totalPaid}/${totalDue} EUR (${tranches.length} tranches)`);
  } else if (status === 'OVERDUE') {
    console.log('❌ Payment overdue!');
  }
}
```

---

## Updated Payment Schedule Display

The payment schedule endpoint (`GET /rentals/:id/payment-schedule`) now includes status for each month:

**Response:**
```json
{
  "rentalId": "69d07705e79bbb2a397cf115",
  "amount": 750,
  "currency": "eur",
  "paymentFrequencyMonths": 1,
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
    },
    {
      "month": "June 2026",
      "dueDate": "2026-07-01",
      "amount": 750,
      "status": "OVERDUE",
      "paidDate": null
    }
  ]
}
```

**Frontend:** Just display the `status` field directly!

---

## Integration Checklist

- [ ] Update payment modal to accept `billingPeriodStart` / `billingPeriodEnd`
- [ ] Add "Pay Multiple Months" option (bulk endpoint)
- [ ] Add "Split Payment" option (tranche endpoint)
- [ ] Display tranche progress (e.g., "2/3 tranches paid")
- [ ] Show payment status in rental table (PAID/UNPAID/OVERDUE/PARTIAL)
- [ ] Refresh payment schedule after each successful payment
- [ ] Handle partial payments in UI (show remaining balance)

---

## Error Handling

**Common Errors:**

| Error | Cause | Solution |
|-------|-------|----------|
| Invalid currency | Stripe account doesn't support currency | Use EUR instead of TND |
| Amount must be > 0 | Zero or negative amount | Validate amount > 0 |
| Rental not found | ID doesn't exist | Verify rentalId |
| stripePaymentIntentId unique violation | Duplicate payment | Check for pending/failed tranches |

---

## Testing Scenarios

### **Scenario A: Bulk Payment (5 months)**
```javascript
// Client wants to pay April-August upfront
POST /rentals/123/payment-intent/bulk
{ "monthsCount": 5 }

// Stripe test card: 4242 4242 4242 4242
// Result: 1 RentalPayment covering all 5 months
// DB shows: isMultiMonth: true, amount: 3750
```

### **Scenario B: Multi-Tranche (3 part)**
```javascript
// Client pays April in 3 tranches
POST /rentals/123/payment-intent/tranche { trancheAmount: 250, trancheNumber: 1 }
POST /rentals/123/payment-intent/tranche { trancheAmount: 250, trancheNumber: 2 }
POST /rentals/123/payment-intent/tranche { trancheAmount: 250, trancheNumber: 3 }

// Result: 3 RentalPayments with same billingPeriodStart/End
// DB shows: trancheNumber: 1,2,3 respectively
```

### **Scenario C: Early Payment**
```javascript
// Client pays 3 months early (April, May, June)
POST /rentals/123/payment-intent/bulk
{ "monthsCount": 3, "startFromMonth": "2026-04-01" }

// Status query shows all three months as PAID
```

---

## Key Changes Summary

| Aspect | Before | After |
|--------|--------|-------|
| Payment tracking | Status only (pending/succeeded) | Period + Tranche info |
| Multi-month support | ❌ None | ✅ Bulk endpoint |
| Split payments | ❌ None | ✅ Tranche endpoint |
| Period accuracy | Vague (uses lastPaymentDate) | Precise (billingPeriodStart/End) |
| Status query | Manual calculation | `GET /payment-status` endpoint |

---

## 📞 RENTAL CHAT Messages - Sender Role Tracking

Each message in the rental conversation now includes the **sender's role** so the frontend can display context about who sent it.

### **RentalMessage Structure**

```json
{
  "_id": "msg_123",
  "conversationId": "conv_456",
  "senderId": "user_789",
  "content": "When can we schedule the inspection?",
  "senderRole": "agent",
  "visibleTo": "all",
  "readBy": ["user_789"],
  "createdAt": "2026-04-05T10:30:00Z",
  "updatedAt": "2026-04-05T10:30:00Z"
}
```

### **New Field: `senderRole`**

| Field | Value | Meaning |
|-------|-------|---------|
| `senderRole` | `"agent"` | Real estate agent sent this |
| `senderRole` | `"tenant"` | Tenant (renter) sent this |
| `senderRole` | `"owner"` | Property owner sent this |

### **Example: Displaying Messages with Role Context**

```javascript
// Fetch messages
const res = await fetch(`/rental-chat/conversations/${conversationId}/messages`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
const messages = await res.json();

// Render messages with role badges
messages.forEach(msg => {
  const roleColor = {
    'agent': 'blue',
    'tenant': 'green',
    'owner': 'purple'
  };

  const roleIcon = {
    'agent': '🏢',
    'tenant': '👤',
    'owner': '👑'
  };

  console.log(`
    ${roleIcon[msg.senderRole]} [${msg.senderRole.toUpperCase()}]
    ${msg.content}
    <span style="color: ${roleColor[msg.senderRole]}">${msg.senderRole}</span>
  `);
});
```

### **UI Example**

```
┌─────────────────────────────────────────┐
│ 🏢 [AGENT]                              │
│ When can we schedule the inspection?     │
│ 2026-04-05 10:30                        │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 👤 [TENANT]                             │
│ Next Tuesday works for me                │
│ 2026-04-05 10:45                        │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 👑 [OWNER]                              │
│ Please ensure utilities are ready        │
│ 2026-04-05 11:00                        │
└─────────────────────────────────────────┘
```

### **Send Message with Automatic Role Assignment**

```javascript
// When tenant sends a message
const res = await fetch(`/rental-chat/conversations/${conversationId}/messages`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({
    content: "Can we delay move-in by one week?",
    visibleTo: "all"
  })
});

const message = await res.json();
// Backend automatically sets: senderRole: "tenant"
console.log(message.senderRole);  // "tenant"
```

### **Why This Matters**

- ✅ **Visual Identification**: Users instantly see who sent each message
- ✅ **No Name Lookup**: Don't need to fetch sender's user data
- ✅ **Message Threading**: Group/color-code by role for clarity
- ✅ **Audit Trail**: Know which role is involved in each decision
- ✅ **Permissions**: Easy to implement role-specific actions

### **Roles in Conversation**

For rental `69d07705e79bbb2a397cf115`:

| Role | Who | Can See | Can Send |
|------|-----|---------|----------|
| `agent` | Real estate agent | All messages | Yes |
| `tenant` | Tenate/Renter | All messages | Yes |
| `owner` | Property owner | All messages | Yes |

(Note: If a participant is missing—e.g., no agent assigned—only TENANT and OWNER exist)

---

## 🏠 Property Status - Rental Lifecycle

When a rental agreement expires, the property **automatically transitions** through statuses:

### **New Status: `RENTAL_ENDED`**

```typescript
// Property status flow during rental lifecycle
AVAILABLE  →  (user rents)  →  RENTED  →  (moveOutDate passes)  →  RENTAL_ENDED  →  (owner confirms)  →  AVAILABLE
```

### **What Changed**

Previously, properties reverted directly to `AVAILABLE` when lease expired. **Now:**

1. **Automatic Scheduler** runs daily at **midnight** ⏰
   - Finds all expired rentals (`moveOutDate < today`)
   - Sets property status to `RENTAL_ENDED`
   - Logged to backend console for audit trail

2. **Property Status: `RENTAL_ENDED`** indicates:
   - ✅ Tenant has moved out (lease expired)
   - ⏳ Awaiting owner confirmation (cleaning, inspection)
   - ❌ Cannot be rented again until back to `AVAILABLE`

3. **Owner Flow** (frontend needs to handle):
   - Receive notification: "Property ABC just ended rental"
   - Review property condition
   - Confirm cleaning/repairs done
   - Click "Ready to List" → status changes to `AVAILABLE`

### **PropertyStatus Enum (Updated)**

```typescript
export enum PropertyStatus {
  AVAILABLE = 'available',        // Ready for new rental
  RENTED = 'rented',               // Currently leased
  RENTAL_ENDED = 'rental_ended',   // ← NEW: Lease expired, awaiting readiness
  SOLD = 'sold',                   // No longer in rental pool
  INACTIVE = 'inactive',           // Temporarily unavailable
}
```

### **Frontend Implementation**

**Display Property Status Badge:**
```javascript
// Show appropriate UI for each status
const statusDisplay = {
  'available': { label: 'Available', color: 'green', icon: '🟢' },
  'rented': { label: 'Rented', color: 'blue', icon: '🟦' },
  'rental_ended': { label: 'Lease Ended', color: 'orange', icon: '⚠️' },  // ← NEW
  'sold': { label: 'Sold', color: 'gray', icon: '⬜' },
  'inactive': { label: 'Inactive', color: 'red', icon: '🔴' },
};

// In property detail/list view
function PropertyStatusBadge({ status }) {
  const { label, color, icon } = statusDisplay[status];
  return (
    <span style={{ color, fontWeight: 'bold' }}>
      {icon} {label}
    </span>
  );
}
```

**Owner Dashboard: Rental Ended Alert**
```javascript
// On property list page
properties.forEach(prop => {
  if (prop.status === 'rental_ended') {
    // Show prominent notification
    showAlert({
      type: 'warning',
      title: `${prop.title} - Lease Ended`,
      message: 'Click to review and confirm property is ready',
      action: () => navigateTo(`/properties/${prop._id}/confirm-readiness`),
      icon: '⚠️'
    });
  }
});
```

**Confirm Readiness Endpoint** (Backend to implement):
```javascript
// PATCH /properties/:id/status
// When owner clicks "Ready to List"
const updatePropertyStatus = async (propertyId) => {
  const res = await fetch(`/properties/${propertyId}/status`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ status: 'available' })
  });
  const updated = await res.json();
  showNotification(`Property back to AVAILABLE`);
};
```

### **Scheduler Timeline (Backend)**

```
Every Day at 00:00:00
│
├─ Query: Find rentals where moveOutDate < today
│
├─ For each expired rental:
│  ├─ Update property.status → "rental_ended"
│  ├─ Log: "Property ABC reverted to RENTAL_ENDED"
│  └─ Update property.updatedAt
│
└─ Log summary: "Processed 3 expired rentals"
```

### **Why This Pattern**

- ✅ **Safety**: Property can't be rented before owner confirms readiness
- ✅ **Visibility**: Owner gets clear "action needed" signal
- ✅ **Automation**: No manual calendar checking needed
- ✅ **Audit**: Uses scheduled task with logging (no silent updates)
- ✅ **Flexibility**: Owner controls when property goes back to market

---

**Questions?** Check backend logs or contact backend team.

Endpoints live at: `POST /rentals/:id/payment-intent*` 🚀
