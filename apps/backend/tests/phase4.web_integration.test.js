import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../src/app.js';
import { setupTestDatabase, teardownTestDatabase } from './helpers/testDb.js';

// Polyfill browser localStorage before importing Web API repositories
const memoryStorage = new Map();
globalThis.localStorage = {
  getItem: (k) => (memoryStorage.has(k) ? memoryStorage.get(k) : null),
  setItem: (k, v) => memoryStorage.set(k, String(v)),
  removeItem: (k) => memoryStorage.delete(k),
  clear: () => memoryStorage.clear(),
};

describe('Phase 4B — Web Billing, Customer, Report & Audit API Repositories Integration', () => {
  let server;
  let baseUrl;
  let apiClient;
  let authApiRepository;
  let orderApiRepository;
  let billApiRepository;
  let customerApiRepository;
  let reportApiRepository;
  let auditApiRepository;

  before(async () => {
    await setupTestDatabase({ seed: true });
    const app = createApp();
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}/api/v1`;

    ({ apiClient } = await import('../../web/src/services/api/apiClient.js'));
    apiClient.getBaseUrl = () => baseUrl;

    ({ authApiRepository } = await import(
      '../../web/src/services/repositories/api/authApiRepository.js'
    ));
    ({ orderApiRepository } = await import(
      '../../web/src/services/repositories/api/orderApiRepository.js'
    ));
    ({ billApiRepository } = await import(
      '../../web/src/services/repositories/api/billApiRepository.js'
    ));
    ({ customerApiRepository } = await import(
      '../../web/src/services/repositories/api/customerApiRepository.js'
    ));
    ({ reportApiRepository } = await import(
      '../../web/src/services/repositories/api/reportApiRepository.js'
    ));
    ({ auditApiRepository } = await import(
      '../../web/src/services/repositories/api/auditApiRepository.js'
    ));
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await teardownTestDatabase();
  });

  it('executes Web customerApiRepository, billApiRepository, reportApiRepository, and auditApiRepository end-to-end', async () => {
    await authApiRepository.login('owner', 'owner123');

    // 1. Create and query Customer via Web customerApiRepository
    const createdCustomer = await customerApiRepository.createCustomer({
      name: 'Neha Verma',
      mobile: '9844455566',
      email: 'neha@example.com',
      notes: 'Anniversary dinner',
    });
    assert.equal(createdCustomer.name, 'Neha Verma');
    assert.equal(createdCustomer.mobile, '9844455566');

    const customers = await customerApiRepository.getCustomers('Neha');
    assert.equal(customers.length, 1);

    // 2. Create, confirm, and serve an order on tbl-15 via Web orderApiRepository
    const order = await orderApiRepository.createOrder({
      tableId: 'tbl-15',
      items: [
        { productId: 'prod-mutton-lahori', quantity: 2 }, // 450 * 2 = 900
        { productId: 'prod-butter-naan', quantity: 4 }, // 60 * 4 = 240
      ],
      isDraft: false,
    });
    await orderApiRepository.confirmOrder(order.id);
    await orderApiRepository.markAsServed(order.id);

    // 3. Generate bill with 10% discount via Web billApiRepository
    const bill = await billApiRepository.generateBill({
      order,
      discount: {
        type: 'PERCENTAGE',
        value: 10,
        reason: 'Anniversary Special',
      },
    });
    assert.ok(bill.billNo.startsWith('BILL-'));
    assert.equal(bill.subtotal, 1140);
    assert.equal(bill.discountAmount, 114);
    assert.equal(bill.taxableValue, 1026);
    assert.equal(bill.grandTotal, 1077); // 1026 + 51.30 tax = 1077.30 -> rounded to 1077.00
    assert.equal(bill.isSettled, false);

    // 4. Split payments via Web billApiRepository (first partialUPI, then final CASH auto-closes bill!)
    const partialRes = await billApiRepository.addPayment(bill.id, {
      mode: 'UPI',
      amount: 500,
      reference: 'UPI-WEB-01',
    });
    assert.equal(partialRes.isSettled, false);
    assert.equal(partialRes.bill.balance, 577);

    const finalRes = await billApiRepository.addPayment(bill.id, {
      mode: 'CASH',
      amount: 577,
    });
    assert.equal(finalRes.isSettled, true);
    assert.equal(finalRes.bill.rawStatus, 'COMPLETED');
    assert.equal(finalRes.bill.balance, 0);

    // 5. Verify settled order is excluded from Pending Settlement queue
    const pendingOrders = await orderApiRepository.getOrders({
      status: ['SERVED', 'READY', 'BILLING', 'KOT_SENT', 'PREPARING'],
    });
    assert.ok(!pendingOrders.some((o) => o.id === order.id));

    // 6. Verify Sales, Items, Captains, and Payment breakdown via Web reportApiRepository
    const todayStr = new Date().toISOString().slice(0, 10);
    const salesReport = await reportApiRepository.getSalesReport({
      startDate: todayStr,
      endDate: todayStr,
    });
    assert.equal(salesReport.totalOrdersCount, 1);
    assert.equal(salesReport.totalSubtotal, 1140);
    assert.equal(salesReport.totalDiscount, 114);
    assert.equal(salesReport.totalNetSales, 1077);
    assert.equal(salesReport.paymentBreakdown.UPI, 500);
    assert.equal(salesReport.paymentBreakdown.CASH, 577);
    assert.equal(salesReport.itemSales.length, 2);
    assert.equal(salesReport.captainSales.length, 1);

    // 7. Verify Audit logs via Web auditApiRepository (including actorId filter shim)
    const auditLogs = await auditApiRepository.getAuditLogs({
      actorId: 'user-owner',
    });
    assert.ok(auditLogs.length >= 4);
    assert.ok(auditLogs.some((l) => l.action === 'BILL_CLOSED'));
  });
});
