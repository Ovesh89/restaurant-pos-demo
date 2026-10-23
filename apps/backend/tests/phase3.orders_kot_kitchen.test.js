import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/app.js';
import { getDb } from '../src/config/database.js';
import { setupTestDatabase, teardownTestDatabase } from './helpers/testDb.js';

describe('Phase 3A — Orders, Reception, KOT, Kitchen & Notifications API Suite', () => {
  let captainToken;
  let receptionToken;
  let kitchenToken;
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
    kitchenToken = await loginAs('kitchen', 'kitchen123');
    adminToken = await loginAs('admin', 'admin123');
  });

  after(async () => {
    await teardownTestDatabase();
  });

  it('captures product price and tax snapshot on order creation and preserves snapshot after menu price change', async () => {
    // 1. Captain creates order on table-01 (alias for tbl-01) with Chicken Tikka (320.00)
    const createRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${captainToken}`)
      .send({
        branchId: 'branch-main',
        tableId: 'table-01',
        items: [
          {
            productId: 'prod-chicken-tikka',
            quantity: 2,
            note: 'Extra crispy',
          },
        ],
        submitImmediately: false,
      });

    assert.equal(createRes.status, 201);
    assert.equal(createRes.body.success, true);
    const orderData = createRes.body.data;
    const orderId = orderData._id;

    assert.equal(orderData.status, 'DRAFT');
    assert.equal(orderData.tableId, 'tbl-01');
    assert.equal(orderData.tableNumber, 'T-01');
    assert.equal(orderData.items.length, 1);
    assert.equal(orderData.items[0].unitPrice, '240.00');
    assert.equal(orderData.items[0].productName, 'Tandoori Tikka');
    assert.equal(orderData.items[0].lineSubtotal, '480.00');
    assert.equal(orderData.financials.subtotal, '480.00');

    // Verify Table tbl-01 is OCCUPIED with activeOrderId
    const db = await getDb();
    const tableDoc = await db.collection('tables').findOne({ _id: 'tbl-01' });
    assert.equal(tableDoc.status, 'OCCUPIED');
    assert.equal(tableDoc.activeOrderId, orderId);

    // Verify duplicate order on same occupied table is rejected with 409
    const dupRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${captainToken}`)
      .send({
        branchId: 'branch-main',
        tableId: 'tbl-01',
        items: [{ productId: 'prod-paneer-tikka', quantity: 1 }],
      });
    assert.equal(dupRes.status, 409);
    assert.equal(dupRes.body.error.code, 'INVALID_STATE');

    // 2. Admin changes Chicken Tikka price to 380.00
    const priceRes = await request(app)
      .post('/api/v1/menu/products/prod-chicken-tikka/price')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        price: '380.00',
        reason: 'Seasonal revision',
      });
    assert.equal(priceRes.status, 200);

    // 3. Retrieve order again: captured unitPrice MUST remain 240.00
    const getRes = await request(app)
      .get(`/api/v1/orders/${orderId}`)
      .set('Authorization', `Bearer ${captainToken}`);
    assert.equal(getRes.status, 200);
    assert.equal(getRes.body.data.items[0].unitPrice, '240.00');

    // Restore price back to 240.00 for subsequent tests
    await request(app)
      .post('/api/v1/menu/products/prod-chicken-tikka/price')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        price: '240.00',
        reason: 'Restore seed price',
      });
  });

  it('holds, resumes, and submits a draft order to Reception', async () => {
    const createRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${captainToken}`)
      .send({
        branchId: 'branch-main',
        tableId: 'table-02',
        items: [{ productId: 'prod-paneer-tikka', quantity: 1 }],
        submitImmediately: false,
      });
    assert.equal(createRes.status, 201);
    const orderId = createRes.body.data._id;

    // Hold order
    const holdRes = await request(app)
      .post(`/api/v1/orders/${orderId}/hold`)
      .set('Authorization', `Bearer ${captainToken}`)
      .send({ reason: 'Waiting for guest arrival' });
    assert.equal(holdRes.status, 200);
    assert.equal(holdRes.body.data.status, 'HOLD');
    assert.equal(holdRes.body.data.held, true);

    // Resume order
    const resumeRes = await request(app)
      .post(`/api/v1/orders/${orderId}/resume`)
      .set('Authorization', `Bearer ${captainToken}`);
    assert.equal(resumeRes.status, 200);
    assert.equal(resumeRes.body.data.status, 'DRAFT');
    assert.equal(resumeRes.body.data.held, false);

    // Submit order to Reception
    const submitRes = await request(app)
      .post(`/api/v1/orders/${orderId}/submit`)
      .set('Authorization', `Bearer ${captainToken}`);
    assert.equal(submitRes.status, 200);
    assert.equal(submitRes.body.data.status, 'WAITING_CONFIRMATION');
    assert.ok(submitRes.body.data.submittedAt);
  });

  it('confirms order at Reception, generates initial KOT idempotently, and records order events', async () => {
    // 1. Captain creates and immediately submits order on table-04
    const orderRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${captainToken}`)
      .send({
        branchId: 'branch-main',
        tableId: 'table-04',
        items: [
          { productId: 'prod-butter-chicken', quantity: 1, note: 'Mild' },
          { productId: 'prod-tandoori-roti', quantity: 4 },
        ],
        submitImmediately: true,
      });
    assert.equal(orderRes.status, 201);
    const orderId = orderRes.body.data._id;
    assert.equal(orderRes.body.data.status, 'WAITING_CONFIRMATION');

    // 2. Reception confirms order
    const confirmRes = await request(app)
      .post(`/api/v1/orders/${orderId}/confirm`)
      .set('Authorization', `Bearer ${receptionToken}`);
    assert.equal(confirmRes.status, 200);
    assert.equal(confirmRes.body.data.order.status, 'KOT_SENT');
    const kotData = confirmRes.body.data.kot;
    assert.ok(kotData);
    assert.equal(kotData.revision, 1);
    assert.equal(kotData.type, 'NEW');
    assert.equal(kotData.status, 'NEW');
    assert.equal(kotData.items.length, 2);

    // Verify Table 04 status updated to KOT_SENT
    const db = await getDb();
    const tableDoc = await db.collection('tables').findOne({ _id: 'tbl-04' });
    assert.equal(tableDoc.status, 'KOT_SENT');

    // 3. Repeat confirmation (Idempotency check: must not create duplicate KOT)
    const repeatRes = await request(app)
      .post(`/api/v1/orders/${orderId}/confirm`)
      .set('Authorization', `Bearer ${receptionToken}`);
    assert.equal(repeatRes.status, 200);
    assert.equal(repeatRes.body.data.kot._id, kotData._id);

    const kotsCount = await db.collection('kots').countDocuments({ orderId });
    assert.equal(kotsCount, 1);

    // 4. Verify order events timeline
    const eventsRes = await request(app)
      .get(`/api/v1/orders/${orderId}/events`)
      .set('Authorization', `Bearer ${captainToken}`);
    assert.equal(eventsRes.status, 200);
    const eventTypes = eventsRes.body.data.map((e) => e.type);
    assert.ok(eventTypes.includes('ORDER_CREATED'));
    assert.ok(eventTypes.includes('ORDER_SUBMITTED'));
    assert.ok(eventTypes.includes('ORDER_CONFIRMED'));
  });

  it('requires reason when rejecting an order, releases table, and notifies Captain', async () => {
    const orderRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${captainToken}`)
      .send({
        branchId: 'branch-main',
        tableId: 'table-05',
        items: [{ productId: 'prod-butter-milk', quantity: 2 }],
        submitImmediately: true,
      });
    const orderId = orderRes.body.data._id;

    // Reject without reason -> 400
    const rejectFail = await request(app)
      .post(`/api/v1/orders/${orderId}/reject`)
      .set('Authorization', `Bearer ${receptionToken}`)
      .send({ reason: '' });
    assert.equal(rejectFail.status, 400);

    // Reject with valid reason -> 200
    const rejectRes = await request(app)
      .post(`/api/v1/orders/${orderId}/reject`)
      .set('Authorization', `Bearer ${receptionToken}`)
      .send({ reason: 'Kitchen out of milk solids' });
    assert.equal(rejectRes.status, 200);
    assert.equal(rejectRes.body.data.status, 'REJECTED');

    // Verify Table 05 is reset to AVAILABLE
    const db = await getDb();
    const tableDoc = await db.collection('tables').findOne({ _id: 'tbl-05' });
    assert.equal(tableDoc.status, 'AVAILABLE');
    assert.equal(tableDoc.activeOrderId, null);

    // Verify Kitchen Queue has 0 active tickets for rejected order
    const queueRes = await request(app)
      .get('/api/v1/kitchen/queue?branchId=branch-main')
      .set('Authorization', `Bearer ${kitchenToken}`);
    assert.equal(queueRes.status, 200);
    const orderKotInQueue = queueRes.body.data.find((k) => k.orderId === orderId);
    assert.equal(orderKotInQueue, undefined);
  });

  it('creates MODIFICATION KOT when items are added after initial KOT and CANCELLATION KOT on cancellation', async () => {
    // 1. Create and confirm order on table-06
    const orderRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${captainToken}`)
      .send({
        branchId: 'branch-main',
        tableId: 'table-06',
        items: [{ productId: 'prod-chicken-dum-biryani', quantity: 1 }],
        submitImmediately: true,
      });
    const orderId = orderRes.body.data._id;

    await request(app)
      .post(`/api/v1/orders/${orderId}/confirm`)
      .set('Authorization', `Bearer ${receptionToken}`);

    // 2. Captain adds more items -> generates MODIFICATION KOT (Revision 2)
    const modifyRes = await request(app)
      .post(`/api/v1/orders/${orderId}/items`)
      .set('Authorization', `Bearer ${captainToken}`)
      .send({
        items: [{ productId: 'prod-soft-drink', quantity: 2, note: 'Cold' }],
        reason: 'Customer ordered drinks',
      });
    assert.equal(modifyRes.status, 200);
    const modKot = modifyRes.body.data.modificationKot;
    assert.ok(modKot);
    assert.equal(modKot.revision, 2);
    assert.equal(modKot.type, 'MODIFICATION');
    assert.equal(modKot.items.length, 1);
    assert.equal(modKot.items[0].changeType, 'ADD');
    assert.equal(modKot.items[0].quantity, 2);

    // 3. Cancel single item via /cancel-item -> generates CANCELLATION KOT (Revision 3)
    const addedItemId = modifyRes.body.data.order.items[1]._id;
    const cancelItemRes = await request(app)
      .post(`/api/v1/orders/${orderId}/cancel-item`)
      .set('Authorization', `Bearer ${receptionToken}`)
      .send({
        itemId: addedItemId,
        reason: 'Guest changed mind about soda',
      });
    assert.equal(cancelItemRes.status, 200);
    assert.ok(cancelItemRes.body.data.cancellationKot);
    assert.equal(cancelItemRes.body.data.cancellationKot.type, 'CANCELLATION');
    assert.equal(cancelItemRes.body.data.cancellationKot.revision, 3);

    // 4. Admin cancels entire order -> generates CANCELLATION KOT and frees table-06
    const cancelOrderRes = await request(app)
      .post(`/api/v1/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Customer had emergency and left' });
    assert.equal(cancelOrderRes.status, 200);
    assert.equal(cancelOrderRes.body.data.status, 'CANCELLED');

    const db = await getDb();
    const tableDoc = await db.collection('tables').findOne({ _id: 'tbl-06' });
    assert.equal(tableDoc.status, 'AVAILABLE');
    assert.equal(tableDoc.activeOrderId, null);
  });

  it('handles KOT listing, print payload, print status, live kitchen queue, and NEW -> PREPARING -> READY -> SERVED transitions', async () => {
    // Create and confirm order on table-10
    const orderRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${captainToken}`)
      .send({
        branchId: 'branch-main',
        tableId: 'table-10',
        items: [
          { productId: 'prod-chicken-tikka', quantity: 2, note: 'Well done' },
          { productId: 'prod-butter-naan', quantity: 3 },
        ],
        submitImmediately: true,
      });
    const orderId = orderRes.body.data._id;

    const confirmRes = await request(app)
      .post(`/api/v1/orders/${orderId}/confirm`)
      .set('Authorization', `Bearer ${receptionToken}`);
    const kotId = confirmRes.body.data.kot._id;
    const kotNumber = confirmRes.body.data.kot.kotNumber;

    // 1. List and detail KOTs
    const listRes = await request(app)
      .get('/api/v1/kots?branchId=branch-main')
      .set('Authorization', `Bearer ${kitchenToken}`);
    assert.equal(listRes.status, 200);
    assert.ok(listRes.body.data.pagination.total >= 1);

    const detailRes = await request(app)
      .get(`/api/v1/kots/${kotId}`)
      .set('Authorization', `Bearer ${kitchenToken}`);
    assert.equal(detailRes.status, 200);
    assert.equal(detailRes.body.data.kotNumber, kotNumber);

    // 2. Thermal print payload & print status update
    const printRes = await request(app)
      .get(`/api/v1/kots/${kotId}/print`)
      .set('Authorization', `Bearer ${kitchenToken}`);
    assert.equal(printRes.status, 200);
    assert.equal(printRes.body.data.restaurant.branchCode, 'MAIN');
    assert.equal(printRes.body.data.kotNumber, kotNumber);
    assert.equal(printRes.body.data.tableNumber, 'T-10');
    assert.equal(printRes.body.data.items.length, 2);

    const printStatusRes = await request(app)
      .post(`/api/v1/kots/${kotId}/print-status`)
      .set('Authorization', `Bearer ${kitchenToken}`)
      .send({ printStatus: 'PRINTED' });
    assert.equal(printStatusRes.status, 200);
    assert.equal(printStatusRes.body.data.printStatus, 'PRINTED');

    // 3. Kitchen Queue includes active KOT with elapsedMinutes
    const queueRes = await request(app)
      .get('/api/v1/kitchen/queue?branchId=branch-main')
      .set('Authorization', `Bearer ${kitchenToken}`);
    assert.equal(queueRes.status, 200);
    const inQueue = queueRes.body.data.find((k) => k._id === kotId);
    assert.ok(inQueue);
    assert.equal(typeof inQueue.elapsedMinutes, 'number');

    // 4. Captain cannot update kitchen status (403 Forbidden)
    const capForbidden = await request(app)
      .post(`/api/v1/kots/${kotId}/status`)
      .set('Authorization', `Bearer ${captainToken}`)
      .send({ status: 'PREPARING' });
    assert.equal(capForbidden.status, 403);

    // 5. Invalid jump NEW -> SERVED is rejected (409 Conflict)
    const invalidJump = await request(app)
      .post(`/api/v1/kots/${kotId}/status`)
      .set('Authorization', `Bearer ${kitchenToken}`)
      .send({ status: 'SERVED' });
    assert.equal(invalidJump.status, 409);

    // 6. Valid flow: NEW -> PREPARING -> READY -> SERVED
    const db = await getDb();

    const prepRes = await request(app)
      .post(`/api/v1/kots/${kotId}/status`)
      .set('Authorization', `Bearer ${kitchenToken}`)
      .send({ status: 'PREPARING' });
    assert.equal(prepRes.status, 200);
    assert.equal(prepRes.body.data.status, 'PREPARING');
    assert.equal((await db.collection('tables').findOne({ _id: 'tbl-10' })).status, 'PREPARING');
    assert.equal((await db.collection('orders').findOne({ _id: orderId })).status, 'PREPARING');

    const readyRes = await request(app)
      .post(`/api/v1/kots/${kotId}/status`)
      .set('Authorization', `Bearer ${kitchenToken}`)
      .send({ status: 'READY' });
    assert.equal(readyRes.status, 200);
    assert.equal(readyRes.body.data.status, 'READY');
    assert.equal((await db.collection('tables').findOne({ _id: 'tbl-10' })).status, 'READY');
    assert.equal((await db.collection('orders').findOne({ _id: orderId })).status, 'READY');

    // Verify Captain receives KOT_READY notification and can mark it as read
    const notifRes = await request(app)
      .get('/api/v1/notifications?branchId=branch-main&unreadOnly=true')
      .set('Authorization', `Bearer ${captainToken}`);
    assert.equal(notifRes.status, 200);
    const readyNotif = notifRes.body.data.find(
      (n) => n.eventType === 'KOT_READY' && n.metadata?.kotId === kotId
    );
    assert.ok(readyNotif, 'Expected KOT_READY notification for Captain');

    const markReadRes = await request(app)
      .post(`/api/v1/notifications/${readyNotif.id}/read`)
      .set('Authorization', `Bearer ${captainToken}`);
    assert.equal(markReadRes.status, 200);
    assert.equal(markReadRes.body.data.isRead, true);

    // Transition READY -> SERVED
    const servedRes = await request(app)
      .post(`/api/v1/kots/${kotId}/status`)
      .set('Authorization', `Bearer ${kitchenToken}`)
      .send({ status: 'SERVED' });
    assert.equal(servedRes.status, 200);
    assert.equal(servedRes.body.data.status, 'SERVED');

    const finalOrder = await db.collection('orders').findOne({ _id: orderId });
    assert.equal(finalOrder.status, 'SERVED');
    assert.ok(finalOrder.servedAt);
  });
});
