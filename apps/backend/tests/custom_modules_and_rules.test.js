import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import { app } from '../src/app.js';
import { setupTestDatabase, teardownTestDatabase } from './helpers/testDb.js';
import { getIstDateKey } from '../src/utils/sequence.js';

describe('Custom Modules & Enhanced POS Workflows', () => {
  let request;
  let adminToken;
  let testBranchId;

  before(async () => {
    await setupTestDatabase({ seed: true });
    request = supertest(app);

    // Login as owner
    const loginRes = await request
      .post('/api/v1/auth/login')
      .send({ username: 'owner', password: 'owner123' })
      .expect(200);

    adminToken = loginRes.body.data.tokens.access || loginRes.body.data.tokens.accessToken;
    testBranchId = (loginRes.body.data.user.branchIds && loginRes.body.data.user.branchIds[0]) || 'branch-main';
  });


  after(async () => {
    await teardownTestDatabase();
  });

  describe('1. Daily Order Numbering & Reset (ORD-DDMMYYYY-N)', () => {
    it('generates order numbers in ORD-DDMMYYYY-N format for current date', async () => {
      const todayKey = getIstDateKey();

      // Get available table & product
      const tblRes = await request
        .get(`/api/v1/tables?branchId=${testBranchId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const table = tblRes.body.data[0];

      const prodRes = await request
        .get(`/api/v1/menu/products?branchId=${testBranchId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const product = (prodRes.body.data.items || prodRes.body.data)[0];

      const res1 = await request
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          branchId: testBranchId,
          tableId: table._id || table.id,
          orderType: 'DINE_IN',
          items: [{ productId: product._id || product.id, quantity: 1 }],
        })
        .expect(201);

      const ordNum = res1.body.data.orderNumber;
      assert.match(ordNum, new RegExp(`^ORD-${todayKey}-\\d+$`), `Order number ${ordNum} should match daily format`);
    });
  });

  describe('2. Take Away & Online Orders (without table)', () => {
    it('creates Take Away order without tableId', async () => {
      const prodRes = await request
        .get(`/api/v1/menu/products?branchId=${testBranchId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const product = (prodRes.body.data.items || prodRes.body.data)[0];

      const res = await request
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          branchId: testBranchId,
          orderType: 'TAKEAWAY',
          customerName: 'Rahul Sharma',
          customerPhone: '9876543210',
          items: [{ productId: product._id || product.id, quantity: 2 }],
        })
        .expect(201);

      assert.equal(res.body.data.orderType, 'TAKEAWAY');
      assert.equal(res.body.data.tableId, null);
      assert.equal(res.body.data.tableNumber, 'Take Away');
      assert.equal(res.body.data.customerName, 'Rahul Sharma');
    });

    it('creates Zomato online order without tableId', async () => {
      const prodRes = await request
        .get(`/api/v1/menu/products?branchId=${testBranchId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const product = (prodRes.body.data.items || prodRes.body.data)[0];

      const res = await request
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          branchId: testBranchId,
          orderType: 'ZOMATO',
          onlineOrderRef: 'ZOM-9921',
          tableNumber: 'Zomato #9921',
          items: [{ productId: product._id || product.id, quantity: 1 }],
        })
        .expect(201);

      assert.equal(res.body.data.orderType, 'ZOMATO');
      assert.equal(res.body.data.tableId, null);
      assert.equal(res.body.data.tableNumber, 'Zomato #9921');
    });
  });

  describe('3. Assigned Dining Area (Add, Update, Delete, Active/Inactive)', () => {
    let createdAreaId;

    it('creates and lists a new dining area', async () => {
      const createRes = await request
        .post('/api/v1/areas')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          branchId: testBranchId,
          name: 'Terrace Garden Area',
          sortOrder: 5,
          isActive: true,
        })
        .expect(201);

      createdAreaId = createRes.body.data._id || createRes.body.data.id;
      assert.equal(createRes.body.data.name, 'Terrace Garden Area');
      assert.equal(createRes.body.data.isActive, true);
    });

    it('updates dining area name and toggles active/inactive', async () => {
      const patchRes = await request
        .patch(`/api/v1/areas/${createdAreaId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Terrace Lounge Area',
          isActive: false,
        })
        .expect(200);

      assert.equal(patchRes.body.data.name, 'Terrace Lounge Area');
      assert.equal(patchRes.body.data.isActive, false);
    });

    it('deletes dining area when no tables are assigned to it', async () => {
      const delRes = await request
        .delete(`/api/v1/areas/${createdAreaId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      assert.equal(delRes.body.success, true);
    });
  });

  describe('4. Kitchen Stations (Add, Update, Delete, Active/Inactive)', () => {
    let stationId;

    it('lists kitchen stations and auto-seeds defaults', async () => {
      const res = await request
        .get(`/api/v1/kitchen-stations?branchId=${testBranchId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      assert.ok(Array.isArray(res.body.data));
      assert.ok(res.body.data.length >= 5, 'Should have default kitchen stations');
    });

    it('creates a new kitchen station', async () => {
      const res = await request
        .post('/api/v1/kitchen-stations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          branchId: testBranchId,
          name: 'Mocktail & Juice Bar',
          code: 'BAR-MOCK',
          sortOrder: 10,
          isActive: true,
        })
        .expect(201);

      stationId = res.body.data._id || res.body.data.id;
      assert.equal(res.body.data.name, 'Mocktail & Juice Bar');
      assert.equal(res.body.data.code, 'BAR-MOCK');
    });

    it('updates and toggles active/inactive for kitchen station', async () => {
      const res = await request
        .patch(`/api/v1/kitchen-stations/${stationId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Live Beverage Counter',
          isActive: false,
        })
        .expect(200);

      assert.equal(res.body.data.name, 'Live Beverage Counter');
      assert.equal(res.body.data.isActive, false);
    });

    it('deletes kitchen station', async () => {
      const res = await request
        .delete(`/api/v1/kitchen-stations/${stationId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      assert.equal(res.body.success, true);
    });
  });

  describe('5. Category kotRequired (KOT created only when required)', () => {
    let noKotCatId;
    let noKotProductId;

    it('creates category with kotRequired: false and a dish under it', async () => {
      const catRes = await request
        .post('/api/v1/menu/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          branchId: testBranchId,
          name: 'Packaged Drinks & Water',
          kotRequired: false,
        })
        .expect(201);

      noKotCatId = catRes.body.data._id || catRes.body.data.id;
      assert.equal(catRes.body.data.kotRequired, false);

      const prodRes = await request
        .post('/api/v1/menu/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          branchId: testBranchId,
          categoryId: noKotCatId,
          name: 'Mineral Water 1L',
          price: '30.00',
          currentPrice: '30.00',
        })
        .expect(201);

      noKotProductId = prodRes.body.data._id || prodRes.body.data.id;
    });

    it('does NOT create KOT ticket when confirming order with only kotRequired: false items', async () => {
      const orderRes = await request
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          branchId: testBranchId,
          orderType: 'TAKEAWAY',
          submitImmediately: true,
          items: [{ productId: noKotProductId, quantity: 2 }],
        })
        .expect(201);

      const orderId = orderRes.body.data._id || orderRes.body.data.id;

      // Confirm order
      const confirmRes = await request
        .post(`/api/v1/orders/${orderId}/confirm`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      assert.equal(confirmRes.body.data.kot, null, 'No KOT should be created');
      assert.equal(confirmRes.body.data.order.kots.length, 0);
    });
  });

  describe('6. Order Item Removal & Unsettled Bill Recalculation', () => {
    it('removes item from order, recalculates pending bill, and blocks removal once settled', async () => {
      // 1. Get 2 products
      const prodRes = await request
        .get(`/api/v1/menu/products?branchId=${testBranchId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const p1 = (prodRes.body.data.items || prodRes.body.data)[0];
      const p2 = (prodRes.body.data.items || prodRes.body.data)[1];

      // 2. Create order with 2 items
      const orderRes = await request
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          branchId: testBranchId,
          orderType: 'TAKEAWAY',
          submitImmediately: true,
          items: [
            { productId: p1._id || p1.id, quantity: 1 },
            { productId: p2._id || p2.id, quantity: 1 },
          ],
        })
        .expect(201);

      const orderId = orderRes.body.data._id || orderRes.body.data.id;
      const initialGrandTotal = parseFloat(orderRes.body.data.financials.grandTotal);

      // Confirm order
      await request
        .post(`/api/v1/orders/${orderId}/confirm`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Generate unsettled bill
      const billRes = await request
        .post(`/api/v1/orders/${orderId}/bill`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      const billId = billRes.body.data._id || billRes.body.data.id;
      const initialBillTotal = parseFloat(billRes.body.data.grandTotal);
      assert.ok(initialBillTotal > 0);

      // 3. Remove 1 item before settlement
      const itemToRemove = orderRes.body.data.items[1];
      const cancelRes = await request
        .post(`/api/v1/orders/${orderId}/cancel-item`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          itemId: itemToRemove._id || itemToRemove.id,
          reason: 'Guest changed mind',
        })
        .expect(200);

      const updatedOrder = cancelRes.body.data.order;
      const newOrderTotal = parseFloat(updatedOrder.financials.grandTotal);
      assert.ok(newOrderTotal < initialGrandTotal, 'Total should be reduced');

      // 4. Verify the unsettled bill was automatically recalculated with the subtracted amount!
      const fetchBillRes = await request
        .get(`/api/v1/bills/${billId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const updatedBillTotal = parseFloat(fetchBillRes.body.data.grandTotal);
      assert.ok(updatedBillTotal < initialBillTotal, 'Bill grand total should be reduced after item removal');
      assert.equal(fetchBillRes.body.data.subtotal, updatedOrder.financials.subtotal, 'Bill subtotal should match reduced order subtotal');

      // 5. Complete payment and close bill
      await request
        .post(`/api/v1/bills/${billId}/payments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          mode: 'CASH',
          amount: updatedBillTotal.toFixed(2),
        })
        .expect(201);

      await request
        .post(`/api/v1/bills/${billId}/close`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // 6. Try to remove the remaining item after bill is settled -> MUST BE REJECTED!
      const remainingItem = updatedOrder.items[0];
      await request
        .post(`/api/v1/orders/${orderId}/cancel-item`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          itemId: remainingItem._id || remainingItem.id,
          reason: 'Attempt removal after settlement',
        })
        .expect(409); // StateConflictError: Cannot remove item once settled
    });
  });
});
