# API Integration Debugging Report: Products Display on Add New Order Page

## 1. Executive Summary
On the **Add New Order Page** (`/orders/new`), the food catalog failed to render any items, showing `All Menu (0)` and `"No dishes match your filter."`, despite the backend API (`GET /api/v1/menu/products?isAvailableOnly=true`) successfully returning HTTP 200 with 21 active and available products.

---

## 2. Confirmed Root Causes

### Root Cause 1: Paginated Response Envelope Mismatch in `productApiRepository.getProducts`
- **Location:** `src/services/repositories/api/productApiRepository.js`
- **Description:** Central API client (`apiClient.request`) automatically un緻wraps standard API envelopes (`payload.data`). The Django REST API backend wraps list query endpoints inside a paginated structure:
  ```json
  {
    "success": true,
    "data": {
      "items": [ ... 21 products ... ],
      "pagination": {
        "total": 21,
        "page": 1,
        "limit": 50,
        "totalPages": 1,
        "hasNext": false,
        "hasPrev": false
      }
    },
    "message": ""
  }
  ```
- **The Bug:** `productApiRepository.getProducts` executed:
  ```javascript
  const products = await apiClient.get(`/menu/products${queryStr}`);
  let list = Array.isArray(products) ? products : [];
  ```
  Since `products` was an object (`{ items: [...], pagination: {...} }`) rather than an `Array`, `Array.isArray(products)` evaluated to `false`. As a result, `list` was assigned `[]`, instantly discarding all 21 items before normalization or rendering.

### Root Cause 2: Price Field Name Mismatch (`currentPrice` vs `price`)
- **Location:** `src/services/repositories/api/productApiRepository.js` (`normalizeProduct`)
- **Description:** The backend MongoDB document schema stores selling price under `currentPrice` (e.g. `"currentPrice": "210.00"`). `normalizeProduct` was checking:
  ```javascript
  price: Number(prod.price) || 0
  ```
  Since `prod.price` was `undefined`, without fallback to `prod.currentPrice`, even if items had passed through, their prices would have evaluated to `0`, corrupting cart calculations and order line item prices.

### Root Cause 3: Undifferentiated Error & Empty States in `CreateOrderPage.jsx`
- **Location:** `src/pages/orders/CreateOrderPage.jsx`
- **Description:** `CreateOrderPage.jsx` had only a binary condition: `loading ? Loading : filteredProducts.length === 0 ? "No dishes match your filter."`. If data fetch failed or data was missing, users were shown `"No dishes match your filter."` instead of actionable feedback or distinct empty/error states.

---

## 3. Affected Files
1. `src/services/repositories/api/productApiRepository.js`
   - Added robust unwrapping for paginated response envelopes (`response?.items || response?.products || response`).
   - Mapped `price: Number(prod.currentPrice !== undefined ? prod.currentPrice : prod.price) || 0`.
   - Preserved `currentPrice` as string and canonical `id` (`prod.id || prod._id`).
   - Normalized single-product unwrapping across mutations (`getProductById`, `createProduct`, `updateProduct`, `toggleProductAvailability`, `toggleProductStatus`).
   - Defaulted `limit=100` query parameter for full catalog fetching.

2. `src/services/repositories/api/categoryApiRepository.js`
   - Added safe fallback unwrapping for categories envelope (`categories?.items || categories?.categories || categories`).
   - Ensured canonical id mapping (`id: cat.id || cat._id`).

3. `src/pages/orders/CreateOrderPage.jsx`
   - Added `loadError` state to catch and display API load failures with a retry mechanism.
   - Differentiated UI states: Loading, API error, Empty catalog (`products.length === 0`), and Filtered out (`filteredProducts.length === 0`).

---

## 4. API Response Structure (Verified from Live Server)
`GET /api/v1/menu/products?isAvailableOnly=true`
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "_id": "prod_0f889d41719c4fa6ad0ce40b635dfcd0",
        "branchId": "branch-main",
        "categoryId": "cat-starter",
        "code": "STR-09",
        "name": "Hara Bhara Kabab",
        "description": "",
        "currentPrice": "210.00",
        "currency": "INR",
        "taxConfig": {
          "rate": "5.00",
          "mode": "EXCLUSIVE"
        },
        "available": true,
        "kitchenStation": "MAIN",
        "sortOrder": 0,
        "isActive": true,
        "createdAt": "2026-09-30T14:36:36.785646+00:00",
        "updatedAt": "2026-09-30T14:36:36.785646+00:00",
        "id": "prod_0f889d41719c4fa6ad0ce40b635dfcd0"
      }
      // ... 20 additional product items ...
    ],
    "pagination": {
      "total": 21,
      "page": 1,
      "limit": 50,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    }
  },
  "message": ""
}
```

---

## 5. Architectural Alignment (Why the Fix is in the Repository Layer)
Per `AGENTS.md` Sections 5 & 6:
- The UI layer expects a uniform, stable domain model (`Product[]` where each product contains `id`, `name`, `code`, `price`, `categoryId`, `station`, `isAvailable`, `isActive`).
- Adapting API response differences (such as `items` wrappers and `currentPrice` fields) belongs squarely within `ProductApiRepository`, maintaining complete parity with `ProductLocalRepository`.
- No backend code changes or UI rewrites were made.

---

## 6. Verification and Test Results

### 1. Catalog Products Verification (21/21 Dishes Available)
All 21 dishes successfully load, normalize, and display:
- **Starter (cat-starter):** Hara Bhara Kabab (₹210), Chicken Tikka (₹320), Paneer Tikka (₹240), Veg Spring Roll (₹180)
- **Chicken (cat-chicken):** Butter Chicken (₹380), Chicken Dum Biryani (₹340), Chicken Kadhai (₹360)
- **Mutton (cat-mutton):** Mutton Raan (₹650), Mutton Rogan Josh (₹460)
- **Fish (cat-fish):** Goan Fish Curry (₹420), Surmai Fish Fry (₹380)
- **Rice (cat-rice):** Jeera Rice (₹150), Steamed Basmati Rice (₹120)
- **Bread (cat-bread):** Butter Naan (₹50), Garlic Naan (₹65), Tandoori Roti (₹30)
- **Drinks (cat-drinks):** Fresh Lime Soda (₹80), Mango Lassi (₹110), Masala Chai (₹40)
- **Dessert (cat-dessert):** Gulab Jamun (2 pcs) (₹90), Rasmalai (2 pcs) (₹120)

### 2. Category Filter Verification
- Clicking each category tab filters down to the exact items matching `categoryId`.
- "All Menu" reflects all 21 items: `All Menu (21)`.

### 3. Search Filter Verification
- Searching `"Chicken"` returns 4 dishes: Butter Chicken, Chicken Dum Biryani, Chicken Kadhai, Chicken Tikka.
- Searching `"Naan"` returns 2 dishes: Butter Naan, Garlic Naan.
- Clearing the search restores all 21 dishes.

### 4. Cart / Add to Order Verification
- Adding Chicken Tikka × 2 correctly sets:
  - `productId`: `prod-chicken-tikka`
  - `unitPrice`: `₹320`
  - `quantity`: `2`
  - `subtotal`: `₹640`
- Order creation via `POST /api/v1/orders` verified end-to-end against live Django REST backend.

### 5. Local Storage vs API Mode Parity
- Verified `VITE_DATA_PROVIDER=api` and `VITE_DATA_PROVIDER=local` both satisfy the identical contract.

### 6. Production Build
- `npm run build` executed and passed with 0 errors.
