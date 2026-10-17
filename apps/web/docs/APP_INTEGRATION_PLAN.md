# APP_INTEGRATION_PLAN.md
# Restaurant POS & KOT Management System — Web + Mobile Integration Plan

## 1. Purpose

This document defines how the existing React Web application and future React Native application will integrate with the Django REST API backed by MongoDB.

The critical design rule is:

```text
React UI
  ↓
Hooks / State
  ↓
Repository / Service
  ↓
API Client
  ↓
Django REST API
  ↓
Domain Services
  ↓
MongoDB
```

Do not rewrite the UI when moving from localhost storage to API data. Replace the repository implementation while keeping the business-facing repository contracts stable.

---

## 2. Current Web State

The React Web application was designed to use local repositories for localhost development.

Expected contracts include:
- authRepository
- userRepository
- roleRepository
- branchRepository
- categoryRepository
- productRepository
- tableRepository
- orderRepository
- kotRepository
- kitchenRepository
- billRepository
- paymentRepository
- customerRepository
- reportRepository
- auditRepository

Recommended configuration:

```text
VITE_DATA_PROVIDER=local
```

After API integration:

```text
VITE_DATA_PROVIDER=api
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

The UI should continue to call:
`orderRepository.submitOrder(id)`
regardless of where the data lives.

---

## 3. Integration Strategy

### Step 1 — Stabilize Local MVP

Confirm that the localhost implementation supports:
- login
- roles
- menu
- tables
- orders
- reception
- KOT
- kitchen
- billing
- payments
- customers
- reports
- audit

### Step 2 — Freeze Repository Contracts

Do not let individual pages depend on localStorage structure.

### Step 3 — Build Django APIs

Implement the backend in dependency order.

### Step 4 — Build API Repositories

Example:

```text
services/repositories/local/orderRepository.js
services/repositories/api/orderApiRepository.js
```

Both expose the same application methods.

### Step 5 — Add Provider Toggle

Use local mode for regression and API mode for integration/UAT.

### Step 6 — End-to-End Validation

Run identical user journeys against API mode.

### Step 7 — Production Cutover

Disable local production data path and use Django API only.

---

## 4. Web Integration Order

Recommended dependency order:

1. Authentication
2. Users
3. Roles/permissions
4. Branch context
5. Categories
6. Products
7. Tables
8. Orders
9. Reception
10. KOT
11. Kitchen
12. Billing
13. Payments
14. Customers
15. Reports
16. Audit
17. Notifications/realtime

This order minimizes broken dependencies during development.

---

## 5. Mobile Integration Order

React Native should integrate in this order:

1. Authentication/profile
2. Permissions
3. Tables
4. Categories/products
5. Order creation
6. Hold/resume
7. Submit
8. Order status
9. KOT status
10. Ready notifications
11. Customer selection where required

Billing/calculation remains backend-authoritative.

---

## 6. Central API Client

The Web and Mobile apps should have a central API client responsible for:
- base URL
- headers
- access token
- refresh token
- timeout
- common error handling
- request/correlation ID when required
- response normalization

Do not configure HTTP behavior separately inside feature components.

---

## 7. Authentication Integration

### Login

```text
POST /api/v1/auth/login
```

Request:

```json
{
  "username": "captain",
  "password": "captain123"
}
```

Response should provide:
- accessToken
- refreshToken
- user
- roles
- permissions
- branchIds

### Session restore

```text
GET /api/v1/me
```

### Refresh

```text
POST /api/v1/auth/refresh
```

### Logout

```text
POST /api/v1/auth/logout
```

Web and Mobile must use centralized auth handling.

---

## 8. 401 / 403 Handling

401:
1. Try refresh once.
2. Retry original request once.
3. If refresh fails, logout.

403:
- do not retry
- show Access Denied

5xx/network errors:
- show retryable error state
- do not fabricate success
- retain user-entered data where the UX allows it

---

## 9. Users / Roles Integration

Web calls:

```text
GET/POST   /api/v1/users
GET/PATCH  /api/v1/users/{id}
POST       /api/v1/users/{id}/activate
POST       /api/v1/users/{id}/deactivate
GET/POST   /api/v1/roles
PATCH      /api/v1/roles/{id}
```

UI repository methods remain:
- getUsers()
- createUser()
- updateUser()
- activateUser()
- deactivateUser()
- getRoles()
- updateRole()

---

## 10. Menu Integration

```text
GET    /api/v1/menu/categories
GET    /api/v1/menu/products
POST   /api/v1/menu/categories
POST   /api/v1/menu/products
PATCH  /api/v1/menu/products/{id}
POST   /api/v1/menu/products/{id}/activate
POST   /api/v1/menu/products/{id}/deactivate
POST   /api/v1/menu/products/{id}/price
GET    /api/v1/menu/products/{id}/price-history
```

For captain/mobile screens, filter to active + available products.

The client may show a price preview, but the backend is authoritative when an order item is created.

---

## 11. Table Integration

```text
GET /api/v1/areas
GET /api/v1/tables
GET /api/v1/tables/{id}
```

Future command endpoints:
- transfer
- merge
- split

Do not build client-side rules that assume those operations are already available.

---

## 12. Order Create Integration

```text
POST /api/v1/orders
```

Request concept:

```json
{
  "branchId": "branch-main",
  "tableId": "table-05",
  "customerId": null,
  "items": [
    {
      "productId": "prod-chicken-tikka",
      "quantity": 2,
      "note": "Less spicy"
    }
  ]
}
```

The server resolves trusted price/tax data and returns the canonical order.

Client should replace temporary local state with the returned server order.

---

## 13. Hold / Resume

```text
POST /api/v1/orders/{id}/hold
POST /api/v1/orders/{id}/resume
```

Held order is not automatically sent to the kitchen.

---

## 14. Submit Order

```text
POST /api/v1/orders/{id}/submit
```

The backend validates:
- user permission
- current state
- items
- branch/table context

The response returns the updated canonical order.

---

## 15. Reception Integration

Queue:

```text
GET /api/v1/orders?status=WAITING_CONFIRMATION
```

Confirm:

```text
POST /api/v1/orders/{id}/confirm
```

Reject:

```text
POST /api/v1/orders/{id}/reject
```

Reject request:

```json
{
  "reason": "Customer requested changes"
}
```

Confirmation should return the created KOT or enough data to fetch it.

---

## 16. KOT Integration

```text
GET  /api/v1/kots
GET  /api/v1/kots/{id}
GET  /api/v1/kots/{id}/print
POST /api/v1/kots/{id}/status
```

KOT status request:

```json
{
  "status": "PREPARING"
}
```

The server validates the state transition.

---

## 17. Order Modification / KOT Delta

For an already-sent KOT, clients must send an intent/command, for example:

```json
{
  "action": "ADD",
  "productId": "prod-chicken-tikka",
  "quantity": 1,
  "note": ""
}
```

The backend:
1. loads canonical order
2. validates permissions/state
3. updates canonical order
4. computes delta
5. creates modification KOT
6. creates audit event
7. returns updated canonical order + KOT information

Client must not fake its own KOT revision number.

---

## 18. Kitchen Integration

Queue:

```text
GET /api/v1/kitchen/queue?status=NEW
```

Actions:

```text
POST /api/v1/kots/{id}/status
```

The Kitchen UI displays:
- KOT number
- table
- captain
- items
- notes
- received time
- elapsed time
- status

Use polling first. Add WebSocket/SSE later.

---

## 19. Bill Generation

```text
POST /api/v1/orders/{id}/bill
```

Return:
- billNumber
- orderNumber
- table
- item snapshot
- subtotal
- discount
- tax
- rounding
- grandTotal
- paidAmount
- balanceAmount
- paymentStatus

The UI should display backend values as authoritative.

---

## 20. Discount Integration

```text
POST /api/v1/bills/{id}/discount
```

Request:

```json
{
  "type": "PERCENTAGE",
  "value": 10,
  "reason": "Manager approved"
}
```

Response should return the updated calculated bill.

---

## 21. Payment Integration

```text
POST /api/v1/bills/{id}/payments
GET  /api/v1/bills/{id}/payments
```

Example:

```json
{
  "mode": "UPI",
  "amount": 1000,
  "referenceNumber": "UPI123",
  "idempotencyKey": "payment-command-001"
}
```

Mixed payment example:
- UPI ₹1000
- Cash ₹500

The UI refreshes the server-calculated paid/balance state after each payment.

---

## 22. Bill Close Integration

```text
POST /api/v1/bills/{id}/close
```

On success:
- bill completed
- order completed
- table available

The Web dashboard, table screen and Mobile table screen should refresh canonical state after success.

---

## 23. Customer Integration

```text
GET  /api/v1/customers?search=9999999999
POST /api/v1/customers
GET  /api/v1/customers/{id}
PATCH /api/v1/customers/{id}
GET  /api/v1/customers/{id}/orders
```

Mobile may only need lookup/select during MVP.

---

## 24. Reports Integration

```text
GET /api/v1/reports/sales
GET /api/v1/reports/items
GET /api/v1/reports/captains
GET /api/v1/reports/payments
GET /api/v1/reports/discounts
GET /api/v1/reports/cancellations
```

Date filters are mandatory for most large reports.

The browser should not download all raw transactions merely to calculate reports.

---

## 25. Audit Integration

```text
GET /api/v1/audit
```

Filters:
- action
- user
- entityType
- entityId
- branchId
- dateFrom
- dateTo

Audit UI is read-only.

---

## 26. Realtime Strategy

### MVP
Use polling for:
- reception queue
- kitchen queue
- notifications

### Later
Use WebSocket/SSE.

Event names:
- ORDER_SUBMITTED
- ORDER_CONFIRMED
- KOT_CREATED
- KOT_MODIFIED
- KOT_READY
- BILL_PENDING
- PAYMENT_RECEIVED
- ORDER_COMPLETED

Create a `realtimeService` abstraction so the transport can change without rewriting screens.

---

## 27. Web Local/API Provider

Recommended pattern:

```text
repositoryFactory
  ├── local repositories
  └── API repositories
```

Configuration:

```text
VITE_DATA_PROVIDER=local
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

For API mode:

```text
VITE_DATA_PROVIDER=api
```

The feature UI must not branch on `local` vs `api`.

---

## 28. Mobile API Provider

React Native should use the same repository concepts.

Environment example:

```text
API_BASE_URL=http://10.0.2.2:8000/api/v1
```

For physical devices, use the development machine's LAN IP or configured environment URL.

Production uses HTTPS.

Store tokens using a secure device storage mechanism suitable for the platform.

---

## 29. Data Synchronization Rules

When a command returns a canonical server resource:
1. replace stale client state with server state
2. update affected caches/stores
3. refresh related screens where needed
4. create local notification state if appropriate

Do not merge financial values from local and server versions blindly.

---

## 30. Offline Migration Path

Full offline mode is deferred.

When implemented later:
- use a local mobile/web database rather than only localStorage
- assign client command IDs
- queue unsynced commands
- send idempotency keys
- store server acknowledgements
- reconcile conflicts using explicit business rules

Do not treat a browser-disconnected screen as a true offline transaction engine unless this synchronization layer exists.

---

## 31. Local Data Migration

LocalStorage prototype data should not be copied into production MongoDB blindly.

If migration is required:

```text
localStorage
→ JSON export
→ validation/mapping
→ Django import command
→ MongoDB
```

Validate IDs, branch scope, historical prices, order/KOT/bill references and demo users before import.

---

## 32. Integration Environment Matrix

| Environment | Web | Backend | DB |
|---|---|---|---|
| Local | localhost:5173 | localhost:8000 | local MongoDB |
| Development | hosted/dev web | hosted/dev API | dev MongoDB |
| Staging/UAT | staging web | staging API | staging MongoDB |
| Production | production web | production API | secured managed MongoDB |

Printer testing must be performed in staging/UAT with the actual intended print path.

---

## 33. CORS

Development:
- allow configured localhost Web origin.

Production:
- allow only production frontend origins.

Do not use wildcard CORS in production.

---

## 34. Contract Verification Checklist

For every endpoint verify:
- path
- method
- authentication
- permission
- request schema
- response schema
- error codes
- pagination/filter behavior
- idempotency behavior
- branch isolation

OpenAPI should be the shared contract.

---

## 35. 8-Week Backend/Web/Mobile Coordination

### Weeks 1-2
Backend:
- Django setup
- Mongo connectivity
- auth
- users/roles/permissions
- menu
- tables

Web:
- local version remains stable
- repository contracts frozen
- API client/repository skeleton prepared

Mobile:
- project setup
- auth/API client skeleton

### Weeks 3-4
Backend:
- orders
- confirmation/rejection
- KOT
- kitchen

Web:
- integrate Orders/Reception/KOT

Mobile:
- integrate Table/Menu/Order/Submit

End-to-end test:
Captain → API → Reception → KOT → Kitchen

### Weeks 5-6
Backend:
- billing
- taxes
- discounts
- payments
- customers
- reports

Web:
- billing/payment/customer/report integration

Mobile:
- order/KOT status + ready notifications

### Weeks 7-8
All:
- regression
- permissions
- idempotency
- performance
- printer
- monitoring
- backup/restore validation
- staging/UAT
- production cutover checklist

---

## 36. Critical End-to-End Test

Execute against staging API:

1. Captain login.
2. Fetch tables.
3. Fetch menu.
4. Create Table 05 order.
5. Add Chicken Tikka ×2.
6. Add Mutton Raan ×1.
7. Submit.
8. Reception fetches waiting order.
9. Reception confirms.
10. Verify exactly one KOT is created.
11. Kitchen fetches KOT.
12. Kitchen marks PREPARING.
13. Kitchen marks READY.
14. Generate bill.
15. Apply discount in an authorized test.
16. Add UPI payment.
17. Add cash payment for mixed payment.
18. Close bill.
19. Verify bill COMPLETED.
20. Verify order COMPLETED.
21. Verify table AVAILABLE.
22. Verify audit records.
23. Verify report totals.
24. Repeat the confirm/payment/close requests to prove idempotency.

---

## 37. Integration Matrix

| Feature | Web | Mobile | Backend |
|---|---|---|---|
| Login | Yes | Yes | Mandatory |
| Roles/permissions | Yes | Yes | Mandatory server-side |
| Menu | Full CRUD | Read | Full |
| Tables | Full | Read/operate | Full |
| Orders | Yes | Yes | Authoritative |
| Reception | Yes | Optional | Yes |
| KOT | Yes | Status/read | Yes |
| Kitchen | Yes | Optional | Yes |
| Billing | Yes | Limited/read | Yes |
| Payments | Yes | Future/limited | Yes |
| Customers | Yes | Lookup | Yes |
| Reports | Yes | Future | Yes |
| Audit | Yes | Future/read-only | Yes |

---

## 38. Production Cutover

Before production:
- API contract frozen for release
- Web API mode enabled
- Mobile API mode enabled
- master data configured
- authentication verified
- branch permissions verified
- complete order tested
- KOT printer tested
- mixed payment tested
- backup/restore verified
- monitoring verified
- production secrets configured securely
- rollback procedure documented

Only after these checks should production data be switched from local to API-backed operation.

---

## 39. Future Integrations

Planned after MVP:
- inventory/recipe APIs
- purchase/supplier
- reservations
- multi-branch consolidated dashboards
- offline sync
- online orders
- delivery
- WhatsApp/SMS
- loyalty
- advanced accounting integrations

Future features must extend existing contracts instead of duplicating order/billing logic.

---

## 40. Final Integration Principle

There must be one business truth:

```text
Django Backend
      ↓
    MongoDB
   ↙       ↘
Web       Mobile
```

Do not maintain separate business implementations for:
- order state
- KOT rules
- pricing
- discounts
- tax calculation
- payment balance
- completion rules

Clients handle interaction and presentation. The backend owns authoritative business behavior.
