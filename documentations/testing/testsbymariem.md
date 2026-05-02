# Tests by Mariem

This document describes the complaint unit tests and what they cover.

## Why these tests exist
- Validate core complaint business rules without hitting the database.
- Ensure controller logic enforces role-based access rules and routing.
- Provide fast feedback on regressions in complaint workflows.

## Test scope
- Unit tests only (service and controller).
- Dependencies are mocked (Mongoose models and service methods).
- Guards, interceptors, and request validation are not executed.

## ComplaintService tests (complaint.service.spec.ts)
- create: rejects when a branch does not exist.
- create: assigns userId/branchId and sets status to OPEN.
- findAll: applies filters, branch scoping, and pagination.
- update: blocks non-owner updates.
- addAdminResponse: defaults assignedTo to adminId when missing.
- getStatistics: aggregates totals by status/target.

## ComplaintController tests (complaint.controller.spec.ts)
- create: passes authenticated userId to the service.
- findAll: blocks branch manager when branchId is missing.
- findAll: scopes branch manager queries to their branch.
- getById: prevents a client from viewing another user complaint.
- addAdminResponse: prevents manager from responding outside branch.
- getStatistics: limits branch manager statistics to their branch.

## What is not covered
- Mongoose integration, database indexes, or actual persistence.
- JWT guards, role guards, or request validation pipes.
- End-to-end flows across modules.

## How to run
- npm test -- complaint.service.spec.ts complaint.controller.spec.ts

## Next ideas
- Add e2e tests for guards and routes.
- Add service tests for delete, resolve, and feedback paths.
