import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import { app } from '../src/app.js';
import { setupTestDatabase, teardownTestDatabase } from './helpers/testDb.js';

describe('Off-Menu & Custom Item Add / Update Workflow', () => {
  let request;
  let adminToken;
  let testBranchId;
  let testTable;
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

    testTable = tblRes.body.data[0];

    const prodRes = await request
      .get(`/api/v1/menu/products?branchId=${testBranchId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const prods = prodRes.body.data.items || prodRes.body.data;
    testProduct = prods[0];
  });

  after(async () => {
    await teardownTestDatabase();
  });

  it('1. Successfully creates an order containing an off-menu item with custom-XX ID', async () => {
    const customId = 'custom-1793293594297';
    const orderRes = await request
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        branchId: testBranchId,
        tableId: testTable.id || testTable._id,
        orderType: 'DINE_IN',
        submitImmediately: true,
        autoApprove: true,
        items: [
          {
            productId: testProduct.id || testProduct._id,
            quantity: 1,
            note: 'Standard menu item',
          },
          {
            productId: customId,
            name: 'Chef Special Halwa (Special)',
            productName: 'Chef Special Halwa (Special)',
            code: 'OFF-MENU',
            price: 250,
            unitPrice: 250,
            taxRate: 5,
            station: 'Dessert Station',
            kotRequired: true,
            isCustom: true,
            quantity: 2,
            note: 'Less sugar, extra dry fruits',
          },
        ],
      })
      .expect(201);

    const order = orderRes.body.data;
    assert.equal(orderRes.body.success, true);
    assert.equal(order.items.length, 2);

    const customItem = order.items.find((i) => i.productId === customId);
    assert(customItem, 'Custom item must be present in order items');
    assert.equal(customItem.productName, 'Chef Special Halwa (Special)');
    assert.equal(customItem.unitPrice, '250.00');
    assert.equal(customItem.quantity, 2);
    assert.equal(customItem.lineSubtotal, '500.00');
    assert.equal(customItem.taxAmount, '25.00'); // 5% of 500
    assert.equal(customItem.lineTotal, '525.00');
    assert.equal(customItem.code, 'OFF-MENU');
    assert.equal(customItem.isCustom, true);
    assert.equal(customItem.note, 'Less sugar, extra dry fruits');

    // Verify KOT ticket was generated and includes the off-menu item
    const kotRes = await request
      .get(`/api/v1/kots?orderId=${order.id || order._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const kots = kotRes.body.data.items || kotRes.body.data;
    assert(kots.length > 0, 'KOT must be generated');
    const kotCustomItem = kots[0].items.find((i) => i.productId === customId);
    assert(kotCustomItem, 'Off-menu item must be present on kitchen ticket');
    assert.equal(kotCustomItem.productName, 'Chef Special Halwa (Special)');
    assert.equal(kotCustomItem.quantity, 2);
  });

  it('2. Successfully adds an off-menu item to an existing order (addOrModifyItems)', async () => {
    // Find active order on table
    const orderRes = await request
      .get(`/api/v1/orders?tableId=${testTable.id || testTable._id}&status=KOT_SENT`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const orders = orderRes.body.data.items || orderRes.body.data;
    assert(orders.length > 0);
    const existingOrder = orders[0];
    const orderId = existingOrder.id || existingOrder._id;

    const newCustomId = `custom-${Date.now()}`;
    const addRes = await request
      .post(`/api/v1/orders/${orderId}/items`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [
          {
            productId: newCustomId,
            name: 'Special Tandoori Butter Naan',
            productName: 'Special Tandoori Butter Naan',
            price: 80,
            unitPrice: 80,
            taxRate: 5,
            station: 'Tandoor',
            kotRequired: true,
            isCustom: true,
            quantity: 3,
            note: 'Crispy butter glaze',
          },
        ],
        reason: 'Customer requested special off-menu naan',
      })
      .expect(200);

    assert.equal(addRes.body.success, true);
    const updatedOrder = addRes.body.data.order;
    const addedNaan = updatedOrder.items.find((i) => i.productId === newCustomId);
    assert(addedNaan, 'Newly added off-menu item must be present');
    assert.equal(addedNaan.productName, 'Special Tandoori Butter Naan');
    assert.equal(addedNaan.unitPrice, '80.00');
    assert.equal(addedNaan.quantity, 3);
    assert.equal(addedNaan.lineSubtotal, '240.00');

    // Verify modification KOT
    const modKot = addRes.body.data.modificationKot;
    assert(modKot, 'Modification KOT must be created');
    const modKotItem = modKot.items.find((i) => i.productId === newCustomId);
    assert(modKotItem, 'Modification KOT must list the off-menu item');
    assert.equal(modKotItem.productName, 'Special Tandoori Butter Naan');
    assert.equal(modKotItem.quantity, 3);
  });

  it('3. Successfully generates bill and settles order containing off-menu items', async () => {
    const orderRes = await request
      .get(`/api/v1/orders?tableId=${testTable.id || testTable._id}&status=KOT_SENT`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const orders = orderRes.body.data.items || orderRes.body.data;
    const activeOrder = orders[0];
    const orderId = activeOrder.id || activeOrder._id;

    // Generate bill
    const billRes = await request
      .post(`/api/v1/orders/${orderId}/bill`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        discountType: 'NONE',
        customerName: 'Amit Patel',
        customerPhone: '+91 91234 56789',
      })
      .expect(201);

    const bill = billRes.body.data;
    assert(bill, 'Bill must be created');
    assert.equal(billRes.body.success, true);

    // Verify print payload contains off-menu items
    const printRes = await request
      .get(`/api/v1/bills/${bill.id || bill._id}/print`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const printData = printRes.body.data;
    assert(printData.items.length >= 3);
    const halwaPrint = printData.items.find((i) => i.name.includes('Chef Special Halwa'));
    assert(halwaPrint, 'Off-menu item must appear on receipt print');
    assert.equal(halwaPrint.unitPrice, '250.00');

    // Record payment via /api/v1/bills/:id/payments
    await request
      .post(`/api/v1/bills/${bill.id || bill._id}/payments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        mode: 'CASH',
        amount: bill.grandTotal,
      })
      .expect(201);

    // Close bill
    const closeRes = await request
      .post(`/api/v1/bills/${bill.id || bill._id}/close`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(200);

    assert.equal(closeRes.body.data.status, 'COMPLETED');

    // Table should now be released back to AVAILABLE
    const tableRes = await request
      .get(`/api/v1/tables/${testTable.id || testTable._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    assert.equal(tableRes.body.data.status, 'AVAILABLE');
  });

  it('4. Rejects request when item does not exist and no off-menu details are provided', async () => {
    const fakeId = 'prod-non-existent-999';
    // Table is now AVAILABLE after settlement in test 3
    const errRes = await request
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        branchId: testBranchId,
        tableId: testTable.id || testTable._id,
        orderType: 'DINE_IN',
        items: [
          {
            productId: fakeId,
            quantity: 1,
          },
        ],
      })
      .expect(404);

    assert.equal(errRes.body.success, false);
    assert(errRes.body.error.message.includes('not found or inactive'));
  });
});
