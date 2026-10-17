import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/app.js';
import { getDb } from '../src/config/database.js';
import { BillingCalculator } from '../src/modules/billing/calculator.js';
import { setupTestDatabase, teardownTestDatabase } from './helpers/testDb.js';

describe('Phase 4A — Billing Calculator, Bills, Discounts, Split Payments, Customers, Reports & Audit', () => {
  let captainToken;
  let receptionToken;
  let cashierToken;
  let managerToken;
  let adminToken;

  before(async () => {
    await setupTestDatabase({ seed: true });

    const loginAs = async (username, password) => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ username, password });
      assert.equal(res.status, 200, `Login failed for ${username}`);
      return res.body.data.tokens.access;
    };

    captainToken = await loginAs('captain', 'captain123');
    receptionToken = await loginAs('reception', 'reception123');
    cashierToken = await loginAs('cashier', 'cashier123');
    managerToken = await loginAs('manager', 'manager123');
    adminToken = await loginAs('admin', 'admin123');
  });

  after(async () => {
    await teardownTestDatabase();
  });

  const createAndConfirmOrder = async (tableId, customerId = null) => {
    const orderRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${captainToken}`)
      .send({
        branchId: 'branch-main',
        tableId,
        customerId,
        items: [
          { productId: 'prod-butter-chicken', quantity: 2 }, // 380 * 2 = 760
          { productId: 'prod-garlic-naan', quantity: 4 }, // 65 * 4 = 260
        ],
        submitImmediately: true,
      });
    assert.equal(orderRes.status, 201);
    const orderId = orderRes.body.data._id;

    const confirmRes = await request(app)
      .post(`/api/v1/orders/${orderId}/confirm`)
      .set('Authorization', `Bearer ${receptionToken}`);
    assert.equal(confirmRes.status, 200);
    return orderId;
  };

  it('verifies BillingCalculator exact Decimal math for GST, percentage discounts, fixed discounts, and nearest-Rupee rounding', () => {
    // 1. Basic subtotal and 5% GST Exclusive
    const res1 = BillingCalculator.calculateBill({
      items: [
        { unitPrice: '380.00', quantity: 2, taxConfig: { rate: '5.00', mode: 'EXCLUSIVE' } },
        { unitPrice: '65.00', quantity: 4, taxConfig: { rate: '5.00', mode: 'EXCLUSIVE' } },
      ],
    });
    assert.equal(res1.subtotal, '1020.00');
    assert.equal(res1.discount.amount, '0.00');
    assert.equal(res1.taxableAmount, '1020.00');
    assert.equal(res1.tax, '51.00');
    assert.equal(res1.cgst, '25.50');
    assert.equal(res1.sgst, '25.50');
    assert.equal(res1.grandTotal, '1071.00');
    assert.equal(res1.balanceAmount, '1071.00');

    // 2. Percentage discount (10% on 1000.00)
    const res2 = BillingCalculator.calculateBill({
      items: [{ unitPrice: '500.00', quantity: 2, taxConfig: { rate: '5.00', mode: 'EXCLUSIVE' } }],
      discountInput: { type: 'PERCENTAGE', value: '10.00', reason: 'Manager Privilege' },
    });
    assert.equal(res2.subtotal, '1000.00');
    assert.equal(res2.discount.amount, '100.00');
    assert.equal(res2.taxableAmount, '900.00');
    assert.equal(res2.tax, '45.00');
    assert.equal(res2.grandTotal, '945.00');

    // 3. Fixed discount + HALF_UP nearest-Rupee rounding (350 + 17.50 = 367.50 -> 368.00)
    const res3 = BillingCalculator.calculateBill({
      items: [{ unitPrice: '250.00', quantity: 2, taxConfig: { rate: '5.00', mode: 'EXCLUSIVE' } }],
      discountInput: { type: 'FIXED', value: '150.00', reason: 'Promo Voucher' },
    });
    assert.equal(res3.subtotal, '500.00');
    assert.equal(res3.discount.amount, '150.00');
    assert.equal(res3.taxableAmount, '350.00');
    assert.equal(res3.tax, '17.50');
    assert.equal(res3.rounding, '0.50');
    assert.equal(res3.grandTotal, '368.00');
  });

  it('generates bill idempotently, validates discount permissions/reasons, and enforces zero balance on bill close', async () => {
    const orderId = await createAndConfirmOrder('tbl-06');

    // 1. Cashier generates bill -> 201 Created
    const billRes = await request(app)
      .post(`/api/v1/orders/${orderId}/bill`)
      .set('Authorization', `Bearer ${cashierToken}`);
    assert.equal(billRes.status, 201);
    const bill = billRes.body.data;
    const billId = bill._id;
    assert.ok(bill.billNumber.startsWith('BILL-'));
    assert.equal(bill.status, 'PAYMENT_PENDING');
    assert.equal(bill.subtotal, '1320.00');
    assert.equal(bill.grandTotal, '1386.00');
    assert.equal(bill.balanceAmount, '1386.00');

    const db = await getDb();
    assert.equal((await db.collection('tables').findOne({ _id: 'tbl-06' })).status, 'BILL_PENDING');

    // 2. Retry generate bill -> 200 OK idempotent return of same bill
    const repeatRes = await request(app)
      .post(`/api/v1/orders/${orderId}/bill`)
      .set('Authorization', `Bearer ${cashierToken}`);
    assert.equal(repeatRes.status, 200);
    assert.equal(repeatRes.body.data._id, billId);
    assert.equal(await db.collection('bills').countDocuments({ orderId }), 1);

    // 3. Captain cannot apply discount -> 403 Forbidden
    const capDiscFail = await request(app)
      .post(`/api/v1/bills/${billId}/discount`)
      .set('Authorization', `Bearer ${captainToken}`)
      .send({ type: 'PERCENTAGE', value: '10.00', reason: 'Friends' });
    assert.equal(capDiscFail.status, 403);

    // 4. Cashier cannot apply >20% discount without discount.approve -> 403 Forbidden
    const highDiscFail = await request(app)
      .post(`/api/v1/bills/${billId}/discount`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ type: 'PERCENTAGE', value: '25.00', reason: 'Large discount' });
    assert.equal(highDiscFail.status, 403);

    // 5. Manager with empty reason -> 400 Bad Request
    const emptyReasonFail = await request(app)
      .post(`/api/v1/bills/${billId}/discount`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ type: 'PERCENTAGE', value: '10.00', reason: '' });
    assert.equal(emptyReasonFail.status, 400);

    // 6. Manager applies valid 10% discount -> 200 OK (1320 - 10% = 1188 + 5% tax = 1247.40 -> 1247.00)
    const discRes = await request(app)
      .post(`/api/v1/bills/${billId}/discount`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ type: 'PERCENTAGE', value: '10.00', reason: 'Happy Hours' });
    assert.equal(discRes.status, 200);
    assert.equal(discRes.body.data.discount.amount, '132.00');
    assert.equal(discRes.body.data.taxableAmount, '1188.00');
    assert.equal(discRes.body.data.grandTotal, '1247.00');

    // 7. Printing bill does NOT settle or create payment
    const printRes = await request(app)
      .get(`/api/v1/bills/${billId}/print`)
      .set('Authorization', `Bearer ${cashierToken}`);
    assert.equal(printRes.status, 200);
    assert.equal(printRes.body.data.grandTotal, '1247.00');
    assert.equal(printRes.body.data.status, 'PAYMENT_PENDING');

    // 8. Cannot close bill while unpaid balance remains -> 400 Bad Request
    const closeFail = await request(app)
      .post(`/api/v1/bills/${billId}/close`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({});
    assert.equal(closeFail.status, 400);
    assert.ok(closeFail.body.error.message.toLowerCase().includes('unpaid balance'));

    // 9. Collect full payment (1247.00 via UPI) and close bill
    const payRes = await request(app)
      .post(`/api/v1/bills/${billId}/payments`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        mode: 'UPI',
        amount: '1247.00',
        referenceNumber: 'UPI-REP-101',
      });
    assert.equal(payRes.status, 201);

    const closeRes = await request(app)
      .post(`/api/v1/bills/${billId}/close`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({});
    assert.equal(closeRes.status, 200);
    assert.equal(closeRes.body.data.status, 'COMPLETED');

    const orderDoc = await db.collection('orders').findOne({ _id: orderId });
    const tableDoc = await db.collection('tables').findOne({ _id: 'tbl-06' });
    assert.equal(orderDoc.status, 'COMPLETED');
    assert.equal(tableDoc.status, 'AVAILABLE');
    assert.equal(tableDoc.activeOrderId, null);
  });

  it('enforces payment idempotency, mixed/split payments accuracy, and rejects overpayments', async () => {
    const orderId = await createAndConfirmOrder('tbl-09');
    const billRes = await request(app)
      .post(`/api/v1/orders/${orderId}/bill`)
      .set('Authorization', `Bearer ${cashierToken}`);
    const billId = billRes.body.data._id;

    // 1. Overpayment (1500.00 > 1386.00) -> 400 Bad Request
    const overpayRes = await request(app)
      .post(`/api/v1/bills/${billId}/payments`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ mode: 'CASH', amount: '1500.00' });
    assert.equal(overpayRes.status, 400);
    assert.ok(overpayRes.body.error.message.toLowerCase().includes('exceeds outstanding balance'));

    // 2. Split Payment 1: UPI 800.00 with idempotencyKey
    const p1Res = await request(app)
      .post(`/api/v1/bills/${billId}/payments`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        mode: 'UPI',
        amount: '800.00',
        referenceNumber: 'UPI-TXN-1',
        idempotencyKey: 'idem-pay-split-1',
      });
    assert.equal(p1Res.status, 201);
    assert.equal(p1Res.body.data.isDuplicate, false);
    assert.equal(p1Res.body.data.bill.paidAmount, '800.00');
    assert.equal(p1Res.body.data.bill.balanceAmount, '586.00');
    assert.equal(p1Res.body.data.bill.status, 'PAYMENT_PENDING');

    // Retry Payment 1 with same idempotencyKey -> 200 OK, isDuplicate: true, no double deduction
    const p1Retry = await request(app)
      .post(`/api/v1/bills/${billId}/payments`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        mode: 'UPI',
        amount: '800.00',
        referenceNumber: 'UPI-TXN-1',
        idempotencyKey: 'idem-pay-split-1',
      });
    assert.equal(p1Retry.status, 200);
    assert.equal(p1Retry.body.data.isDuplicate, true);
    assert.equal(p1Retry.body.data.bill.paidAmount, '800.00');

    // 3. Split Payment 2: CASH 586.00 -> balance 0.00, status PAID, table PAID
    const p2Res = await request(app)
      .post(`/api/v1/bills/${billId}/payments`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        mode: 'CASH',
        amount: '586.00',
      });
    assert.equal(p2Res.status, 201);
    assert.equal(p2Res.body.data.bill.paidAmount, '1386.00');
    assert.equal(p2Res.body.data.bill.balanceAmount, '0.00');
    assert.equal(p2Res.body.data.bill.status, 'PAID');

    const paymentsListRes = await request(app)
      .get(`/api/v1/bills/${billId}/payments`)
      .set('Authorization', `Bearer ${cashierToken}`);
    assert.equal(paymentsListRes.status, 200);
    assert.equal(paymentsListRes.body.data.length, 2);

    // Close the paid bill to release tbl-09
    await request(app)
      .post(`/api/v1/bills/${billId}/close`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({});
  });

  it('supports Customer CRM creation, phone normalization, duplicate guard, search, and visit/spend tracking on bill close', async () => {
    // 1. Create customer with +91 phone prefix
    const cRes = await request(app)
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${receptionToken}`)
      .send({
        branchId: 'branch-main',
        name: 'Amit Sharma',
        mobile: '+91 98765 43210',
        email: 'amit.sharma@example.com',
        notes: 'Regular guest',
      });
    assert.equal(cRes.status, 201);
    const custId = cRes.body.data._id;
    assert.equal(cRes.body.data.mobile, '9876543210');
    assert.equal(cRes.body.data.visitCount, 0);
    assert.equal(cRes.body.data.totalSpending, '0.00');

    // 2. Duplicate mobile in same branch -> 409 Conflict
    const dupRes = await request(app)
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${receptionToken}`)
      .send({
        branchId: 'branch-main',
        name: 'Another Amit',
        mobile: '09876543210',
      });
    assert.equal(dupRes.status, 409);

    // 3. Search by mobile and name
    const s1 = await request(app)
      .get('/api/v1/customers?q=98765')
      .set('Authorization', `Bearer ${receptionToken}`);
    assert.equal(s1.status, 200);
    assert.equal(s1.body.data.items.length, 1);

    // 4. Update customer address
    const updRes = await request(app)
      .patch(`/api/v1/customers/${custId}`)
      .set('Authorization', `Bearer ${receptionToken}`)
      .send({ address: 'Indiranagar, Bengaluru' });
    assert.equal(updRes.status, 200);
    assert.equal(updRes.body.data.address, 'Indiranagar, Bengaluru');

    // 5. Link customer to an order, settle bill, and verify visitCount & totalSpending
    const orderId = await createAndConfirmOrder('tbl-12', custId);
    const billRes = await request(app)
      .post(`/api/v1/orders/${orderId}/bill`)
      .set('Authorization', `Bearer ${cashierToken}`);
    const billId = billRes.body.data._id;
    const grandTotal = billRes.body.data.grandTotal;

    await request(app)
      .post(`/api/v1/bills/${billId}/payments`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ mode: 'CARD', amount: grandTotal });
    await request(app)
      .post(`/api/v1/bills/${billId}/close`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({});

    const updatedCustRes = await request(app)
      .get(`/api/v1/customers/${custId}`)
      .set('Authorization', `Bearer ${receptionToken}`);
    assert.equal(updatedCustRes.body.data.visitCount, 1);
    assert.equal(updatedCustRes.body.data.totalSpending, grandTotal);
    assert.ok(updatedCustRes.body.data.lastVisitAt);

    const custOrdersRes = await request(app)
      .get(`/api/v1/customers/${custId}/orders`)
      .set('Authorization', `Bearer ${receptionToken}`);
    assert.equal(custOrdersRes.status, 200);
    assert.equal(custOrdersRes.body.data.length, 1);
  });

  it('aggregates Sales, Items, Captains, Payments, Discounts, Cancellations reports and enforces Audit RBAC', async () => {
    // Also create a rejected order so cancellations report has data
    const rejOrderRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${captainToken}`)
      .send({
        branchId: 'branch-main',
        tableId: 'tbl-14',
        items: [{ productId: 'prod-butter-naan', quantity: 2 }],
        submitImmediately: true,
      });
    await request(app)
      .post(`/api/v1/orders/${rejOrderRes.body.data._id}/reject`)
      .set('Authorization', `Bearer ${receptionToken}`)
      .send({ reason: 'Tandoor maintenance' });

    // 1. Sales report
    const salesRes = await request(app)
      .get('/api/v1/reports/sales?branchId=branch-main')
      .set('Authorization', `Bearer ${managerToken}`);
    assert.equal(salesRes.status, 200);
    assert.equal(salesRes.body.data.summary.totalBills, 3);
    assert.equal(salesRes.body.data.summary.totalDiscount, '132.00');
    assert.equal(salesRes.body.data.summary.totalSales, '4019.00'); // 1247 + 1386 + 1386

    // 2. Items report
    const itemsRes = await request(app)
      .get('/api/v1/reports/items?branchId=branch-main')
      .set('Authorization', `Bearer ${managerToken}`);
    assert.equal(itemsRes.status, 200);
    const bc = itemsRes.body.data.find((i) => i.productId === 'prod-butter-chicken');
    assert.ok(bc);
    assert.equal(bc.quantitySold, 6);
    assert.equal(bc.totalRevenue, '2880.00');

    // 3. Captains report
    const capRes = await request(app)
      .get('/api/v1/reports/captains?branchId=branch-main')
      .set('Authorization', `Bearer ${managerToken}`);
    assert.equal(capRes.status, 200);
    assert.ok(capRes.body.data.length >= 1);
    assert.equal(capRes.body.data[0].totalSales, '4019.00');

    // 4. Payments report
    const payRepRes = await request(app)
      .get('/api/v1/reports/payments?branchId=branch-main')
      .set('Authorization', `Bearer ${managerToken}`);
    assert.equal(payRepRes.status, 200);
    assert.equal(payRepRes.body.data.summary.totalTransactions, 4);
    assert.equal(payRepRes.body.data.summary.totalCollected, '4019.00');

    // 5. Discounts report
    const discRepRes = await request(app)
      .get('/api/v1/reports/discounts?branchId=branch-main')
      .set('Authorization', `Bearer ${managerToken}`);
    assert.equal(discRepRes.status, 200);
    assert.equal(discRepRes.body.data.discountCount, 1);
    assert.equal(discRepRes.body.data.totalDiscountAmount, '132.00');

    // 6. Cancellations report
    const cancRepRes = await request(app)
      .get('/api/v1/reports/cancellations?branchId=branch-main')
      .set('Authorization', `Bearer ${managerToken}`);
    assert.equal(cancRepRes.status, 200);
    assert.equal(cancRepRes.body.data.totalRejected, 1);

    // 7. Audit logs RBAC (403 for Captain, 200 for Admin)
    const auditForbidden = await request(app)
      .get('/api/v1/audit')
      .set('Authorization', `Bearer ${captainToken}`);
    assert.equal(auditForbidden.status, 403);

    const auditOk = await request(app)
      .get('/api/v1/audit?limit=50')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(auditOk.status, 200);
    assert.ok(auditOk.body.data.items.length >= 5);
  });
});
