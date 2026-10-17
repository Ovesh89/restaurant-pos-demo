# Source Project Inventory — Restaurant POS & KOT Management System

> **Phase 0 Audit Date:** 2026-10-11  
> **Migration Repository:** `C:\GTS-POS\restaurant-pos-backend-mern`  
> **Read-Only Source Backend:** `C:\GTS-POS\restaurant-pos-backend`  
> **Read-Only Source Web App:** `C:\GTS-POS\restaurant-pos-web`  
> **Read-Only Mobile App:** `C:\GTS-POS\restaurant-pos-mobile`

---

## 1. Executive Summary & Audit Scope

This inventory records the verified state of the new migration workspace and the three read-only source projects prior to any code migration. All inspections were performed strictly in read-only mode without modifying, formatting, installing dependencies, or executing Git mutations in any source project.

### 1.1 New Migration Repository Status (`C:\GTS-POS\restaurant-pos-backend-mern`)
- **Git Status:** Currently **not initialized as a Git repository** (`fatal: not a git repository (or any of the parent directories): .git`).
- **Existing Files Present Before Phase 0:**
  - `AGENTS.md` (292 lines — migration rules, safety constraints, architecture, and phase definitions)
  - `docs/restaurant-pos-development-specification-mern.md` (983 lines — full functional & technical specification for the MERN POS & KOT system)
  - `docs/restaurant-pos-development-specification-mern.docx` (binary Word counterpart of the specification)
- **Existing Application Code:** None yet (`apps/` and `scripts/` do not exist yet, as required for Phase 0).

---

## 2. Record of Actually Inspected Files & Directories

### 2.1 New Repository (`C:\GTS-POS\restaurant-pos-backend-mern`)
- `AGENTS.md`
- `docs/restaurant-pos-development-specification-mern.md`

### 2.2 Source Django Backend (`C:\GTS-POS\restaurant-pos-backend`)
- **Root & Configuration:**
  - `.env.example`, `README.md`, `requirements/base.txt`, `requirements/development.txt`, `requirements/production.txt`
  - `config/settings.py`, `config/urls.py`, `api/db.py`, `api/views.py`
- **Documentation:**
  - `docs/DATABASE_SCHEMA.md`, `docs/IMPLEMENTATION_DECISIONS.md`, `docs/APP_INTEGRATION_PLAN.md`
- **Common Infrastructure (`apps/common/`):**
  - `database.py`, `exceptions.py`, `middleware.py`, `pagination.py`, `repositories.py`, `responses.py`, `sequence.py`
- **Domain Apps (`apps/`):**
  - `apps/identity/`: `authentication.py`, `permissions.py`, `permissions_registry.py`, `repositories.py`, `serializers.py`, `services.py`, `tokens.py`, `urls.py`, `views.py`
  - `apps/restaurant/`: `urls.py`, `views.py`, `services.py`, `serializers.py`, `repositories.py`
  - `apps/menu/`: `urls.py`, `views.py`, `services.py`, `serializers.py`, `repositories.py`
  - `apps/orders/`: `urls.py`, `views.py`, `services.py`, `serializers.py`, `repositories.py`
  - `apps/kot/`: `urls.py`, `views.py`, `services.py`, `serializers.py`, `repositories.py`
  - `apps/kitchen/`: `urls.py`, `views.py`, `services.py`, `serializers.py`
  - `apps/billing/`: `urls.py`, `views.py`, `services.py`, `serializers.py`, `repositories.py`, `calculator.py`
  - `apps/payments/`: `urls.py`, `views.py`, `services.py`, `serializers.py`, `repositories.py`
  - `apps/customers/`: `urls.py`, `views.py`, `services.py`, `serializers.py`, `repositories.py`, `utils.py`
  - `apps/reports/`: `urls.py`, `views.py`, `services.py`, `serializers.py`
  - `apps/audit/`: `urls.py`, `views.py`, `services.py`, `serializers.py`, `repositories.py`
  - `apps/notifications/`: `urls.py`, `views.py`, `services.py`, `serializers.py`, `repositories.py`
- **Scripts, Tests & Backups:**
  - `scripts/init_indexes.py`, `scripts/seed_demo_data.py`, `scripts/backup_mongodb.py`, `scripts/restore_mongodb.py`
  - `tests/base.py` and test suite inventory (`tests/test_*.py`)
  - `backups/backup_20260930_215039/manifest.json`

### 2.3 Source React Web App (`C:\GTS-POS\restaurant-pos-web`)
- **Root & Build Config:**
  - `package.json`, `.env.example`, `vite.config.js`, `tailwind.config.js`, `postcss.config.js`, `index.html`
- **Documentation:**
  - `docs/API_INTEGRATION_MATRIX.md`, `docs/API_INTEGRATION_DEBUGGING.md`, `docs/BILLING_PRINT_DEBUGGING.md`, `docs/BILLING_SETTLEMENT_DEBUGGING.md`
- **Core & Routing (`src/`):**
  - `src/config/appConfig.js`
  - `src/routes/AppRoutes.jsx`, `src/stores/AuthContext.jsx`
  - `src/services/api/apiClient.js`, `src/services/api/tokenStorage.js`
  - `src/services/calculations/billingCalculator.js`, `src/services/printing/printService.js`
- **Repository Facades & API Repositories (`src/services/repositories/`):**
  - `orderRepository.js`, `billRepository.js`
  - `api/authApiRepository.js`, `api/userApiRepository.js`, `api/roleApiRepository.js`, `api/branchApiRepository.js`, `api/tableApiRepository.js`, `api/categoryApiRepository.js`, `api/productApiRepository.js`, `api/orderApiRepository.js`, `api/kotApiRepository.js`, `api/billApiRepository.js`, `api/customerApiRepository.js`, `api/reportApiRepository.js`, `api/auditApiRepository.js`, `api/notificationApiRepository.js`, `api/settingsApiRepository.js`, `api/shiftApiRepository.js`

### 2.4 Source React Native Mobile App (`C:\GTS-POS\restaurant-pos-mobile`)
- **Root & Documentation:**
  - `package.json`
  - `docs/API_INTEGRATION_MATRIX.md`, `docs/IMPLEMENTATION_DECISIONS.md`
- **Core Infrastructure (`src/core/`):**
  - `src/core/config/apiConfig.ts`
  - `src/core/api/client.ts`
  - `src/core/realtime/realtimeService.ts`
- **Feature Repositories & Adapters (`src/features/`):**
  - `src/features/auth/repositories/ApiAuthRepository.ts`
  - `src/features/service/repositories/ServiceRepository.ts`
  - `src/features/service/repositories/djangoOrderState.ts`
  - `src/features/menu/repositories/MenuRepository.ts`
  - `src/features/order/repositories/OrderRepository.ts`
  - `src/features/kot/repositories/KotRepository.ts`

---

## 3. Source Django Backend Inventory (`C:\GTS-POS\restaurant-pos-backend`)

### 3.1 Runtime & Technology Stack
- **Language & Framework:** Python 3.12, Django `6.1.1`, Django REST Framework (`djangorestframework==3.18.1`), `django-cors-headers==4.11.0`, `drf-spectacular==0.30.0`, `PyJWT==2.15.1`.
- **Database Driver:** Direct `pymongo==4.18.2` (`api/db.py` & `apps/common/database.py`). **Note:** Django ORM is *not* used for domain persistence (`DATABASES = {}` in `config/settings.py`); all 19 collections are accessed directly via custom PyMongo repository classes inheriting from `BaseMongoRepository` (`apps/common/repositories.py`).
- **Configured Port & Database:**
  - Default HTTP server port: `8000` (`http://127.0.0.1:8000`)
  - MongoDB URI: `mongodb://127.0.0.1:27017`
  - Default database: `restaurant_pos_dev` (test database: `restaurant_pos_test`)

### 3.2 Cross-Cutting Backend Architecture
1. **Standard Response Envelope (`apps/common/responses.py`):**
   - Success (`/api/v1/*`): `{"success": true, "data": <payload>, "message": "<optional string>"}`
   - Error (`/api/v1/*`): `{"success": false, "error": {"code": "<ERROR_CODE>", "message": "<human message>", "details": {...}}}`
   - Unwrapped Health/Root (`/`, `/health`, `/ready`, `/api/health`, `/api/ready`): Returns raw JSON with service and MongoDB ping status.
2. **Pagination Contract (`apps/common/pagination.py`):**
   - Query params: `page` (default `1`, min `1`), `limit` (default `50`, min `1`, max `200`).
   - Envelope inside `data`:
     ```json
     {
       "items": [...],
       "pagination": {
         "total": 21,
         "page": 1,
         "limit": 50,
         "totalPages": 1,
         "hasNext": false,
         "hasPrev": false
       }
     }
     ```
3. **Authentication & JWT (`apps/identity/tokens.py`, `authentication.py`):**
   - Algorithm: `HS256` signed with `settings.SECRET_KEY`.
   - Access Token (`JWT_ACCESS_EXPIRATION_MINUTES=60`):
     `{"sub": "<user_id>", "username": "<username>", "type": "access", "iat": <epoch>, "exp": <epoch>}`
   - Refresh Token (`JWT_REFRESH_EXPIRATION_DAYS=7`):
     `{"sub": "<user_id>", "type": "refresh", "iat": <epoch>, "exp": <epoch>}`
   - Password Hashing (`config/settings.py`):
     `PASSWORD_HASHERS` lists `MD5PasswordHasher` first, followed by `PBKDF2PasswordHasher`. Existing seeded/created users in MongoDB have `passwordHash` values formatted as `md5$<salt>$<hex>` or `pbkdf2_sha256$<iterations>$<salt>$<base64>`.
4. **RBAC & Branch Isolation (`apps/identity/permissions.py`, `permissions_registry.py`):**
   - 7 system roles: `OWNER`, `ADMIN`, `MANAGER`, `RECEPTION`, `CASHIER`, `CAPTAIN`, `KITCHEN`.
   - 29 granular permission codes across `branch`, `area`, `table`, `menu`, `order`, `kot`, `kitchen`, `billing`, `payment`, `discount`, `customer`, `report`, `user`, `role`, `audit`.
   - `OWNER` and `ADMIN` bypass branch array restrictions; other roles are restricted to `user.branchIds`.
5. **Middlewares (`apps/common/middleware.py`):**
   - `CorrelationIdMiddleware`: Propagates `X-Correlation-ID` / `X-Request-ID` on every request and response.
   - `IdempotencyMiddleware`: Intercepts mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`) carrying `Idempotency-Key` or `X-Idempotency-Key`, storing state (`PROCESSING` / `COMPLETED`) and cached HTTP responses in the `idempotency_keys` collection, returning `409 CONCURRENT_REQUEST` on in-flight duplicates and replaying completed responses with `X-Idempotent-Replay: true`.
6. **Sequence Generator (`apps/common/sequence.py`):**
   - Uses atomic `find_one_and_update(..., {"$inc": {"seq": 1}}, upsert=True)` on `counters` collection with `_id = "{counter_name}_{branch_code}_{year}"` to generate `ORD-YYYY-NNNNNN`, `KOT-YYYY-NNNNNN`, and `BILL-YYYY-NNNNNN`.

### 3.3 Domain Module Status in Django Backend
| Module | Django App | Implementation Status | Key Capabilities |
|---|---|---|---|
| Health & Docs | `api` | Complete | `/`, `/health`, `/ready`, `/api/health`, `/api/ready`, `/api/schema/`, `/api/docs/`, `/api/redoc/` |
| Identity & RBAC | `apps.identity` | Complete | Login, refresh, logout, `/me`, users CRUD + activate/deactivate, roles list/detail/create/patch |
| Restaurant Master | `apps.restaurant` | Complete (minor gap) | Branches list/create (missing `GET/PATCH /branches/{id}`), Areas list/create/patch, Tables list/create/detail/patch (`tbl-XX` <-> `table-XX` alias support) |
| Menu & Pricing | `apps.menu` | Complete | Categories list/create/detail/patch, Products paginated list/create/detail/patch, activate/deactivate, price change + immutable `price_history` |
| Orders | `apps.orders` | Complete | Paginated list, create (`DRAFT`/`HOLD`/`WAITING_CONFIRMATION`), detail, append items (with automatic `MODIFICATION` KOT when already confirmed), hold, resume, submit, confirm (creates initial `NEW` KOT), reject, cancel, cancel-item, order events timeline |
| KOT & Kitchen | `apps.kot`, `apps.kitchen` | Complete | Paginated KOT list, KOT detail, status transition (`NEW -> PREPARING -> READY -> SERVED`), print payload, print-status update, active Kitchen queue (`NEW` & `PREPARING` with `elapsedMinutes`) |
| Billing & Payments | `apps.billing`, `apps.payments` | Complete | Paginated bills list, bill detail, generate/recalculate bill from order (`POST /orders/{id}/bill`), apply discount (`FIXED`/`PERCENTAGE` with threshold check), print payload, record split/mixed payments (`CASH`/`UPI`/`CARD`/`OTHER`), close bill (transitions order to `COMPLETED`, releases table to `AVAILABLE`, updates customer visit/spend stats) |
| Customers | `apps.customers` | Complete | Paginated customer list/search, create/upsert by normalized 10-digit phone, detail, customer order history |
| Reports | `apps.reports` | Complete | Sales summary (`totalBills`, `totalSales`, `totalSubtotal`, `totalDiscount`, `totalTax`, `averageBillValue`), item-wise sales, captain-wise sales, payment mode breakdown |
| Audit & Notifications | `apps.audit`, `apps.notifications` | Complete | Paginated immutable audit log query, unread/recent notifications query, mark notification read |

---

## 4. Source React Web App Inventory (`C:\GTS-POS\restaurant-pos-web`)

### 4.1 Runtime & Build Stack
- **Framework & Bundler:** React `18.3.1`, React DOM `18.3.1`, Vite `5.4.11` (`@vitejs/plugin-react`), JavaScript ES Modules (`"type": "module"`).
- **Routing & UI:** `react-router-dom` `6.28.0`, Tailwind CSS `3.4.15`, `lucide-react` `0.460.0`.
- **Dev Server Config (`vite.config.js`):** Runs on port `3000` (`strictPort: false`).
- **Environment Configuration (`.env.example` / `src/config/appConfig.js`):**
  - `VITE_DATA_PROVIDER`: `'local'` (default fallback in code) or `'api'` (set in `.env` / `.env.example`)
  - `VITE_API_BASE_URL`: `'http://localhost:8000/api/v1'`
  - `VITE_DEFAULT_BRANCH_ID`: `'branch-main'`

### 4.2 Web Pages & Routes (`src/routes/AppRoutes.jsx`)
| Route Path | Page Component | Permission Guard | Status |
|---|---|---|---|
| `/login` | `LoginPage.jsx` | Public (redirects if authenticated) | Working (API & Local) |
| `/unauthorized` | `UnauthorizedPage.jsx` | Public | Working |
| `/dashboard` | `DashboardPage.jsx` | `VIEW_DASHBOARD` | Working (API & Local) |
| `/profile` | `ProfilePage.jsx` | Authenticated | Working (API & Local) |
| `/orders/new` | `CreateOrderPage.jsx` | `CREATE_ORDER` | Working (API & Local) |
| `/orders` | `OrdersPage.jsx` | `VIEW_ORDERS` | Working (API & Local) |
| `/reception` | `ReceptionPage.jsx` | `CONFIRM_ORDER` | Working (API & Local) |
| `/kitchen` | `KitchenPage.jsx` | `VIEW_KOT` | Working (API & Local) |
| `/billing` | `BillingPage.jsx` | `GENERATE_BILL` | Working (API & Local) |
| `/tables` | `TablesPage.jsx` | `VIEW_TABLES` | Working (API & Local) |
| `/menu/categories` | `CategoriesPage.jsx` | `VIEW_MENU` | Working (API & Local) |
| `/menu/products` | `ProductsPage.jsx` | `VIEW_MENU` | Working (API & Local) |
| `/customers` | `CustomersPage.jsx` | `VIEW_CUSTOMERS` | Working (API & Local) |
| `/shifts` | `ShiftsPage.jsx` | `GENERATE_BILL` | Working (Hybrid: LocalStorage shifts + live API bills) |
| `/reports` | `ReportsPage.jsx` | `VIEW_REPORTS` | Working (API & Local) |
| `/users` | `UsersPage.jsx` | `MANAGE_USERS` | Working (API & Local) |
| `/roles` | `RolesPage.jsx` | `MANAGE_ROLES` | Working (API & Local) |
| `/audit` | `AuditPage.jsx` | `VIEW_AUDIT_LOGS` | Working (API & Local) |
| `/settings` | `SettingsPage.jsx` | `MANAGE_SETTINGS` | Working (Calls `GET/PATCH /branches/{branchId}`, falls back to defaults) |

### 4.3 Dual-Mode Repository Architecture
- All 16 domain repositories in `src/services/repositories/*.js` act as facades switching on `APP_CONFIG.DATA_PROVIDER === 'api'` between `src/services/repositories/api/*ApiRepository.js` and `src/services/repositories/local/*LocalRepository.js` (except `notificationRepository.js`, which uses `notificationApiRepository` in API mode and returns empty/no-op in local mode).
- **Printing (`src/services/printing/printService.js`):** Pure client-side HTML thermal receipt generator (`80mm`) for both KOT slips (`printKOT`) and GST Tax Invoices (`printInvoice`). Strictly decoupled from payment/settlement mutations.

---

## 5. Source React Native Mobile Inventory (`C:\GTS-POS\restaurant-pos-mobile`)

### 5.1 Runtime & Stack (Read-Only Compatibility Target)
- **Framework:** React Native `0.87.1` (New Architecture enabled), React `19.2.3`, TypeScript `6.0.3`.
- **State & Networking:** Zustand `5.0.15`, `@tanstack/react-query` `5.103.2`, Axios `1.20.0`.
- **Configured Base URL (`src/core/config/apiConfig.ts`):**
  - Default Android Emulator URL: `http://10.0.2.2:8000/api/v1`
  - Default Localhost URL: `http://127.0.0.1:8000/api/v1`
  - Supports runtime override via `globalThis.__APP_CONFIG__.apiBaseUrl`, `process.env.API_BASE_URL`, `process.env.POS_API_BASE_URL`, or `setApiConfigOverride()`.
  - Health endpoint derived by replacing `/api/v1` with `/api/health`.

### 5.2 Mobile Role Scope & Workflows
- **Strict Role Guard (`RootNavigator.tsx`):** Only `CAPTAIN` and `KITCHEN` role codes are permitted into operational flows; other roles see an "Access Restricted / Role Not Supported on Mobile" screen.
- **Captain Workflows (`AppNavigator`):**
  - Home Overview (`HomeScreen.tsx`): Displays floor stats (`totalTables`, `availableTables`, `occupiedTables`, `readyToServe`, `billsPending`), assigned tables, and real-time service alerts (`KOT_READY`, `ORDER_REJECTED`, `WAITING_CONFIRMATION`).
  - Table Floor View (`TablesScreen.tsx`): Displays areas and tables sorted numerically with live order status badges and non-authoritative offline read cache fallback.
  - Order Workspace & Menu (`OrderWorkspaceScreen.tsx`, `MenuScreen.tsx`, `ReviewOrderScreen.tsx`):
    - Opening an `AVAILABLE` table starts a local draft context (`draft-{tableId}`) without creating a 0-item backend order.
    - Adding/editing/removing unsent lines (`state: 'draft'`) happens locally in memory/draft state.
    - Holding an order calls `POST /api/v1/orders` (`held: true`) or `POST /api/v1/orders/{id}/hold`; resuming calls `POST /api/v1/orders/{id}/resume`.
    - Submitting an initial order calls `POST /api/v1/orders` + `POST /api/v1/orders/{id}/submit` (with `Idempotency-Key` headers), moving the order to `WAITING_CONFIRMATION`.
    - Submitting additional items on an already-confirmed order (`KOT_SENT`, `PREPARING`, `READY`, `SERVED`) calls `POST /api/v1/orders/{id}/items` with `reason: 'Additional items ordered by Captain'`, which generates a `MODIFICATION` KOT on the server.
- **Kitchen Workflows (`KitchenNavigator`):**
  - Kitchen Dashboard (`KitchenDashboardScreen.tsx`): Fetches `GET /api/v1/kitchen/queue?branchId=...`, `GET /api/v1/kots?branchId=...&status=READY&limit=20`, and `GET /api/v1/kots?branchId=...&status=CANCELLED&limit=10` in parallel, merging and deduplicating tickets and computing `NEW`, `PREPARING`, and `READY` counts.
  - Kitchen KOT Detail (`KitchenKotDetailScreen.tsx`): Displays ticket revision, `NEW`/`MODIFICATION`/`CANCELLATION` type badges, item quantity deltas (`+`/`-`), spice customizations (`Spice: ...`), and transitions status via `POST /api/v1/kots/{kotId}/status` (`PREPARING` / `READY`).
- **Polling & Notifications (`src/core/realtime/realtimeService.ts`):**
  - Polls every `8000ms` while `AppState === 'active'`.
  - Polls `GET /api/v1/notifications?branchId=...&unreadOnly=true` and marks surfaced `KOT_READY` and `ORDER_REJECTED` notifications as read via `POST /api/v1/notifications/{id}/read`.
