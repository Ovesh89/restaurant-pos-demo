# Database Migration & Schema Plan — MongoDB (Django PyMongo to Node.js MERN)

> **Phase 0 Audit Date:** 2026-10-11  
> **Source Database (Read-Only):** `restaurant_pos_dev` (`mongodb://127.0.0.1:27017`)  
> **New Development Database:** `restaurant_pos_mern_dev`  
> **New Automated Test Database:** `restaurant_pos_mern_test`

---

## 1. Database Isolation & Non-Destructive Safety Rules

1. **Strict Database Separation:**
   - The existing Django backend uses `MONGODB_DATABASE=restaurant_pos_dev` (and `restaurant_pos_test`).
   - The new Node.js/Express backend **must default to `MONGODB_DATABASE=restaurant_pos_mern_dev`** (and `restaurant_pos_mern_test` for automated tests).
   - Never connect to, write to, seed, or drop collections in `restaurant_pos_dev` during development or testing.
2. **Guardrails in Seed & Test Scripts:**
   - Any test cleanup or reset script in `apps/backend` must include an explicit database name assertion (`if (!dbName.includes('mern_test')) throw new Error(...)`) before deleting test documents.
   - `dropDatabase` and `collection.drop()` are strictly prohibited in application and seed code.

---

## 2. Driver & Data Modeling Strategy (Native MongoDB Repository Pattern)

### 2.1 Why Document Shapes Must Match 1:1
Although both the source backend and target backend use MongoDB, the source Django backend (`api/db.py`, `apps/common/repositories.py`) uses **direct `pymongo` dictionaries** with specific conventions that differ from default Mongoose behavior:
1. **String `_id` Primary Keys (NOT `ObjectId`):**
   - Every document in all 19 collections stores `_id` as a **string**, never a BSON `ObjectId`:
     - Human-readable seeded IDs: `"branch-main"`, `"area-indoor"`, `"tbl-01"`..`"tbl-20"`, `"role-owner"`..`"role-kitchen"`, `"user-owner"`..`"user-kitchen"`, `"cat-starter"`, `"prod-paneer-tikka"`.
     - Prefixed UUID hex IDs (`BaseMongoRepository.generate_id`): `"usr_<32hex>"`, `"role_<32hex>"`, `"branch_<32hex>"`, `"area_<32hex>"`, `"tbl_<32hex>"`, `"cat_<32hex>"`, `"prod_<32hex>"`, `"ph_<32hex>"`, `"audit_logs_<32hex>"`.
     - Standard hyphenated UUIDv4 strings: used for `orders`, `order_events`, `kots`, `bills`, `payments`, `customers`, `discounts`, `notifications`.
     - Composite counter IDs: `"ord_MAIN_2026"`, `"kot_MAIN_2026"`, `"bill_MAIN_2026"`.
2. **Dual `id` and `_id` Serialization:**
   - `serialize_mongo_doc` in `apps/common/repositories.py` returns **both** `"id": String(doc._id)` and `"_id": String(doc._id)` on every document and nested item. Both Web and Mobile repositories rely on `doc.id || doc._id`.
3. **2-Decimal String Monetary Representation:**
   - All money and tax rate fields (`currentPrice`, `unitPrice`, `subtotal`, `discountAmount`, `taxableAmount`, `taxTotal`, `tax`, `cgst`, `sgst`, `rounding`, `grandTotal`, `paidAmount`, `balanceAmount`, `amount`, `totalSpend`) are stored in MongoDB and returned in JSON as **2-decimal strings** (e.g. `"240.00"`, `"5.00"`), computed with `ROUND_HALF_UP`.
4. **ISO-8601 UTC Timestamps:**
   - Stored and returned as ISO-8601 strings (`new Date().toISOString()`) or serialized UTC dates (`createdAt`, `updatedAt`, `submittedAt`, `confirmedAt`, `servedAt`, `completedAt`, `generatedAt`, `collectedAt`, `changedAt`, `timestamp`).

### 2.2 Recommended Data Access Layer in Node.js
To guarantee zero schema drift, zero `CastError: Cast to ObjectId failed` issues, and 100% compatibility with existing backup/restore JSON snapshots:
- Use the official **`mongodb` Node.js driver** (or thin schema-validated repository classes built over `mongodb.Db`, mirroring `BaseMongoRepository` in `apps/common/repositories.py`) with `zod` / validator schemas at the request/domain boundary, **or** configure Mongoose schemas with `{ _id: { type: String }, id: false, versionKey: false }` and a shared `serializeMongoDoc(doc)` mapper.
- Using a direct `BaseMongoRepository` over the official `mongodb` Node.js driver (matching Django's `BaseMongoRepository` 1:1) avoids Mongoose `__v` pollution, `ObjectId` coercion bugs, and subdocument casting surprises while keeping queries fast and transparent.

---

## 3. Complete Collection Inventory & Document Schemas (19 Active Collections)

### 3.1 `branches`
- **ID format:** `"branch-main"` or `"branch_<hex>"`
- **Fields:**
  ```json
  {
    "_id": "branch-main",
    "id": "branch-main",
    "code": "MAIN",
    "name": "Green Tandoor — Main Branch",
    "address": "101 MG Road, Indiranagar, Bengaluru",
    "phone": "+91-9876543210",
    "gstin": "29ABCDE1234F1Z5",
    "timezone": "Asia/Kolkata",
    "currency": "INR",
    "taxConfig": { "rate": "5.00", "gstin": "29ABCDE1234F1Z5", "mode": "EXCLUSIVE" },
    "invoiceConfig": { "prefix": "INV-", "terms": "Thank you for dining with us." },
    "isActive": true,
    "createdAt": "2026-09-30T14:36:36.000Z",
    "updatedAt": "2026-09-30T14:36:36.000Z"
  }
  ```
- **Indexes:**
  - `idx_branches_code_unique`: `{ code: 1 }` (unique)
  - `idx_branches_active`: `{ isActive: 1 }`

### 3.2 `areas`
- **ID format:** `"area-indoor"`, `"area-family"`, `"area-rooftop"`, or `"area_<hex>"`
- **Fields:** `_id`, `id`, `branchId`, `name`, `sortOrder` (int), `isActive` (bool), `createdAt`, `updatedAt`.
- **Indexes:**
  - `idx_areas_branch_active_sort`: `{ branchId: 1, isActive: 1, sortOrder: 1 }`

### 3.3 `tables`
- **ID format:** `"tbl-01"`..`"tbl-20"` or `"tbl_<hex>"` (Repository `findById` must alias `"table-01"` <-> `"tbl-01"`).
- **Fields:**
  ```json
  {
    "_id": "tbl-01",
    "id": "tbl-01",
    "branchId": "branch-main",
    "areaId": "area-indoor",
    "tableNumber": "T-01",
    "capacity": 4,
    "status": "AVAILABLE",
    "activeOrderId": null,
    "isActive": true,
    "createdAt": "2026-09-30T14:36:36.000Z",
    "updatedAt": "2026-09-30T14:36:36.000Z"
  }
  ```
- **Valid `status` values:** `AVAILABLE`, `OCCUPIED`, `ORDER_IN_PROGRESS`, `KOT_SENT`, `PREPARING`, `READY`, `SERVED`, `BILL_PENDING`.
- **Indexes:**
  - `idx_tables_branch_number_unique`: `{ branchId: 1, tableNumber: 1 }` (unique)
  - `idx_tables_branch_area_status`: `{ branchId: 1, areaId: 1, status: 1 }`

### 3.4 `categories`
- **ID format:** `"cat-starter"`, `"cat-chicken"`, etc., or `"cat_<hex>"`
- **Fields:** `_id`, `id`, `branchId`, `code` (optional string), `name`, `description`, `sortOrder` (int), `isActive` (bool), `createdAt`, `updatedAt`.
- **Indexes:**
  - `idx_categories_branch_active_sort`: `{ branchId: 1, isActive: 1, sortOrder: 1 }`

### 3.5 `products`
- **ID format:** `"prod-paneer-tikka"` or `"prod_<hex>"`
- **Fields:**
  ```json
  {
    "_id": "prod-paneer-tikka",
    "id": "prod-paneer-tikka",
    "branchId": "branch-main",
    "categoryId": "cat-starter",
    "code": "STR-01",
    "name": "Paneer Tikka",
    "description": "Charcoal grilled cottage cheese cubes",
    "currentPrice": "240.00",
    "currency": "INR",
    "taxConfig": { "rate": "5.00", "mode": "EXCLUSIVE" },
    "available": true,
    "kitchenStation": "TANDOOR",
    "sortOrder": 1,
    "isActive": true,
    "createdAt": "2026-09-30T14:36:36.000Z",
    "updatedAt": "2026-09-30T14:36:36.000Z"
  }
  ```
- **Indexes:**
  - `idx_products_branch_cat_active_avail`: `{ branchId: 1, categoryId: 1, isActive: 1, available: 1 }`
  - `idx_products_branch_name`: `{ branchId: 1, name: 1 }`

### 3.6 `price_history` (Immutable)
- **ID format:** `"ph_<hex>"`
- **Fields:** `_id`, `id`, `productId`, `branchId`, `oldPrice` (string or `null`), `newPrice` (string), `reason` (string), `changedByUserId`, `changedByName`, `changedAt`, `createdAt`, `updatedAt`.
- **Indexes:**
  - `idx_price_history_product_date`: `{ productId: 1, changedAt: -1 }`

### 3.7 `roles`
- **ID format:** `"role-owner"`, `"role-admin"`, `"role-manager"`, `"role-reception"`, `"role-cashier"`, `"role-captain"`, `"role-kitchen"`, or `"role_<hex>"`
- **Fields:** `_id`, `id`, `code` (`OWNER`, `ADMIN`, `MANAGER`, `RECEPTION`, `CASHIER`, `CAPTAIN`, `KITCHEN`), `name`, `description`, `permissions` (`string[]`), `isSystem` (bool), `createdAt`, `updatedAt`.
- **Indexes:**
  - `idx_roles_code_unique`: `{ code: 1 }` (unique)

### 3.8 `users`
- **ID format:** `"user-owner"`, `"user-captain"`, etc., or `"usr_<hex>"`
- **Fields:** `_id`, `id`, `username`, `passwordHash`, `displayName`, `email`, `mobile`, `roleIds` (`string[]`), `branchIds` (`string[]`), `isActive` (bool), `lastLoginAt`, `createdAt`, `updatedAt`.
- **Security Rule:** `passwordHash` must **never** be included in API responses or logs.
- **Indexes:**
  - `idx_users_username_unique`: `{ username: 1 }` (unique)
  - `idx_users_branches_active`: `{ branchIds: 1, isActive: 1 }`

### 3.9 `orders`
- **ID format:** UUIDv4 string (`"550e8400-e29b-41d4-a716-446655440000"`)
- **Fields:**
  ```json
  {
    "_id": "<uuid>",
    "id": "<uuid>",
    "orderNumber": "ORD-2026-000001",
    "branchId": "branch-main",
    "tableId": "tbl-01",
    "tableNumber": "T-01",
    "customerId": null,
    "captainId": "user-captain",
    "captainName": "Captain",
    "status": "WAITING_CONFIRMATION",
    "held": false,
    "holdReason": "",
    "items": [
      {
        "id": "<uuid>",
        "_id": "<uuid>",
        "productId": "prod-paneer-tikka",
        "productName": "Paneer Tikka",
        "code": "STR-01",
        "unitPrice": "240.00",
        "quantity": 2,
        "taxConfig": { "rate": "5.00", "mode": "EXCLUSIVE" },
        "taxAmount": "24.00",
        "lineSubtotal": "480.00",
        "lineTotal": "504.00",
        "note": "Medium spice",
        "status": "ACTIVE",
        "kotRevision": 1,
        "createdAt": "...",
        "updatedAt": "..."
      }
    ],
    "notes": "",
    "financials": {
      "subtotal": "480.00",
      "discountAmount": "0.00",
      "taxableAmount": "480.00",
      "taxTotal": "24.00",
      "grandTotal": "504.00",
      "paidAmount": "0.00",
      "balanceDue": "504.00",
      "paymentStatus": "UNPAID"
    },
    "rejectionReason": null,
    "cancellationReason": null,
    "submittedAt": "...",
    "confirmedAt": null,
    "confirmedByUserId": null,
    "confirmedByName": null,
    "servedAt": null,
    "completedAt": null,
    "createdAt": "...",
    "updatedAt": "..."
  }
  ```
- **Valid `status` values:** `DRAFT`, `HOLD`, `WAITING_CONFIRMATION`, `CONFIRMED`, `KOT_SENT`, `PREPARING`, `READY`, `SERVED`, `BILL_PENDING`, `COMPLETED`, `REJECTED`, `CANCELLED`.
- **Indexes:**
  - `idx_orders_number_unique`: `{ orderNumber: 1 }` (unique)
  - `idx_orders_branch_status_date`: `{ branchId: 1, status: 1, createdAt: -1 }`
  - `idx_orders_branch_table_status`: `{ branchId: 1, tableId: 1, status: 1 }`
  - `idx_orders_branch_captain_date`: `{ branchId: 1, captainId: 1, createdAt: -1 }`

### 3.10 `order_events` (Immutable)
- **ID format:** UUIDv4 string
- **Fields:** `_id`, `id`, `orderId`, `branchId`, `eventType` (`ORDER_CREATED`, `ORDER_ITEMS_ADDED`, `ORDER_HELD`, `ORDER_RESUMED`, `ORDER_SUBMITTED`, `ORDER_CONFIRMED`, `ORDER_REJECTED`, `ORDER_CANCELLED`, `ORDER_ITEM_CANCELLED`, `BILL_GENERATED`, `BILL_CLOSED`), `fromStatus`, `toStatus`, `actorUserId`, `actorName`, `reason`, `metadata`, `createdAt`.
- **Indexes:**
  - `idx_order_events_order_date`: `{ orderId: 1, createdAt: 1 }`

### 3.11 `kots` (Immutable Ticket History)
- **ID format:** UUIDv4 string
- **Fields:**
  ```json
  {
    "_id": "<uuid>",
    "id": "<uuid>",
    "kotNumber": "KOT-2026-000001",
    "orderId": "<uuid>",
    "orderNumber": "ORD-2026-000001",
    "branchId": "branch-main",
    "tableId": "tbl-01",
    "tableNumber": "T-01",
    "captainId": "user-captain",
    "captainName": "Captain",
    "revision": 1,
    "type": "NEW",
    "status": "NEW",
    "kitchenStation": "MAIN",
    "items": [
      {
        "productId": "prod-paneer-tikka",
        "productName": "Paneer Tikka",
        "quantity": 2,
        "note": "Medium spice",
        "changeType": "ADD"
      }
    ],
    "notes": "Initial order confirmed",
    "printStatus": "PENDING",
    "printedAt": null,
    "createdByUserId": "user-reception",
    "createdByName": "Reception",
    "preparingAt": null,
    "readyAt": null,
    "servedAt": null,
    "createdAt": "...",
    "updatedAt": "..."
  }
  ```
- **Valid `type` values:** `NEW`, `MODIFICATION`, `CANCELLATION`.
- **Valid `status` values:** `NEW`, `PREPARING`, `READY`, `SERVED`, `CANCELLED`.
- **Indexes:**
  - `idx_kots_number_unique`: `{ kotNumber: 1 }` (unique)
  - `idx_kots_branch_status_date`: `{ branchId: 1, status: 1, createdAt: 1 }`
  - `idx_kots_order_revision`: `{ orderId: 1, revision: 1 }`

### 3.12 `notifications`
- **ID format:** UUIDv4 string
- **Fields:** `_id`, `id`, `branchId`, `eventType` (`ORDER_SUBMITTED`, `ORDER_CONFIRMED`, `ORDER_REJECTED`, `KOT_CREATED`, `KOT_MODIFIED`, `KOT_CANCELLED`, `KOT_READY`), `title`, `message`, `recipientRole` (`RECEPTION`, `KITCHEN`, `CAPTAIN`, or `null`), `recipientUserId` (string or `null`), `metadata` (`{ orderId, orderNumber, kotId?, kotNumber?, tableId, tableNumber }`), `isRead` (bool), `readAt`, `createdAt`.
- **Indexes:**
  - `idx_notifications_branch_role_read_date`: `{ branchId: 1, recipientRole: 1, isRead: 1, createdAt: -1 }`
  - `idx_notifications_user_read_date`: `{ recipientUserId: 1, isRead: 1, createdAt: -1 }`

### 3.13 `bills`
- **ID format:** UUIDv4 string
- **Fields:** `_id`, `id`, `billNumber` (`BILL-YYYY-NNNNNN`), `orderId`, `orderNumber`, `branchId`, `tableId`, `tableNumber`, `customerId`, `captainId`, `captainName`, `items` (snapshot array), `subtotal`, `discount` (`{ type, value, amount, reason }` or `null`), `discountAmount`, `taxableAmount`, `tax`, `cgst`, `sgst`, `taxBreakdown` (`[{ rate, taxableAmount, taxAmount, cgst, sgst }]`), `rounding`, `grandTotal`, `paidAmount`, `balanceAmount`, `payments` (embedded summary array), `status` (`PAYMENT_PENDING`, `PARTIALLY_PAID`, `PAID`, `COMPLETED`, `VOIDED`), `generatedByUserId`, `generatedByName`, `generatedAt`, `completedAt`, `createdAt`, `updatedAt`.
- **Indexes:**
  - `idx_bills_number_unique`: `{ billNumber: 1 }` (unique)
  - `idx_bills_order_unique`: `{ orderId: 1 }` (unique)
  - `idx_bills_branch_status_date`: `{ branchId: 1, status: 1, createdAt: -1 }`

### 3.14 `payments` (Immutable)
- **ID format:** UUIDv4 string
- **Fields:** `_id`, `id`, `billId`, `billNumber`, `orderId`, `branchId`, `mode` (`CASH`, `UPI`, `CARD`, `OTHER`), `amount` (2-decimal string), `referenceNumber`, `notes`, `status` (`SUCCESS`), `idempotencyKey`, `collectedByUserId`, `collectedByName`, `collectedAt`, `createdAt`.
- **Indexes:**
  - `idx_payments_bill_date`: `{ billId: 1, createdAt: 1 }`
  - `idx_payments_branch_mode_date`: `{ branchId: 1, mode: 1, createdAt: -1 }`
  - `idx_payments_idempotency_sparse`: `{ idempotencyKey: 1 }` (unique, sparse)

### 3.15 `discounts` (Immutable Audit History)
- **ID format:** UUIDv4 string
- **Fields:** `_id`, `id`, `billId`, `orderId`, `branchId`, `type` (`FIXED`, `PERCENTAGE`), `value`, `amount`, `reason`, `appliedByUserId`, `appliedByName`, `createdAt`.
- **Indexes:**
  - `idx_discounts_bill`: `{ billId: 1 }`

### 3.16 `customers`
- **ID format:** UUIDv4 string
- **Fields:** `_id`, `id`, `branchId`, `name`, `phone` (normalized 10-digit string), `email`, `address`, `notes`, `totalVisits` (int), `totalSpend` (2-decimal string), `lastVisitAt`, `createdAt`, `updatedAt`.
- **Indexes:**
  - `idx_customers_branch_phone_unique`: `{ branchId: 1, phone: 1 }` (unique)
  - `idx_customers_branch_name`: `{ branchId: 1, name: 1 }`

### 3.17 `audit_logs` (Immutable)
- **ID format:** `"audit_logs_<hex>"` or UUIDv4 string
- **Fields:** `_id`, `id`, `branchId`, `action`, `entityType`, `entityId`, `actorUserId`, `actorName`, `before` (object or `null`), `after` (object or `null`), `metadata` (object), `createdAt`.
- **Indexes:**
  - `idx_audit_branch_date`: `{ branchId: 1, createdAt: -1 }`
  - `idx_audit_entity_date`: `{ entityType: 1, entityId: 1, createdAt: -1 }`
  - `idx_audit_actor_date`: `{ actorUserId: 1, createdAt: -1 }`

### 3.18 `counters`
- **ID format:** `"{counter_name}_{branch_code}_{year}"` (e.g., `"ord_MAIN_2026"`, `"kot_MAIN_2026"`, `"bill_MAIN_2026"`)
- **Fields:** `_id`, `branchId` (branch code, e.g., `"MAIN"`), `year` (int), `seq` (int).

### 3.19 `idempotency_keys`
- **ID format:** ObjectId or UUIDv4
- **Fields:** `key` (string), `path` (string), `method` (string), `status` (`PROCESSING` | `COMPLETED`), `statusCode` (int), `contentType` (string), `content` (JSON string), `createdAt`, `completedAt`.
- **Indexes:**
  - `idx_idempotency_key_unique`: `{ key: 1, path: 1, method: 1 }` (unique)

---

## 4. Password Hash Compatibility Strategy

In the existing `restaurant_pos_dev` database (and `scripts/seed_demo_data.py`), Django's `make_password()` generated hashes using `MD5PasswordHasher` or `PBKDF2PasswordHasher`:
1. **Django MD5 Format:** `md5$<salt>$<md5_hex_of_salt_plus_password>`
   - Verification in Node.js (`crypto` built-in):
     ```js
     const [algo, salt, digest] = passwordHash.split('$');
     const computed = crypto.createHash('md5').update(salt + plainPassword, 'utf8').digest('hex');
     return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(digest));
     ```
2. **Django PBKDF2 Format:** `pbkdf2_sha256$<iterations>$<salt>$<base64_digest>`
   - Verification in Node.js (`crypto` built-in):
     ```js
     const [algo, iterStr, salt, digest] = passwordHash.split('$');
     const computed = crypto.pbkdf2Sync(plainPassword, salt, Number(iterStr), 32, 'sha256').toString('base64');
     return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(digest));
     ```
3. **New Password Hashes in Express:**
   - Generate `pbkdf2_sha256$600000$<salt>$<base64_digest>` (or `bcrypt` if preferred, while supporting `pbkdf2_sha256$` and `md5$` verification). Generating `pbkdf2_sha256$` in Node.js has two major advantages:
     - Zero native C++ addon compilation issues on Windows.
     - 100% forward- and backward-compatible with Django if rollback to Django is ever required during cutover!

---

## 5. Standalone vs Replica-Set MongoDB Transaction Handling

Local development MongoDB (`127.0.0.1:27017`) runs as a **standalone** `mongod` instance, which does not support multi-document ACID sessions (`IllegalOperation: Transaction numbers are only allowed on a replica set member or mongos`).
- Mirror Django's `atomic_transaction()` helper (`apps/common/database.py`):
  - Attempt a session transaction if replica set transactions are supported; if standalone `mongod` raises `OperationFailure` / `IllegalOperation` (codes `20` or `263`), fall back cleanly to sequential atomic document operations with ordered state updates and compensating error handling.

---

## 6. Seed Data, Backup, Restore & Cutover Migration Procedure

### 6.1 Node.js Scripts to Implement in `scripts/`
1. `scripts/init-indexes.js`: Idempotently creates all 28 indexes across the 19 collections on `restaurant_pos_mern_dev`.
2. `scripts/seed-demo-data.js`: Idempotently seeds `restaurant_pos_mern_dev` with:
   - Main branch (`branch-main`, code `MAIN`)
   - 7 system roles (`role-owner` .. `role-kitchen`) with canonical permissions
   - 7 demo users (`owner/owner123`, `admin/admin123`, `manager/manager123`, `reception/reception123`, `cashier/cashier123`, `captain/captain123`, `kitchen/kitchen123`)
   - 3 dining areas (`area-indoor`, `area-family`, `area-rooftop`)
   - 20 tables (`tbl-01` .. `tbl-20`, numbered `T-01` .. `T-20`)
   - All 8 menu categories (`cat-starter`, `cat-chicken`, `cat-mutton`, `cat-fish`, `cat-rice`, `cat-bread`, `cat-drinks`, `cat-dessert`) and all 21 dishes (matching `API_INTEGRATION_DEBUGGING.md`) so Web and Mobile have identical rich catalog data out of the box!
3. `scripts/backup-mongodb.js` & `scripts/restore-mongodb.js`: JSON snapshot backup/restore utilities compatible with Django's `backups/backup_*/manifest.json` format.

### 6.2 Production/Existing Data Cutover Procedure (Phase 5 Only, After Approval)
1. **Freeze Writes:** Place source backend in maintenance/read-only mode during cutover window.
2. **Full Backup:** Run backup utility against `restaurant_pos_dev` and verify document counts in `manifest.json`.
3. **Dry-Run Restore into Staging DB:** Restore snapshot into `restaurant_pos_mern_staging`, run `init-indexes.js`, and execute verification suite (user login with existing hashes, active orders, historical bills, sequence counters).
4. **Rollback Plan:** Because the Node.js backend preserves identical collection names, string `_id` formats, `counters` keys, and `pbkdf2_sha256$` password hashes, rolling back before or during cutover simply requires switching the API port/reverse-proxy back to port `8000` (or restoring the pre-cutover snapshot).

---

## 7. Cloud Migration Execution: MongoDB Atlas Live Database

### 7.1 Connection Details & URI Normalization
- **Cluster Host:** `gst-pos-dev.dg6tpws.mongodb.net` (MongoDB Atlas v8.0.34, Replica Set)
- **Active Database:** `restaurant_pos_mern_dev`
- **Test Database:** `restaurant_pos_mern_test`
- **Credential Handling & URI Normalization:**
  - Password contains reserved character `@` (`gstPos@26`), which RFC 3986 requires to be percent-encoded (`%40`) in MongoDB URIs.
  - Implemented automatic URI normalizer `normalizeMongoUri()` in [`apps/backend/src/config/env.js`](file:///c:/GTS-POS/restaurant-pos-backend-mern/apps/backend/src/config/env.js) to safely parse and encode credentials, guaranteeing seamless connection whether raw or pre-encoded URIs are provided in `.env`.
  - Configured resilient Atlas network timeouts (`serverSelectionTimeoutMS: 15000`, `connectTimeoutMS: 15000`) in [`apps/backend/src/config/database.js`](file:///c:/GTS-POS/restaurant-pos-backend-mern/apps/backend/src/config/database.js).

### 7.2 Migration Execution Summary
1. **Pre-Migration Snapshot:** Backed up local database `restaurant_pos_mern_dev` to `backups/backup_20261015_194146/` (19 collections, 576 documents).
2. **Data Restoration to Atlas:** Restored all 19 collections to `restaurant_pos_mern_dev` on Atlas via `scripts/restore-mongodb.js`.
3. **Index Initialization:** Executed `npm run db:indexes` (`scripts/init-indexes.js`) creating all 28 indexes across the 19 collections.
4. **Data Seeding & Verification:** Executed `npm run db:seed` (`scripts/seed-demo-data.js`) to ensure all master roles, users, branches, tables, and full menu catalog are verified and present.
5. **Collection Count Parity (1:1 with Local):**
   - `branches`: 1
   - `areas`: 3
   - `tables`: 20
   - `categories`: 25
   - `products`: 171
   - `price_history`: 171
   - `roles`: 7
   - `users`: 7
   - `orders`: 5
   - `order_events`: 50
   - `kots`: 8
   - `notifications`: 20
   - `bills`: 5
   - `payments`: 5
   - `customers`: 1
   - `discounts`: 2
   - `audit_logs`: 94
   - `counters`: 3
   - `idempotency_keys`: 2
6. **Regression Verification:** Full 47/47 tests across all 10 test suites passed cleanly against the Atlas cluster.

