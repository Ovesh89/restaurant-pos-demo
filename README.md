# Green Garden Pure Veg — Restaurant POS & KOT Demo Application (MERN Stack)

This repository contains the standalone **Demo Application** for the Restaurant POS & KOT Management System, configured as a 100% Pure Vegetarian restaurant with custom demo branding, fresh menu catalog, and isolated demo database.

---

## Key Highlights & Differences from Live Production

1. **Brand Neutrality & Demo Identity**:
   - Zero references to Green Tandoor Se or live ownership.
   - Branded as **Green Garden Pure Veg** (Dining & Banquet).
   - Address: `101, City Centre, Near Central Park, Sector 11, Gandhinagar - 382010`.
   - Contact: `+91 98765 43210` | `info@greengardenveg.demo`.
   - GSTIN: `24AABCG1234F1Z8`.
   - Custom generic demo logos generated for web, dark mode, light mode, receipts, and KOTs.

2. **100% Pure Vegetarian Menu**:
   - All non-veg categories and dishes (mutton, chicken, egg, seafood) removed.
   - 13 Vegetarian categories (Soups, Starters, Tandoor Veg, Paneer Main Course, Sabzi, Kaju Specialties, Dal & Lentils, Rice & Biryani, Tandoori Breads, Chinese & Sizzlers, Salad/Raita/Papad, Desserts, Beverages & Mocktails).
   - 89 realistic pure veg dishes with price history snapshots and kitchen station routing (`MAIN`, `TANDOOR`, `CHINESE`, `BEVERAGES`).

3. **Isolated Live MongoDB Database**:
   - Created on the live MongoDB Atlas cluster: `restaurant_pos_demo`.
   - Test database: `restaurant_pos_demo_test`.
   - Same schema with all 28 indexes across 19 collections.
   - Clean operational state (fresh tables, sequence counters, demo customer profile).

4. **Port Configuration**:
   - **Express API Port:** `8002` (`http://127.0.0.1:8002`) — runs concurrently alongside the live backend on port `8001`.
   - **React POS Web Application:** `http://localhost:5173` (or `5174`).

---

## Quick Start

### 1. Initialize Indexes & Seed Demo Data
```powershell
npm run db:setup
```

### 2. Start Backend & Web Application
```powershell
# Terminal 1: Start Express API on http://127.0.0.1:8002
npm run dev:backend

# Terminal 2: Start React Web App on http://localhost:5173
npm run dev:web
```

### 3. Build Web Application for Production
```powershell
npm run build:web
```

---

## Demo Credentials

All roles and permissions are pre-configured with demo access credentials:

| Role | Username | Password | Display Name |
|---|---|---|---|
| Owner | `owner` | `owner123` | Demo Restaurant Owner |
| Admin | `admin` | `admin123` | Branch Administrator |
| Manager | `manager` | `manager123` | Floor Manager |
| Reception | `reception` | `reception123` | Reception Desk |
| Cashier | `cashier` | `cashier123` | Main Cashier |
| Captain | `captain` | `captain123` | Captain Rahul |
| Kitchen | `kitchen` | `kitchen123` | Head Chef Vikram |

---

## Repository Structure

```text
restaurant-pos-demo/
├── README.md                           # Demo documentation and credentials
├── apps/
│   ├── backend/                        # Node.js + Express REST API (/api/v1/*) on port 8002
│   │   ├── src/
│   │   │   ├── config/
│   │   │   ├── middleware/
│   │   │   ├── modules/
│   │   │   ├── repositories/
│   │   │   ├── scripts/
│   │   │   │   ├── menuData.js         # Pure veg catalog & demo profile
│   │   │   │   └── seedDemoData.js     # Demo DB seeder
│   │   │   └── server.js
│   │   ├── tests/
│   │   ├── package.json
│   │   └── .env                        # Connected to restaurant_pos_demo
│   └── web/                            # React 18 + Vite 5 POS Web Application
│       ├── public/                     # Demo logos & favicon
│       ├── src/                        # UI layouts, pages, printing service
│       └── .env                        # Points to API port 8002
├── scripts/
│   ├── init-indexes.js                 # Idempotent MongoDB index initialization
│   ├── seed-demo-data.js               # Demo DB seeder runner
│   ├── backup-mongodb.js               # Database backup utility
│   └── restore-mongodb.js              # Database restore utility
└── package.json                        # Monorepo root scripts
```
