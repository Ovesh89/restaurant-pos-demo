# API_INTEGRATION_MATRIX.md
# Restaurant POS & KOT Management System — Comprehensive API Contract Matrix
**Authoritative Mapping: React Web Local Repositories ↔ Django REST API Backend (MongoDB)**

---

## 1. Overview & Standard Envelope Conventions

All Django backend API endpoints under `/api/v1/` adhere to deterministic response envelopes:

### Success Response Envelope (HTTP 200 / 201)
```json
{
  "success": true,
  "data": {},
  "message": "Operation completed successfully."
}
```

### Error Response Envelope (HTTP 400 / 401 / 403 / 404 / 409 / 500)
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

### Standard HTTP Headers
- `Authorization: Bearer <jwt_access_token>`
- `Content-Type: application/json`
- `X-Correlation-ID: <uuid4>` (Generated or propagated by `CorrelationIdMiddleware`)
- `Idempotency-Key: <unique_key>` (Optional on mutating `POST`/`PUT`/`PATCH` calls; processed by `IdempotencyMiddleware`)

---

## 2. API Contract Matrix

| Feature | Existing Local Repository Method | Backend Endpoint | HTTP Method | Request Body / Query Params | Response Structure (`data`) | Auth | Permission Required | Integration Status & Field Mapping Notes |
|:---|:---|:---|:---|:---|:---|:---|:---|:---|
| **Auth: Login** | `authRepository.login(username, password)` | `/api/v1/auth/login` | `POST` | `{"username": "captain", "password": "..."}` | `{"tokens": {"access": "...", "refresh": "...", "tokenType": "Bearer"}, "user": {"id": "...", "username": "...", "displayName": "...", "mobile": "...", "roleIds": [...], "branchIds": [...]}, "roles": [...], "permissions": [...]}` | Public | None | **Backend Implemented**. Adapter must normalize `user.displayName` $\to$ `user.name`, `tokens.access` $\to$ `token`, and `roles[0].code.toLowerCase()` $\to$ `user.role` to maintain compatibility with existing `AuthContext`. |
| **Auth: Token Refresh** | *(None in local mode)* | `/api/v1/auth/refresh` | `POST` | `{"refresh": "<jwt_refresh_token>"}` | `{"tokens": {"access": "...", "tokenType": "Bearer"}}` | Public | None | **Backend Implemented**. Needed by API client for transparent 401 token refresh. |
| **Auth: Logout** | `authRepository.logout()` | `/api/v1/auth/logout` | `POST` | None | `null` (`message: "Logged out successfully."`) | Bearer | Authenticated | **Backend Implemented**. Clears server session audit and local storage. |
| **Auth: Current Session / Me** | `authRepository.getCurrentSession()` | `/api/v1/me` | `GET` | None | `{"user": {"id": "...", "username": "...", "displayName": "...", "mobile": "...", "roleIds": [...], "branchIds": [...]}, "roles": [...], "permissions": [...]}` | Bearer | Authenticated | **Backend Implemented**. Authoritative server session validation on application mount. |
| **Auth: Update Profile** | `authRepository.updateProfile(userId, data)` | `/api/v1/users/{id}` | `PATCH` | `{"displayName": "...", "mobile": "..."}` | Updated user document | Bearer | Self or `user.manage` | **Backend Implemented** via `users/{id}` endpoint. Maps `profileData.name` $\to$ `displayName`. |
| **Auth: Change Password** | `authRepository.changePassword(userId, old, new)` | `/api/v1/users/{id}` | `PATCH` | `{"password": "<new_password>"}` | Updated user document | Bearer | `user.manage` | **Backend Implemented**. Note: Direct self password change endpoint can use `PATCH /api/v1/users/{id}`. |
| **Users: List Users** | `userRepository.getUsers()` | `/api/v1/users` | `GET` | Query: `branchId`, `roleId`, `isActive`, `search`, `page`, `limit` | `{"items": [UserDoc...], "total": N, "page": 1, "limit": 20, "pages": N}` | Bearer | `user.manage` | **Backend Implemented**. Returns paginated envelope; adapter extracts `items` array and normalizes `displayName` $\to$ `name`. |
| **Users: Get by ID** | `userRepository.getUserById(id)` | `/api/v1/users/{id}` | `GET` | None | Single User document | Bearer | `user.manage` | **Backend Implemented**. |
| **Users: Create User** | `userRepository.createUser(userData, actor)` | `/api/v1/users` | `POST` | `{"username": "...", "password": "...", "displayName": "...", "mobile": "...", "roleIds": [...], "branchIds": [...]}` | Created User document | Bearer | `user.manage` | **Backend Implemented**. Adapter maps `userData.name` $\to$ `displayName` and role string to `roleIds`. |
| **Users: Update User** | `userRepository.updateUser(id, userData, actor)` | `/api/v1/users/{id}` | `PATCH` | `{"displayName": "...", "mobile": "...", "roleIds": [...], "branchIds": [...], "password": "..."}` | Updated User document | Bearer | `user.manage` | **Backend Implemented**. |
| **Users: Toggle Status** | `userRepository.toggleUserStatus(id, actor)` | `/api/v1/users/{id}/activate`<br>`/api/v1/users/{id}/deactivate` | `POST` | None | Updated User document | Bearer | `user.manage` | **Backend Implemented**. Calls `/activate` or `/deactivate` based on current `isActive` flag. |
| **Roles: List Roles** | `roleRepository.getRoles()` | `/api/v1/roles` | `GET` | Query: `isActiveOnly` | `[RoleDoc...]` | Bearer | `role.manage` | **Backend Implemented**. Array of roles with embedded `permissions` array. |
| **Roles: Get by ID** | `roleRepository.getRoleById(id)` | `/api/v1/roles/{id}` | `GET` | None | Single Role document | Bearer | `role.manage` | **Backend Implemented**. |
| **Roles: Update Permissions** | `roleRepository.updateRolePermissions(id, perms)` | `/api/v1/roles/{id}` | `PATCH` | `{"permissions": ["order.create", "order.submit", ...]}` | Updated Role document | Bearer | `role.manage` | **Backend Implemented**. |
| **Branches: List Branches** | `branchRepository.getBranches()` | `/api/v1/branches` | `GET` | Query: `isActiveOnly` | `[BranchDoc...]` | Bearer | Authenticated | **Backend Implemented**. Contains `taxConfig` (gstRate, mode) and `invoiceConfig`. |
| **Branches: Create Branch** | *(Prototyped in local seed)* | `/api/v1/branches` | `POST` | `{"code": "...", "name": "...", "address": "...", "phone": "..."}` | Created Branch document | Bearer | `branch.manage` | **Backend Implemented**. |
| **Areas: List Areas** | `branchRepository.getAreas(branchId)` | `/api/v1/areas` | `GET` | Query: `branchId`, `isActiveOnly` | `[AreaDoc...]` | Bearer | Authenticated | **Backend Implemented**. Sorted by `sortOrder`. |
| **Areas: Create Area** | `branchRepository.createArea(areaData, actor)` | `/api/v1/areas` | `POST` | `{"branchId": "...", "name": "...", "sortOrder": 1}` | Created Area document | Bearer | `table.manage` | **Backend Implemented**. |
| **Areas: Update Area** | `branchRepository.updateArea(id, areaData, actor)` | `/api/v1/areas/{id}` | `PATCH` | `{"name": "...", "sortOrder": 1, "isActive": true}` | Updated Area document | Bearer | `table.manage` | **Backend Implemented**. |
| **Areas: Toggle Status** | `branchRepository.toggleAreaStatus(id, actor)` | `/api/v1/areas/{id}` | `PATCH` | `{"isActive": false}` | Updated Area document | Bearer | `table.manage` | **Backend Implemented**. |
| **Tables: List Tables** | `tableRepository.getTables(branchId, areaId)` | `/api/v1/tables` | `GET` | Query: `branchId`, `areaId`, `status`, `isActive` | `[TableDoc...]` | Bearer | Authenticated | **Backend Implemented**. Adapter normalizes `tableNumber` $\leftrightarrow$ `tableNo` for client components. |
| **Tables: Get Table** | `tableRepository.getTableById(id)` | `/api/v1/tables/{id}` | `GET` | None | Single Table document | Bearer | Authenticated | **Backend Implemented**. Normalizes `tableNumber` $\leftrightarrow$ `tableNo`. |
| **Tables: Create Table** | `tableRepository.createTable(tableData, actor)` | `/api/v1/tables` | `POST` | `{"branchId": "...", "areaId": "...", "tableNumber": "05", "capacity": 4}` | Created Table document | Bearer | `table.manage` | **Backend Implemented**. Maps `tableData.tableNo` $\to$ `tableNumber`. |
| **Tables: Update Table** | `tableRepository.updateTable(id, tableData, actor)` | `/api/v1/tables/{id}` | `PATCH` | `{"tableNumber": "05", "areaId": "...", "capacity": 4}` | Updated Table document | Bearer | `table.manage` | **Backend Implemented**. |
| **Tables: Toggle Active** | `tableRepository.toggleTableActive(id, actor)` | `/api/v1/tables/{id}` | `PATCH` | `{"isActive": false}` | Updated Table document | Bearer | `table.manage` | **Backend Implemented**. |
| **Tables: Transfer Table** | `tableRepository.transferTable(...)` | `/api/v1/tables/transfer` | `POST` | `{"fromTableId": "...", "toTableId": "...", "reason": "..."}` | `{"order": {...}, "fromTable": {...}, "toTable": {...}}` | Bearer | `table.manage`, `order.modify`, `order.create` | **Backend Implemented**. Shifts active order, KOTs, and bills from source to destination table without modifying order items/financials, and releases source table back to `AVAILABLE`. |
| **Tables: Merge Tables** | `tableRepository.mergeTables(...)` | *(None)* | *(None)* | — | — | — | — | **Not Available in Backend API** (Intentionally deferred in specification). Adapter retains local fallback. |
| **Categories: List Categories** | `categoryRepository.getCategories(includeInactive)` | `/api/v1/menu/categories` | `GET` | Query: `isActiveOnly` | `[CategoryDoc...]` | Bearer | Authenticated | **Backend Implemented**. Sorted by `sortOrder`. |
| **Categories: Create Category** | `categoryRepository.createCategory(data, actor)` | `/api/v1/menu/categories` | `POST` | `{"name": "...", "code": "...", "sortOrder": 1}` | Created Category document | Bearer | `menu.edit` | **Backend Implemented**. |
| **Categories: Update Category** | `categoryRepository.updateCategory(id, data, actor)` | `/api/v1/menu/categories/{id}` | `PATCH` | `{"name": "...", "code": "...", "sortOrder": 1, "isActive": true}` | Updated Category document | Bearer | `menu.edit` | **Backend Implemented**. |
| **Categories: Toggle Status** | `categoryRepository.toggleCategoryStatus(id, actor)` | `/api/v1/menu/categories/{id}` | `PATCH` | `{"isActive": false}` | Updated Category document | Bearer | `menu.edit` | **Backend Implemented**. |
| **Products: List Products** | `productRepository.getProducts(filters)` | `/api/v1/menu/products` | `GET` | Query: `categoryId`, `isActiveOnly`, `isAvailableOnly`, `search` | `[ProductDoc...]` | Bearer | Authenticated | **Backend Implemented**. Adapter normalizes numeric `price` (backend returns string Decimal e.g. `"350.00"`) and maps `available` $\leftrightarrow$ `isAvailable`. |
| **Products: Get Product** | `productRepository.getProductById(id)` | `/api/v1/menu/products/{id}` | `GET` | None | Single Product document | Bearer | Authenticated | **Backend Implemented**. |
| **Products: Create Product** | `productRepository.createProduct(data, actor)` | `/api/v1/menu/products` | `POST` | `{"code": "...", "name": "...", "categoryId": "...", "price": "350.00", "kitchenStation": "...", "description": "..."}` | Created Product document | Bearer | `menu.edit` | **Backend Implemented**. Stringifies `price` to 2 decimals. |
| **Products: Update Product** | `productRepository.updateProduct(id, data, actor)` | `/api/v1/menu/products/{id}` | `PATCH` | `{"name": "...", "categoryId": "...", "kitchenStation": "...", "description": "..."}` | Updated Product document | Bearer | `menu.edit` | **Backend Implemented**. Price changes must use dedicated price change endpoint. |
| **Products: Price Change** | `productRepository.recordPriceChange(...)` | `/api/v1/menu/products/{id}/price` | `POST` | `{"newPrice": "380.00", "reason": "Vendor cost increase"}` | `{"product": ProductDoc, "historyEntry": PriceHistoryDoc}` | Bearer | `menu.edit` | **Backend Implemented**. Enforces mandatory non-empty reason and creates immutable audit history. |
| **Products: Price History** | `productRepository.getPriceHistory(productId)` | `/api/v1/menu/products/{id}/price-history` | `GET` | None | `[PriceHistoryDoc...]` | Bearer | `menu.view` | **Backend Implemented**. |
| **Products: Toggle Available** | `productRepository.toggleProductAvailability(id)` | `/api/v1/menu/products/{id}` | `PATCH` | `{"available": false}` | Updated Product document | Bearer | `menu.edit` | **Backend Implemented**. Maps `isAvailable` $\leftrightarrow$ `available`. |
| **Products: Toggle Status** | `productRepository.toggleProductStatus(id)` | `/api/v1/menu/products/{id}/activate`<br>`/api/v1/menu/products/{id}/deactivate` | `POST` | None | Updated Product document | Bearer | `menu.edit` | **Backend Implemented**. |
| **Orders: List Orders** | `orderRepository.getOrders(filters)` | `/api/v1/orders` | `GET` | Query: `branchId`, `status`, `tableId`, `captainId`, `dateFrom`, `dateTo`, `page`, `limit` | `{"items": [OrderDoc...], "total": N, "page": 1, "limit": 20, "pages": N}` | Bearer | Authenticated | **Backend Implemented**. Normalizes `orderNumber` $\leftrightarrow$ `orderNo`, `tableNumber` $\leftrightarrow$ `tableNo`, and calculates `subtotal` from line items if not embedded. |
| **Orders: Get Order** | `orderRepository.getOrderById(id)` | `/api/v1/orders/{id}` | `GET` | None | Single Order document | Bearer | Authenticated | **Backend Implemented**. |
| **Orders: Get Active by Table** | `orderRepository.getActiveOrderByTable(tableId)` | `/api/v1/orders` | `GET` | Query: `tableId={tableId}`, `status=WAITING_CONFIRMATION,CONFIRMED,KOT_SENT,PREPARING,READY,SERVED,BILLING` | `{"items": [OrderDoc...]}` | Bearer | Authenticated | **Backend Implemented**. Adapter selects first non-completed/non-cancelled order. |
| **Orders: Create / Save Order** | `orderRepository.createOrder(params)` | `/api/v1/orders` | `POST` | `{"branchId": "branch-main", "tableId": "...", "customerId": null, "items": [{"productId": "...", "quantity": 2, "note": "..."}], "held": false, "submitImmediately": true}` | Canonical Order document | Bearer | `order.create` | **Backend Implemented**. Takes point-in-time price snapshot. Server assigns `orderNumber` (`ORD-YYYY-XXXXXX`). Supports `Idempotency-Key`. |
| **Orders: Submit Order** | `orderRepository.submitOrder(orderId, actor)` | `/api/v1/orders/{id}/submit` | `POST` | `{}` | Order document (`status: WAITING_CONFIRMATION`) | Bearer | `order.submit` or `order.create` | **Backend Implemented**. Enforces state machine transition from `DRAFT`/`HOLD`. |
| **Orders: Hold Order** | `orderRepository.createOrder({isDraft: true})` | `/api/v1/orders/{id}/hold` | `POST` | `{}` | Order document (`held: true`) | Bearer | `order.modify` or `order.create` | **Backend Implemented**. |
| **Orders: Resume Order** | `orderRepository.submitOrder(...)` | `/api/v1/orders/{id}/resume` | `POST` | `{}` | Order document (`held: false`) | Bearer | `order.modify` or `order.create` | **Backend Implemented**. |
| **Orders: Confirm Order** | `orderRepository.confirmOrder(orderId, actor)` | `/api/v1/orders/{id}/confirm` | `POST` | `{}` | `{"order": OrderDoc, "kot": KOTDoc}` | Bearer | `order.confirm` | **Backend Implemented**. Idempotently confirms order, issues Initial KOT Rev 1, transitions table to `KOT_SENT`. |
| **Orders: Reject Order** | `orderRepository.rejectOrder(orderId, reason)` | `/api/v1/orders/{id}/reject` | `POST` | `{"reason": "Guest canceled order"}` | Order document (`status: REJECTED`) | Bearer | `order.confirm` | **Backend Implemented**. Releases table to `AVAILABLE`, logs rejection audit trail. |
| **Orders: Modify Items** | `orderRepository.modifyOrderItems(id, items, reason)` | `/api/v1/orders/{id}/items` | `POST` | `{"items": [{"productId": "...", "quantity": 1, "note": "..."}], "reason": "Added drinks"}` | `{"order": OrderDoc, "kot": KOTDoc}` | Bearer | `order.modify` or `order.create` | **Backend Implemented**. Computes delta lines and creates revision increment KOT ticket. |
| **Orders: Cancel Order** | `orderRepository.cancelOrder(orderId, reason, actor)` | `/api/v1/orders/{id}/cancel` | `POST` | `{"reason": "Party walked out"}` | Order document (`status: CANCELLED`) | Bearer | `order.cancel` | **Backend Implemented**. Generates cancellation KOT ticket, releases table to `AVAILABLE`. |
| **Orders: Get Order Events** | *(Local order events array)* | `/api/v1/orders/{id}/events` | `GET` | None | `[OrderEventDoc...]` | Bearer | Authenticated | **Backend Implemented**. Immutable transition audit history. |
| **KOT: List KOTs** | `kotRepository.getKOTs(filters)` | `/api/v1/kots` | `GET` | Query: `branchId`, `orderId`, `status`, `type`, `station` | `[KOTDoc...]` | Bearer | `kot.view` | **Backend Implemented**. Adapter normalizes `kotNumber` $\leftrightarrow$ `kotNo`. |
| **KOT: Get KOT** | `kotRepository.getKOTById(id)` | `/api/v1/kots/{id}` | `GET` | None | Single KOT document | Bearer | `kot.view` | **Backend Implemented**. |
| **KOT: Thermal Print Payload** | `printService.generateKOTReceiptText()` | `/api/v1/kots/{id}/print` | `GET` | None | `{"kotNumber": "...", "revision": 1, "type": "NEW", "tableNumber": "05", "plainTextReceipt": "..."}` | Bearer | `kot.view` | **Backend Implemented**. Authoritative deterministic ESC/POS receipt layout. |
| **KOT: Update Print Status** | *(Local print status field)* | `/api/v1/kots/{id}/print-status` | `POST` | `{"status": "printed"}` | Updated KOT document | Bearer | `kot.view` | **Backend Implemented**. |
| **Kitchen: Live Queue** | `kotRepository.getKOTs({status: 'NEW'})` | `/api/v1/kitchen/queue` | `GET` | Query: `branchId`, `station`, `status` | `[KitchenQueueItem...]` | Bearer | `kot.view` | **Backend Implemented**. Includes elapsed timer in seconds (`elapsedSeconds`). |
| **Kitchen: Update Status** | `kotRepository.updateKOTStatus(id, status)` | `/api/v1/kots/{id}/status` | `POST` | `{"status": "PREPARING"}` (`"READY"` / `"SERVED"`) | `{"kot": KOTDoc, "order": OrderDoc}` | Bearer | `kitchen.update` | **Backend Implemented**. Synchronizes order and table operational status. |
| **Billing: Generate Bill** | `billRepository.generateBill({order, ...})` | `/api/v1/orders/{id}/bill` | `POST` | `{}` | Bill document (`status: PENDING`, `billNumber: BILL-YYYY-XXXXXX`) | Bearer | `billing.generate` | **Backend Implemented**. Uses exact Decimal calculation engine. Idempotent duplicate prevention. |
| **Billing: List Bills** | `billRepository.getBills(filters)` | `/api/v1/bills` | `GET` | Query: `branchId`, `status`, `tableId`, `orderId`, `page`, `limit` | `{"items": [BillDoc...], "total": N, "page": 1, "limit": 20, "pages": N}` | Bearer | `billing.generate` | **Backend Implemented**. Normalizes `billNumber` $\leftrightarrow$ `billNo`. |
| **Billing: Get Bill** | `billRepository.getBillById(id)` | `/api/v1/bills/{id}` | `GET` | None | Single Bill document | Bearer | `billing.generate` | **Backend Implemented**. |
| **Billing: Apply Discount** | `billRepository.generateBill({discount, ...})` | `/api/v1/bills/{id}/discount` | `POST` | `{"type": "PERCENTAGE", "value": "10.00", "reason": "Manager Privilege"}` | Recalculated Bill document | Bearer | `billing.discount` | **Backend Implemented**. Authoritatively recalculates GST and grand total; logs discount event. |
| **Billing: Add Payment** | `billRepository.addPayment(billId, payment)` | `/api/v1/bills/{id}/payments` | `POST` | `{"mode": "UPI", "amount": "500.00", "referenceNumber": "UPI-12345", "idempotencyKey": "..."}` | `{"payment": PaymentDoc, "bill": BillDoc, "isSettled": false}` | Bearer | `payment.collect` | **Backend Implemented**. Supports multi-tender split payments (Cash, UPI, Card), blocks overpayment, updates outstanding balance. |
| **Billing: List Payments** | *(Local bill.payments array)* | `/api/v1/bills/{id}/payments` | `GET` | None | `[PaymentDoc...]` | Bearer | `payment.collect` | **Backend Implemented**. |
| **Billing: Close Bill** | `billRepository.addPayment(...)` (auto-close) | `/api/v1/bills/{id}/close` | `POST` | `{"notes": "Guest settled in full"}` | Closed Bill document | Bearer | `billing.generate` | **Backend Implemented**. Verifies balance == 0. Transitions bill & order to `COMPLETED`, releases table to `AVAILABLE`. |
| **Billing: Print Payload** | `printService.printBill()` | `/api/v1/bills/{id}/print` | `GET` | None | `{"billNumber": "...", "branchHeader": {...}, "financials": {...}, "plainTextReceipt": "..."}` | Bearer | `billing.generate` | **Backend Implemented**. ESC/POS thermal invoice layout. |
| **Customers: Search / List** | `customerRepository.getCustomers(query)` | `/api/v1/customers` | `GET` | Query: `search` (name or mobile), `page`, `limit` | `{"items": [CustomerDoc...], "total": N, "page": 1, "limit": 20, "pages": N}` | Bearer | `customer.view` | **Backend Implemented**. Phone normalization handles country code and spacing. |
| **Customers: Create** | `customerRepository.createCustomer(data)` | `/api/v1/customers` | `POST` | `{"name": "Rohan", "mobile": "9876543210", "email": "...", "address": "...", "notes": "..."}` | Created Customer document | Bearer | `customer.edit` | **Backend Implemented**. Returns existing customer if phone already registered. |
| **Customers: Get by ID** | `customerRepository.getCustomerById(id)` | `/api/v1/customers/{id}` | `GET` | None | Single Customer document | Bearer | `customer.view` | **Backend Implemented**. |
| **Customers: Update** | *(None in local mode)* | `/api/v1/customers/{id}` | `PATCH` | `{"name": "...", "email": "...", "notes": "..."}` | Updated Customer document | Bearer | `customer.edit` | **Backend Implemented**. |
| **Customers: Order History** | *(None in local mode)* | `/api/v1/customers/{id}/orders` | `GET` | None | `[OrderDoc...]` | Bearer | `customer.view` | **Backend Implemented**. |
| **Reports: Sales Report** | `reportRepository.getSalesReport({start, end})` | `/api/v1/reports/sales` | `GET` | Query: `branchId`, `dateFrom`, `dateTo` | `{"summary": {"totalSales": "...", "totalDiscounts": "...", "totalTaxes": "...", "netSales": "...", "totalOrders": N}, "dailyBreakdown": [...]}` | Bearer | `report.view` | **Backend Implemented**. Backed by native MongoDB aggregation pipelines. Adapter maps fields to client charts. |
| **Reports: Items Report** | *(Calculated in local report repo)* | `/api/v1/reports/items` | `GET` | Query: `branchId`, `categoryId`, `dateFrom`, `dateTo` | `[{"productId": "...", "productName": "...", "totalQuantity": N, "totalRevenue": "..."}]` | Bearer | `report.view` | **Backend Implemented**. High-performance pipeline with `$unwind` on order items. |
| **Reports: Captains Report** | *(Calculated in local report repo)* | `/api/v1/reports/captains` | `GET` | Query: `branchId`, `dateFrom`, `dateTo` | `[{"captainId": "...", "captainName": "...", "ordersCount": N, "totalSales": "..."}]` | Bearer | `report.view` | **Backend Implemented**. |
| **Reports: Payments Report** | *(Calculated in local report repo)* | `/api/v1/reports/payments` | `GET` | Query: `branchId`, `dateFrom`, `dateTo` | `[{"mode": "CASH", "totalAmount": "...", "transactionCount": N}]` | Bearer | `report.view` | **Backend Implemented**. |
| **Reports: Discounts Report** | *(None in local report repo)* | `/api/v1/reports/discounts` | `GET` | Query: `branchId`, `dateFrom`, `dateTo` | `[{"billNumber": "...", "type": "PERCENTAGE", "value": "10.00", "discountAmount": "...", "reason": "...", "appliedBy": "..."}]` | Bearer | `report.view` | **Backend Implemented**. |
| **Reports: Cancellations** | *(None in local report repo)* | `/api/v1/reports/cancellations` | `GET` | Query: `branchId`, `dateFrom`, `dateTo` | `[{"orderNumber": "...", "reason": "...", "cancelledBy": "...", "cancelledAt": "..."}]` | Bearer | `report.view` | **Backend Implemented**. |
| **Audit: List Logs** | `auditRepository.getAuditLogs(filters)` | `/api/v1/audit` | `GET` | Query: `branchId`, `action`, `actorId`, `entityType`, `entityId`, `dateFrom`, `dateTo`, `page`, `limit` | `{"items": [AuditDoc...], "total": N, "page": 1, "limit": 20, "pages": N}` | Bearer | `audit.view` | **Backend Implemented**. Server-side pagination. |
| **Audit: Log Event** | `auditRepository.logEvent(...)` | Server internal | Internal | Server domain services record events automatically | Internal MongoDB `audit_logs` record | Internal | Internal | **Backend Implemented**. Backend services automatically log all mutating domain events. Client direct write is forbidden. |
| **Notifications: List** | *(Local mock / in-memory)* | `/api/v1/notifications` | `GET` | Query: `role`, `unreadOnly` | `[NotificationDoc...]` | Bearer | Authenticated | **Backend Implemented**. Captain alerts on `READY`, Reception alerts on `SUBMITTED`. |
| **Notifications: Mark Read** | *(Local mock / in-memory)* | `/api/v1/notifications/{id}/read` | `POST` | None | Updated Notification document | Bearer | Authenticated | **Backend Implemented**. |
| **Shifts: Workstation Shifts** | `shiftRepository.*` | *(None)* | *(None)* | — | — | — | — | **Not Available in Backend API** (Schema documented, but endpoints deferred). Adapter operates in local persistence mode until Phase 5 backend release. |
| **Settings: App Settings** | `settingsRepository.*` | *(None)* | *(None)* | — | — | — | — | **Not Available in Backend API** (No `/api/v1/settings` endpoint; branch config holds GST and invoice prefix). Adapter persists locally. |

---

## 3. Discrepancy & Field Normalization Summary

To preserve existing React components without rewriting JSX or handlers, the API Repository Adapter layer must perform these exact bidirectional mappings:

| Domain | Client React Expectation | Backend Server Format | Adapter Handling |
|:---|:---|:---|:---|
| **Identity: User Name** | `user.name` | `user.displayName` | Adapter provides both: `{ ...user, name: user.displayName }` |
| **Identity: Role Code** | `user.role` (e.g. `'captain'`) | `user.roleIds: ['role-captain']`, `roles: [{code: 'CAPTAIN'}]` | Adapter derives `role: roles[0]?.code.toLowerCase()` |
| **Identity: Branch ID** | `user.branchId` | `user.branchIds: ['branch-main']` | Adapter provides `branchId: user.branchIds[0] || 'branch-main'` |
| **Identity: Auth Token** | `session.token` | `tokens.access` and `tokens.refresh` | Store both in memory / secure storage; provide `token: tokens.access` |
| **Tables: Number** | `table.tableNo` | `table.tableNumber` | Adapter ensures both `tableNo` and `tableNumber` exist on object |
| **Orders: Number** | `order.orderNo` | `order.orderNumber` | Adapter ensures both `orderNo` and `orderNumber` exist on object |
| **Orders: Table Ref** | `order.tableNo` | `order.tableNumber` | Adapter ensures both `tableNo` and `tableNumber` exist on object |
| **KOT: Number** | `kot.kotNo` | `kot.kotNumber` | Adapter ensures both `kotNo` and `kotNumber` exist on object |
| **Bills: Number** | `bill.billNo` | `bill.billNumber` | Adapter ensures both `billNo` and `billNumber` exist on object |
| **Products: Price Type** | `product.price` (Number `350`) | `product.price` (Decimal string `"350.00"`) | Adapter converts string to `Number(product.price)` for UI math |
| **Products: Availability** | `product.isAvailable` | `product.available` | Adapter ensures both `isAvailable` and `available` are populated |
| **Financial Calculations** | Client components calculate locally | Backend calculates authoritatively | Display backend numbers directly; keep `billingCalculator.js` for instant interactive preview |
| **Collections vs Pagination** | `getUsers()` returns raw array | Backend returns `{"items": [...], "total": N}` | Adapter extracts `.items` array for compatibility |
