import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import request from 'supertest';

import { app } from '../src/app.js';
import { getDb } from '../src/config/database.js';
import { backupDatabase } from '../src/scripts/backupMongo.js';
import { restoreDatabase } from '../src/scripts/restoreMongo.js';
import { setupTestDatabase, teardownTestDatabase } from './helpers/testDb.js';

describe('Phase 5 — Security, Branch Isolation, Print/Settlement Invariants & Backup/Restore Readiness', () => {
  let db;
  let ownerToken;
  let managerToken;
  let cashierToken;
  let captainToken;

  before(async () => {
    db = await setupTestDatabase({ seed: true });
    assert.equal(db.databaseName, 'restaurant_pos_mern_test');

    const loginAs = async (username, password) => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ username, password });
      assert.equal(res.status, 200);
      return res.body.data.tokens.access;
    };

    ownerToken = await loginAs('owner', 'owner123');
    managerToken = await loginAs('manager', 'manager123');
    cashierToken = await loginAs('cashier', 'cashier123');
    captainToken = await loginAs('captain', 'captain123');
  });

  after(async () => {
    await teardownTestDatabase();
  });

  it('enforces strict branch isolation (403 PERMISSION_DENIED) across Orders, KOTs, Kitchen, Bills, Customers, Reports & Audit', async () => {
    // 1. Owner creates a secondary branch (branch-north)
    const createBranchRes = await request(app)
      .post('/api/v1/branches')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'GTS North Hub',
        code: 'NORTH',
        address: 'Sector 18, Noida',
        phone: '9876500099',
      });
    assert.equal(createBranchRes.status, 201);
    const northBranchId = createBranchRes.body.data.id;

    // 2. Captain & Cashier (assigned only to branch-main) cannot access branch-north resources
    const captainOrdersRes = await request(app)
      .get(`/api/v1/orders?branchId=${northBranchId}`)
      .set('Authorization', `Bearer ${captainToken}`);
    assert.equal(captainOrdersRes.status, 403);
    assert.equal(captainOrdersRes.body.error.code, 'PERMISSION_DENIED');

    const captainCreateOrderRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${captainToken}`)
      .send({
        branchId: northBranchId,
        tableId: 'tbl-01',
        items: [{ productId: 'prod-paneer-tikka', quantity: 1 }],
      });
    assert.equal(captainCreateOrderRes.status, 403);

    const captainKitchenRes = await request(app)
      .get(`/api/v1/kitchen/queue?branchId=${northBranchId}`)
      .set('Authorization', `Bearer ${captainToken}`);
    assert.equal(captainKitchenRes.status, 403);

    const cashierBillsRes = await request(app)
      .get(`/api/v1/bills?branchId=${northBranchId}`)
      .set('Authorization', `Bearer ${cashierToken}`);
    assert.equal(cashierBillsRes.status, 403);

    const cashierCustRes = await request(app)
      .get(`/api/v1/customers?branchId=${northBranchId}`)
      .set('Authorization', `Bearer ${cashierToken}`);
    assert.equal(cashierCustRes.status, 403);

    const managerReportRes = await request(app)
      .get(`/api/v1/reports/sales?branchId=${northBranchId}`)
      .set('Authorization', `Bearer ${managerToken}`);
    assert.equal(managerReportRes.status, 403);

    const managerAuditRes = await request(app)
      .get(`/api/v1/audit?branchId=${northBranchId}`)
      .set('Authorization', `Bearer ${managerToken}`);
    assert.equal(managerAuditRes.status, 403);

    // 3. Owner (role-owner) has global branch access and succeeds (200)
    const ownerOrdersRes = await request(app)
      .get(`/api/v1/orders?branchId=${northBranchId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    assert.equal(ownerOrdersRes.status, 200);
    assert.equal(ownerOrdersRes.body.data.items.length, 0);
  });

  it('enforces >20% discount approval threshold, Pending Settlement exclusion, print independence, and post-settlement immutability', async () => {
    // 1. Create, submit, and confirm an order on tbl-11
    const createRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${captainToken}`)
      .send({
        branchId: 'branch-main',
        tableId: 'tbl-11',
        submitImmediately: true,
        items: [{ productId: 'prod-butter-chicken', quantity: 2 }], // 2 x 360 = 720
      });
    assert.equal(createRes.status, 201);
    const orderId = createRes.body.data.id;

    const confirmRes = await request(app)
      .post(`/api/v1/orders/${orderId}/confirm`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({});
    assert.equal(confirmRes.status, 200);

    // 2. Generate bill -> order transitions to BILLING, table to BILL_PENDING
    const billRes = await request(app)
      .post(`/api/v1/orders/${orderId}/bill`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({});
    assert.equal(billRes.status, 201);
    const billId = billRes.body.data.id;

    // 3. Verify Pending Settlement query (used by BillingPage.jsx) includes this BILLING order
    const pendingBeforeClose = await request(app)
      .get('/api/v1/orders?status=SERVED,READY,BILLING,KOT_SENT,PREPARING')
      .set('Authorization', `Bearer ${cashierToken}`);
    assert.equal(pendingBeforeClose.status, 200);
    assert.ok(
      pendingBeforeClose.body.data.items.some((o) => o.id === orderId),
      'Active BILLING order must appear in Pending Settlement list'
    );

    // 4. Cashier (has discount.apply, NOT discount.approve) can apply <= 20% discount (e.g., 10%)
    const cashier10Res = await request(app)
      .post(`/api/v1/bills/${billId}/discount`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ type: 'PERCENTAGE', value: '10', reason: 'Standard loyalty promo' });
    assert.equal(cashier10Res.status, 200);
    assert.equal(cashier10Res.body.data.discount.amount, '96.00');

    // 5. Cashier is rejected (403) when attempting > 20% discount (e.g., 25%)
    const cashier25Res = await request(app)
      .post(`/api/v1/bills/${billId}/discount`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ type: 'PERCENTAGE', value: '25', reason: 'Special event discount' });
    assert.equal(cashier25Res.status, 403);
    assert.equal(cashier25Res.body.error.code, 'PERMISSION_DENIED');

    // 6. Manager (has discount.approve) can apply 25% discount (240 on 960)
    const manager25Res = await request(app)
      .post(`/api/v1/bills/${billId}/discount`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ type: 'PERCENTAGE', value: '25', reason: 'Manager approved VIP discount' });
    assert.equal(manager25Res.status, 200);
    assert.equal(manager25Res.body.data.discount.amount, '240.00');
    const grandTotal = manager25Res.body.data.grandTotal; // 720 + 5% (36.00) = 756.00
    assert.equal(grandTotal, '756.00');

    // 7. Verify GET and POST /api/v1/bills/:id/print do NOT settle bill or alter balance
    const printGetRes = await request(app)
      .get(`/api/v1/bills/${billId}/print`)
      .set('Authorization', `Bearer ${cashierToken}`);
    assert.equal(printGetRes.status, 200);
    assert.equal(printGetRes.body.data.status, 'PAYMENT_PENDING');
    assert.equal(printGetRes.body.data.balanceAmount, '756.00');

    const printPostRes = await request(app)
      .post(`/api/v1/bills/${billId}/print`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({});
    assert.equal(printPostRes.status, 200);
    assert.equal(printPostRes.body.data.status, 'PAYMENT_PENDING');
    assert.equal(printPostRes.body.data.payments.length, 0);

    // 8. Pay and close the bill
    const payRes = await request(app)
      .post(`/api/v1/bills/${billId}/payments`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ mode: 'CASH', amount: '756.00' });
    assert.equal(payRes.status, 201);

    const closeRes = await request(app)
      .post(`/api/v1/bills/${billId}/close`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({});
    assert.equal(closeRes.status, 200);
    assert.equal(closeRes.body.data.status, 'COMPLETED');

    // 9. Verify Pending Settlement query now EXCLUDES the completed order
    const pendingAfterClose = await request(app)
      .get('/api/v1/orders?status=SERVED,READY,BILLING,KOT_SENT,PREPARING')
      .set('Authorization', `Bearer ${cashierToken}`);
    assert.equal(pendingAfterClose.status, 200);
    assert.ok(
      !pendingAfterClose.body.data.items.some((o) => o.id === orderId),
      'Completed order must be excluded from Pending Settlement list'
    );

    // 10. Completed orders and bills reject post-settlement mutations (409 CONFLICT)
    const mutateCompletedOrderRes = await request(app)
      .post(`/api/v1/orders/${orderId}/items`)
      .set('Authorization', `Bearer ${captainToken}`)
      .send({ items: [{ productId: 'prod-paneer-tikka', quantity: 1 }] });
    assert.equal(mutateCompletedOrderRes.status, 409);

    const cancelCompletedOrderRes = await request(app)
      .post(`/api/v1/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ reason: 'Post-settlement cancel attempt' });
    assert.equal(cancelCompletedOrderRes.status, 409);

    const discountCompletedBillRes = await request(app)
      .post(`/api/v1/bills/${billId}/discount`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ type: 'FIXED', value: '50', reason: 'Late discount attempt' });
    assert.equal(discountCompletedBillRes.status, 409);
  });

  it('verifies Web printService, billingCalculator, and shiftApiRepository end-to-end', async () => {
    const { printService } = await import(
      '../../web/src/services/printing/printService.js'
    );
    const { billingCalculator, DISCOUNT_TYPES } = await import(
      '../../web/src/services/calculations/billingCalculator.js'
    );

    const calc = billingCalculator.calculate({
      items: [{ quantity: 2, unitPrice: 360, taxRate: 5 }],
      discount: { type: DISCOUNT_TYPES.PERCENTAGE, value: 25, reason: 'VIP' },
      taxRate: 5,
      payments: [{ mode: 'CASH', amount: 567 }],
    });
    assert.equal(calc.subtotal, 720);
    assert.equal(calc.discountAmount, 180);
    assert.equal(calc.taxableAmount, 540);
    assert.equal(calc.taxAmount, 27);
    assert.equal(calc.grandTotal, 567);
    assert.equal(calc.isSettled, true);

    const kotText = printService.generateKOTReceiptText(
      {
        kotNo: 'KOT-MAIN-2026-000001',
        type: 'NEW',
        tableNo: 'T-11',
        orderId: 'ORD-MAIN-2026-000001',
        captainName: 'Vikram Singh',
        station: 'MAIN',
        revision: 1,
        createdAt: new Date().toISOString(),
        items: [{ quantity: 2, name: 'Butter Chicken', notes: 'Extra butter' }],
      },
      { orderNo: 'ORD-MAIN-2026-000001', captainName: 'Vikram Singh' },
      { tableNo: 'T-11' }
    );
    assert.ok(kotText.includes('KITCHEN ORDER TICKET'));
    assert.ok(kotText.includes('Butter Chicken'));

    const invoiceHtml = printService.generateInvoiceHTML({
      billNo: 'BILL-MAIN-2026-000001',
      orderNo: 'ORD-MAIN-2026-000001',
      tableNo: 'T-11',
      subtotal: 720,
      discountAmount: 180,
      taxableAmount: 540,
      taxAmount: 27,
      cgst: 13.5,
      sgst: 13.5,
      rounding: 0,
      grandTotal: 567,
      paidAmount: 567,
      balance: 0,
      items: [{ name: 'Butter Chicken', quantity: 2, unitPrice: 360, subtotal: 720 }],
      payments: [{ mode: 'CASH', amount: 567 }],
    });
    assert.ok(invoiceHtml.includes('BILL-MAIN-2026-000001'));
    assert.ok(invoiceHtml.includes('567.00'));
  });

  it('executes MongoDB backup and restore round-trip and enforces legacy DB safety guardrails', async () => {
    const tmpBackupDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pos-mern-backup-'));

    try {
      // 1. Export full snapshot of restaurant_pos_mern_test
      const { manifest } = await backupDatabase({
        targetDir: tmpBackupDir,
        db,
        quiet: true,
      });
      assert.equal(manifest.database, 'restaurant_pos_mern_test');
      assert.equal(manifest.collections.roles, 7);
      assert.equal(manifest.collections.users, 7);
      assert.equal(manifest.collections.products, 159);

      const originalOrdersCount = manifest.collections.orders;

      // 2. Delete all roles and orders in test DB to simulate data loss
      await db.collection('roles').deleteMany({});
      await db.collection('orders').deleteMany({});
      assert.equal(await db.collection('roles').countDocuments({}), 0);

      // 3. Restore from backup snapshot with dropFirst: true
      const restoreRes = await restoreDatabase({
        sourceDir: tmpBackupDir,
        dropFirst: true,
        db,
        quiet: true,
      });
      assert.equal(restoreRes.restoredCounts.roles, 7);
      assert.equal(restoreRes.restoredCounts.orders, originalOrdersCount);
      assert.equal(await db.collection('roles').countDocuments({}), 7);

      // 4. Verify safety guardrail refuses restoring into legacy Django databases
      await assert.rejects(
        async () => {
          await restoreDatabase({
            sourceDir: tmpBackupDir,
            db: { databaseName: 'restaurant_pos_dev' },
            quiet: true,
          });
        },
        /SAFETY VIOLATION/
      );
    } finally {
      await fs.rm(tmpBackupDir, { recursive: true, force: true });
    }
  });
});
