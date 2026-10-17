# API Compatibility Matrix — Django REST to Express.js (MERN)

> **Phase 0 Audit Date:** 2026-10-11  
> **Target API Prefix:** `/api/v1` (plus root/health endpoints)  
> **Compatibility Requirement:** 100% backward-compatible with unchanged `restaurant-pos-mobile` (Captain & Kitchen) and migrated `apps/web` (`restaurant-pos-web`).

---

## 1. Global API Contract Conventions

### 1.1 Standard Response Envelopes
All `/api/v1/*` endpoints return JSON in the following envelopes:
- **Success (`200 OK`, `201 Created`):**
  ```json
  {
    "success": true,
    "data": <Object | Array>,
    "message": "<optional string>"
  }
  ```
- **Error (`400`, `401`, `403`, `404`, `409`, `422`, `500`):**
  ```json
  {
    "success": false,
    "error": {
      "code": "<ERROR_CODE>",
      "message": "<human-readable summary>",
      "details": {}
    }
  }
  ```
- **Unwrapped Health & Root Endpoints (`/`, `/health`, `/ready`, `/api/health`, `/api/ready`):**
  Return raw JSON (not wrapped in `{ success, data }`):
  ```json
  {
    "status": "ok",
    "service": "restaurant-pos-backend",
    "database": "connected",
    "mongodb": {
      "status": "connected",
      "database": "restaurant_pos_mern_dev",
      "version": "<mongod version>"
    }
  }
  ```

### 1.2 Trailing Slash Tolerance
Django's `APPEND_SLASH=True` allows clients to call routes with or without trailing slashes (e.g., `/api/health` and `/api/health/`). Express default routing (`strict: false`) naturally matches both `/path` and `/path/` and must be kept enabled.

### 1.3 Standard Error Codes & HTTP Statuses
| Error Code | HTTP Status | Meaning & Client Handling |
|---|---|---|
| `VALIDATION_ERROR` | `400` | Invalid request body, missing required fields, or invalid query params |
| `UNAUTHORIZED` | `401` | Missing, malformed, expired, or invalid JWT access/refresh token (triggers single token refresh on Web & Mobile) |
| `PERMISSION_DENIED` | `403` | Authenticated user lacks required permission code or branch access (never retried by clients) |
| `NOT_FOUND` | `404` | Entity or route not found |
| `CONFLICT` | `409` | Duplicate unique field (`username`, `code`, `tableNumber`) or table already occupied |
| `INVALID_STATE` | `409` | Invalid Order, KOT, or Bill state transition |
| `CONCURRENT_REQUEST` | `409` | Duplicate `Idempotency-Key` currently in `PROCESSING` state |
| `INTERNAL_SERVER_ERROR` | `500` | Unhandled server exception |

### 1.4 Pagination Contract
Paginated list endpoints accept `?page=1&limit=50` (default `page=1`, `limit=50`, max `limit=200`) and return inside `data`:
```json
{
  "items": [ ... ],
  "pagination": {
    "total": 42,
    "page": 1,
    "limit": 50,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```
- **Paginated Endpoints:** `GET /api/v1/users`, `GET /api/v1/menu/products`, `GET /api/v1/orders`, `GET /api/v1/kots`, `GET /api/v1/bills`, `GET /api/v1/customers`, `GET /api/v1/audit`.
- **Non-Paginated List Endpoints (return raw Array in `data`):** `GET /api/v1/roles`, `GET /api/v1/branches`, `GET /api/v1/areas`, `GET /api/v1/tables`, `GET /api/v1/menu/categories`, `GET /api/v1/menu/products/{id}/price-history`, `GET /api/v1/orders/{id}/events`, `GET /api/v1/kitchen/queue`, `GET /api/v1/bills/{id}/payments`, `GET /api/v1/customers/{id}/orders`, `GET /api/v1/notifications`, `GET /api/v1/reports/items`, `GET /api/v1/reports/captains`, `GET /api/v1/reports/payments`.

### 1.5 ID Formats, Casing & Monetary Serialization
- **Document IDs:** Stored in MongoDB `_id` as strings (`branch-main`, `area-indoor`, `tbl-01`..`tbl-20`, `role-*`, `user-*`, `{prefix}_{uuid4_hex}`, or UUIDv4 strings). Every serialized document includes **both** `"id": "<string>"` and `"_id": "<string>"`.
- **Table ID Aliasing:** `TableRepository.findById` must resolve both `tbl-XX` and `table-XX` interchangeably (e.g., `table-01` <-> `tbl-01`), matching Django's `apps/restaurant/repositories.py`.
- **Field Casing:** `camelCase` across all request/response payloads (`branchId`, `tableNumber`, `currentPrice`, `taxConfig`, `activeOrderId`, `kotNumber`, `orderNumber`, `billNumber`, `grandTotal`, `balanceAmount`).
- **Monetary Values:** Stored and returned as 2-decimal strings (`"240.00"`, `"5.00"`) in MongoDB and API responses, computed using exact decimal arithmetic (`HALF_UP` rounding).

### 1.6 Headers & Middleware Contracts
- `Authorization: Bearer <access_token>`
- `Idempotency-Key` or `X-Idempotency-Key`: Supported on all `POST`, `PUT`, `PATCH`, `DELETE` endpoints via `idempotency_keys` collection; replays cached response with `X-Idempotent-Replay: true`.
- `X-Correlation-ID` or `X-Request-ID`: Echoed back in response `X-Correlation-ID` header.

---

## 2. Endpoint-by-Endpoint Compatibility Matrix

### 2.1 System Health & Documentation

| Path | Method | Auth / Perms | Query / Request Body | Response Wrapper & Fields | Consumers | Target Status & Notes |
|---|---|---|---|---|---|---|
| `/` | `GET` | Public | None | Unwrapped: `{ status, service, database, mongodb }` | Browser / Health check | Phase 1 |
| `/health` & `/api/health` | `GET` | Public | None | Unwrapped: `{ status: "ok", service, database, mongodb }` (`503` if DB down) | Mobile (`apiConfig.healthUrl`), DevOps | Phase 1 |
| `/ready` & `/api/ready` | `GET` | Public | None | Unwrapped: `{ status: "ready", service, database, mongodb }` (`503` if DB down) | DevOps / Readiness probe | Phase 1 |
| `/api/schema/` & `/api/docs/` | `GET` | Public | None | OpenAPI 3.0 JSON & Swagger UI | Developers | Phase 1 |

---

### 2.2 Identity, Authentication, Users & Roles

| Path | Method | Auth / Perms | QueryParams / Request Body | Response `data` Shape | Consumers | Compatibility Notes / Shims |
|---|---|---|---|---|---|---|
| `/api/v1/auth/login` | `POST` | Public | Body: `{ username: string, password: string }` | `{ tokens: { access, refresh, tokenType: "Bearer" }, user: { id, username, displayName, email, mobile, roleIds, branchIds, isActive }, roles: [{ id, code, name }], permissions: string[] }` | Web (`authApiRepository.login`), Mobile (`ApiAuthRepository.login`) | Must verify Django `md5$<salt>$<hash>` & `pbkdf2_sha256$...` password hashes in addition to new hashes. Rejects inactive users (`403 PERMISSION_DENIED`). |
| `/api/v1/auth/refresh` | `POST` | Public | Body: `{ refresh: string }` | `{ access: string, tokenType: "Bearer", tokens: { access: string, tokenType: "Bearer" } }` | Web (`apiClient.refreshAccessToken`), Mobile (`client.ts`, `ApiAuthRepository.refreshToken`) | **CRITICAL SHIM:** Django returned `{ access, tokenType }`, which Mobile reads via `unwrapped.access`, whereas Web `apiClient.js` reads `data.data.tokens.access`. Returning **both** top-level `access` and nested `tokens: { access, tokenType }` satisfies both clients without modifying either! |
| `/api/v1/auth/logout` | `POST` | Authenticated | Body: `{ refresh?: string }` (optional) | `{ loggedOut: true }` (`message: "Logged out successfully."`) | Web (`authApiRepository.logout`), Mobile (`ApiAuthRepository.logout`) | Writes `AUTH_LOGOUT` audit log. |
| `/api/v1/me` | `GET` | Authenticated | None | `{ user: {...}, roles: [...], permissions: string[] }` | Web (`authApiRepository.restoreSession`), Mobile (`ApiAuthRepository.getCurrentUser`, `restoreSession`) | Returns active user profile, full role objects (`id, code, name, permissions`), and flattened sorted `permissions` array. |
| `/api/v1/users` | `GET` | `user.view` | Query: `branchId?`, `isActive?`, `page?`, `limit?` | Paginated: `{ items: User[], pagination: {...} }` (excludes `passwordHash`, attaches `roles: [{ id, code, name }]`) | Web (`userApiRepository.getUsers`) | Phase 2 |
| `/api/v1/users` | `POST` | `user.manage` | Body: `{ username, password, displayName, email?, mobile?, roleIds: string[], branchIds?: string[], isActive?: bool }` | Created `User` object (`201 Created`) | Web (`userApiRepository.createUser`) | `409 CONFLICT` on duplicate username. |
| `/api/v1/users/:userId` | `GET` | `user.view` | None | `User` object with `roles` array | Web (`userApiRepository.getUserById`) | `404 NOT_FOUND` if missing. |
| `/api/v1/users/:userId` | `PATCH` | `user.manage` (or self for profile/password) | Body: `{ displayName?, email?, mobile?, password?, roleIds?, branchIds?, isActive? }` | Updated `User` object | Web (`userApiRepository.updateUser`, `authApiRepository.updateProfile`, `changePassword`) | **COMPATIBILITY NOTE:** Web `ProfilePage` calls `PATCH /users/:userId` for self profile/password updates (`authApiRepository.js:102,120`). Allow authenticated user to update their own `displayName`, `mobile`, `password` even without `user.manage`, while requiring `user.manage` to change `roleIds`, `branchIds`, `isActive`, or other users! |
| `/api/v1/users/:userId/activate` | `POST` | `user.manage` | Body: `{}` | Updated `User` (`isActive: true`) | Web (`userApiRepository.toggleUserStatus`) | Writes `USER_ACTIVATED` audit log. |
| `/api/v1/users/:userId/deactivate` | `POST` | `user.manage` | Body: `{}` | Updated `User` (`isActive: false`) | Web (`userApiRepository.toggleUserStatus`) | Writes `USER_DEACTIVATED` audit log. |
| `/api/v1/roles` | `GET` | `role.view` | None | Non-paginated `Role[]` | Web (`roleApiRepository.getRoles`) | Sorted by `name`. |
| `/api/v1/roles` | `POST` | `role.manage` | Body: `{ code, name, description?, permissions: string[] }` | Created `Role` (`201 Created`) | Admin API | Validates permissions against `ALL_PERMISSIONS`. |
| `/api/v1/roles/:roleId` | `GET` | `role.view` | None | `Role` object | Web (`roleApiRepository.getRoleById`) | `404 NOT_FOUND` if missing. |
| `/api/v1/roles/:roleId` | `PATCH` | `role.manage` | Body: `{ name?, description?, permissions? }` | Updated `Role` object | Web (`roleApiRepository.updateRolePermissions`) | Writes `ROLE_UPDATED` audit log. |

---

### 2.3 Restaurant Master Data (Branches, Areas, Tables)

| Path | Method | Auth / Perms | QueryParams / Request Body | Response `data` Shape | Consumers | Compatibility Notes / Shims |
|---|---|---|---|---|---|---|
| `/api/v1/branches` | `GET` | `branch.view` or `table.view` or `menu.view` | None | Non-paginated `Branch[]` (filtered by user's `branchIds` unless `OWNER`/`ADMIN`) | Web (`branchApiRepository.getBranches`) | Phase 2 |
| `/api/v1/branches` | `POST` | `branch.manage` | Body: `{ code, name, address?, phone?, gstin?, timezone?, currency?, isActive?, taxConfig?, invoiceConfig? }` | Created `Branch` (`201 Created`) | Admin API | `409 CONFLICT` on duplicate `code`. |
| `/api/v1/branches/:branchId` | `GET` | Authenticated (branch member) | None | `Branch` object (`id, code, name, address, phone, gstin, timezone, currency, taxConfig, invoiceConfig`) | Web (`settingsApiRepository.getSettings`), Mobile (`ApiAuthRepository.fetchBranchSafe`) | **COMPATIBILITY ADDITION:** Both Web and Mobile call `GET /api/v1/branches/:branchId`, which was missing in Django (causing silent 404 fallback). Implementing this in Express enables live branch & settings loading! |
| `/api/v1/branches/:branchId` | `PATCH` | `branch.manage` | Body: `{ name?, address?, phone?, gstin?, taxConfig?, invoiceConfig?, isActive? }` | Updated `Branch` object | Web (`settingsApiRepository.updateSettings`) | **COMPATIBILITY ADDITION:** Enables Web Settings page to persist restaurant/branch/tax/invoice settings to MongoDB. |
| `/api/v1/areas` | `GET` | `area.view` or `table.view` | Query: `branchId` (default `branch-main`), `isActiveOnly?` | Non-paginated `Area[]` sorted by `sortOrder, name` | Web (`branchApiRepository.getAreas`), Mobile (`ServiceRepository.fetchTablesAndOrders`, `resolveAreaName`) | Checks branch access (`ensure_branch_access`). |
| `/api/v1/areas` | `POST` | `area.manage` | Body: `{ branchId, name, sortOrder?: int, isActive?: bool }` | Created `Area` (`201 Created`) | Web (`branchApiRepository.createArea`) | Writes `AREA_CREATED` audit log. |
| `/api/v1/areas/:areaId` | `PATCH` | `area.manage` | Body: `{ name?, sortOrder?, isActive? }` | Updated `Area` | Web (`branchApiRepository.updateArea`, `toggleAreaStatus`) | Writes `AREA_UPDATED` audit log. |
| `/api/v1/tables` | `GET` | `table.view` | Query: `branchId` (default `branch-main`), `areaId?`, `status?`, `isActive?` | Non-paginated `Table[]` sorted by `tableNumber` | Web (`tableApiRepository.getTables`), Mobile (`ServiceRepository.fetchTablesAndOrders`) | Supports both `isActive=true` and `areaId`. |
| `/api/v1/tables` | `POST` | `table.manage` | Body: `{ branchId, areaId, tableNumber, capacity: int, status?: "AVAILABLE", isActive?: bool }` | Created `Table` (`201 Created`) | Web (`tableApiRepository.createTable`) | `409 CONFLICT` on duplicate `(branchId, tableNumber)`. |
| `/api/v1/tables/:tableId` | `GET` | `table.view` | None | `Table` object (`id, branchId, areaId, tableNumber, capacity, status, activeOrderId, isActive`) | Web (`tableApiRepository.getTableById`), Mobile (`ServiceRepository.openTableOrder`) | Supports `tbl-XX` <-> `table-XX` ID alias lookup. |
| `/api/v1/tables/:tableId` | `PATCH` | `table.manage` | Body: `{ areaId?, tableNumber?, capacity?, status?, isActive?, activeOrderId? }` | Updated `Table` | Web (`tableApiRepository.updateTable`, `toggleTableActive`) | Validates duplicate `tableNumber` if changed. |

---

### 2.4 Menu Categories, Products & Price History

| Path | Method | Auth / Perms | QueryParams / Request Body | Response `data` Shape | Consumers | Compatibility Notes / Shims |
|---|---|---|---|---|---|---|
| `/api/v1/menu/categories` | `GET` | `menu.view` | Query: `branchId` (default `branch-main`), `isActiveOnly?` | Non-paginated `Category[]` sorted by `sortOrder, name` | Web (`categoryApiRepository.getCategories`), Mobile (`MenuRepository.getCatalog`) | Phase 2 |
| `/api/v1/menu/categories` | `POST` | `menu.manage` | Body: `{ branchId?: "branch-main", code?, name, description?, sortOrder?, isActive? }` | Created `Category` (`201 Created`) | Web (`categoryApiRepository.createCategory`) | **SHIM:** Web `categoryApiRepository.createCategory` omits `branchId` in body; default `branchId` to `"branch-main"` (or user's primary branch) when omitted! |
| `/api/v1/menu/categories/:categoryId` | `GET` | `menu.view` | None | `Category` object | Web (`categoryApiRepository.getCategoryById`) | `404 NOT_FOUND` if missing. |
| `/api/v1/menu/categories/:categoryId` | `PATCH` | `menu.manage` | Body: `{ code?, name?, description?, sortOrder?, isActive? }` | Updated `Category` | Web (`categoryApiRepository.updateCategory`, `toggleCategoryStatus`) | Writes `CATEGORY_UPDATED` audit log. |
| `/api/v1/menu/products` | `GET` | `menu.view` | Query: `branchId` (default `branch-main`), `categoryId?`, `isActive?`, `available?`, `isAvailableOnly?`, `search?`, `page?`, `limit?` | Paginated: `{ items: Product[], pagination: {...} }` | Web (`productApiRepository.getProducts`), Mobile (`MenuRepository.getCatalog`) | Supports `isAvailableOnly=true` (sets `isActive=true, available=true`) as well as separate `isActive` and `available` query params. |
| `/api/v1/menu/products` | `POST` | `menu.manage` | Body: `{ branchId?: "branch-main", categoryId, code?, name, description?, price: DecimalStr, currency?: "INR", taxConfig?: { rate, mode }, available?: bool, kitchenStation?: string, sortOrder?: int, isActive?: bool }` | Created `Product` (`201 Created`) with `currentPrice` set to `"<price>"` | Web (`productApiRepository.createProduct`) | **SHIM:** Default `branchId` to `"branch-main"` if omitted by Web `productApiRepository.createProduct`. Writes initial `price_history` entry (`oldPrice: null, newPrice: currentPrice, reason: "Initial product creation"`). |
| `/api/v1/menu/products/:productId` | `GET` | `menu.view` | None | `Product` object | Web (`productApiRepository.getProductById`) | `404 NOT_FOUND` if missing. |
| `/api/v1/menu/products/:productId` | `PATCH` | `menu.manage` | Body: `{ categoryId?, code?, name?, description?, taxConfig?, available?, kitchenStation?, sortOrder?, isActive? }` | Updated `Product` | Web (`productApiRepository.updateProduct`, `toggleProductAvailability`) | Does not overwrite `currentPrice` (price changes go through `/price`). |
| `/api/v1/menu/products/:productId/activate` | `POST` | `menu.manage` | Body: `{}` | Updated `Product` (`isActive: true`) | Web (`productApiRepository.toggleProductStatus`) | Writes `PRODUCT_ACTIVATED` audit log. |
| `/api/v1/menu/products/:productId/deactivate` | `POST` | `menu.manage` | Body: `{}` | Updated `Product` (`isActive: false`) | Web (`productApiRepository.toggleProductStatus`) | Writes `PRODUCT_DEACTIVATED` audit log. |
| `/api/v1/menu/products/:productId/price` | `POST` | `menu.price_change` | Body: `{ price?: DecimalStr, newPrice?: DecimalStr, reason: string }` | Updated `Product` object | Web (`productApiRepository.updateProduct`, `recordPriceChange`) | **CRITICAL SHIM:** Django serializer expected `price`, whereas Web `productApiRepository.js` sends `newPrice`. Express validator must accept `price ?? newPrice`! Writes immutable `price_history` and `PRODUCT_PRICE_CHANGED` audit log. |
| `/api/v1/menu/products/:productId/price-history` | `GET` | `menu.view` | None | Non-paginated `PriceHistoryEntry[]` sorted by `changedAt DESC` | Web (`productApiRepository.getPriceHistory`) | Each entry has `id, productId, branchId, oldPrice, newPrice, reason, changedByUserId, changedByName, changedAt`. |

---

### 2.5 Orders & Reception Confirmation

| Path | Method | Auth / Perms | QueryParams / Request Body | Response `data` Shape | Consumers | Compatibility Notes / Shims |
|---|---|---|---|---|---|---|
| `/api/v1/orders` | `GET` | `order.view` | Query: `branchId`, `status?` (comma-separated supported), `tableId?`, `captainId?`, `page?`, `limit?` | Paginated: `{ items: Order[], pagination: {...} }` | Web (`orderApiRepository.getOrders`), Mobile (`ServiceRepository.fetchTablesAndOrders`, `openTableOrder`) | Supports comma-separated `status=SERVED,READY,BILLING,KOT_SENT,PREPARING` for Billing Pending Settlement queue. Also maps `BILLING` alias to `BILL_PENDING` if queried! |
| `/api/v1/orders` | `POST` | `order.create` | Body: `{ branchId, tableId?, customerId?, items: [{ productId, quantity, note? }], notes?, held?: bool, submitImmediately?: bool }` | Created `Order` (`201 Created`) | Web (`orderApiRepository.createOrder`), Mobile (`OrderRepository.holdOrder`, `submitOrder`) | Captures product snapshot (`productName`, `unitPrice`, `taxConfig`, `lineSubtotal`, `lineTotal`). Sets status `HOLD` if `held`, `WAITING_CONFIRMATION` if `submitImmediately`, else `DRAFT`. Occupies table (`ORDER_IN_PROGRESS`, `activeOrderId`). Rejects if table already has active order (`409 CONFLICT`). |
| `/api/v1/orders/:orderId` | `GET` | `order.view` | None | `Order` object | Web (`orderApiRepository.getOrderById`), Mobile (`ServiceRepository.openTableOrder`) | `404 NOT_FOUND` if missing. |
| `/api/v1/orders/:orderId/items` | `POST` | `order.modify` or `order.create` | Body: `{ items: [{ productId, quantity, note? }], reason?: string }` | `{ order: Order, modificationKot: KOT | null }` | Web (`orderApiRepository.modifyOrderItems`), Mobile (`OrderRepository.holdOrder`, `submitOrder`) | If order is in `CONFIRMED`, `KOT_SENT`, `PREPARING`, `READY`, or `SERVED`, automatically creates a `MODIFICATION` KOT (Revision $N+1$) and notifies `KITCHEN`! Rejects if order is `COMPLETED`/`CANCELLED`/`REJECTED`/`BILL_PENDING` (`409 INVALID_STATE`). |
| `/api/v1/orders/:orderId/hold` | `POST` | `order.hold` | Body: `{ reason?: string }` | Updated `Order` (`status: "HOLD"`, `held: true`) | Mobile (`OrderRepository.holdOrder`) | Allowed from `DRAFT` or `HOLD` (idempotent). |
| `/api/v1/orders/:orderId/resume` | `POST` | `order.resume` | Body: `{}` | Updated `Order` (`status: "DRAFT"`, `held: false`) | Mobile (`OrderRepository.holdOrder`, `resumeOrder`, `submitOrder`) | Allowed from `HOLD` or `DRAFT` (idempotent). |
| `/api/v1/orders/:orderId/submit` | `POST` | `order.submit` | Body: `{}` | Updated `Order` (`status: "WAITING_CONFIRMATION"`) | Web (`orderApiRepository.submitOrder`), Mobile (`OrderRepository.submitOrder`) | Idempotent if already `WAITING_CONFIRMATION`. Creates `ORDER_SUBMITTED` notification for `RECEPTION`. |
| `/api/v1/orders/:orderId/confirm` | `POST` | `order.confirm` | Body: `{}` | `{ order: Order, kot: KOT }` | Web (`orderApiRepository.confirmOrder`) | Transitions `WAITING_CONFIRMATION -> KOT_SENT`, generates initial `NEW` KOT (Revision 1), updates table status to `KOT_SENT`, notifies `KITCHEN` and `CAPTAIN`. Idempotent if already confirmed. |
| `/api/v1/orders/:orderId/reject` | `POST` | `order.reject` | Body: `{ reason: string }` | Updated `Order` (`status: "REJECTED"`) | Web (`orderApiRepository.rejectOrder`) | Requires `WAITING_CONFIRMATION`. Releases table (`AVAILABLE`, `activeOrderId: null`), notifies Captain (`ORDER_REJECTED`). |
| `/api/v1/orders/:orderId/cancel` | `POST` | `order.cancel` | Body: `{ reason: string }` | Updated `Order` (`status: "CANCELLED"`) | Web (`orderApiRepository.cancelOrder`) | Allowed before `COMPLETED`. Marks all active items `CANCELLED`, creates `CANCELLATION` KOT if order was confirmed, releases table (`AVAILABLE`, `activeOrderId: null`). |
| `/api/v1/orders/:orderId/cancel-item` | `POST` | `order.cancel` | Body: `{ itemId: string, reason: string }` | `{ order: Order, cancellationKot: KOT | null }` | Admin / Reception API | Marks item `CANCELLED`, recalculates order financials, creates `CANCELLATION` KOT if order had KOTs. |
| `/api/v1/orders/:orderId/events` | `GET` | `order.view` | None | Non-paginated `OrderEvent[]` sorted by `createdAt ASC` | Order timeline | Immutable event log per order. |
| `/api/v1/orders/history` | `GET` | `order.view`, `order.confirm`, `report.view`, `billing.generate` | Query: `branchId`, `dateFrom?`, `dateTo?`, `month?` (`YYYY-MM`), `customerId?`, `categoryId?`, `status?`, `search?`, `page?`, `limit?` | `{ summary: { totalOrders, totalSales, totalSubtotal, totalTax, totalDiscount, totalItemsSold, averageOrderValue, dateFrom, dateTo }, categoryBreakdown: [...], dailyBreakdown: [...], orders: [...], pagination: {...} }` | Web (`orderApiRepository.getOrderHistory`, `OrderHistoryPage`) | Filters orders by Date/Month range, Customer, Category, or Status with category-level breakdowns and range sales metrics. |

---

### 2.6 KOT & Kitchen Management

| Path | Method | Auth / Perms | QueryParams / Request Body | Response `data` Shape | Consumers | Compatibility Notes / Shims |
|---|---|---|---|---|---|---|
| `/api/v1/kots` | `GET` | `kot.view` | Query: `branchId`, `orderId?`, `status?`, `kitchenStation?`, `page?`, `limit?` | Paginated: `{ items: KOT[], pagination: {...} }` | Web (`kotApiRepository.getKOTs`), Mobile (`KotRepository.getQueue`) | Mobile queries `status=READY&limit=20` and `status=CANCELLED&limit=10`. |
| `/api/v1/kots/:kotId` | `GET` | `kot.view` | None | `KOT` object | Web (`kotApiRepository.getKOTById`), Mobile (`KotRepository.getById`) | `404 NOT_FOUND` if missing. |
| `/api/v1/kots/:kotId/status` | `POST` | `kitchen.update` or `kot.manage` | Body: `{ status: "PREPARING" | "READY" | "SERVED" | "CANCELLED", notes?: string }` | Updated `KOT` object | Web (`kotApiRepository.updateKOTStatus`, `orderApiRepository.markAsServed`), Mobile (`KotRepository.updateStatus`) | Validates transitions (`NEW -> PREPARING -> READY -> SERVED`). Synchronizes parent `order.status` and `table.status` (`PREPARING`, `READY`, `SERVED`) and creates `KOT_READY` notification for Captain when transitioning to `READY`. |
| `/api/v1/kots/:kotId/print` | `GET` | `kot.view` | None | `{ kotId, kotNumber, type, revision, status, orderId, orderNumber, tableNumber, captainName, kitchenStation, items, notes, printStatus, createdAt, printedAt }` | Web (`kotApiRepository.getPrintPayload`) | Read-only print payload; does not mutate state. |
| `/api/v1/kots/:kotId/print-status` | `POST` | `kot.view` or `kot.manage` | Body: `{ printStatus: "PENDING" | "PRINTED" | "FAILED" }` | Updated `KOT` object | Web (`kotApiRepository.updatePrintStatus`) | Updates `printStatus` and `printedAt`. |
| `/api/v1/kitchen/queue` | `GET` | `kot.view` or `kitchen.update` | Query: `branchId` (default `branch-main`), `kitchenStation?` | Non-paginated `KOT[]` (`status in ["NEW", "PREPARING"]`) sorted by `createdAt ASC` with computed `elapsedMinutes: int` | Web, Mobile (`KotRepository.getQueue`) | Computes `elapsedMinutes = floor((now - createdAt) / 60s)`. |

---

### 2.7 Billing, Discounts & Payments

| Path | Method | Auth / Perms | QueryParams / Request Body | Response `data` Shape | Consumers | Compatibility Notes / Shims |
|---|---|---|---|---|---|---|
| `/api/v1/bills` | `GET` | `billing.view` | Query: `branchId`, `status?`, `orderId?`, `page?`, `limit?` | Paginated: `{ items: Bill[], pagination: {...} }` | Web (`billApiRepository.getBills`) | Phase 4 |
| `/api/v1/bills/:billId` | `GET` | `billing.view` | None | `Bill` object | Web (`billApiRepository.getBillById`) | Includes embedded `items`, `discount`, `taxBreakdown`, `payments`, `cgst`, `sgst`, `taxableAmount`, `grandTotal`, `paidAmount`, `balanceAmount`. |
| `/api/v1/orders/:orderId/bill` | `POST` | `billing.create` | Body: `{ discount?: { type: "FIXED" | "PERCENTAGE", value: DecimalStr, reason?: string } }` | `Bill` object (`200 OK`) | Web (`billApiRepository.generateBill`) | Idempotent: if a bill already exists for `orderId` and is `PAYMENT_PENDING` or `PARTIALLY_PAID`, recalculates and updates it; if `COMPLETED`/`PAID`, returns existing bill. Transitions order & table status to `BILL_PENDING`. |
| `/api/v1/bills/:billId/discount` | `POST` | `discount.apply` | Body: `{ type: "FIXED" | "PERCENTAGE", value: DecimalStr, reason: string }` | Updated `Bill` object | Web (`billApiRepository.generateBill`) | If `type === "PERCENTAGE"` and `value > 20`, requires `discount.approve` permission (`403 PERMISSION_DENIED` otherwise). Inserts into `discounts` collection and recalculates bill totals. |
| `/api/v1/bills/:billId/print` | `GET` | `billing.print` or `billing.view` | None | `{ billId, billNumber, orderId, orderNumber, tableNumber, items, subtotal, discount, taxableAmount, tax, cgst, sgst, taxBreakdown, rounding, grandTotal, paidAmount, balanceAmount, payments, status, generatedAt }` | Web (`billApiRepository.getPrintPayload`) | Read-only print payload; never settles bill or records payment. |
| `/api/v1/bills/:billId/payments` | `GET` | `billing.view` or `payment.record` | None | Non-paginated `Payment[]` sorted by `createdAt ASC` | Web / API | Returns all recorded payments for the bill. |
| `/api/v1/bills/:billId/payments` | `POST` | `payment.record` | Body: `{ mode: "CASH" | "UPI" | "CARD" | "OTHER", amount: DecimalStr, referenceNumber?: string, notes?: string, idempotencyKey?: string }` | `{ payment: Payment, bill: Bill, isDuplicate: boolean }` (`201` if new, `200` if duplicate `idempotencyKey`) | Web (`billApiRepository.addPayment`) | Rejects if `amount > balanceAmount` (`400 VALIDATION_ERROR`). Updates `paidAmount`, `balanceAmount`, and sets `bill.status` to `PAID` when `balanceAmount == 0.00` or `PARTIALLY_PAID` otherwise. |
| `/api/v1/bills/:billId/close` | `POST` | `billing.close` | Body: `{}` | Updated `Bill` (`status: "COMPLETED"`) | Web (`billApiRepository.addPayment`, `closeBill`) | Rejects if `balanceAmount > 0` (`409 INVALID_STATE`). Transitions `bill.status -> COMPLETED`, `order.status -> COMPLETED`, releases table (`status: "AVAILABLE"`, `activeOrderId: null`), and increments customer `totalVisits` (+1) and `totalSpend` (+grandTotal). Idempotent if already `COMPLETED`. |

---

### 2.8 Customers, Reports, Audit & Notifications

| Path | Method | Auth / Perms | QueryParams / Request Body | Response `data` Shape | Consumers | Compatibility Notes / Shims |
|---|---|---|---|---|---|---|
| `/api/v1/customers` | `GET` | `customer.view` | Query: `branchId`, `search?`, `page?`, `limit?` | Paginated: `{ items: Customer[], pagination: {...} }` | Web (`customerApiRepository.getCustomers`) | Searches `name` (regex) and `phone` (regex). |
| `/api/v1/customers` | `POST` | `customer.manage` | Body: `{ branchId, name, phone, email?, address?, notes? }` | `Customer` (`201 Created`) | Web (`customerApiRepository.createCustomer`) | Normalizes phone to 10-digit Indian mobile; upserts existing customer if `(branchId, phone)` already exists! |
| `/api/v1/customers/:customerId` | `GET` | `customer.view` | None | `Customer` object | Web (`customerApiRepository.getCustomerById`) | `404 NOT_FOUND` if missing. |
| `/api/v1/customers/:customerId/orders` | `GET` | `customer.view` | Query: `limit?` (default `50`) | Non-paginated `Order[]` | Customer history | Sorted by `createdAt DESC`. |
| `/api/v1/reports/sales` | `GET` | `report.view` | Query: `branchId`, `dateFrom?`, `dateTo?` | `{ branchId, totalBills, totalSales, totalSubtotal, totalDiscount, totalTax, averageBillValue }` | Web (`reportApiRepository.getSalesReport`) | Aggregates bills in `status in ["PAID", "COMPLETED"]`. **SHIM:** Support full ISO date-time range when `dateTo` is `YYYY-MM-DD` (append `T23:59:59.999Z` when filtering ISO strings so same-day bills are included!). |
| `/api/v1/reports/items` | `GET` | `report.view` | Query: `branchId`, `dateFrom?`, `dateTo?` | Non-paginated `[{ productId, productName, name, quantity, totalRevenue, revenue }]` | Web (`reportApiRepository.getSalesReport`) | Sorted by `quantity DESC`. |
| `/api/v1/reports/captains` | `GET` | `report.view` | Query: `branchId`, `dateFrom?`, `dateTo?` | Non-paginated `[{ captainId, captainName, name, orderCount, ordersCount, totalSales, revenue }]` | Web (`reportApiRepository.getSalesReport`) | Sorted by `totalSales DESC`. |
| `/api/v1/reports/payments` | `GET` | `report.view` | Query: `branchId`, `dateFrom?`, `dateTo?` | Non-paginated `[{ mode, count, totalAmount, amount }]` | Web (`reportApiRepository.getSalesReport`) | Aggregates `payments` collection where `status == "SUCCESS"`. |
| `/api/v1/audit` | `GET` | `audit.view` | Query: `branchId?`, `entityType?`, `entityId?`, `action?`, `actorId?`, `page?`, `limit?` | Paginated: `{ items: AuditLog[], pagination: {...} }` | Web (`auditApiRepository.getAuditLogs`) | **SHIM:** Support `actorId` filter (passed by Web `auditApiRepository.js:21`) mapped to `actorUserId` in MongoDB! |
| `/api/v1/notifications` | `GET` | Authenticated | Query: `branchId`, `unreadOnly?` (`true`/`false`), `limit?` | Non-paginated `Notification[]` | Web (`notificationApiRepository.getNotifications`), Mobile (`realtimeService.fetchUnreadNotifications`, `ServiceRepository.getHomeOverview`) | Filters by user's role codes (`recipientRole`) and `recipientUserId`. |
| `/api/v1/notifications/:notificationId/read` | `POST` | Authenticated | Body: `{}` | Updated `Notification` (`isRead: true`) | Web (`notificationApiRepository.markAsRead`), Mobile (`realtimeService.markNotificationRead`) | Marks notification read with `readAt` timestamp. |
