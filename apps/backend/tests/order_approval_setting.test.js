import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import { app } from '../src/app.js';
import { setupTestDatabase, teardownTestDatabase } from './helpers/testDb.js';

describe('System Setting: requireOrderApproval Toggle & Workflow Verification', () => {
  let request;
  let adminToken;
  let testBranchId;
  let testTables;
  let testProduct;

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
    testTables = tblRes.body.data;

    const prodRes = await request
      .get(`/api/v1/menu/products?branchId=${testBranchId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    testProduct = (prodRes.body.data.items || prodRes.body.data)[0];
  });

  after(async () => {
    await teardownTestDatabase();
  });

  it('1. Default branch setting requires order approval (order status = WAITING_CONFIRMATION)', async () => {
    const table = testTables[0];
    const res = await request
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        branchId: testBranchId,
        tableId: table.id || table._id,
        orderType: 'DINE_IN',
        submitImmediately: true,
        items: [{ productId: testProduct.id || testProduct._id, quantity: 2 }]
      })
      .expect(201);

    assert.equal(res.body.success, true);
    assert.equal(res.body.data.status, 'WAITING_CONFIRMATION');

    // Verify no KOT was created yet
    const kotsRes = await request
      .get(`/api/v1/kots?orderId=${res.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const kots = Array.isArray(kotsRes.body.data) ? kotsRes.body.data : (kotsRes.body.data.items || []);
    assert.equal(kots.length, 0);
  });

  it('2. Disabling requireOrderApproval in branch settings immediately auto-approves orders to KOT_SENT and creates KOT', async () => {
    const table = testTables[1];
    // Disable order approval in branch
    const updateRes = await request
      .patch(`/api/v1/branches/${testBranchId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ requireOrderApproval: false })
      .expect(200);

    assert.equal(updateRes.body.data.requireOrderApproval, false);

    // Create a new order with approval disabled
    const orderRes = await request
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        branchId: testBranchId,
        tableId: table.id || table._id,
        orderType: 'DINE_IN',
        submitImmediately: true,
        items: [{ productId: testProduct.id || testProduct._id, quantity: 1 }]
      })
      .expect(201);

    assert.equal(orderRes.body.success, true);
    assert.equal(orderRes.body.data.status, 'KOT_SENT');

    // Verify initial KOT was automatically created and dispatched to kitchen
    const kotsRes = await request
      .get(`/api/v1/kots?orderId=${orderRes.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const kots = Array.isArray(kotsRes.body.data) ? kotsRes.body.data : (kotsRes.body.data.items || []);
    assert.ok(kots.length >= 1, 'Initial KOT must be created immediately');
    assert.equal(kots[0].status, 'NEW');
  });

  it('3. Re-enabling requireOrderApproval restores the reception approval workflow', async () => {
    const table = testTables[2];
    // Re-enable order approval
    await request
      .patch(`/api/v1/branches/${testBranchId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ requireOrderApproval: true })
      .expect(200);

    const orderRes = await request
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        branchId: testBranchId,
        tableId: table.id || table._id,
        orderType: 'DINE_IN',
        submitImmediately: true,
        items: [{ productId: testProduct.id || testProduct._id, quantity: 1 }]
      })
      .expect(201);

    assert.equal(orderRes.body.success, true);
    assert.equal(orderRes.body.data.status, 'WAITING_CONFIRMATION');
  });
});
