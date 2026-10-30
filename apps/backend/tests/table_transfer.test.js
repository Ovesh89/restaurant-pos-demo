import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import { app } from '../src/app.js';
import { setupTestDatabase, teardownTestDatabase } from './helpers/testDb.js';

describe('Table Swipe / Shift / Transfer Feature', () => {
  let request;
  let adminToken;
  let testBranchId;
  let tableA;
  let tableB;
  let tableC;
  let testProducts;
  let orderCId;

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

    const tables = tblRes.body.data;
    assert(tables.length >= 3, 'Must have at least 3 tables for transfer tests');
    tableA = tables[0];
    tableB = tables[1];
    tableC = tables[2];

    const prodRes = await request
      .get(`/api/v1/menu/products?branchId=${testBranchId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    testProducts = prodRes.body.data.items || prodRes.body.data;
  });

  after(async () => {
    await teardownTestDatabase();
  });

  it('1. Successfully shifts an active table order to an available table without changing order details and releases source table', async () => {
    const prod1 = testProducts[0];
    const prod2 = testProducts[1];

    // Create an order on Table A
    const orderRes = await request
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        branchId: testBranchId,
        tableId: tableA.id || tableA._id,
        orderType: 'DINE_IN',
        customerName: 'Rahul Verma',
        customerPhone: '+91 98765 43210',
        submitImmediately: true,
        autoApprove: true,
        items: [
          { productId: prod1.id || prod1._id, quantity: 2 },
          { productId: prod2.id || prod2._id, quantity: 1 },
        ],
      })
      .expect(201);

    const createdOrder = orderRes.body.data;
    const initialItems = JSON.parse(JSON.stringify(createdOrder.items));
    const initialFinancials = JSON.parse(JSON.stringify(createdOrder.financials));
    const initialOrderId = createdOrder.id || createdOrder._id;

    // Verify Table A is occupied
    const checkTableARes = await request
      .get(`/api/v1/tables/${tableA.id || tableA._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    assert.equal(checkTableARes.body.data.status, 'KOT_SENT');
    assert.equal(checkTableARes.body.data.activeOrderId, initialOrderId);

    // Verify Table B is available before shift
    const checkTableBBeforeRes = await request
      .get(`/api/v1/tables/${tableB.id || tableB._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    assert.equal(checkTableBBeforeRes.body.data.status, 'AVAILABLE');

    // Fetch initial KOT tickets for the order
    const kotsBeforeRes = await request
      .get(`/api/v1/kots?orderId=${initialOrderId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const kotsBefore = kotsBeforeRes.body.data.items || kotsBeforeRes.body.data;
    assert(kotsBefore.length > 0, 'Should have generated KOT');
    assert.equal(kotsBefore[0].tableNumber, tableA.tableNumber);

    // Execute table transfer: Table A -> Table B
    const transferRes = await request
      .post('/api/v1/tables/transfer')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fromTableId: tableA.id || tableA._id,
        toTableId: tableB.id || tableB._id,
        reason: 'Guest requested window booth section',
      })
      .expect(200);

    const transferData = transferRes.body.data;
    assert.equal(transferRes.body.success, true);
    assert(transferRes.body.message.includes('transferred'));

    // Check updated order
    const updatedOrder = transferData.order;
    assert.equal(updatedOrder.id || updatedOrder._id, initialOrderId, 'Order ID must remain unchanged');
    assert.equal(updatedOrder.tableNumber, tableB.tableNumber, 'Order tableNumber must be updated to Table B');
    assert.equal(updatedOrder.tableId, tableB.id || tableB._id, 'Order tableId must be updated to Table B');
    assert.equal(updatedOrder.customerName, 'Rahul Verma', 'Customer name must be preserved');
    assert.equal(updatedOrder.customerPhone, '+91 98765 43210', 'Customer phone must be preserved');

    // Verify order items and financials have NOT changed
    assert.equal(updatedOrder.items.length, initialItems.length, 'Item count must not change');
    assert.deepEqual(updatedOrder.financials, initialFinancials, 'Order financials must not change');
    assert(updatedOrder.notes.includes('Transferred from Table'), 'Order notes must record transfer');
    assert(updatedOrder.notes.includes('Guest requested window booth section'), 'Transfer reason must be preserved');

    // Verify Table A is released and AVAILABLE
    const checkTableAAfterRes = await request
      .get(`/api/v1/tables/${tableA.id || tableA._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    assert.equal(checkTableAAfterRes.body.data.status, 'AVAILABLE', 'Source Table A must be released to AVAILABLE');
    assert.equal(checkTableAAfterRes.body.data.activeOrderId, null, 'Source Table A activeOrderId must be cleared');

    // Verify Table B is now occupied with the order
    const checkTableBAfterRes = await request
      .get(`/api/v1/tables/${tableB.id || tableB._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    assert.equal(checkTableBAfterRes.body.data.status, 'KOT_SENT', 'Destination Table B must receive KOT_SENT status');
    assert.equal(checkTableBAfterRes.body.data.activeOrderId, initialOrderId, 'Destination Table B must point to order');

    // Verify KOT tickets reflect the new table
    const kotsAfterRes = await request
      .get(`/api/v1/kots?orderId=${initialOrderId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const kotsAfter = kotsAfterRes.body.data.items || kotsAfterRes.body.data;
    assert.equal(kotsAfter[0].tableNumber, tableB.tableNumber, 'KOT tickets must reflect new Table B');

    // Verify order events
    const eventsRes = await request
      .get(`/api/v1/orders/${initialOrderId}/events`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const events = eventsRes.body.data;
    const transferEvent = events.find((e) => e.eventType === 'TABLE_TRANSFERRED');
    assert(transferEvent, 'TABLE_TRANSFERRED event must be recorded');
    assert.equal(transferEvent.metadata.toTableNumber, tableB.tableNumber);
  });

  it('2. Rejects table transfer if destination table is occupied (409 Conflict)', async () => {
    // Create an order on Table C
    const orderCRes = await request
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        branchId: testBranchId,
        tableId: tableC.id || tableC._id,
        orderType: 'DINE_IN',
        submitImmediately: true,
        items: [{ productId: testProducts[0].id || testProducts[0]._id, quantity: 1 }],
      })
      .expect(201);

    orderCId = orderCRes.body.data.id || orderCRes.body.data._id;

    // Try to transfer Table C order to Table B (which is already occupied with Table A's transferred order)
    const errRes = await request
      .post('/api/v1/tables/transfer')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fromTableId: tableC.id || tableC._id,
        toTableId: tableB.id || tableB._id,
      })
      .expect(409);

    assert.equal(errRes.body.success, false);
    assert(errRes.body.error.message.includes('occupied'));
  });

  it('3. Rejects table transfer if destination table is the same as source table (400 Validation Error)', async () => {
    const errRes = await request
      .post('/api/v1/tables/transfer')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fromTableId: tableB.id || tableB._id,
        toTableId: tableB.id || tableB._id,
      })
      .expect(400);

    assert.equal(errRes.body.success, false);
    assert(errRes.body.error.message.includes('Destination table cannot be the same'));
  });

  it('4. Rejects table transfer if source table has no active order (404 Not Found)', async () => {
    // Table A was released and is currently AVAILABLE with no active order
    const errRes = await request
      .post('/api/v1/tables/transfer')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fromTableId: tableA.id || tableA._id,
        toTableId: 'tbl-non-existent-99',
      });

    assert.equal(errRes.status, 404);
    assert.equal(errRes.body.success, false);
  });

  it('5. Supports shift table via POST /api/v1/orders/:id/shift-table route', async () => {
    // Table C currently has an active order (orderCId). Table A is currently available.
    // Shift Table C's order to Table A via the order endpoint!
    assert(orderCId, 'Must have order on Table C');

    const shiftRes = await request
      .post(`/api/v1/orders/${orderCId}/shift-table`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        toTableId: tableA.id || tableA._id,
        reason: 'Shifted via order action',
      })
      .expect(200);

    assert.equal(shiftRes.body.success, true);
    assert.equal(shiftRes.body.data.order.tableNumber, tableA.tableNumber);

    // Table C should now be AVAILABLE
    const checkTableC = await request
      .get(`/api/v1/tables/${tableC.id || tableC._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    assert.equal(checkTableC.body.data.status, 'AVAILABLE');

    // Table A should now be occupied
    const checkTableA = await request
      .get(`/api/v1/tables/${tableA.id || tableA._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    assert.notEqual(checkTableA.body.data.status, 'AVAILABLE');
    assert.equal(checkTableA.body.data.activeOrderId, orderCId);
  });
});
