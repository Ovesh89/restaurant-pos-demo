# Master Data Caching and Intelligent API Refresh Architecture & Implementation Plan

> **Document Version:** 1.0.0  
> **Repository:** `restaurant-pos-backend-mern`  
> **Workspace Context:** Monorepo (`apps/backend` Express.js REST API + `apps/web` React 18 / Vite Web POS)  
> **Safety Notice:** Read-only references (`restaurant-pos-backend`, `restaurant-pos-web`, `restaurant-pos-mobile`) remain untouched. All modifications reside strictly inside `apps/backend` and `apps/web`.

---

## 1. Executive Summary & Objective

In the current Restaurant POS application, screens independently issue HTTP requests for the same datasets on mount (e.g., categories, products, table layouts, kitchen stations, branch settings, tax configurations). When navigating between Table Floor, Order Creation, Billing, Menu Management, and Dashboard:
- Identical endpoints are fetched repeatedly.
- Network bandwidth and server load are wasted.
- Screen transitions display full-page loading spinners instead of instantly rendering available data.
- Duplicate data-fetching, normalization, and state-management code are repeated across components.

The objective of this architectural enhancement is:
$$\text{Fetch Once} \longrightarrow \text{Cache Centrally} \longrightarrow \text{Reuse Across Screens} \longrightarrow \text{Detect Server Changes} \longrightarrow \text{Refresh Only Affected Data}$$

This plan specifies the architecture, data classification, caching policies, persistent storage strategy, server-side revision tracking, cross-tab synchronization, error resilience, and phased implementation.

---

## 2. Source Audit & Architecture Inventory

### 2.1 Web Frontend Audit (`apps/web`)
- **Framework & Build:** React 18.3.1, Vite 5.4.6, Tailwind CSS 3.4.11.
- **Routing:** `react-router-dom` 6.26.2.
- **Current State Management:** 
  - `AuthContext`: Session, permissions, active user token management.
  - `RestaurantContext`: Local branding & branch settings caching via `localStorageAdapter`.
  - Component-level `useState` + `useEffect` fetching patterns in `CategoriesPage`, `ProductsPage`, `TablesPage`, `CreateOrderPage`, `OrdersPage`, `BillingPage`, etc.
- **API Client:** `apps/web/src/services/api/apiClient.js` provides:
  - Base URL resolution (`APP_CONFIG.API_BASE_URL`).
  - Correlation ID tracking (`X-Correlation-ID`).
  - Mutex-queued 401 token refresh.
  - Standard response unwrapping (`{ success: true, data: ... }`).
- **Repositories:** Abstracted repository facade pattern switching dynamically between `api` and `local`:
  - `categoryRepository` / `categoryApiRepository`
  - `productRepository` / `productApiRepository`
  - `tableRepository` / `tableApiRepository`
  - `branchRepository` / `branchApiRepository`
  - `settingsRepository` / `settingsApiRepository`
  - `kitchenStationRepository` / `kitchenStationApiRepository`
  - `userRepository` / `userApiRepository`
  - `roleRepository` / `roleApiRepository`
- **Identified Caching Gap:** No centralized query management exists. Each component mounts, calls the repository, sets `loading = true`, and downloads the full list. No ETag or conditional request validation is conducted.

### 2.2 Backend Audit (`apps/backend`)
- **Runtime & Framework:** Node.js >= 20.0.0, Express 4.21.2, MongoDB 6.12.0.
- **Architecture:** Modular clean architecture:
  $$\text{Route} \longrightarrow \text{Auth/Perms} \longrightarrow \text{Service (Domain Logic)} \longrightarrow \text{Repository (MongoDB)} \longrightarrow \text{Response}$$
- **Write Paths:** All mutations pass through centralized services:
  - `MenuService`: `createCategory`, `updateCategory`, `deleteCategory`, `createProduct`, `updateProduct`, `deleteProduct`, `updateAvailability`, `updatePriceHistory`.
  - `RestaurantService`: `createBranch`, `updateBranch`, `createArea`, `updateArea`, `deleteArea`, `createTable`, `updateTable`, `transferTable`, `createKitchenStation`, `updateKitchenStation`, `deleteKitchenStation`.
  - `IdentityService`: `createUser`, `updateUser`, `deleteUser`, `createRole`, `updateRole`.
- **Identified Freshness Gap:** The backend does not maintain revision sequences or version timestamps for master-data collections. Clients cannot ask "has menu changed since version X?" without downloading the entire payload.

---

## 3. Data Classification & Cache Policies

Data is strictly partitioned into three categories with differentiated caching, persistence, and invalidation rules.

### 3.1 Master Data (Reusable Reference Data)
Master data has a lower mutation frequency and is shared across many POS workflows.

| Resource Key | Backend Collection | Scope | Stale Time (TTL) | Cache Retention (gcTime) | Persistent Storage |
|---|---|---|---:|---:|:---:|
| `branches` | `branches` | Global | 15 mins | 24 hours | IndexedDB |
| `areas` | `areas` | Branch | 10 mins | 24 hours | IndexedDB |
| `tables` (definitions) | `tables` | Branch | 5 mins | 12 hours | IndexedDB |
| `categories` | `categories` | Branch | 15 mins | 24 hours | IndexedDB |
| `products` | `products` | Branch + Filter | 5 mins | 24 hours | IndexedDB |
| `product-detail` | `products` | Product ID | 5 mins | 24 hours | IndexedDB |
| `kitchenStations` | `kitchen_stations` | Branch | 15 mins | 24 hours | IndexedDB |
| `settings` & `branding`| `branches` (settings) | Branch | 15 mins | 24 hours | IndexedDB |
| `roles` & `permissions`| `roles` | Global | 5 mins | 12 hours | IndexedDB |
| `users` | `users` | Branch | 5 mins | 12 hours | In-Memory only |

### 3.2 Operational Data (Live POS Transactional Data)
Operational data changes rapidly and must remain strictly fresh and server-authoritative.

| Resource Key | Scope | Stale Time | Cache Retention | Persistent Storage | Refetch Policy |
|---|---|---:|---:|:---:|---|
| `tableStatus` (live occupancy) | Branch | 15s | 5 mins | No | On window focus + polling |
| `orders` (active queue) | Branch | 15s | 5 mins | No | On window focus + polling |
| `order-detail` | Order ID | 10s | 5 mins | No | On mutation / view |
| `kotQueue` | Branch / Station | 5s | 2 mins | No | Polling (10s) |
| `pendingSettlement` | Branch | 15s | 5 mins | No | On order/bill mutations |
| `bill-detail` | Bill ID | 10s | 5 mins | No | Server authoritative |

### 3.3 Sensitive & Session Data (Strictly Non-Cacheable)
- Passwords, password hashes, reset tokens.
- JWT Access and Refresh tokens (retained exclusively in `tokenStorage` memory/secure storage).
- Payment gateway secrets, card details, UPI transaction secrets.
- PII customer contact history outside explicitly requested orders.
- **Rule:** Sensitive tokens are never written to query caches or IndexedDB master-data caches.

---

## 4. Server-Side Revision Tracking & Version Endpoint

### 4.1 Concept
To prevent browsers from performing wasteful full-collection downloads or polling large endpoints, the Express backend tracks lightweight monotonic revisions per resource and branch.

### 4.2 Revision Storage Model
A dedicated MongoDB collection `master_data_revisions`:
```json
{
  "_id": "rev_branch-main",
  "branchId": "branch-main",
  "branches": 1,
  "areas": 3,
  "tables": 7,
  "categories": 12,
  "products": 34,
  "kitchenStations": 2,
  "settings": 4,
  "roles": 1,
  "users": 5,
  "updatedAt": "2026-11-05T07:50:00.000Z"
}
```

### 4.3 Atomic Revision Increment Helper
`apps/backend/src/modules/meta/revisionService.js`:
```javascript
export async function bumpMasterDataRevision(branchId, resourceType) {
  const db = await getDatabase();
  const branchKey = branchId || 'branch-main';
  await db.collection('master_data_revisions').updateOne(
    { branchId: branchKey },
    {
      $inc: { [resourceType]: 1 },
      $set: { updatedAt: new Date() }
    },
    { upsert: true }
  );
}
```

All write paths in `MenuService`, `RestaurantService`, and `IdentityService` invoke `bumpMasterDataRevision(branchId, resource)`.

### 4.4 Freshness Endpoint
`GET /api/v1/meta/master-data-versions?branchId=:branchId`
- **Access:** Public or Authenticated (lightweight response).
- **Payload:**
```json
{
  "success": true,
  "data": {
    "branchId": "branch-main",
    "versions": {
      "branches": 1,
      "areas": 3,
      "tables": 7,
      "categories": 12,
      "products": 34,
      "kitchenStations": 2,
      "settings": 4,
      "roles": 1,
      "users": 5
    },
    "timestamp": 1730793000000
  }
}
```

### 4.5 ETag / Conditional Requests
Master data list endpoints (`/api/v1/menu/categories`, `/api/v1/menu/products`, etc.) generate an `ETag` based on the resource revision + branch. If the client includes `If-None-Match: "W/<etag>"`, the backend immediately responds with `304 Not Modified`, saving serialization and network payload.

---

## 5. Frontend Centralized Query Architecture (`apps/web`)

```text
┌────────────────────────────────────────────────────────────┐
│                        React UI Screens                    │
│   (TablesPage, ProductsPage, CreateOrderPage, Billing...)  │
└───────────────▲────────────────────────────▲───────────────┘
                │                            │
      useCategories / useProducts   cacheInvalidationService
                │                            │
┌───────────────▼────────────────────────────▼───────────────┐
│              Central TanStack QueryClient                  │
│       - Stale time / gcTime per resource policy            │
│       - Branch & Filter-scoped Query Keys                  │
└───────────────▲────────────────────────────▲───────────────┘
                │                            │
       IndexedDB Persister            HTTP / REST Repos
  (@tanstack/query-async-storage)   (productApiRepo, etc.)
                │                            │
        Browser IndexedDB             Express Backend API
```

### 5.1 Central Query Client (`apps/web/src/config/queryClient.js`)
- Configured with robust defaults:
  - `staleTime`: 5 minutes (overridden per query key).
  - `gcTime`: 24 hours.
  - `refetchOnWindowFocus`: false for master data, true for operational data.
  - `retry`: 2 attempts with exponential backoff; never retry 401/403/404 errors.
  - Safe hydration error recovery.

### 5.2 Consistent Query Keys (`apps/web/src/constants/queryKeys.js`)
Centralized query key builder:
```javascript
export const queryKeys = {
  branches: () => ['branches'],
  branch: (id) => ['branches', 'detail', id],
  areas: (branchId) => ['areas', branchId],
  tables: (branchId, params = {}) => ['tables', branchId, params],
  table: (id) => ['tables', 'detail', id],
  categories: (branchId, includeInactive = false) => ['categories', branchId, { includeInactive }],
  products: (branchId, filters = {}) => ['products', branchId, filters],
  product: (id) => ['products', 'detail', id],
  kitchenStations: (branchId) => ['kitchenStations', branchId],
  settings: (branchId) => ['settings', branchId],
  branding: (branchId) => ['branding', branchId],
  roles: () => ['roles'],
  permissions: () => ['permissions'],
  users: (branchId) => ['users', branchId],
  masterDataVersions: (branchId) => ['meta', 'master-data-versions', branchId],

  // Operational keys
  orders: (branchId, filters = {}) => ['orders', branchId, filters],
  order: (id) => ['orders', 'detail', id],
  kotQueue: (branchId) => ['kot-queue', branchId],
  pendingSettlement: (branchId) => ['pending-settlement', branchId],
};
```

### 5.3 Offline & Corrupted Storage Protection (IndexedDB Persister)
- Persistence configured via `@tanstack/query-async-storage-persister` backed by `idb-keyval`.
- Cache key: `GTS_POS_MASTER_DATA_CACHE_V1`.
- Only allows persistence of approved master-data queries (`branches`, `areas`, `tables`, `categories`, `products`, `kitchenStations`, `settings`).
- Operational queries and user sessions are explicitly denied from persistence.
- Any deserialization or schema mismatch caught safely, resetting corrupt cache without crashing the UI.

---

## 6. Intelligent Background Freshness Verification

```text
Application Launch / Window Focus
               │
               ▼
   Restore Cached Data from IndexedDB
               │
               ▼
   Render UI Instantly (Zero Spinners)
               │
               ▼
   GET /api/v1/meta/master-data-versions?branchId=...
               │
      ┌────────┴────────┐
      ▼                 ▼
Versions Match?    Versions Differ?
      │                 │
      ▼                 ▼
   No-Op          Invalidate only
(Keep Cache)   modified query keys
                        │
                        ▼
               Background fetch & UI update
```

- A hook `useMasterDataFreshness(branchId)` polls the version endpoint every 60 seconds (or immediately on browser tab focus / visibility change).
- If the server version for `products` changes from `34` to `35`, ONLY `['products', branchId]` queries are invalidated and refetched in the background.
- `categories`, `tables`, `settings`, etc. remain untouched in cache.

---

## 7. Mutation-Based Invalidation & Cross-Tab Synchronization

### 7.1 Centralized Invalidation Service (`apps/web/src/services/cache/cacheInvalidationService.js`)
Exposes dedicated domain invalidators:
- `invalidateProducts(branchId, productId)`
- `invalidateCategories(branchId)`
- `invalidateTables(branchId)`
- `invalidateAreas(branchId)`
- `invalidateKitchenStations(branchId)`
- `invalidateSettings(branchId)`
- `invalidateBranches()`
- `invalidateRoles()`
- `invalidateAllMasterData(branchId)`
- `clearOnLogout()`

### 7.2 Cross-Tab Invalidation via BroadcastChannel
- When a manager in Tab A updates a product price:
  1. Mutation succeeds on Express backend.
  2. `cacheInvalidationService.invalidateProducts(branchId)` runs in Tab A.
  3. A message `{ type: 'INVALIDATE', resource: 'products', branchId }` is broadcast to all open POS tabs via `BroadcastChannel('gts_pos_cache_bus')`.
  4. Tab B (e.g. Table Floor or Billing) receives the event and invalidates its product queries, triggering a seamless background refresh.

---

## 8. Branch & Session Isolation

1. **Query Keys Scoped by `branchId`:**
   - Queries incorporate `branchId` in their key (e.g., `['products', 'branch-main', { ... }]`).
   - Switching branches in the UI automatically shifts query subscription to the new branch's cached data, preventing data leakage across branches.
2. **Session Cleanup:**
   - Upon `logout()` in `AuthContext`, `cacheInvalidationService.clearOnLogout()` is triggered.
   - User profile, branch-specific in-memory operational states, and active query subscriptions are purged.

---

## 9. Phased Execution Plan

### Phase 0 — Audit and Design (Complete)
- [x] Read `AGENTS.md` and verify safety rules.
- [x] Audit API client, repository facades, component data-fetching patterns.
- [x] Classify Master Data vs. Operational Data vs. Sensitive Data.
- [x] Audit Express backend write operations and service layer.
- [x] Draft `docs/CACHING_IMPLEMENTATION_PLAN.md`.

### Phase 1 — Centralized Frontend Cache Foundation
- [ ] Install compatible `@tanstack/react-query`, `@tanstack/query-async-storage-persister`, and `idb-keyval` in `apps/web`.
- [ ] Implement `apps/web/src/config/queryClient.js` with production settings.
- [ ] Implement `apps/web/src/constants/queryKeys.js`.
- [ ] Implement `apps/web/src/config/cachePolicies.js`.
- [ ] Implement reusable React Query data hooks (`useCategories`, `useProducts`, `useTables`, `useAreas`, `useBranches`, `useKitchenStations`, `useRestaurantSettings`).
- [ ] Provide `QueryClientProvider` at the root of `apps/web/src/App.jsx`.

### Phase 2 — Server-Side Freshness & Revision Tracking
- [ ] Implement `apps/backend/src/modules/meta/` module:
  - Repository / Service for `master_data_revisions`.
  - Endpoint `GET /api/v1/meta/master-data-versions`.
- [ ] Wire revision increments into write paths:
  - `MenuService`: Category and Product writes.
  - `RestaurantService`: Branch, Area, Kitchen Station, and Table writes.
  - `IdentityService`: Role and User writes.
- [ ] Mount `/api/v1/meta` in `apps/backend/src/app.js`.
- [ ] Add unit and integration tests verifying revision increments on mutations.

### Phase 3 — Persistence, Freshness Polling & Invalidation Service
- [ ] Configure IndexedDB persistence adapter in `queryClient.js` with filter whitelist.
- [ ] Implement `useMasterDataFreshness` hook in `apps/web` with window focus and periodic verification.
- [ ] Implement `cacheInvalidationService.js` with `BroadcastChannel` cross-tab synchronization.
- [ ] Connect master-data mutations in `CategoriesPage`, `ProductsPage`, `TablesPage`, and `RestaurantContext` to the invalidation service.
- [ ] Ensure logout purges sensitive in-memory queries.

### Phase 4 — Verification, Performance Benchmarking & Automated Testing
- [ ] Verify test suite in `apps/backend`.
- [ ] Verify zero regressions in `apps/web` production build (`npm --prefix apps/web run build`).
- [ ] Add automated tests for:
  - Query caching and deduplication.
  - Revision increments upon product/category updates.
  - Version endpoint responses.
  - Stale data background refresh.
- [ ] Deliver execution report and documentation.
