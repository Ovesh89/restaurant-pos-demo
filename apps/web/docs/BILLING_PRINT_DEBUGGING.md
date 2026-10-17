# Billing Tax Invoice Print & Settlement Status Debugging Report

**Date:** 2026-10-06  
**Environment:** Restaurant POS Web + Django REST API Backend (MongoDB)  
**Status:** RESOLVED  

---

## 1. Executive Summary

Following Django REST API integration for the Restaurant POS Web application, a regression was identified on the Billing page (`/billing`):
1. **Print Failure:** Clicking **"Print Tax Invoice"** failed with an unhandled exception:
   ```text
   Browser print invocation failed or blocked:
   TypeError: Cannot read properties of undefined (reading 'toFixed')
   Stack:
   PrintService.generateInvoiceHTML (printService.js:207:80)
   PrintService.printInvoice (printService.js:259:25)
   onClick (BillingPage.jsx:647:51)
   ```
2. **Settlement Queue & Table Release Defect:** After completing full payment for a bill, the table remained occupied in backend status `PAID` instead of becoming `AVAILABLE`, the order remained in `BILLING` instead of `COMPLETED`, and the order remained visible in the **"Tables Pending Settlement"** queue on the billing desk.
3. **Network 409 Conflict:** A visible HTTP 409 Conflict was reported on `/api/v1/orders/.../reject`.

All root causes have been isolated, repaired, and validated across both API (`VITE_DATA_PROVIDER=api`) and Local (`VITE_DATA_PROVIDER=local`) modes.

---

## 2. Root Cause Analysis

### Issue A: `TypeError: Cannot read properties of undefined (reading 'toFixed')`
- **Location:** `src/services/printing/printService.js` (line 207) & `src/services/repositories/api/billApiRepository.js`
- **Root Cause:**
  In local mode, bills were generated using `billingCalculator.js`, which attached `taxableValue`, `cgst`, and `sgst` properties directly to the bill object.
  In API mode, the Django backend returns string-serialized fields (`taxableAmount: "615.00"`, `tax: "30.75"`, `cgst: "15.38"`, `sgst: "15.37"`).
  However, `billApiRepository.normalizeBill()` failed to map or normalize `taxableValue`, `taxableAmount`, `cgst`, or `sgst`.
  Consequently, `bill.taxableValue`, `bill.cgst`, and `bill.sgst` were `undefined`.
  When `printService.generateInvoiceHTML()` evaluated:
  ```javascript
  <div class="row"><span>Taxable Value:</span><span>₹${bill.taxableValue.toFixed(2)}</span></div>
  ```
  it crashed with `TypeError: Cannot read properties of undefined (reading 'toFixed')`.

### Issue B: Settlement Auto-Close & Table Release Failure
- **Location:** `src/services/repositories/api/billApiRepository.js` (`addPayment`)
- **Root Cause:**
  In `addPayment()`, after recording full payment (`balance <= 0`), the code attempted to auto-close the bill using the following guard:
  ```javascript
  const isNowSettled = bill ? bill.balance <= 0 : false;
  if (isNowSettled && bill && bill.status !== BILL_STATUS.PAID) {
    const closedRes = await apiClient.post(`/bills/${billId}/close`);
    bill = this.normalizeBill(closedRes);
  }
  ```
  However, in `normalizeBill()`, any backend status of `'PAID'` or `'COMPLETED'` was mapped to `bill.status = BILL_STATUS.PAID`.
  Because `bill.status` was already `BILL_STATUS.PAID`, the check `bill.status !== BILL_STATUS.PAID` evaluated to `false`.
  As a result:
  - `POST /api/v1/bills/{billId}/close` was **never executed**.
  - The bill remained in backend status `PAID` rather than transitioning to `COMPLETED`.
  - The backend `close_bill` logic (which updates order status to `COMPLETED` and releases the table to `AVAILABLE` with `activeOrderId: null`) never executed.
  - When the Billing page refreshed via `loadBillingData()`, the order's status remained `BILLING` (which is in `[SERVED, READY, BILLING, KOT_SENT, PREPARING]`), leaving the table stranded in **"Tables Pending Settlement"**.

### Issue C: HTTP 409 Conflict on `/api/v1/orders/.../reject`
- **Location:** Reception Order Review workflow (`ReceptionPage.jsx` & Django `OrderRejectView`)
- **Analysis:**
  - Audited all frontend occurrences of `reject`. Found that `orderRepository.rejectOrder()` is exclusively triggered from `ReceptionPage.jsx` (`/reception`) when a user explicitly rejects an incoming order. It is **never** invoked by `BillingPage.jsx` or any billing service.
  - In Django (`apps/orders/services.py:reject_order`), order rejection requires `order.status == 'WAITING_CONFIRMATION'`. If an order has already been confirmed (`KOT_SENT`, `PREPARING`, `READY`, `SERVED`, or `BILLING`), the backend raises `StateConflictError(f"Cannot reject order in status '{current_status}'.")`, which returns HTTP 409 Conflict (`INVALID_STATE`).
  - **Conclusion:** The 409 Conflict was a stale/duplicate reject attempt from a prior reception test on an order that had already transitioned past confirmation. It is completely independent of the billing and printing pipeline.

---

## 3. Data Shape Comparison & Normalization Model

| Field | Local Shape | Django API Shape | Normalized Web Shape | PrintService Usage |
|---|---|---|---|---|
| `billNo` / `billNumber` | `"INV-001"` | `"BILL-2026-000005"` | `"BILL-2026-000005"` (String) | Header Invoice # |
| `orderNo` / `orderNumber` | `"ORD-001"` | `"ORD-2026-000019"` | `"ORD-2026-000019"` (String) | Header Order # |
| `tableNo` / `tableNumber` | `"02"` | `"02"` | `"02"` (String) | Header Table # |
| `subtotal` | `615` (Number) | `"615.00"` (String) | `615` (Number) | `formatMoney(subtotal)` |
| `discountAmount` | `0` (Number) | `discount.amount: "0.00"` | `0` (Number) | Discount line |
| `taxableValue` / `taxableAmount` | `615` (Number) | `"615.00"` (String) | `615` (Number) | `formatMoney(taxableValue)` |
| `cgst` / `cgstAmount` | `15.38` (Number) | `"15.38"` (String) | `15.38` (Number) | `formatMoney(cgst)` |
| `sgst` / `sgstAmount` | `15.37` (Number) | `"15.37"` (String) | `15.37` (Number) | `formatMoney(sgst)` |
| `taxAmount` / `tax` | `30.75` (Number) | `"30.75"` (String) | `30.75` (Number) | CGST + SGST base |
| `rounding` | `0.25` (Number) | `"0.25"` (String) | `0.25` (Number) | Rounding line |
| `grandTotal` | `646` (Number) | `"646.00"` (String) | `646` (Number) | `formatMoney(grandTotal)` |
| `paidAmount` | `646` (Number) | `"646.00"` (String) | `646` (Number) | `formatMoney(paidAmount)` |
| `balance` / `balanceAmount` | `0` (Number) | `"0.00"` (String) | `0` (Number) | `formatMoney(balance)` |
| `status` | `'PAID'` | `'COMPLETED'` / `'PAID'` | `BILL_STATUS.PAID` | Badges & filter |
| `rawStatus` | `'COMPLETED'` | `'COMPLETED'` / `'PAID'` | String (`'COMPLETED'`) | Lifecycle state machine |

---

## 4. Key Code Changes

### 1. `src/services/printing/printService.js`
- Added centralized numeric helpers:
  - `normalizeMoney(value, fallback = 0)`: Safely parses numbers, numeric strings, `null`, and `undefined`, logging warnings for corrupt values.
  - `formatMoney(value, fallback = 0)`: Outputs deterministic 2-decimal rupee strings (e.g., `"615.00"`).
- Re-architected `generateInvoiceHTML()`:
  - Calculates dynamic tax percentages (e.g., `CGST (2.5%)`, `SGST (2.5%)`).
  - Defensively formats `taxableValue`, `cgst`, `sgst`, `rounding`, `grandTotal`, `paidAmount`, and `balance`.
  - Safely handles optional guest details, multi-item snapshots, and split payments.
  - Uses `triggerPrint()` handling both `document.readyState === 'complete'` and `window.onload`.
- Re-architected `printInvoice()`:
  - Generates HTML **before** invoking `window.open` to eliminate empty/blank pop-ups if generation encounters an issue.
  - Automatically focuses the print window and handles pop-up blockers cleanly.

### 2. `src/services/repositories/api/billApiRepository.js`
- In `normalizeBill()`:
  - Extracted and parsed numeric values for `taxableValue`, `taxableAmount`, `cgst`, `sgst`, `taxAmount`, `tax`, `rounding`, `grandTotal`, `paidAmount`, and `balance`.
  - Preserved both canonical and convenience property names (`billNo`/`billNumber`, `taxableValue`/`taxableAmount`, etc.).
  - Retained `rawStatus` (`COMPLETED`, `PAID`, `PAYMENT_PENDING`) alongside the UI-level `BILL_STATUS`.
  - Mapped line items with `unitPrice`, `quantity`, `lineSubtotal`, and names.
- In `addPayment()`:
  - Fixed settlement guard:
    ```javascript
    const isNowSettled = bill ? bill.balance <= 0 : false;
    if (isNowSettled && bill && bill.rawStatus !== 'COMPLETED') {
      const closedRes = await apiClient.post(`/bills/${billId}/close`);
      bill = this.normalizeBill(closedRes);
    }
    ```
    Now, when `balance <= 0`, `/bills/{billId}/close` is always called, transitioning bill -> `COMPLETED`, order -> `COMPLETED`, and releasing table -> `AVAILABLE`.
- Added `closeBill(billId, actor)` to repository facade for explicit closures and idempotency.
- In `generateBill()`:
  - When an existing bill is retrieved and a discount is applied/modified, automatically calls `POST /bills/{id}/discount`.

### 3. `src/services/repositories/local/billLocalRepository.js`
- Added normalized aliases (`tax`, `balanceAmount`, `rawStatus: 'COMPLETED'`) to maintain 100% contract parity with `billApiRepository`.
- Added `closeBill(billId, actor)` to the local repository facade.

### 4. `src/pages/billing/BillingPage.jsx`
- Added `handleCloseDesk()`: Closes modal and calls `loadBillingData()` to guarantee full queue synchronization.
- In `handleOpenCheckout()`: Detects if a retrieved active bill is already settled (`bill.isSettled`) but unclosed (`bill.rawStatus !== 'COMPLETED'`), automatically invoking `billRepository.closeBill()` to release stranded tables immediately upon opening.

---

## 5. Verification & Test Results

### Automated Test Suite
Created and executed verification scripts:
1. `scratch/test_print.js`:
   - Tested `normalizeMoney` & `formatMoney` with valid numbers, numeric strings, `null`, `undefined`, and invalid strings.
   - Tested `billApiRepository.normalizeBill` with raw Django MongoDB responses.
   - Tested 10 Print Cases:
     - Case 1: No discount, Cash payment
     - Case 2: UPI payment with transaction ref
     - Case 3: Mixed tender split payments (UPI + Cash)
     - Case 4: Percentage discount with reason
     - Case 5: Fixed amount discount with reason
     - Case 6: Tax + negative/positive rounding
     - Case 7: Zero discount
     - Case 8: Guest profile present (Name + Phone)
     - Case 9: Guest absent (Walk-in)
     - Case 10: Missing/undefined property defensive test
   - **Result:** ALL 10 CASES PASSED.

2. `scratch/test_settlement.js` (Live Django REST API End-to-End Test):
   - Created order on Table 02 (`Hara Bhara Kabab ×1`, `Garlic Naan ×1`, `Chicken Dum Biryani ×1`).
   - Submitted order as Captain -> Confirmed at Reception -> KOT created.
   - Generated bill (`BILL-2026-000006`: Subtotal ₹615.00, Taxable ₹615.00, CGST ₹15.38, SGST ₹15.37, Rounding ₹0.25, Grand Total ₹646.00).
   - Recorded full UPI payment of ₹646.00.
   - Bill auto-closed via `/bills/.../close`.
   - Verified Table 02 status transitioned to `AVAILABLE` with `activeOrderId: null`.
   - Verified Order status transitioned to `COMPLETED`.
   - Verified Table 02 was removed from `status=SERVED,READY,BILLING,KOT_SENT,PREPARING` query (Pending Settlement).
   - Verified bill appeared in `GET /bills` (Recent Settled Invoices).
   - **Result:** PASSED.

3. `scratch/test_local_mode.js`:
   - Verified `billLocalRepository.generateBill`, `addPayment`, and `printService` in Local mode.
   - **Result:** PASSED.

4. Production Build:
   - `npm run build` executed and succeeded (`dist/` generated with 0 errors).
   - **Result:** PASSED.
