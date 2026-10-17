# Deployment, Cutover & Rollback Guide — Restaurant POS MERN Stack

## 1. Architecture & Repository Overview

This monorepo (`C:\GTS-POS\restaurant-pos-backend-mern`) contains the complete migrated **MERN Stack** implementation of the Restaurant POS & KOT Management System:

```text
restaurant-pos-backend-mern/
├── AGENTS.md
├── README.md
├── package.json
├── docs/
│   ├── SOURCE_PROJECT_INVENTORY.md
│   ├── MIGRATION_PLAN.md
│   ├── API_COMPATIBILITY_MATRIX.md
│   ├── DATABASE_MIGRATION_PLAN.md
│   ├── MIGRATION_DECISIONS.md
│   └── DEPLOYMENT_AND_CUTOVER_GUIDE.md
├── scripts/
│   ├── init-indexes.js
│   ├── seed-demo-data.js
│   ├── backup-mongodb.js
│   └── restore-mongodb.js
└── apps/
    ├── backend/          # Node.js + Express.js + MongoDB native REST API (default port 8001)
    └── web/              # React 18 + Vite 5 + Tailwind CSS v4 POS Web Frontend (default port 5173)
```

- **Unchanged Mobile Compatibility:** The React Native Captain & Kitchen mobile app (`C:\GTS-POS\restaurant-pos-mobile`) connects directly to `/api/v1/*` with zero code changes required.

---

## 2. Environment Configuration & Security Checklist

### 2.1 Backend Environment (`apps/backend/.env`)

Copy `apps/backend/.env.example` to `apps/backend/.env` and configure:

| Variable | Development Default | Production Recommendation |
|---|---|---|
| `NODE_ENV` | `development` | `production` |
| `PORT` | `8001` | `8001` (or `8000` after Django retirement) |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017` | Replica-set URI with auth & TLS |
| `MONGODB_DATABASE` | `restaurant_pos_mern_dev` | `restaurant_pos_prod` |
| `MONGODB_TEST_DATABASE` | `restaurant_pos_mern_test` | `restaurant_pos_mern_test` |
| `JWT_SECRET` | *(dev placeholder)* | Strong 64-byte random secret (match Django `SECRET_KEY` during dual-run cutover if preserving active sessions) |
| `JWT_ACCESS_EXPIRES_IN` | `43200` (12h) | `43200` (12h shift duration) |
| `JWT_REFRESH_EXPIRES_IN` | `604800` (7d) | `604800` (7d) |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Production Web domain(s) |

> **Database Safety Guardrail:** `apps/backend/src/config/database.js`, `initIndexes.js`, `seedDemoData.js`, and `restoreMongo.js` strictly block destructive writes or index/seed operations against the legacy Django databases (`restaurant_pos_dev` and `restaurant_pos_test`).

### 2.2 Web Frontend Environment (`apps/web/.env`)

Copy `apps/web/.env.example` to `apps/web/.env`:

```ini
VITE_STORAGE_MODE=api
VITE_API_BASE_URL=http://localhost:8001/api/v1
VITE_DEFAULT_BRANCH_ID=branch-main
```

- Setting `VITE_STORAGE_MODE=api` connects all 13 Web repositories to the Express backend via `apiClient.js`.
- Setting `VITE_STORAGE_MODE=local` preserves offline `localStorage` fallback mode for demos or isolated UI testing.

---

## 3. Database Operations (Indexes, Seed, Backup & Restore)

Run from the monorepo root (`C:\GTS-POS\restaurant-pos-backend-mern`):

### 3.1 Initialize MongoDB Indexes (28 Indexes across 19 Collections)
```powershell
npm run db:indexes
```

### 3.2 Seed Demo Master Data (Idempotent)
Seeds `branch-main`, 7 roles, 7 demo users (`owner/owner123`, `admin/admin123`, `manager/manager123`, `reception/reception123`, `cashier/cashier123`, `captain/captain123`, `kitchen/kitchen123`), 3 dining areas, 20 tables (`T-01`..`T-20`), 8 categories, and 21 menu products:
```powershell
npm run db:seed
```

### 3.3 Full Database Snapshot Backup
Exports all 19 collections in canonical Extended JSON (`EJSON`) format with a `manifest.json` summary into `backups/backup_YYYYMMDD_HHMMSS/`:
```powershell
npm run db:backup
# Or specify a custom target directory:
node scripts/backup-mongodb.js --output ./backups/pre_cutover_snapshot
```

### 3.4 Restore Database Snapshot
Restores all collections from a backup directory (compatible with both Django `backup_mongodb.py` and Node `backup-mongodb.js` snapshots):
```powershell
node scripts/restore-mongodb.js ./backups/pre_cutover_snapshot --drop
```

---

## 4. Running & Testing the Stack

### 4.1 Start Backend & Web in Development
```powershell
# Terminal 1: Start Express API on http://localhost:8001
npm run dev:backend

# Terminal 2: Start React/Vite Web App on http://localhost:5173
npm run dev:web
```

### 4.2 Run Automated Backend, Web-Repository & Mobile-Contract Test Suite
Executes all **40 automated tests across 9 suites** against the isolated `restaurant_pos_mern_test` database:
```powershell
npm run test:backend
```

### 4.3 Production Web Build
```powershell
npm run build:web
```
Outputs production static assets into `apps/web/dist/`.

---

## 5. Step-by-Step Cutover Runbook

When ready to cut over from the legacy Django backend (`port 8000`) to the new Express backend:

1. **Pre-Cutover Verification:**
   - Run `npm run test:backend` and `npm run build:web` and confirm `0` failures.
   - Confirm `GET http://127.0.0.1:8001/ready` returns `{"status":"ready","database":"connected"}`.
2. **Maintenance Freeze (2–5 Minutes):**
   - Ensure all active floor bills are settled or paused, and stop incoming writes to the legacy Django backend.
3. **Snapshot Backup of Existing Database:**
   - Export the existing database snapshot to `./backups/cutover_snapshot`.
   - Verify record counts in `./backups/cutover_snapshot/manifest.json`.
4. **Dry-Run Restore & Index Synchronization:**
   - Restore the snapshot into the target MERN database (`node scripts/restore-mongodb.js ./backups/cutover_snapshot`).
   - Run `npm run db:indexes` to ensure all 28 indexes are present.
   - Note: Existing user passwords (`md5$<salt>$<hash>` and `pbkdf2_sha256$<iterations>$<salt>$<hash>`), string `_id`s, `tbl-XX` / `table-XX` table IDs, and `counters` (`ord_MAIN_YYYY`, `kot_MAIN_YYYY`, `bill_MAIN_YYYY`) work natively in Express without transformation.
5. **Switch Traffic (Port / Reverse Proxy / Base URL):**
   - **Option A (Zero-Client-Reconfiguration):** Stop the Django process on port `8000` and start the Express backend with `PORT=8000` (or point Nginx/reverse-proxy upstream to `127.0.0.1:8001`). Both the Web app and the React Native mobile app will immediately talk to Express without changing their configured URL.
   - **Option B (Parallel Port):** Keep Express on `8001` and set `VITE_API_BASE_URL=http://localhost:8001/api/v1` for Web and `EXPO_PUBLIC_API_BASE_URL=http://<LAN_IP>:8001/api/v1` when launching Expo for Mobile.
6. **Post-Cutover Smoke Check:**
   - Log in as `owner`, `captain`, `kitchen`, `reception`, and `cashier`.
   - Verify active tables, menu items, order creation, KOT status transition (`NEW -> PREPARING -> READY -> SERVED`), bill generation, payment recording, bill settlement, and report totals.

---

## 6. Rollback Procedure

Because the Express backend preserves **100% schema and cryptography compatibility** with the source Django backend:
- Collection names (`branches`, `areas`, `tables`, `categories`, `products`, `price_history`, `roles`, `users`, `orders`, `order_events`, `kots`, `notifications`, `bills`, `payments`, `discounts`, `customers`, `audit_logs`, `counters`, `idempotency_keys`) are identical.
- Password hashes (`pbkdf2_sha256$600000$...`) generated by Express are natively verifiable by Django's `PBKDF2PasswordHasher`.
- Sequence counters (`ord_MAIN_YYYY`, `kot_MAIN_YYYY`, `bill_MAIN_YYYY`) use the exact same `_id` keys and integer `seq` increments.

**To Roll Back at Any Point:**
1. Route API traffic back to the Django process on port `8000`.
2. If restoring to the exact pre-cutover state is desired, run the restore utility against `./backups/cutover_snapshot`.
