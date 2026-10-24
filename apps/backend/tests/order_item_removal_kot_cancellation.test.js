import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import { app } from '../src/app.js';
import { setupTestDatabase, teardownTestDatabase } from './helpers/testDb.js';

describe('Order Item Removal, Strikethrough, Notification & KOT Cancellation', () => {
  let request;
  let adminToken;
  let testBranchId;
  let testTable;
  let testProducts;
  let createdOrderId;

  before(async () => {
    await setupTestDatabase({ seed: true });
    request = supertest(app);

    const loginRes = await request
      .post('/api/v1/auth/login')
      .send({ username: 'owner', password: 'owner123' })
      .expect(200);

    adminToken = loginRes.body.data.tokens.access || loginRes.body.data.tokens.accessToken;
    testBranchId = (loginRes.body.data.user.branchIds && loginRes.body.data.user.branchIds[0]) || 'branch-main';

    const tblRes = await request
      .get(`/api/v1/tables?branchId=${testBranchId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    testTable = tblRes.body.data[0];

    const prodRes = await request
      .get(`/api/v1/menu/products?branchId=${testBranchId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    testProducts = prodRes.body.data.items || prodRes.body.data;
  });

  after(async () => {
    await teardownTestDatabase();
  });

  it('1. Cancelling an item marks it CANCELLED, notifies kitchen, and preserves it on order', async () => {
    const prod1 = testProducts[0];
    const prod2 = testProducts[1];

    // Create and submit order
    const orderRes = await request
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        branchId: testBranchId,
        tableId: testTable.id || testTable._id,
        orderType: 'DINE_IN',
        submitImmediately: true,
        items: [
          { productId: prod1.id || prod1._id, quantity: 1 },
          { productId: prod2.id || prod2._id, quantity: 2 },
        ],
      })
      .expect(201);

    const orderId = orderRes.body.data.id;
    createdOrderId = orderId;

    // Confirm order to issue initial KOT
    await request
      .post(`/api/v1/orders/${orderId}/confirm`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // Verify initial KOT exists with 2 items in status NEW
    const kotsRes1 = await request
      .get(`/api/v1/kots?orderId=${orderId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const initialKots = Array.isArray(kotsRes1.body.data) ? kotsRes1.body.data : kotsRes1.body.data.items;
    const initialKot = initialKots.find((k) => k.type !== 'CANCELLATION');
    assert.ok(initialKot);
    assert.equal(initialKot.status, 'NEW');

    // Cancel 1st item
    const cancelRes = await request
      .post(`/api/v1/orders/${orderId}/cancel-item`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        itemId: prod1.id || prod1._id,
        reason: 'Customer allergic to ingredients',
      })
      .expect(200);

    // Order items still contain prod1, but with status CANCELLED
    const cancelledItem = cancelRes.body.data.order.items.find(
      (i) => i.productId === (prod1.id || prod1._id)
    );
    assert.ok(cancelledItem);
    assert.equal(cancelledItem.status, 'CANCELLED');
    assert.equal(cancelledItem.cancellationReason, 'Customer allergic to ingredients');

    // Initial KOT is still active because prod2 remains
    const kotAfterFirstCancel = await request
      .get(`/api/v1/kots/${initialKot.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    assert.equal(kotAfterFirstCancel.body.data.status, 'NEW');
  });

  it('2. When all items of a single KOT are removed, that KOT is automatically marked CANCELLED and cannot advance', async () => {
    const prod2 = testProducts[1];
    const orderId = createdOrderId;

    // Cancel the second and last item
    await request
      .post(`/api/v1/orders/${orderId}/cancel-item`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        itemId: prod2.id || prod2._id,
        reason: 'Guest changed mind completely',
      })
      .expect(200);

    // Retrieve KOTs
    const kotsRes = await request
      .get(`/api/v1/kots?orderId=${orderId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const kots = Array.isArray(kotsRes.body.data) ? kotsRes.body.data : kotsRes.body.data.items;
    const initialKot = kots.find((k) => k.type !== 'CANCELLATION');

    // All items removed -> KOT status MUST be CANCELLED
    assert.equal(initialKot.status, 'CANCELLED');
    assert.ok(initialKot.notes.includes('KOT CANCELLED'));

    // Attempting to advance cancelled KOT to PREPARING must be rejected (409 Conflict)
    await request
      .post(`/api/v1/kots/${initialKot.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'PREPARING' })
      .expect(409);
  });
});
