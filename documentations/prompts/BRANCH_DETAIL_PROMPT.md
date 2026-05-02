BranchDetail.jsx — API spec & data model

Purpose
- Information and KPI spec for `BranchDetail.jsx` (accessible to `BRANCH_MANAGER` and `SUPER_ADMIN`).

Access & Auth
- Primary roles: `BRANCH_MANAGER`, `SUPER_ADMIN`.
- Most endpoints require JWT: set `Authorization: Bearer <token>` header.
- For development you may have a test-only public endpoint (toggle as needed).

Page Sections (UX)
- Header: Branch name, manager, address, contact
- KPI row: Active rentals, Occupancy rate, Total revenue (period), Collected amount, Outstanding balance, Overdue invoices, Open complaints, Active listings
- Charts: Revenue (last 6/12 months), Payments trend, Occupancy trend
- Tables: Active rentals (paginated), Recent invoices, Expiring contracts (30/90 days), New applications/leads, Open complaints
- Timeline: recent events (payments, invoices, contracts, complaints)
- Quick actions: Create invoice, Verify payment, Upload contract, Contact tenant/owner

Data models (fields to display)
- Rental: `_id`, `propertyId` (populated -> `title,address,branchId`), `tenantId` (populate `fullName,email,phone`), `status`, `outstandingBalance`, `nextPaymentDue`, `createdAt`
- Property: `_id`, `title`, `address`, `branchId`, `status` (rented/available), `latestInvoiceId`
- Invoice: `_id`, `invoiceNumber`, `date`, `dueDate`, `total`, `paid`, `balanceDue`, `status`, `pdfUrl`, `rentalId`, `rentalPaymentId`, `branchId`
- Contract: `_id`, `rentalId`, `version`, `documentUrl`, `expiresAt`, `isArchived`, `signedBy`
- Application/Lead: `_id`, `applicantName`, `propertyId`, `status`, `createdAt`
- Complaint: `_id`, `target`, `status`, `createdAt`, `details`
- User (staff): `_id`, `fullName`, `role`, `email`, `branchId`

Key KPIs (definition + how to compute)
- Active Rentals: count of rentals with `status` in `['rented']` for branch. Endpoint: `GET /rentals/branch/:branchId`.
- Occupancy Rate: rentedProperties / totalPropertiesInBranch. Endpoints: `GET /property/rented/branch/:branchId` and `GET /property/branch/:branchId` (if available).
- Total Revenue (period): sum(invoice.total) for invoices with `branchId` in date range. Suggested endpoint: `GET /finance/invoices?branchId=:branchId&from=YYYY-MM-DD&to=YYYY-MM-DD` or aggregated `GET /finance/stats?branchId=:branchId&from&to`.
- Collected Amount: sum(invoice.paid) same filter.
- Outstanding Balance: sum(invoice.balanceDue) same filter.
- Overdue Invoices: count invoices with `balanceDue>0` and `dueDate < now`.
- Payment Collection Rate: collected / totalRevenue.
- Contracts expiring soon: contracts where `expiresAt` within next N days. Existing flow: list rentals for branch then call `GET /rental-documents/contracts?rentalId=...` or add `GET /rental-documents/contracts/expiring?branchId=:branchId&days=30`.
- New Applications / Leads: `GET /application/branch/:branchId` (existing)
- Open Complaints: `GET /complaints?branchId=:branchId&status=open` (existing filtering in complaint service)

Existing endpoints (useful for BranchDetail)
- Rentals
  - GET `/rentals/branch/:branchId` — list rentals for branch (added)
  - GET `/rentals/:id` — single rental
  - GET `/rentals/property/:propertyId`
- Properties
  - GET `/property/rented/branch/:branchId` — rented properties for branch
  - (suggest) GET `/property/branch/:branchId` — all properties in branch
- Property Listings
  - GET `/property-listing/branch/:branchId` — listings in branch
- Applications
  - GET `/application/branch/:branchId` — applications/leads
- Complaints
  - GET `/complaints` with `branchId` query filter (server supports branch filtering)
- Finance / Invoices
  - POST `/finance/invoices` — create manual invoice
  - GET `/finance/invoices` — list invoices (server-side supports accountant scoping; consider adding `?branchId=` filter)
  - GET `/finance/invoices/accountant/:accountantId` — invoices for an accountant (added)
  - GET `/finance/invoices/:id/pdf` — invoice PDF URL
  - (suggest) GET `/finance/invoices/branch/:branchId` or `GET /finance/stats?branchId=` for branch-level aggregates
- Contracts & Documents
  - POST `/rental-documents/contracts` — upload new contract version
  - GET `/rental-documents/contracts?rentalId=...` — list versions
  - GET `/rental-documents/contracts/rental/:rentalId/latest` — latest contract
  - (suggest) aggregate: `GET /rental-documents/contracts/expiring?branchId=&days=`
- Users / Staff
  - (server) `UserService.findUsersByBranch(branchId)` exists — controller endpoint `GET /users/branch/:branchId` may be added/used to list staff

Suggested aggregated endpoints (recommended)
- GET `/branches/:branchId/dashboard?from&to` — returns all KPIs in one call:
  {
    activeRentals: number,
    occupancyRate: number,
    totalRevenue: number,
    collectedAmount: number,
    outstandingBalance: number,
    overdueInvoicesCount: number,
    openComplaintsCount: number,
    expiringContracts: [{ rentalId, contractId, daysToExpiry }],
    recentActivity: [ ... ],
  }

- GET `/finance/invoices?branchId=:branchId&from&to&status&limit&page`
- GET `/rental-documents/contracts/expiring?branchId=:branchId&days=30`

Example requests
- Fetch active rentals (branch manager):
```javascript
fetch('/rentals/branch/69c6d7d4d0cf6938952e6eec', { headers: { Authorization: `Bearer ${authToken}` } })
  .then(r => r.json()).then(rentals => console.log(rentals));
```
- Fetch recent invoices (recommended):
```bash
curl -H "Authorization: Bearer <token>" "http://localhost:3000/finance/invoices?branchId=69c6d7d4d0cf6938952e6eec&limit=20"
```

Performance & UX notes
- Prefer server-side aggregated endpoint `/branches/:branchId/dashboard` to reduce round-trips.
- Add `from`/`to` query params to KPI endpoints for date range filtering.
- Use pagination on tables and `limit` on recent activity endpoints.
- Cache dashboard results for short windows (e.g., 1–5 minutes) to reduce DB load.

Implementation checklist for frontend
- [ ] Header card (branch name + manager + contact)
- [ ] KPI row using aggregated endpoint or parallel calls
- [ ] Active rentals table (columns: property, tenant, rent, nextPaymentDue, status)
- [ ] Recent invoices table (download PDF action)
- [ ] Expiring contracts panel (download/sign)
- [ ] Complaints & applications lists
- [ ] Charts for revenue and occupancy

Files & server references (where to look in backend)
- Rentals: `src/rental/rental.controller.ts`, `src/rental/rental.service.ts` (see `findByBranch`)
- Invoices: `src/finance/finance.controller.ts`, `src/finance/finance.service.ts`
- Contracts: `src/rental/rental-document.controller.ts`, `src/rental/rental-contract.service.ts`
- Properties: `src/property/property.controller.ts`, `src/property/property.service.ts`
- Applications: `src/application/application.controller.ts`, `src/application/application.service.ts`
- Complaints: `src/complaint/controllers/complaint.controller.ts`, `src/complaint/services/complaint.service.ts`

Next steps (suggested)
- Implement/enable aggregated endpoint `/branches/:branchId/dashboard` in backend (recommended).
- Add missing branch-scoped endpoints if needed: invoices by branch, contracts expiring by branch, users by branch.

If you want I can:
- Implement the aggregated `/branches/:branchId/dashboard` endpoint on the backend, or
- Create a small mock JSON response you can use for frontend development.

---
Generated for BranchDetail.jsx implementation.
