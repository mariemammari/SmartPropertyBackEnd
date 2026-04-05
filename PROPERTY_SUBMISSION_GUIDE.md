# Property Submission & Assignment Workflow

## Overview

This module implements a robust and fair property submission workflow for clients. When a client submits a property, it's automatically assigned to a real estate agent in their branch based on workload fairness.

**Key Features:**
- ✅ Client submissions are NOT directly published
- ✅ Properties start as `inactive`, listings as `pending_review`
- ✅ Fair assignment using **least-loaded algorithm**
- ✅ Agent approval/rejection workflow
- ✅ Structured logging for observability
- ✅ Backward compatible with existing agent workflows

---

## Data Model Changes

### PropertyListing Schema (New Fields)

| Field | Type | Purpose |
|-------|------|---------|
| `submittedByClient` | boolean | Marks client submissions |
| `assignedAgentId` | ObjectId | Agent assigned for review |
| `assignmentStatus` | "assigned" \| "unassigned" | Current assignment state |
| `assignedAt` | Date | Timestamp of assignment |
| `lastAssignedAt` | Date | Last assignment time (for tie-breaking) |

### User Schema (New Field)

| Field | Type | Purpose |
|-------|------|---------|
| `lastAssignedAt` | Date | Tracks when agent last received assignment |

---

## Least-Loaded Assignment Algorithm

### Selection Criteria

1. **Workload Calculation:**
   - Count submitted requests where status ∈ `["pending_review", "under_review"]`
   - Assigned to the agent only (not global)

2. **Selection Process:**
   - Find all eligible agents:
     - `role` = `"real_estate_agent"`
     - `status` = `"active"`
     - `branchId` matches submission
   - Calculate workload for each
   - Pick agent with **minimum workload**

3. **Tie-Breakers (in order):**
   - **Tie 1 (Equal workload):** Pick agent with oldest `lastAssignedAt` (ensures fairness)
   - **Tie 2 (Never assigned):** Use ascending `_id` for determinism

### Example Scenario

```
Agents in Branch:
  Alice: workload=3, lastAssignedAt=2024-04-01T10:00Z
  Bob:   workload=3, lastAssignedAt=2024-04-01T11:00Z    ← Gets new assignment
  Carol: workload=1, lastAssignedAt=2024-04-01T09:00Z    (Carol gets priority if workload matched)

New submission → Assigned to Bob (tie-break: older lastAssignedAt)
```

---

## API Endpoints

### 1. Client Property Submission

**Endpoint:** `POST /property-submissions/client`

**Request:**
```json
{
  "branchId": "507f1f77bcf86cd799439011",
  "propertyType": "villa",
  "type": "sale",
  "title": "Beautiful Villa Carthage",
  "price": 500000,
  "bedrooms": 4,
  "bathrooms": 2,
  "city": "Tunis",
  "lat": 36.8,
  "lng": 10.1,
  "address": "Main Avenue, Carthage",
  "furnishingStatus": "unfurnished",
  "standing": "haut_standing"
}
```

**Response:**
```json
{
  "success": true,
  "listing": {
    "_id": "507f1f77bcf86cd799439012",
    "status": "pending_review",
    "submittedByClient": true,
    "assignedAgentId": "507f1f77bcf86cd799439013",
    "assignmentStatus": "assigned",
    "assignedAt": "2024-04-03T14:30:00Z"
  },
  "warning": null,
  "message": "Property submitted and assigned for review"
}
```

**Status Codes:**
- `201`: Success
- `422`: Missing/invalid `branchId`
- `400`: Validation error

---

### 2. Fetch Agent's Pending Submissions

**Endpoint:** `GET /property-submissions/assigned/pending?page=1&limit=10`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439012",
      "propertyId": { "propertyType": "villa", "bedrooms": 4 },
      "ownerId": { "fullName": "Ahmed Mahjoub", "email": "client@example.com" },
      "status": "pending_review",
      "assignedAt": "2024-04-03T14:30:00Z"
    }
  ],
  "total": 15,
  "page": 1,
  "pages": 2
}
```

---

### 3. Agent Approves Submission

**Endpoint:** `PATCH /property-submissions/:id/approve`

**Request:**
```json
{
  "agentComments": "Property looks good. Photos are clear."
}
```

**Result:**
- ✅ `listing.status` → `"approved"`
- ✅ `property.status` → `"available"`
- ✅ `reviewedBy` and `reviewedAt` are set

---

### 4. Agent Rejects Submission

**Endpoint:** `PATCH /property-submissions/:id/reject`

**Request:**
```json
{
  "rejectionReason": "Poor quality photos, exterior needs maintenance review",
  "agentComments": "Please provide better photos and maintenance report"
}
```

**Result:**
- ✅ `listing.status` → `"rejected"`
- ✅ `property.status` → remains `"inactive"`
- ✅ `rejectionReason` is stored for future reference

---

## Authorization Rules

### Client
- ✅ Can submit property → POST `/property-submissions/client`
- ❌ Cannot set `assignedAgentId` manually
- ❌ Cannot see assigned agent submissions

### Real Estate Agent
- ✅ Can view their assigned pending submissions
- ✅ Can approve assigned submissions
- ✅ Can reject assigned submissions
- ❌ Cannot approve/reject submissions assigned to others
- ❌ Cannot modify `assignmentStatus` directly

### Branch Manager / Admin
- ✅ Full access (typically)
- ✅ Can reassign submissions if needed
- ✅ Can view all submissions in branch

---

## Concurrency Safety

The system is designed to handle simultaneous submissions:

1. **Assignment Service** uses atomic queries with proper indexing:
   - `countDocuments()` for workload is scoped to `assignedAgentId`
   - `findByIdAndUpdate()` with `{ new: true }` ensures atomicity

2. **In-Memory Calculation:**
   - Each assignment calculates fresh workload snapshot
   - No cached workload values

3. **Future Enhancement:**
   - Can add MongoDB transactions/sessions if stronger CAP guarantees needed
   - Currently sufficient for typical submission rates

---

## Observability & Logging

### Structured Logs

```
[AssignmentService] Selected agent Alice (507f1f77bcf86cd799439013) 
  with workload 3. Snapshot: [{"agentId":"...","workload":3}]

[PropertySubmissionService] Created property 507f1f77bcf86cd799439012 
  from client submission

[PropertySubmissionService] Assigned listing 507f1f77bcf86cd799439012 
  to agent 507f1f77bcf86cd799439013

[PropertySubmissionService] Agent 507f1f77bcf86cd799439013 approved 
  listing 507f1f77bcf86cd799439012
```

---

## Example: Complete Submission Flow

```
1. Client submits property
   POST /property-submissions/client
   ↓
   Property created (status: inactive)
   Listing created (status: pending_review, submittedByClient: true)
   ↓
   AssignmentService.findBestAgentForAssignment()
   → Calculates workloads for all eligible agents
   → Selects Bob (workload: 2)
   ↓
   Listing assigned to Bob (assignedAgentId: Bob's ID)

2. Bob views his pending submissions
   GET /property-submissions/assigned/pending
   → Returns 1 listing with property details

3. Bob reviews and approves
   PATCH /property-submissions/{id}/approve
   ↓
   Listing status → "approved"
   Property status → "available"
   ↓
   Property now visible to renters/buyers

4. Alternative: Bob rejects
   PATCH /property-submissions/{id}/reject
   ↓
   Listing status → "rejected"
   Property remains "inactive"
   ↓ Client can modify and resubmit
```

---

## Backward Compatibility

### Existing Agent Workflows

✅ **Agents can still create properties directly:**
- `POST /property` (agent workflow)
- Property created with `status: "active"` (not "inactive")
- Listing created with `status: "draft"` (not "pending_review")
- These skip the assignment workflow

### Field Defaults

New fields have safe defaults:
- `submittedByClient` defaults to `false`
- `assignmentStatus` defaults to `"unassigned"`
- Existing listings unaffected

---

## Testing

### Unit Tests

```bash
npm run test src/property-submission/services/assignment.service.spec.ts
```

**Covered:**
- ✅ Least-loaded selection
- ✅ Tie-breaker logic (workload, lastAssignedAt, _id)
- ✅ No eligible agent fallback
- ✅ Invalid branchId rejection

### Integration Tests

```bash
npm run test src/property-submission/services/property-submission.service.spec.ts
```

**Covered:**
- ✅ Client submission creates property + listing
- ✅ Auto-assignment to agent
- ✅ Unassigned fallback
- ✅ Approval/rejection transitions
- ✅ Agent isolation (agent only sees own submissions)

---

## Configuration & Tuning

### Workload Calculation

If you want to include other statuses in workload calculation:

```typescript
// In assignment.service.ts
const count = await this.listingModel.countDocuments({
  assignedAgentId: agentId,
  status: { $in: ['pending_review', 'under_review', 'draft'] } // Add as needed
});
```

### Pagination Defaults

Located in `property-submission.controller.ts`:
- Default page: 1
- Default limit: 10
- Maximum limit: 100

---

## Troubleshooting

### "No eligible agents available in this branch"

**Cause:** No agents with role `real_estate_agent` and status `active` in branch

**Solution:**
1. Create agents in branch
2. Ensure agent status is `active`
3. Ensure agent role is `real_estate_agent`

### "Only the assigned agent can approve/reject"

**Cause:** Different agent tried to modify submission

**Solution:**
- Only the assigned agent can approve/reject
- Admins/managers can reassign if needed (feature for future)

### High workload disparity

**Cause:** Some agents getting all requests

**Possible reasons:**
1. New agents have `lastAssignedAt = null` (treated as 0, lower priority)
2. If agents have identical workload/lastAssignedAt, _id determines selection

**Solution:**
- Manually adjust `lastAssignedAt` for new agents
- Or use reassignment API (future feature)

---

## Future Enhancements

1. **Manual Reassignment:** Allow managers to move submissions between agents
2. **Load Limits:** Define max workload per agent
3. **Skill-Based Routing:** Assign based on agent specialization + workload
4. **Bulk Operations:** Batch approve/reject
5. **Webhooks:** Notify agents of new assignments

---

## File Structure

```
src/property-submission/
├── dto/
│   ├── create-property-submission.dto.ts
│   └── submission-review.dto.ts
├── services/
│   ├── assignment.service.ts
│   ├── assignment.service.spec.ts
│   ├── property-submission.service.ts
│   └── property-submission.service.spec.ts
├── property-submission.controller.ts
└── property-submission.module.ts
```

---

## Support

For issues or feature requests, contact the development team.
