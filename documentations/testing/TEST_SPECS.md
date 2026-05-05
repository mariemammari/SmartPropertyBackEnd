# Test Specs Overview

This document lists all Jest spec files in the backend and explains the role of each test suite.

## Spec Index

| Spec File | Module | Role in the App |
| --- | --- | --- |
| src/app.service.spec.ts | App | Validates `AppService.getHello()` health response. |
| src/app.controller.spec.ts | App | Confirms controller wiring for the root health endpoint. |
| src/application/application.service.spec.ts | Application | Checks application status updates and service setup. |
| src/application/application.controller.spec.ts | Application | Confirms controller module is defined and wired. |
| src/ai/ai.service.spec.ts | AI | Tests AI price estimation calls and error propagation. |
| src/ai/ai.controller.spec.ts | AI | Validates request checks and controller-to-service flow for chat/estimate/navigate. |
| src/complaint/services/complaint.service.spec.ts | Complaint | Covers complaint creation validation, filtering, permissions, and statistics. |
| src/complaint/controllers/complaint.controller.spec.ts | Complaint | Enforces role-based access, branch scoping, and controller behavior. |
| src/notifications/notifications.service.spec.ts | Notifications | Ensures notifications service can be instantiated with its model. |
| src/notification/notification.service.spec.ts | Notification | Smoke test for notification service availability. |
| src/notification/notification.controller.spec.ts | Notification | Smoke test for notification controller availability. |
| src/property/property.service.spec.ts | Property | Tests location mapping, filtering, not-found behavior, updates, and stats. |
| src/property/property.controller.spec.ts | Property | Checks role-based create behavior and ownership filtering. |
| src/property-listing/property-listing.service.spec.ts | Property Listing | Validates listing create/update flows and rental trigger on status change. |
| src/property-listing/property-listing.controller.spec.ts | Property Listing | Verifies controller delegates to listing service. |
| src/property-submission/services/property-submission.service.spec.ts | Property Submission | Tests client submission flow, auto-assignment, and approval transitions. |
| src/property-submission/services/assignment.service.spec.ts | Property Submission | Validates least-loaded agent selection, tie-breakers, and assignments. |
| src/nearby/nearby.service.spec.ts | Nearby | Checks input validation and empty results handling. |
| src/nearby/nearby.controller.spec.ts | Nearby | Ensures nearby controller forwards query params correctly. |
| src/mail/mail.service.spec.ts | Mail | Verifies mail send helpers and template entry points. |
| src/mail/mail.controller.spec.ts | Mail | Confirms controller returns success/failure responses for emails. |
| src/finance/finance.service.spec.ts | Finance | Validates invoice creation input requirements. |
| src/finance/finance.controller.spec.ts | Finance | Checks controller passes accountant id and delegates to service. |
| src/notifications/notifications.controller.spec.ts | Notifications | Verifies notifications controller delegates to service. |
| src/user/user.service.spec.ts | User | Tests user creation conflict and role validation on update. |
| src/user/user.controller.spec.ts | User | Validates profile lookup and input checks for profile updates. |
| src/branch/branch.service.spec.ts | Branch | Tests branch create and list flows. |
| src/branch/branch.controller.spec.ts | Branch | Ensures controller delegates to branch service. |
| src/chat/chat.service.spec.ts | Chat | Checks unread count aggregation from conversations/messages. |
| src/chat/chat.controller.spec.ts | Chat | Validates controller responses for chat endpoints. |
| src/rental-chat/rental-chat.service.spec.ts | Rental Chat | Ensures missing conversations error on message fetch. |
| src/rental-chat/rental-chat.controller.spec.ts | Rental Chat | Verifies controller error wrapping and conversation selection. |
| src/property-engagement/property-engagement.service.spec.ts | Property Engagement | Validates input checks for tracking events. |
| src/property-engagement/property-engagement.controller.spec.ts | Property Engagement | Ensures controller routes to summary/track service. |
| src/visits/Visits.service.spec.ts | Visits | Tests visit creation mapping and not-found behavior. |
| src/visits/Visits.controller.spec.ts | Visits | Verifies controller delegates to visits service. |

## Notes
- These are unit tests focused on service logic and controller wiring.
- Integration tests (end-to-end) can be added separately for full API workflows.
