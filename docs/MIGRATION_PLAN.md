# MERN Migration Plan — Restaurant POS & KOT Management System

> **Phase 0 Audit Date:** 2026-10-11  
> **Target Repository:** `C:\GTS-POS\restaurant-pos-backend-mern`  
> **Express Dev Port:** `8001` (isolated from Django on `8000`)  
> **Express Dev Database:** `restaurant_pos_mern_dev` (isolated from Django `restaurant_pos_dev`)

---

## 1. Migration Objectives & Architectural Principles

1. **Zero Modification to Source Repositories:**
   - `C:\GTS-POS\restaurant-pos-backend`, `C:\GTS-POS\restaurant-pos-web`, and `C:\GTS-POS\restaurant-pos-mobile` remain 100% untouched.
2. **100% Observable API Compatibility:**
   - The new Node.js + Express backend reproduces all `/api/v1/*` and health/readiness endpoints of the Django backend, plus targeted compatibility shims so both the migrated React Web app (`apps/web`) and the unchanged React Native mobile app (`restaurant-pos-mobile`) work without any mobile source changes.
3. **Preserve Working Web UX & Dual-Mode Repositories:**
   - Copy `C:\GTS-POS\restaurant-pos-web` into `apps/web` preserving all screens, Tailwind styling, routes, printing, billing calculator, local storage mode (`VITE_DATA_PROVIDER=local`), and API mode (`VITE_DATA_PROVIDER=api` pointed to `http://localhost:8001/api/v1`).
4. **Runtime & Data Isolation:**
   - Run Express on port `8001` by default (`PORT=8001`).
   - Connect to `restaurant_pos_mern_dev` (`MONGODB_DATABASE=restaurant_pos_mern_dev`) and `restaurant_pos_mern_test` for tests.

---

## 2. Target Repository Structure

```text
restaurant-pos-backend-mern/
├── AGENTS.md
├── docs/
│   ├── restaurant-pos-development-specification-mern.md
│   ├── restaurant-pos-development-specification-mern.docx
│   ├── SOURCE_PROJECT_INVENTORY.md
│   ├── MIGRATION_PLAN.md
│   ├── API_COMPATIBILITY_MATRIX.md
│   ├── DATABASE_MIGRATION_PLAN.md
│   └── MIGRATION_DECISIONS.md
├── apps/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── config/
│   │   │   │   ├── env.js                 # Environment config & defaults (PORT=8001, DB=restaurant_pos_mern_dev)
│   │   │   │   ├── database.js            # MongoClient singleton, getCollection, atomicTransaction, ping
│   │   │   │   ├── permissions.js         # Canonical 29 permissions & 7 default role mappings
│   │   │   │   └── openapi.js             # OpenAPI 3.0 specification generator
│   │   │   ├── middleware/
│   │   │   │   ├── correlationId.js       # X-Correlation-ID / X-Request-ID propagation
│   │   │   │   ├── idempotency.js         # Idempotency-Key / X-Idempotency-Key replay & 409 lock
│   │   │   │   ├── auth.js                # Bearer JWT verification & req.user attachment
│   │   │   │   ├── permissions.js         # requirePermissions([...]), requireAnyPermission([...]), ensureBranchAccess
│   │   │   │   ├── validate.js            # Request body/query validation wrapper
│   │   │   │   └── errorHandler.js        # AppError classes & canonical { success: false, error } formatter
│   │   │   ├── modules/
│   │   │   │   ├── health/                # /, /health, /ready, /api/health, /api/ready, /api/schema, /api/docs
│   │   │   │   ├── identity/              # /auth/*, /me, /users/*, /roles/* + password hashers & JWT service
│   │   │   │   ├── restaurant/            # /branches/*, /areas/*, /tables/*
│   │   │   │   ├── menu/                  # /menu/categories/*, /menu/products/*, price history
│   │   │   │   ├── orders/                # /orders/* (lifecycle, items, hold/resume/submit/confirm/reject/cancel)
│   │   │   │   ├── kot/                   # /kots/*, /kitchen/queue
│   │   │   │   ├── billing/               # /bills/*, /orders/:id/bill, calculator, discounts
│   │   │   │   ├── payments/              # /bills/:id/payments
│   │   │   │   ├── customers/             # /customers/*
│   │   │   │   ├── reports/               # /reports/sales, /items, /captains, /payments
│   │   │   │   ├── audit/                 # /audit + AuditService
│   │   │   │   └── notifications/         # /notifications/* + NotificationService
│   │   │   ├── repositories/
│   │   │   │   └── BaseMongoRepository.js # Shared CRUD, string _id/id serialization, pagination helper
│   │   │   ├── utils/
│   │   │   │   ├── decimal.js             # Exact Decimal money arithmetic & HALF_UP 2-decimal formatter
│   │   │   │   ├── sequence.js            # Atomic counters collection sequence generator (ORD/KOT/BILL)
│   │   │   │   ├── phone.js               # 10-digit Indian mobile normalization & validation
│   │   │   │   └── response.js            # successResponse, createdResponse, errorResponse
│   │   │   ├── app.js                     # Express application setup
│   │   │   └── server.js                  # HTTP server entry point & graceful shutdown
│   │   ├── tests/
│   │   │   ├── helpers/                   # Test DB setup (restaurant_pos_mern_test) & auth token helpers
│   │   │   ├── phase1.health.test.js
│   │   │   ├── phase2.identity.test.js
│   │   │   ├── phase2.restaurant.test.js
│   │   │   ├── phase2.menu.test.js
│   │   │   ├── phase3.orders.test.js
│   │   │   ├── phase3.kot_kitchen.test.js
│   │   │   ├── phase3.mobile_contract.test.js
│   │   │   ├── phase4.billing_payments.test.js
│   │   │   └── phase4.customers_reports_audit.test.js
│   │   ├── .env.example
│   │   └── package.json
│   └── web/                               # Migrated copy of C:\GTS-POS\restaurant-pos-web
│       ├── docs/
│       ├── src/
│       ├── index.html
│       ├── package.json
│       ├── package-lock.json
│       ├── postcss.config.js
│       ├── tailwind.config.js
│       ├── vite.config.js
│       └── .env.example
├── scripts/
│   ├── init-indexes.js
│   ├── seed-demo-data.js
│   ├── backup-mongodb.js
│   └── restore-mongodb.js
├── package.json                           # Root convenience scripts (dev:backend, dev:web, test, seed)
├── .gitignore
└── README.md
```

---

## 3. Technology Stack & Pinned Dependencies

### 3.1 Backend (`apps/backend/package.json`)
- **Runtime:** Node.js (v20+ / v22 LTS, CommonJS or ES Modules — using ES Modules `"type": "module"` to align with `apps/web`).
- **Core Dependencies (pinned compatible versions):**
  - `express`: `4.21.2` — HTTP framework (supports trailing-slash tolerance out of the box)
  - `mongodb`: `6.12.0` — Official MongoDB Node.js driver (preserves string `_id` and exact document shapes)
  - `cors`: `2.8.5` — Cross-Origin Resource Sharing middleware (allowing `http://localhost:3000`, `http://127.0.0.1:3000`, `http://localhost:5173`, and mobile requests)
  - `dotenv`: `16.4.7` — Environment variable loader
  - `jsonwebtoken`: `9.0.2` — HS256 JWT generation & verification compatible with PyJWT
  - `decimal.js`: `10.4.3` — Exact decimal financial calculations with `ROUND_HALF_UP`
  - `swagger-ui-express`: `5.0.1` — Interactive OpenAPI documentation at `/api/docs/`
- **Dev / Test Dependencies:**
  - `vitest`: `2.1.8` (or Node built-in `node:test`) + `supertest`: `7.0.0` — Fast HTTP integration and contract testing against `restaurant_pos_mern_test`

### 3.2 Web Frontend (`apps/web/package.json`)
- Preserved verbatim from `C:\GTS-POS\restaurant-pos-web\package.json`:
  - `react`: `^18.3.1`, `react-dom`: `^18.3.1`, `react-router-dom`: `^6.28.0`, `lucide-react`: `^0.460.0`
  - `vite`: `^5.4.11`, `@vitejs/plugin-react`: `^4.3.4`, `tailwindcss`: `^3.4.15`, `postcss`: `^8.4.49`, `autoprefixer`: `^10.4.20`
- Only `.env.example` / `.env` in `apps/web` is updated so `VITE_API_BASE_URL=http://localhost:8001/api/v1`.

---

## 4. Phased Implementation Plan & Exit Criteria

### Phase 0 — Audit and Plan (Current Phase — Documentation Only)
- **Scope:**
  - Read `AGENTS.md`, `docs/restaurant-pos-development-specification-mern.md`, and inspect all three source projects in read-only mode.
  - Create `docs/SOURCE_PROJECT_INVENTORY.md`, `docs/MIGRATION_PLAN.md`, `docs/API_COMPATIBILITY_MATRIX.md`, `docs/DATABASE_MIGRATION_PLAN.md`, and `docs/MIGRATION_DECISIONS.md`.
- **Exit Criteria:** User reviews and approves Phase 0 deliverables and migration decisions.

---

### Phase 1 — MERN Foundation & Infrastructure
- **Scope:**
  1. Initialize `.gitignore`, root `package.json`, and `README.md` in `C:\GTS-POS\restaurant-pos-backend-mern`.
  2. Create `apps/backend` with Express app, `.env.example` (`PORT=8001`, `MONGODB_URI=mongodb://127.0.0.1:27017`, `MONGODB_DATABASE=restaurant_pos_mern_dev`), MongoDB connection manager (`database.js`), `BaseMongoRepository`, `decimal.js` helper, and `sequence.js` counter generator.
  3. Implement cross-cutting middlewares:
     - `correlationId` (`X-Correlation-ID` / `X-Request-ID`)
     - `idempotency` (`Idempotency-Key` / `X-Idempotency-Key` backed by `idempotency_keys` collection)
     - Central `errorHandler` and response helpers (`successResponse`, `createdResponse`, `errorResponse`)
  4. Implement health, readiness, and OpenAPI schema/docs routes (`/`, `/health`, `/ready`, `/api/health`, `/api/ready`, `/api/schema/`, `/api/docs/`).
  5. Implement `scripts/init-indexes.js` and `scripts/seed-demo-data.js` targeting `restaurant_pos_mern_dev`.
  6. Copy `C:\GTS-POS\restaurant-pos-web` into `apps/web` (excluding `node_modules` and `.git`), configure `apps/web/.env.example` to point to `http://localhost:8001/api/v1`, install dependencies inside `apps/web`, and verify `npm run build` succeeds.
- **Exit Criteria:**
  - Express server starts cleanly on port `8001` connected to `restaurant_pos_mern_dev`.
  - Health/readiness/idempotency/error contract tests pass against `restaurant_pos_mern_test`.
  - `apps/web` builds and runs independently in local mode.
  - Source directories (`restaurant-pos-backend`, `restaurant-pos-web`, `restaurant-pos-mobile`) remain untouched.

---

### Phase 2 — Identity, RBAC & Master Data (Branches, Areas, Tables, Menu)
- **Scope:**
  1. Implement Identity & RBAC module (`apps/backend/src/modules/identity`):
     - Password verification supporting Django `md5$<salt>$<hash>` and `pbkdf2_sha256$<iterations>$<salt>$<hash>`, and hashing new passwords with `pbkdf2_sha256`.
     - HS256 JWT token generation and verification (`sub`, `username`, `type: "access" | "refresh"`).
     - `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh` (with dual `{ access, tokenType, tokens: { access, tokenType } }` shim), `POST /api/v1/auth/logout`, `GET /api/v1/me`.
     - Users CRUD & activation (`GET/POST /api/v1/users`, `GET/PATCH /api/v1/users/:id`, `POST /api/v1/users/:id/activate`, `POST /api/v1/users/:id/deactivate`) including self-profile update support.
     - Roles CRUD (`GET/POST /api/v1/roles`, `GET/PATCH /api/v1/roles/:id`).
  2. Implement Restaurant Master module (`apps/backend/src/modules/restaurant`):
     - `GET/POST /api/v1/branches`, plus `GET/PATCH /api/v1/branches/:branchId` (for Web Settings & Mobile Branch lookup).
     - `GET/POST /api/v1/areas`, `PATCH /api/v1/areas/:areaId`.
     - `GET/POST /api/v1/tables`, `GET/PATCH /api/v1/tables/:tableId` (with `tbl-XX` <-> `table-XX` alias support).
  3. Implement Menu & Price History module (`apps/backend/src/modules/menu`):
     - `GET/POST /api/v1/menu/categories`, `GET/PATCH /api/v1/menu/categories/:categoryId`.
     - `GET/POST /api/v1/menu/products`, `GET/PATCH /api/v1/menu/products/:productId`, `POST .../activate`, `POST .../deactivate`.
     - `POST /api/v1/menu/products/:productId/price` (accepting both `price` and `newPrice` + `reason`) and `GET /api/v1/menu/products/:productId/price-history`.
  4. Seed `restaurant_pos_mern_dev` with all 7 roles, 7 demo users, main branch, 3 areas, 20 tables, 8 categories, and 21 products.
- **Exit Criteria:**
  - Automated backend tests for Auth (login, refresh, disabled user `403`, invalid token `401`), Users, Roles, Branches, Areas, Tables, Categories, Products, and Price History pass.
  - Web Login, Profile, Users, Roles, Tables, Categories, Products, and Settings pages verified against Express API (`http://localhost:8001/api/v1`).

---

### Phase 3 — Orders, Reception, KOT & Kitchen (Plus Mobile Compatibility)
- **Scope:**
  1. Implement Notifications & Audit services (`NotificationService`, `AuditService`) used across Order and KOT state transitions.
  2. Implement Orders module (`apps/backend/src/modules/orders`):
     - `GET/POST /api/v1/orders` (with comma-separated `status` filter and `BILLING` -> `BILL_PENDING` alias support).
     - `GET /api/v1/orders/:orderId`, `POST /api/v1/orders/:orderId/items` (generating `MODIFICATION` KOT when order is already confirmed).
     - `POST /api/v1/orders/:orderId/hold`, `/resume`, `/submit`, `/confirm` (generating initial `NEW` KOT), `/reject`, `/cancel`, `/cancel-item`, and `GET /api/v1/orders/:orderId/events`.
  3. Implement KOT & Kitchen modules (`apps/backend/src/modules/kot`):
     - `GET /api/v1/kots`, `GET /api/v1/kots/:kotId`, `POST /api/v1/kots/:kotId/status` (`NEW -> PREPARING -> READY -> SERVED` with parent order & table status synchronization and `KOT_READY` notification), `GET /api/v1/kots/:kotId/print`, `POST /api/v1/kots/:kotId/print-status`.
     - `GET /api/v1/kitchen/queue` (returning `NEW` and `PREPARING` KOTs with computed `elapsedMinutes`).
  4. Implement Notifications endpoints (`GET /api/v1/notifications`, `POST /api/v1/notifications/:id/read`).
- **Exit Criteria:**
  - Automated backend tests for full Order & KOT state machine, item snapshots, modification/cancellation KOTs, table locking/release on reject/cancel, and idempotency pass.
  - Mobile Captain & Kitchen API contract test suite passes 100% against Express.
  - Web Create Order, Orders, Reception, and Kitchen pages verified end-to-end against Express.

---

### Phase 4 — Billing, Discounts, Payments, Customers, Reports & Audit
- **Scope:**
  1. Implement Billing & Exact Calculator module (`apps/backend/src/modules/billing`):
     - `BillingCalculator` using `decimal.js` (`ROUND_HALF_UP`) with item snapshot totals, `FIXED`/`PERCENTAGE` discounts, `EXCLUSIVE`/`INCLUSIVE` GST split (`cgst`, `sgst`), and nearest-rupee `rounding`.
     - `GET /api/v1/bills`, `GET /api/v1/bills/:billId`, `POST /api/v1/orders/:orderId/bill`, `POST /api/v1/bills/:billId/discount` (enforcing `discount.approve` over 20%), `GET /api/v1/bills/:billId/print`, `POST /api/v1/bills/:billId/close` (enforcing `balanceAmount == 0`, completing order, releasing table to `AVAILABLE` with `activeOrderId: null`, and incrementing customer stats).
  2. Implement Payments module (`apps/backend/src/modules/payments`):
     - `GET/POST /api/v1/bills/:billId/payments` supporting split/mixed tenders (`CASH`, `UPI`, `CARD`, `OTHER`), overpayment prevention, and `idempotencyKey` deduplication.
  3. Implement Customers module (`apps/backend/src/modules/customers`):
     - `GET/POST /api/v1/customers` (with 10-digit phone normalization and upsert), `GET /api/v1/customers/:id`, `GET /api/v1/customers/:id/orders`.
  4. Implement Reports & Audit modules (`apps/backend/src/modules/reports`, `apps/backend/src/modules/audit`):
     - `GET /api/v1/reports/sales`, `/items`, `/captains`, `/payments`.
     - `GET /api/v1/audit` (supporting `branchId`, `entityType`, `entityId`, `action`, `actorUserId` / `actorId`).
- **Exit Criteria:**
  - Automated backend tests for billing math, discount approval threshold, split payments, cannot-close-with-balance, table release after settlement, pending settlement exclusion, customer upsert, reports, and audit logs pass.
  - Web Billing, Customers, Shifts, Reports, Dashboard, and Audit pages + KOT/Invoice printing verified end-to-end.

---

### Phase 5 — Regression, Hardening, Backup/Restore & Cutover Readiness
- **Scope:**
  1. Full backend integration & contract test suite execution.
  2. Full `apps/web` build and end-to-end verification in both `api` and `local` modes.
  3. Unchanged `restaurant-pos-mobile` compatibility verification against Express API.
  4. Implement `scripts/backup-mongodb.js` and `scripts/restore-mongodb.js` and document deployment, cutover, and rollback guide in `docs/`.
- **Exit Criteria:** All backend, web, and mobile contract tests pass with 0 errors; cutover documentation complete.
