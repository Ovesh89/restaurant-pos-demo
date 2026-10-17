# Billing Settlement Queue Debugging & Resolution Guide

## 1. Overview & Problem Description

After integrating the Django REST backend with the React POS web application (`http://localhost:3000/billing`), orders that had already been settled and completed (`COMPLETED`) or rejected (`REJECTED`) continued to appear in the **"Tables Pending Settlement"** section.

### Observed Behavior
1. In **"Tables Pending Settlement"**, the following orders were rendered:
   - `ORD-2026-000020` → `COMPLETED` → Table 02
   - `ORD-2026-000019` → `COMPLETED` → Table 02
   - `ORD-2026-000018` → `REJECTED` → Table 05
   - `ORD-2026-000017` → `COMPLETED` → Table 01
2. In **"Recent Settled Invoices"**, the corresponding paid invoices were already present:
   - `BILL-2026-000007` → `PAID`
   - `BILL-2026-000006` → `PAID`
   - `BILL-2026-000005` → `PAID`
   - `BILL-2026-000004` → `PAID`
3. All tables in MongoDB (`Table 01`, `Table 02`, `Table 05`) were already in status `AVAILABLE` with `activeOrderId: null`.

---

## 2. Root Cause Analysis

### Step 1: Frontend Data Flow Trace
In `src/pages/billing/BillingPage.jsx`:
```javascript
const [orders, bills] = await Promise.all([
  orderRepository.getOrders({
    status: [
      ORDER_STATUS.SERVED,
      ORDER_STATUS.READY,
      ORDER_STATUS.BILLING,
      ORDER_STATUS.KOT_SENT,
      ORDER_STATUS.PREPARING
    ]
  }),
  billRepository.getBills()
]);
setReadyOrders(orders);
setBillsHistory(bills);
```
The caller specifically requested only orders whose status was in `[SERVED, READY, BILLING, KOT_SENT, PREPARING]`. `COMPLETED`, `REJECTED`, and `CANCELLED` were explicitly omitted.

### Step 2: Repository Serialization
In `src/services/repositories/api/orderApiRepository.js`:
```javascript
const params = {
  branchId: filters.branchId || APP_CONFIG.DEFAULT_BRANCH_ID || 'branch-main',
  limit: 100
};
if (filters.status) {
  params.status = Array.isArray(filters.status) ? filters.status.join(',') : filters.status;
}
const res = await apiClient.get('/orders', { params });
```
Here, `params.status` was correctly populated as `"SERVED,READY,BILLING,KOT_SENT,PREPARING"`.

### Step 3: Backend API Readiness
In Django backend `apps/orders/views.py` and `apps/orders/repositories.py`:
```python
if status:
    if "," in status:
        query["status"] = {"$in": [s.strip() for s in status.split(",")]}
    else:
        query["status"] = status
```
The Django backend was already implemented to filter by comma-separated status strings.

### Step 4: The Defect in `apiClient.js`
In `src/services/api/apiClient.js`:
```javascript
async request(endpoint, options = {}) {
  const baseUrl = this.getBaseUrl();
  const isAbsolute = endpoint.startsWith('http://') || endpoint.startsWith('https://');
  const url = isAbsolute ? endpoint : `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  ...
  fetch(url, fetchConfig);
}
```
**`apiClient.request()` never converted `options.params` into a URL query string.**
Because `apiClient` ignored `options.params`, every call:
```javascript
apiClient.get('/orders', { params })
```
was sent over the network as a raw request:
```http
GET /api/v1/orders
```
Without query parameters, Django's query was `{ "branchId": "branch-main" }` with no `status` filter, returning **every order in the database**, including all historical `COMPLETED` and `REJECTED` orders.

This also broke all other repository methods that passed `{ params }`:
- `billApiRepository.getBills({ params })`
- `customerApiRepository.getCustomers({ params })`
- `kotApiRepository.getKOTs({ params })`
- `notificationApiRepository.getNotifications({ params })`
- `reportApiRepository.getSalesReport({ params })`

---

## 3. Investigation of the 409 Conflict

During reproduction, an HTTP `409 Conflict` was noticed for `POST /api/v1/orders/{orderId}/reject`.

### Findings:
1. In Django backend `apps/orders/services.py`:
   ```python
   def reject_order(self, order_id: str, reason: str, actor_id: str, actor_name: str) -> Dict[str, Any]:
       ...
       current_status = order.get("status")
       if current_status != "WAITING_CONFIRMATION":
           raise StateConflictError(f"Cannot reject order in status '{current_status}'.")
   ```
2. When an order is already `REJECTED` (such as `ORD-2026-000018`), any redundant rejection attempt raises `StateConflictError`, which maps to HTTP `409 Conflict`.
3. Because `ORD-2026-000018` was incorrectly displayed in the queue due to missing status filtering, attempting to interact with it triggered invalid state transitions.
4. The 409 Conflict was an expected consequence of attempting an invalid transition on a previously completed/rejected entity.

---

## 4. Fix Implementation

### 1. Unified Query Parameter Serialization in `apiClient.js`
Updated `apiClient.request()` to serialize `options.params` into a valid query string:
```javascript
// src/services/api/apiClient.js
if (options.params) {
  let queryString = '';
  if (options.params instanceof URLSearchParams) {
    queryString = options.params.toString();
  } else if (typeof options.params === 'object') {
    const queryParams = new URLSearchParams();
    Object.entries(options.params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value)) {
          queryParams.append(key, value.join(','));
        } else {
          queryParams.append(key, String(value));
        }
      }
    });
    queryString = queryParams.toString();
  }
  if (queryString) {
    url += (url.includes('?') ? '&' : '?') + queryString;
  }
}
```

### 2. Defense-in-Depth Contract Enforcement in Repositories
Added client-side defensive checks to `orderApiRepository.getOrders()` and `billApiRepository.getBills()` to guarantee that returned arrays strictly adhere to requested filters regardless of backend behavior:
```javascript
// src/services/repositories/api/orderApiRepository.js
if (filters.status) {
  const allowed = Array.isArray(filters.status) ? filters.status : [filters.status];
  list = list.filter((o) => allowed.includes(o.status));
}

if (filters.tableId) {
  list = list.filter((o) => o.tableId === filters.tableId);
}

if (filters.captainId) {
  list = list.filter((o) => o.captainId === filters.captainId);
}
```

### 3. Kitchen State Machine Compliance
Updated `orderApiRepository.markAsServed()` to advance KOT tickets through valid intermediate states (`NEW -> PREPARING -> READY -> SERVED`) without triggering backend `409 StateConflictError`.

---

## 5. Verification & Test Results

### 1. Direct API Parameter Filter Test
Executed against running Django backend (`http://localhost:8000/api/v1`):
- **Without filter**: 4 orders returned (`ORD-2026-000020`, `ORD-2026-000019`, `ORD-2026-000018`, `ORD-2026-000017`).
- **With status filter (`?status=SERVED,READY,BILLING,KOT_SENT,PREPARING`)**: 0 orders returned. Completed and rejected orders are cleanly excluded.

### 2. End-to-End Operational Lifecycle Verification
Executed a full restaurant workflow cycle:
1. Checked initial Table 04 status: `AVAILABLE`.
2. Created order `ORD-2026-000022` on Table 04 (status: `WAITING_CONFIRMATION`).
3. Reception confirmed order (status: `KOT_SENT`).
4. Kitchen processed to served (status: `SERVED`).
5. Query `getOrders({ status: [...] })`: `ORD-2026-000022` correctly appeared in **"Tables Pending Settlement"** (count: 1).
6. Cashier opened checkout, generated bill `BILL-2026-000008` (Grand Total: ₹441.00).
7. Cashier recorded full payment (UPI ₹441.00), bill auto-closed.
8. Query `getOrders({ status: [...] })`: `ORD-2026-000022` **immediately disappeared from "Tables Pending Settlement"** (count: 0).
9. Query `getBills()`: `BILL-2026-000008` appeared in **"Recent Settled Invoices"** with status `PAID`.
10. Query `getTables()`: Table 04 status reset to `AVAILABLE` with `activeOrderId: null`.

### 3. Production Build
Executed `npm run build`:
```bash
vite v5.4.21 building for production...
✓ 1664 modules transformed.
dist/index.html                   0.70 kB │ gzip:   0.47 kB
dist/assets/index-hmTs_WoU.css   40.54 kB │ gzip:   7.08 kB
dist/assets/index-DAk7nDNC.js   473.69 kB │ gzip: 125.64 kB
✓ built in 1m 39s
```
Compilation succeeded with zero errors.
