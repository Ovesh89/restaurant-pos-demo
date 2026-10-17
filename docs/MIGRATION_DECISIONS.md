# Migration Decisions & Cross-Project Discrepancy Log

> **Phase 0 Audit Date:** 2026-10-11  
> **Purpose:** Record concrete contract discrepancies, authentication/database risks, and architectural decisions discovered across `restaurant-pos-backend`, `restaurant-pos-web`, and `restaurant-pos-mobile`.

---

## Decision 1 — Token Refresh Payload Shape (`data.access` vs `data.tokens.access`)

- **Observed Discrepancy:**
  - **Django Backend (`apps/identity/services.py`):** `POST /api/v1/auth/refresh` returns:
    ```json
    {
      "success": true,
      "data": { "access": "<jwt>", "tokenType": "Bearer" }
    }
    ```
  - **Mobile Client (`src/core/api/client.ts:126` & `ApiAuthRepository.ts:150`):** Unwraps `data` and reads `unwrapped.access ?? unwrapped.accessToken`.
  - **Web Client (`src/services/api/apiClient.js:192`):** Reads `const newTokens = data?.data?.tokens || data?.tokens; if (newTokens?.access) { tokenStorage.setTokens(newTokens); }`. Because Django did not include a nested `tokens` object on `/auth/refresh`, silent token refresh in the Web app failed to extract the new token!
- **Proposed Resolution (Non-Breaking Compatibility Shim):**
  - In the new Express backend, `POST /api/v1/auth/refresh` will return **both** top-level `access` and nested `tokens`:
    ```json
    {
      "success": true,
      "data": {
        "access": "<jwt>",
        "tokenType": "Bearer",
        "tokens": {
          "access": "<jwt>",
          "tokenType": "Bearer"
        }
      },
      "message": "Token refreshed successfully."
    }
    ```
  - This satisfies both the unchanged Mobile client (`unwrapped.access`) and the Web client (`data.data.tokens.access`) simultaneously.

---

## Decision 2 — Product Price Change Request Payload (`price` vs `newPrice`)

- **Observed Discrepancy:**
  - **Django Backend (`apps/menu/serializers.py:55`):** `ProductPriceChangeSerializer` requires `{ "price": "250.00", "reason": "..." }`.
  - **Web Client (`src/services/repositories/api/productApiRepository.js:117,173`):** Sends `{ "newPrice": "250.00", "reason": "..." }` to `POST /api/v1/menu/products/:productId/price`.
- **Proposed Resolution (Non-Breaking Compatibility Shim):**
  - In the Express backend validator for `POST /api/v1/menu/products/:productId/price`, accept **either** `price` or `newPrice` (`const rawPrice = req.body.price ?? req.body.newPrice`), validate that it is a non-negative decimal and `reason` has at least 3 characters, record the immutable `price_history` entry, and return the updated product document.

---

## Decision 3 — Missing `GET /api/v1/branches/:branchId` and `PATCH /api/v1/branches/:branchId` in Django

- **Observed Discrepancy:**
  - **Django Backend (`apps/restaurant/urls.py`):** Only implemented `GET /api/v1/branches` and `POST /api/v1/branches`. It did **not** implement `/api/v1/branches/<branch_id>`.
  - **Mobile Client (`src/features/auth/repositories/ApiAuthRepository.ts:55`):** Calls `GET /api/v1/branches/${branchId}` during `login()` and `restoreSession()` to populate `session.restaurant` (catching the 404 and falling back to hardcoded defaults).
  - **Web Client (`src/services/repositories/api/settingsApiRepository.js:9,53`):** Calls `GET /api/v1/branches/${branchId}` on the Settings page to load restaurant/tax/invoice settings, and calls `PATCH /api/v1/branches/${branchId}` when saving settings (catching the 404 and falling back to `DEFAULT_SETTINGS`).
- **Proposed Resolution:**
  - Implement both `GET /api/v1/branches/:branchId` (accessible to any authenticated user assigned to that branch or `OWNER`/`ADMIN`) and `PATCH /api/v1/branches/:branchId` (requiring `branch.manage` permission) in the Express backend. This eliminates silent 404s on both Mobile login and Web Settings and persists branch `taxConfig` and `invoiceConfig` in MongoDB.

---

## Decision 4 — Self-Profile & Password Update Permission on `PATCH /api/v1/users/:userId`

- **Observed Discrepancy:**
  - **Django Backend (`apps/identity/views.py:92`):** `PATCH /api/v1/users/<user_id>` requires `HasPermissions(["user.manage"])` for all updates.
  - **Web Client (`src/pages/auth/ProfilePage.jsx` -> `authApiRepository.js:102,120`):** Allows any logged-in user (including `CAPTAIN`, `KITCHEN`, `CASHIER`, `RECEPTION` who do *not* have `user.manage`) to update their own `displayName`, `mobile`, and `password` via `PATCH /api/v1/users/${userId}`.
- **Proposed Resolution:**
  - In the Express backend `PATCH /api/v1/users/:userId`:
    - If `req.user.id === req.params.userId` and the request only modifies self-profile fields (`displayName`, `mobile`, `email`, `password`), allow the update for any authenticated user.
    - If the request targets another user or modifies administrative fields (`roleIds`, `branchIds`, `isActive`, `username`), enforce the `user.manage` permission.

---

## Decision 5 — Optional `branchId` in Web Menu Category & Product Creation

- **Observed Discrepancy:**
  - **Django Backend (`apps/menu/serializers.py`):** `CategoryCreateSerializer` and `ProductCreateSerializer` require `branchId` as a mandatory field.
  - **Web Client (`categoryApiRepository.js:40`, `productApiRepository.js:86`):** Sends `{ name, code, sortOrder, isActive }` for categories and `{ code, name, categoryId, price, taxConfig, available, kitchenStation, description, isActive }` for products **without** `branchId` in the POST body.
- **Proposed Resolution:**
  - In the Express backend, if `branchId` is omitted in `POST /api/v1/menu/categories` or `POST /api/v1/menu/products`, default `branchId` to the authenticated user's primary branch (`req.user.branchIds?.[0] || "branch-main"`).

---

## Decision 6 — Password Hash Compatibility (`md5$` and `pbkdf2_sha256$`)

- **Observed Discrepancy:**
  - In `C:\GTS-POS\restaurant-pos-backend\config\settings.py` (lines 158–161), `PASSWORD_HASHERS` is configured with `django.contrib.auth.hashers.MD5PasswordHasher` first and `PBKDF2PasswordHasher` second.
  - Consequently, existing users in `restaurant_pos_dev` and backups have `passwordHash` strings prefixed with `md5$<salt>$<hex>` or `pbkdf2_sha256$<iterations>$<salt>$<base64>`.
- **Proposed Resolution:**
  - Implement a dedicated password hashing utility in `apps/backend/src/modules/identity/password.js` using Node's native `node:crypto` module that:
    1. Verifies `md5$<salt>$<hash>` (Django `MD5PasswordHasher`).
    2. Verifies `pbkdf2_sha256$<iterations>$<salt>$<hash>` (Django `PBKDF2PasswordHasher`).
    3. Hashes newly created or updated passwords using `pbkdf2_sha256$600000$<salt>$<base64>` (standard OWASP/Django 5+ PBKDF2-SHA256 format), ensuring zero native addon build issues on Windows and 100% two-way compatibility with Django.

---

## Decision 7 — Official `mongodb` Node Driver vs Mongoose ODM

- **Context:**
  - `AGENTS.md` §8 notes: *"Compare the existing database schema/collection structure with any Mongoose models before defining or migrating collections. Similar database technology does not imply identical document shapes."*
  - The source Django backend uses direct PyMongo repositories (`BaseMongoRepository`) with string `_id` values (`"branch-main"`, `"tbl-01"`, `"usr_<hex>"`, UUIDv4 strings), dual `id`/`_id` fields, and string-formatted decimals (`"240.00"`).
- **Proposed Resolution:**
  - Implement `BaseMongoRepository` in Node.js using the official `mongodb` driver (`mongodb@6.12.0`), mirroring Django's `apps/common/repositories.py` 1:1.
  - This guarantees identical collection structures, prevents Mongoose `ObjectId` casting failures on string `_id`s (`"branch-main"`, `"tbl-01"`), avoids `__v` version key pollution, and preserves 100% compatibility with existing backup/restore JSON snapshots.

---

## Decision 8 — Order Status Alias (`BILLING` vs `BILL_PENDING`) and Date-Range Inclusive Filtering

- **Observed Discrepancy:**
  - **Order Status Filter:** Web `BillingPage.jsx` queries `GET /api/v1/orders?status=SERVED,READY,BILLING,KOT_SENT,PREPARING` (`ORDER_STATUS.BILLING = 'BILLING'`), whereas the backend sets `order.status = 'BILL_PENDING'` when a bill is generated.
  - **Report Date Filter:** Web `ReportsPage.jsx` passes `dateFrom=YYYY-MM-DD` and `dateTo=YYYY-MM-DD`. In MongoDB, `createdAt` is an ISO timestamp (`YYYY-MM-DDTHH:mm:ss.sssZ`). Comparing `createdAt <= "2026-10-11"` lexicographically excludes bills created after `00:00:00` on `2026-10-11` unless `dateTo` is expanded to end-of-day (`2026-10-11T23:59:59.999Z`).
- **Proposed Resolution:**
  - In `OrderRepository.findPaginated`: When filtering by comma-separated `status`, if `"BILLING"` or `"BILL_PENDING"` is present in the status list, include **both** `"BILLING"` and `"BILL_PENDING"` in the `$in` query so orders with generated bills always appear in "Tables Pending Settlement" until closed!
  - In `ReportsService`: When `dateTo` is a 10-character `YYYY-MM-DD` string, automatically append `T23:59:59.999Z` for the `$lte` comparison so same-day settled bills are included in reports.

---

## Decision 9 — Cashier Shifts Persistence (`localStorage` vs Backend API)

- **Observed Discrepancy:**
  - Even when `VITE_DATA_PROVIDER=api`, Web `shiftApiRepository.js` stores shift open/close/cash-movement records in browser `localStorage` while querying live paid bills from `/api/v1/bills` to calculate expected cash. The Django backend has no `/api/v1/shifts` endpoints.
- **Proposed Resolution:**
  - Preserve `shiftApiRepository.js` behavior as-is during Phases 1–4 so existing Web shift workflows continue working without regression. (If server-side `/api/v1/shifts` endpoints are desired in a later enhancement, they can be added as an optional extension.)
