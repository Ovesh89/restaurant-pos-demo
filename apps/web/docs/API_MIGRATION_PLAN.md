# API_MIGRATION_PLAN.md
# Restaurant POS & KOT Management System — Web API Integration Plan
**Migration from Local Storage Repositories to Authoritative Django REST API & MongoDB**

---

## 1. Current Local Architecture

The React Web application currently operates entirely in localhost mode using browser `localStorage` mediated by local repositories:

```text
React View Components (Pages & Components)
               ↓
React Hooks & Context (AuthContext, usePermission, useAuth)
               ↓
Local Repositories (services/repositories/*.js)
               ↓
Local Storage Adapter (services/storage/localStorageAdapter.js)
               ↓
Browser localStorage (namespaced keys: restaurant_pos_*)
```

### Characteristics of Current Local Implementation:
1. **Synchronous/Instant Persistence:** Mutations update JavaScript arrays in memory and write JSON strings to `localStorage`.
2. **Implicit Identity & Permissions:** `AuthContext` reads `restaurant_pos_session` directly. Role names are strings (`'owner'`, `'admin'`, `'captain'`).
3. **Local Point-in-Time Math:** `billingCalculator.js` runs client-side inside `orderRepository.js` and `billRepository.js`.
4. **Client-Side Unique Counters:** Simple sequence counters like `ORD-${count}` and `INV-${count}` generated client-side.
5. **No Network Latency or Offline Boundary:** All calls resolve immediately without HTTP status codes, network retry logic, or CORS headers.

---

## 2. Target API Architecture

The target architecture establishes a strict unidirectional data flow where business rules, state machines, sequence numbering, and financial calculations are enforced authoritatively by the Django REST API backend backed by MongoDB. The UI components remain completely agnostic of whether data is fetched locally or over HTTP.

```text
React Page / View Component
            ↓
React Hooks / Context / Local State
            ↓
Repository Interface (Unified Contract)
            ↓
    ┌───────────────────────┴───────────────────────┐
    ▼                                               ▼
Local Repository (Prototype)             API Repository (services/repositories/api/)
    ↓                                               ↓
localStorage Adapter                             Central API Client (services/api/apiClient.js)
    ↓                                               ↓ (HTTP + Bearer JWT + Idempotency)
Browser Storage                                 Django REST API (apps/*/views.py)
                                                    ↓
                                                Domain Services (apps/*/services.py)
                                                    ↓
                                                PyMongo Repositories
                                                    ↓
                                                MongoDB Collections
```

### Invariant Rules:
1. **Zero UI Rewrite:** No React page (`OrdersPage`, `ReceptionPage`, `BillingPage`, etc.) or reusable component will directly invoke `fetch()`, `axios`, or inspect HTTP status codes.
2. **Repository Contract Preservation:** Methods like `orderRepository.getOrders()`, `orderRepository.confirmOrder()`, and `billRepository.addPayment()` keep their existing signatures.
3. **Backend Authority:** Order status transitions, price freezes, and financial rounding cannot be overridden by client manipulations.

---

## 3. Central API Client Design

A unified API client (`src/services/api/apiClient.js`) handles all HTTP communication with the Django backend.

### Core Capabilities:
- **Base URL Configuration:** Read from environment variable `VITE_API_BASE_URL` (defaulting to `/api/v1` in dev to leverage Vite proxy).
- **Request Interceptor / Header Injection:**
  - Automatic `Authorization: Bearer <accessToken>` header attachment when token is present.
  - Automatic `X-Correlation-ID: <uuid4>` generation for distributed request tracing.
  - Automatic `Content-Type: application/json`.
- **Response Normalization:** Unwraps the backend standard envelope `{ success: true, data: ..., message: "..." }` and returns `data` directly to repository callers.
- **Unified Error Normalization:** Converts backend error envelope `{ success: false, error: { code, message, details } }` into standard JavaScript `AppError` instances with `.code`, `.message`, and `.details`.
- **Concurrency & Mutex Queue:** Prevents race conditions during token refresh.

---

## 4. Authentication Migration

### Authentication Flow Transition:

| Local Mode Flow | Target API Mode Flow |
|:---|:---|
| Matches plain credentials against `restaurant_pos_users` in localStorage | `POST /api/v1/auth/login` validates credentials against Django PBKDF2 hash |
| Generates fake token `pos_token_<timestamp>` | Returns cryptographically signed JWT `access` (60m) and `refresh` (7d) |
| Hardcodes role permissions from local array | Server resolves permissions dynamically from assigned active `roles` |
| Stores entire session object in localStorage | Securely stores JWT access & refresh tokens; restores profile via `GET /api/v1/me` |

### Profile & Permissions Normalization:
The API auth repository maps backend user entities to match existing frontend expectations:
```javascript
normalizedUser = {
  id: backendUser.id,
  username: backendUser.username,
  name: backendUser.displayName, // Maps displayName -> name
  mobile: backendUser.mobile,
  role: backendRoles[0]?.code.toLowerCase() || 'staff', // Maps role object -> role string
  roleIds: backendUser.roleIds,
  branchId: backendUser.branchIds?.[0] || 'branch-main',
  isActive: backendUser.isActive
};
```

---

## 5. Token Lifecycle & Session Management

```text
[App Initializing]
        │
        ▼
Is Refresh Token present? ──No──► [Redirect to /login]
        │
       Yes
        │
        ▼
Execute GET /api/v1/me with stored Access Token
        │
        ├── Success ──► Hydrate AuthContext (user, permissions)
        │
        └── 401 Unauthorized ──► Execute POST /api/v1/auth/refresh
                                      │
                                      ├── Success ──► Update tokens & retry /me
                                      └── Failure ──► Clear storage, redirect /login
```

### Storage of Tokens:
- `restaurant_pos_access_token`: Stored in memory or `sessionStorage`/`localStorage` for web persistence.
- `restaurant_pos_refresh_token`: Stored in `localStorage` for cross-reload session continuity.

---

## 6. Repository Migration Strategy

To support zero-risk cutover, we utilize the **Factory / Delegation Pattern**:

```text
src/services/repositories/
├── local/                     (Current localStorage implementations preserved)
│   ├── authRepository.js
│   ├── orderRepository.js
│   └── ...
├── api/                       (New Django REST implementations)
│   ├── authApiRepository.js
│   ├── orderApiRepository.js
│   └── ...
└── index.js                   (Factory exporting either Local or API implementations)
```

The feature pages continue importing from the existing path:
```javascript
import { orderRepository } from '../services/repositories/orderRepository';
```
`orderRepository.js` acts as a facade delegating to `orderApiRepository` or `localOrderRepository` based on the configured data provider.

---

## 7. Environment Configuration

Create `.env` and `.env.example` in the root of `restaurant-pos-web`:

```bash
# Data Provider Toggle: 'local' (localStorage) or 'api' (Django REST API)
VITE_DATA_PROVIDER=api

# Backend REST API Base URL
VITE_API_BASE_URL=http://localhost:8000/api/v1

# Default Branch Scope
VITE_DEFAULT_BRANCH_ID=branch-main

# Request Timeout (milliseconds)
VITE_API_TIMEOUT=15000
```

---

## 8. API / Local Provider Switch

In `src/config/appConfig.js`:

```javascript
export const APP_CONFIG = {
  DATA_PROVIDER: import.meta.env.VITE_DATA_PROVIDER || 'local',
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1',
  DEFAULT_BRANCH_ID: import.meta.env.VITE_DEFAULT_BRANCH_ID || 'branch-main',
  // ...
};
```

This allows instant runtime and build-time toggling between standalone demo mode and full backend API mode.

---

## 9. Error Handling Architecture

Backend error responses follow this exact schema:
```json
{
  "success": false,
  "error": {
    "code": "ORDER_INVALID_STATE",
    "message": "Order cannot be confirmed in its current state.",
    "details": {}
  }
}
```

The API client intercepts this and raises:
```javascript
export class AppError extends Error {
  constructor(message, code = 'UNKNOWN_ERROR', status = 400, details = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}
```
Pages and UI toast handlers check `err.message` or `err.code` without needing to parse network payloads.

---

## 10. 401 / 403 Handling

1. **HTTP 401 Unauthorized:**
   - If an API call fails with 401 and is not a `/auth/login` or `/auth/refresh` request, the API client initiates an automatic token refresh using the stored refresh token.
   - If token refresh succeeds, the original pending request is replayed with the new token.
   - If token refresh fails or refresh token is expired, the client clears stored session credentials and broadcasts an `AUTH_EXPIRED` event to redirect to `/login`.
2. **HTTP 403 Forbidden:**
   - The user lacks permission or lacks access to the requested `branchId`.
   - The API client immediately rejects without retry.
   - UI displays an actionable toast or redirects to `/unauthorized`.

---

## 11. API Response Normalization

The repository adapter normalizes differences between backend data structures and frontend component expectations:

| Domain | Backend Format | Frontend Expected Format | Normalization Action |
|:---|:---|:---|:---|
| **Orders** | `orderNumber: "ORD-2026-000001"` | `orderNo: "ORD-001"` | Populate both `orderNo` and `orderNumber` |
| **Tables** | `tableNumber: "05"` | `tableNo: "05"` | Populate both `tableNo` and `tableNumber` |
| **KOT** | `kotNumber: "KOT-2026-000001"` | `kotNo: "KOT-001"` | Populate both `kotNo` and `kotNumber` |
| **Bills** | `billNumber: "BILL-2026-000001"` | `billNo: "INV-001"` | Populate both `billNo` and `billNumber` |
| **Product Prices**| String `"350.00"` | Number `350` | `price: Number(item.price)` |
| **Product Availability**| `available: true` | `isAvailable: true` | Populate both `available` and `isAvailable` |
| **Staff Profile** | `displayName: "Ahmed"` | `name: "Ahmed"` | Populate both `name` and `displayName` |

---

## 12. Pagination Handling

Backend endpoints (`/api/v1/orders`, `/api/v1/bills`, `/api/v1/users`, `/api/v1/audit`, `/api/v1/customers`) return:
```json
{
  "items": [...],
  "total": 54,
  "page": 1,
  "limit": 20,
  "pages": 3
}
```
For repository methods called with no pagination arguments (e.g. `orderRepository.getOrders()`), the adapter extracts and returns the `.items` array directly to preserve compatibility with existing page components.

---

## 13. Search & Filter Integration

Client filters map directly to Django query parameters:
- `search` $\to$ text search (name, code, order/bill number, phone)
- `status` $\to$ status code filtering
- `branchId` $\to$ scoped to current branch (`branch-main`)
- `tableId` $\to$ filtered dining table
- `dateFrom` / `dateTo` $\to$ ISO date bounds for reporting and audit

---

## 14. Loading & Error States

Existing pages already include local `loading` state hooks (`useState(true)`). The API repository methods return real asynchronous promises that naturally tie into the existing UI loading spinners and empty states without component rewrites.

---

## 15. Retry Handling & Network Resilience

For idempotent read operations (`GET` requests):
- Transparently retry up to 2 times on transient network failures (e.g., connection reset or HTTP 503) with exponential backoff (300ms, 900ms).
- Never automatically retry mutating operations (`POST`, `PUT`, `DELETE`) without an idempotency key to prevent accidental duplicate actions.

---

## 16. Idempotency & Duplicate Mutation Prevention

The backend features `IdempotencyMiddleware`. For sensitive restaurant operations:
- **Order Creation:** Generate client command UUID passed via `Idempotency-Key` header.
- **Order Confirmation:** Idempotent by design in backend (`order_service.confirm_order` returns existing active KOT if already confirmed).
- **Payment Collection:** Pass `idempotencyKey` in body and header to prevent double-charging cash/UPI.
- **Bill Closure:** Backend verifies `balance == 0` and idempotently succeeds if already closed.

---

## 17. Realtime & Polling Approach

### MVP Strategy:
Use configurable polling in `orderRepository` and `kitchenRepository` for hot operational screens:
- **Reception Queue:** Poll `GET /api/v1/orders?status=WAITING_CONFIRMATION` every 10 seconds.
- **Kitchen Queue:** Poll `GET /api/v1/kitchen/queue` every 10 seconds.
- **Notifications:** Poll `GET /api/v1/notifications?unreadOnly=true` every 30 seconds.

### Post-MVP Upgrade:
Replace polling hooks with WebSocket / SSE connection without touching view components.

---

## 18. Testing Strategy

1. **API Client Unit Tests:**
   - Token insertion in headers
   - Response envelope unwrapping
   - Error code extraction
   - Transparent 401 token refresh queue
2. **Adapter Normalization Tests:**
   - Field mappings (`orderNumber` $\leftrightarrow$ `orderNo`, `tableNumber` $\leftrightarrow$ `tableNo`)
   - Numeric type coercions (prices, tax rates)
3. **End-to-End Operational Workflow Verification:**
   - Captain Login $\to$ Table List $\to$ Create Order $\to$ Submit Order
   - Reception Review $\to$ Confirm Order (Verify KOT Rev 1)
   - Kitchen Queue $\to$ Mark Preparing $\to$ Mark Ready
   - Cashier Bill Generation $\to$ Apply Discount $\to$ Add UPI Payment $\to$ Close Bill $\to$ Table Released to AVAILABLE.

---

## 19. Rollback Strategy to Local Mode

Because the factory pattern retains all local repositories intact in `src/services/repositories/local/`:
- Setting `VITE_DATA_PROVIDER=local` immediately switches all data access back to `localStorage`.
- No code rollback or branch reverting is necessary if an environment issue arises with the backend server or MongoDB during testing.

---

## 20. Phased Implementation Plan

### Phase 1: Infrastructure & Master Data — [COMPLETED]
- Set up Vite proxy in `vite.config.js` to avoid CORS issues.
- Implemented central `apiClient.js` with JWT token management and error handling.
- Built API repositories for `auth`, `user`, `role`, `branch`, `area`, `table`, `category`, and `product`.
- Verified Login, Dashboard, Menu Management, Table Views, Staff Management.

### Phase 2: Operations Workflow (Orders, Reception, KOT, Kitchen) — [COMPLETED]
- Built `orderApiRepository.js`, `kotApiRepository.js`, and `notificationApiRepository.js`.
- Connected Order Creation, Hold, Resume, and Submission flows.
- Connected Reception Queue, Confirmation, and Rejection flows.
- Connected Kitchen Live Queue and KOT Status progression (`PREPARING` → `READY` → `SERVED`).
- Connected In-App Notifications and Delta KOT modifications.

### Phase 3: Financials, Billing, Payments, Customers & Reports — [COMPLETED]
- Built `billApiRepository.js`, `customerApiRepository.js`, and `reportApiRepository.js`.
- Connected Authoritative Bill Generation and ESC/POS thermal print payloads.
- Connected Authorized Discounts with mandatory reason codes.
- Connected Multi-tender split payments (Cash, UPI, Card) and Zero-balance Bill Closure.
- Connected Customer CRM search and profile creation.
- Connected Native Aggregation Reports (Daily Sales, Items Sold, Captains, Payments).

### Phase 4: Hardening, Shift/Settings Adaptation & Verification — [COMPLETED]
- Adapted `shiftRepository` (workstation cash drawer + live bill reconciliation + backend audit events).
- Connected `settingsRepository` to `/api/v1/branches/{id}` for authoritative restaurant tax/invoice/contact details.
- Verified 100% of all 16 domain facades route to their API implementation under `VITE_DATA_PROVIDER=api`.
- Preserved complete rollback compatibility with `src/services/repositories/local/`.

