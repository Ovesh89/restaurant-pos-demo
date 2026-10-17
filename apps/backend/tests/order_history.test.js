import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/app.js';
import { getDb } from '../src/config/database.js';
import { setupTestDatabase, teardownTestDatabase } from './helpers/testDb.js';

describe('Order History & Sales Analytics API Suite', () => {
  let captainToken;
  let cashierToken;
  let adminToken;
  let customer1Id;
  let customer2Id;
  let catStartersId;
  let catMainsId;
  let prodPaneerId;
  let prodBiryaniId;
  let order1Id;
  let order2Id;

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
    cashierToken = await loginAs('cashier', 'cashier123');
    adminToken = await loginAs('admin', 'admin123');

    // Create 2 Customers
    const cust1Res = await request(app)
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        branchId: 'branch-main',
        name: 'Arjun Mehta',
        mobile: '9876543210',
        email: 'arjun@example.com'
      });
    assert.equal(cust1Res.status, 201);
    customer1Id = cust1Res.body.data.id || cust1Res.body.data._id;

    const cust2Res = await request(app)
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        branchId: 'branch-main',
        name: 'Priya Sharma',
        mobile: '9812345678',
        email: 'priya@example.com'
      });
    assert.equal(cust2Res.status, 201);
    customer2Id = cust2Res.body.data.id || cust2Res.body.data._id;

    // Fetch Categories and Products
    const catsRes = await request(app)
      .get('/api/v1/menu/categories')
      .set('Authorization', `Bearer ${captainToken}`);
    const cats = catsRes.body.data || [];
    catStartersId = cats.find((c) => c.name.toLowerCase().includes('starter'))?._id || cats[0]?._id;
    catMainsId = cats.find((c) => c.name.toLowerCase().includes('main'))?._id || cats[1]?._id;

    const prodsRes = await request(app)
      .get('/api/v1/menu/products')
      .set('Authorization', `Bearer ${captainToken}`);
    const prods = prodsRes.body.data?.items || prodsRes.body.data || [];
    prodPaneerId = prods[0]?._id || prods[0]?.id;
    prodBiryaniId = prods[1]?._id || prods[1]?.id;

    // Order 1: Placed with Customer 1, Table 1
    const ord1Res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${captainToken}`)
      .send({
        branchId: 'branch-main',
        tableId: 'tbl-01',
        customerId: customer1Id,
        submitImmediately: true,
        items: [
          { productId: prodPaneerId, quantity: 2, note: 'Extra spicy' }
        ]
      });
    assert.equal(ord1Res.status, 201);
    order1Id = ord1Res.body.data.id || ord1Res.body.data._id;

    // Confirm Order 1 at Reception
    const recRes = await request(app)
      .post(`/api/v1/orders/${order1Id}/confirm`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(recRes.status, 200);

    // Bill & Settle Order 1
    const bill1Res = await request(app)
      .post(`/api/v1/orders/${order1Id}/bill`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({});
    assert.equal(bill1Res.status, 201);
    const bill1Id = bill1Res.body.data.id || bill1Res.body.data._id;
    const bill1Total = bill1Res.body.data.grandTotal;

    // Pay Bill 1
    const pay1Res = await request(app)
      .post(`/api/v1/bills/${bill1Id}/payments`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        mode: 'UPI',
        amount: bill1Total,
        referenceNumber: 'UPI-TEST-1234'
      });
    assert.equal(pay1Res.status, 201);

    // Close Bill 1 to complete order
    const close1Res = await request(app)
      .post(`/api/v1/bills/${bill1Id}/close`)
      .set('Authorization', `Bearer ${cashierToken}`);
    assert.equal(close1Res.status, 200);

    // Order 2: Walk-in guest on Table 2
    const ord2Res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${captainToken}`)
      .send({
        branchId: 'branch-main',
        tableId: 'tbl-02',
        submitImmediately: true,
        items: [
          { productId: prodBiryaniId, quantity: 1, note: 'Mild' }
        ]
      });
    assert.equal(ord2Res.status, 201);
    order2Id = ord2Res.body.data.id || ord2Res.body.data._id;

    // Confirm Order 2
    await request(app)
      .post(`/api/v1/orders/${order2Id}/confirm`)
      .set('Authorization', `Bearer ${adminToken}`);
  });

  after(async () => {
    await teardownTestDatabase();
  });

  it('GET /api/v1/orders/history returns aggregated sales metrics, category breakdown and orders', async () => {
    const res = await request(app)
      .get('/api/v1/orders/history')
      .set('Authorization', `Bearer ${cashierToken}`)
      .query({ branchId: 'branch-main' });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    const data = res.body.data;

    assert.ok(data.summary, 'Summary object should exist');
    assert.ok(Number(data.summary.totalOrders) >= 2, 'Should have at least 2 orders');
    assert.ok(Number(data.summary.totalSales) > 0, 'Total sales should be positive');
    assert.ok(Number(data.summary.totalItemsSold) >= 3, 'Items sold should be at least 3 portions');
    assert.ok(Array.isArray(data.categoryBreakdown), 'categoryBreakdown should be array');
    assert.ok(Array.isArray(data.dailyBreakdown), 'dailyBreakdown should be array');
    assert.ok(Array.isArray(data.orders), 'orders should be array');
  });

  it('filters order history by specific customerId', async () => {
    const res = await request(app)
      .get('/api/v1/orders/history')
      .set('Authorization', `Bearer ${cashierToken}`)
      .query({ branchId: 'branch-main', customerId: customer1Id });

    assert.equal(res.status, 200);
    const data = res.body.data;
    assert.ok(data.orders.length >= 1);
    data.orders.forEach((ord) => {
      assert.equal(ord.customer?.id, customer1Id);
      assert.equal(ord.customer?.name, 'Arjun Mehta');
    });
  });

  it('filters order history by WALK_IN customer mode', async () => {
    const res = await request(app)
      .get('/api/v1/orders/history')
      .set('Authorization', `Bearer ${cashierToken}`)
      .query({ branchId: 'branch-main', customerId: 'WALK_IN' });

    assert.equal(res.status, 200);
    const data = res.body.data;
    data.orders.forEach((ord) => {
      assert.equal(ord.customer, null, 'Walk-in orders should have null customer');
    });
  });

  it('filters order history by month (YYYY-MM)', async () => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const res = await request(app)
      .get('/api/v1/orders/history')
      .set('Authorization', `Bearer ${cashierToken}`)
      .query({ branchId: 'branch-main', month: currentMonth });

    assert.equal(res.status, 200);
    const data = res.body.data;
    assert.ok(data.orders.length >= 2);
    assert.ok(Number(data.summary.totalSales) > 0);
  });

  it('filters order history by date range (dateFrom & dateTo)', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await request(app)
      .get('/api/v1/orders/history')
      .set('Authorization', `Bearer ${cashierToken}`)
      .query({ branchId: 'branch-main', dateFrom: today, dateTo: today });

    assert.equal(res.status, 200);
    const data = res.body.data;
    assert.ok(data.orders.length >= 2, 'Should include today orders');
  });

  it('enforces branch isolation (403 for unauthorized branch)', async () => {
    const res = await request(app)
      .get('/api/v1/orders/history')
      .set('Authorization', `Bearer ${captainToken}`)
      .query({ branchId: 'branch-other' });

    assert.equal(res.status, 403);
    assert.equal(res.body.error?.code, 'PERMISSION_DENIED');
  });

  it('rejects unauthenticated requests (401)', async () => {
    const res = await request(app)
      .get('/api/v1/orders/history');

    assert.equal(res.status, 401);
  });
});
