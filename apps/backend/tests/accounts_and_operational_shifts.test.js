import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/app.js';
import { getCollection, closeMongoConnection } from '../src/config/database.js';
import { generateAccessToken } from '../src/modules/identity/tokens.js';
import {
  getCurrentOperationalInfo,
  resolveOperationalTimeRange,
  SHIFT_SESSIONS,
} from '../src/utils/operationalTime.js';

describe('Accounts System & Operational Meal Shifts (5AM-5PM / 5PM-5AM)', () => {
  let adminToken;
  let cashierToken;
  let captainToken;
  let kitchenToken;

  const adminUser = {
    _id: 'usr-admin-account-test',
    username: 'admin_account_test',
    roleCodes: ['ADMIN'],
    branchIds: ['branch-main'],
    isActive: true,
  };

  const cashierUser = {
    _id: 'usr-cashier-account-test',
    username: 'cashier_account_test',
    roleCodes: ['CASHIER'],
    branchIds: ['branch-main'],
    isActive: true,
  };

  const captainUser = {
    _id: 'usr-captain-account-test',
    username: 'captain_account_test',
    roleCodes: ['CAPTAIN'],
    branchIds: ['branch-main'],
    isActive: true,
  };

  const kitchenUser = {
    _id: 'usr-kitchen-account-test',
    username: 'kitchen_account_test',
    roleCodes: ['KITCHEN'],
    branchIds: ['branch-main'],
    isActive: true,
  };

  before(async () => {
    const usersCol = await getCollection('users');
    await usersCol.deleteMany({
      _id: { $in: [adminUser._id, cashierUser._id, captainUser._id, kitchenUser._id] },
    });
    await usersCol.insertMany([adminUser, cashierUser, captainUser, kitchenUser]);

    adminToken = generateAccessToken(adminUser._id, adminUser.username);
    cashierToken = generateAccessToken(cashierUser._id, cashierUser.username);
    captainToken = generateAccessToken(captainUser._id, captainUser.username);
    kitchenToken = generateAccessToken(kitchenUser._id, kitchenUser.username);
  });

  after(async () => {
    const usersCol = await getCollection('users');
    await usersCol.deleteMany({
      _id: { $in: [adminUser._id, cashierUser._id, captainUser._id, kitchenUser._id] },
    });
  });

  describe('1. Operational Shift Timing & Session Transitions', () => {
    it('accurately resolves Lunch boundaries (5:00 AM - 5:00 PM IST)', () => {
      const range = resolveOperationalTimeRange({
        date: '2026-11-02',
        session: 'LUNCH',
      });
      // 5:00 AM IST = 23:30 UTC previous day
      assert.equal(range.start, '2026-11-01T23:30:00.000Z');
      // 5:00 PM IST = 11:30 UTC same day
      assert.equal(range.end, '2026-11-02T11:30:00.000Z');
    });

    it('accurately resolves Dinner boundaries (5:00 PM - 5:00 AM next day IST)', () => {
      const range = resolveOperationalTimeRange({
        date: '2026-11-02',
        session: 'DINNER',
      });
      // 5:00 PM IST = 11:30 UTC same day
      assert.equal(range.start, '2026-11-02T11:30:00.000Z');
      // 5:00 AM IST next day = 23:30 UTC same day
      assert.equal(range.end, '2026-11-02T23:30:00.000Z');
    });

    it('accurately resolves All Day boundaries (5:00 AM to 5:00 AM next day IST)', () => {
      const range = resolveOperationalTimeRange({
        date: '2026-11-02',
        session: 'ALL',
      });
      assert.equal(range.start, '2026-11-01T23:30:00.000Z');
      assert.equal(range.end, '2026-11-02T23:30:00.000Z');
    });

    it('identifies late-night orders (e.g. 02:00 AM IST) as yesterday Dinner session', () => {
      const lateNightDate = new Date('2026-11-03T02:00:00+05:30');
      const opInfo = getCurrentOperationalInfo(lateNightDate);
      assert.equal(opInfo.operationalDate, '2026-11-02');
      assert.equal(opInfo.currentSession, 'DINNER');
    });

    it('identifies morning/afternoon orders (e.g. 11:00 AM IST) as today Lunch session', () => {
      const morningDate = new Date('2026-11-03T11:00:00+05:30');
      const opInfo = getCurrentOperationalInfo(morningDate);
      assert.equal(opInfo.operationalDate, '2026-11-03');
      assert.equal(opInfo.currentSession, 'LUNCH');
    });
  });

  describe('2. RBAC Access Control on Accounts System', () => {
    it('permits Admin to access /api/v1/accounts/daily-summary', async () => {
      const res = await request(app)
        .get('/api/v1/accounts/daily-summary')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ branchId: 'branch-main' });

      assert.equal(res.status, 200);
      assert.ok(res.body.data.summary);
      assert.ok(Array.isArray(res.body.data.orders));
    });

    it('denies Cashier, Captain, Kitchen from accessing Accounts System (403 Forbidden)', async () => {
      const cashierRes = await request(app)
        .get('/api/v1/accounts/daily-summary')
        .set('Authorization', `Bearer ${cashierToken}`);
      assert.equal(cashierRes.status, 403);

      const captainRes = await request(app)
        .get('/api/v1/accounts/daily-summary')
        .set('Authorization', `Bearer ${captainToken}`);
      assert.equal(captainRes.status, 403);

      const kitchenRes = await request(app)
        .get('/api/v1/accounts/daily-summary')
        .set('Authorization', `Bearer ${kitchenToken}`);
      assert.equal(kitchenRes.status, 403);
    });

    it('denies unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/v1/accounts/daily-summary');
      assert.equal(res.status, 401);
    });
  });

  describe('3. Calculations of Daily Total Order Amount, Payment Modes & Order Ledger', () => {
    const testDate = '2026-11-02';
    // 12:00 PM IST on 2026-11-02 is in Lunch shift (06:30 UTC)
    const lunchTimestamp = '2026-11-02T06:30:00.000Z';
    // 08:00 PM IST on 2026-11-02 is in Dinner shift (14:30 UTC)
    const dinnerTimestamp = '2026-11-02T14:30:00.000Z';

    before(async () => {
      const billsCol = await getCollection('bills');
      const ordersCol = await getCollection('orders');

      // Seed Lunch Bill (Cash)
      const lunchBill = {
        _id: 'bill-acc-lunch-cash',
        billNumber: 'BILL-ACC-001',
        branchId: 'branch-main',
        orderId: 'ord-acc-lunch-cash',
        orderNumber: 'ORD-ACC-001',
        tableId: 'table-101',
        tableNumber: 'Table 101',
        orderType: 'DINE_IN',
        captainName: 'Rajesh',
        subtotal: '500.00',
        discountAmount: '50.00',
        tax: '22.50',
        rounding: '0.50',
        grandTotal: '473.00',
        paymentMode: 'CASH',
        status: 'PAID',
        generatedAt: lunchTimestamp,
        paidAt: lunchTimestamp,
        createdAt: lunchTimestamp,
        items: [
          { productName: 'Butter Chicken', quantity: 1, unitPrice: '400.00' },
          { productName: 'Garlic Naan', quantity: 2, unitPrice: '50.00' },
        ],
      };

      // Seed Dinner Bill (Online / UPI)
      const dinnerBill = {
        _id: 'bill-acc-dinner-online',
        billNumber: 'BILL-ACC-002',
        branchId: 'branch-main',
        orderId: 'ord-acc-dinner-online',
        orderNumber: 'ORD-ACC-002',
        tableId: 'table-102',
        tableNumber: 'Table 102',
        orderType: 'DINE_IN',
        captainName: 'Vikram',
        subtotal: '1000.00',
        discountAmount: '100.00',
        tax: '45.00',
        rounding: '0.00',
        grandTotal: '945.00',
        paymentMode: 'UPI',
        status: 'PAID',
        generatedAt: dinnerTimestamp,
        paidAt: dinnerTimestamp,
        createdAt: dinnerTimestamp,
        items: [
          { productName: 'Tandoori Platter', quantity: 2, unitPrice: '500.00' },
        ],
      };

      await billsCol.deleteMany({ _id: { $in: [lunchBill._id, dinnerBill._id] } });
      await billsCol.insertMany([lunchBill, dinnerBill]);
    });

    after(async () => {
      const billsCol = await getCollection('bills');
      await billsCol.deleteMany({ _id: { $in: ['bill-acc-lunch-cash', 'bill-acc-dinner-online'] } });
    });

    it('calculates full day totals across Cash and Online payment modes', async () => {
      const res = await request(app)
        .get('/api/v1/accounts/daily-summary')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ branchId: 'branch-main', date: testDate, session: 'ALL' });

      assert.equal(res.status, 200);
      const { summary, orders } = res.body.data;

      assert.equal(summary.operationalDate, testDate);
      assert.equal(summary.totalOrders, 2);
      assert.equal(summary.totalSubtotal, '1500.00');
      assert.equal(summary.totalDiscount, '150.00');
      assert.equal(summary.totalTax, '67.50');
      assert.equal(summary.totalRounding, '0.50');
      assert.equal(summary.totalNetAmount, '1418.00');

      // Cash vs Online Breakdown
      assert.equal(summary.payments.cash.total, '473.00');
      assert.equal(summary.payments.cash.count, 1);
      assert.equal(summary.payments.online.total, '945.00');
      assert.equal(summary.payments.online.count, 1);

      // Verify order list details
      assert.equal(orders.length, 2);
      const cashOrder = orders.find((o) => o.billId === 'bill-acc-lunch-cash');
      assert.ok(cashOrder);
      assert.equal(cashOrder.netAmount, '473.00');
      assert.equal(cashOrder.paymentMode, 'CASH');

      const onlineOrder = orders.find((o) => o.billId === 'bill-acc-dinner-online');
      assert.ok(onlineOrder);
      assert.equal(onlineOrder.netAmount, '945.00');
      assert.equal(onlineOrder.paymentMode, 'UPI');
    });

    it('filters strictly by Lunch session (5:00 AM - 5:00 PM)', async () => {
      const res = await request(app)
        .get('/api/v1/accounts/daily-summary')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ branchId: 'branch-main', date: testDate, session: 'LUNCH' });

      assert.equal(res.status, 200);
      const { summary, orders } = res.body.data;
      assert.equal(summary.session, 'LUNCH');
      assert.equal(summary.totalOrders, 1);
      assert.equal(summary.totalNetAmount, '473.00');
      assert.equal(summary.payments.cash.total, '473.00');
      assert.equal(summary.payments.online.total, '0.00');
      assert.equal(orders[0].billId, 'bill-acc-lunch-cash');
    });

    it('filters strictly by Dinner session (5:00 PM - 5:00 AM next day)', async () => {
      const res = await request(app)
        .get('/api/v1/accounts/daily-summary')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ branchId: 'branch-main', date: testDate, session: 'DINNER' });

      assert.equal(res.status, 200);
      const { summary, orders } = res.body.data;
      assert.equal(summary.session, 'DINNER');
      assert.equal(summary.totalOrders, 1);
      assert.equal(summary.totalNetAmount, '945.00');
      assert.equal(summary.payments.online.total, '945.00');
      assert.equal(summary.payments.cash.total, '0.00');
      assert.equal(orders[0].billId, 'bill-acc-dinner-online');
    });
  });

  describe('4. Operational Status API', () => {
    it('returns current operational status at /api/v1/accounts/status', async () => {
      const res = await request(app)
        .get('/api/v1/accounts/status')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      assert.ok(res.body.data.operationalDate);
      assert.ok(res.body.data.currentSession);
      assert.ok(res.body.data.sessionLabel);
    });
  });
});
