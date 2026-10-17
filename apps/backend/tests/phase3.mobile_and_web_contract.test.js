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

describe('Phase 3B — Web Repositories & Unchanged Mobile Captain/Kitchen Contract Verification', () => {
  let server;
  let baseUrl;
  let apiClient;
  let authApiRepository;
  let orderApiRepository;
  let kotApiRepository;
  let notificationApiRepository;

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
    ({ kotApiRepository } = await import(
      '../../web/src/services/repositories/api/kotApiRepository.js'
    ));
    ({ notificationApiRepository } = await import(
      '../../web/src/services/repositories/api/notificationApiRepository.js'
    ));
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await teardownTestDatabase();
  });

  it('executes Web orderApiRepository, kotApiRepository, and notificationApiRepository end-to-end', async () => {
    // Login as Owner in Web client
    await authApiRepository.login('owner', 'owner123');

    // 1. Create order from Web UI (submitImmediately = true when isDraft = false)
    const createdOrder = await orderApiRepository.createOrder({
      tableId: 'tbl-11',
      items: [
        { productId: 'prod-paneer-tikka', quantity: 2, notes: 'Medium spice' },
        { productId: 'prod-garlic-naan', quantity: 3 },
      ],
      isDraft: false,
    });
    assert.equal(createdOrder.status, 'WAITING_CONFIRMATION');
    assert.equal(createdOrder.tableNo, 'T-11');
    assert.equal(createdOrder.items.length, 2);

    // 2. Reception confirms order via Web orderApiRepository
    const { order: confirmedOrder, kotTicket } = await orderApiRepository.confirmOrder(
      createdOrder.id
    );
    assert.equal(confirmedOrder.status, 'KOT_SENT');
    assert.ok(kotTicket);
    assert.equal(kotTicket.revision, 1);
    assert.equal(kotTicket.type, 'NEW');

    // 3. Modify order items via Web orderApiRepository (computes delta and triggers MODIFICATION KOT)
    const { order: modifiedOrder, deltaKOT } = await orderApiRepository.modifyOrderItems(
      createdOrder.id,
      [
        { productId: 'prod-paneer-tikka', quantity: 3 }, // +1 delta
        { productId: 'prod-garlic-naan', quantity: 3 }, // unchanged
        { productId: 'prod-butter-milk', quantity: 2, notes: 'Cold' }, // new item
      ],
      'Guest requested extra starter and beverage'
    );
    assert.ok(deltaKOT);
    assert.equal(deltaKOT.revision, 2);
    assert.equal(deltaKOT.type, 'MODIFICATION');
    assert.equal(modifiedOrder.kots.length, 2);

    // 4. Kitchen & Print operations via Web kotApiRepository
    const kotsForOrder = await kotApiRepository.getKOTs({ orderId: createdOrder.id });
    assert.equal(kotsForOrder.length, 2);

    const printPayload = await kotApiRepository.getPrintPayload(kotTicket.id);
    assert.equal(printPayload.kotNumber, kotTicket.kotNumber);

    const printedKot = await kotApiRepository.updatePrintStatus(kotTicket.id, 'printed');
    assert.equal(printedKot.printStatus, 'printed');

    // 5. Mark all KOTs as served via orderApiRepository.markAsServed
    const servedOrder = await orderApiRepository.markAsServed(createdOrder.id, {
      id: 'user-owner',
      name: 'Owner',
    });
    assert.equal(servedOrder.status, 'SERVED');

    // 6. Verify BILLING status alias shim (Decision 8) works for Web Billing Pending Settlement queue
    const pendingSettlementOrders = await orderApiRepository.getOrders({
      status: ['SERVED', 'READY', 'BILLING', 'KOT_SENT', 'PREPARING'],
    });
    assert.ok(pendingSettlementOrders.some((o) => o.id === createdOrder.id));

    // 7. Notifications via Web notificationApiRepository
    const unreadNotifs = await notificationApiRepository.getNotifications(true);
    assert.ok(unreadNotifs.length >= 1);
    await notificationApiRepository.markAsRead(unreadNotifs[0].id);
  });

  it('simulates unchanged React Native Mobile Captain & Kitchen HTTP client workflows', async () => {
    const mobileFetch = async (path, { method = 'GET', token, body, idempotencyKey } = {}) => {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
      const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      return { status: res.status, headers: res.headers, body: json };
    };

    // 1. Mobile Captain logs in and fetches branch/areas/tables/menu
    const capLogin = await mobileFetch('/auth/login', {
      method: 'POST',
      body: { username: 'captain', password: 'captain123' },
    });
    assert.equal(capLogin.status, 200);
    const capToken = capLogin.body.data.tokens.access;

    const branchRes = await mobileFetch('/branches/branch-main', { token: capToken });
    assert.equal(branchRes.status, 200);
    assert.equal(branchRes.body.data.code, 'MAIN');

    const tablesRes = await mobileFetch('/tables?branchId=branch-main', { token: capToken });
    assert.equal(tablesRes.status, 200);
    assert.equal(tablesRes.body.data.length, 20);

    // 2. Mobile Captain holds an order on tbl-12 (OrderRepository.holdOrder)
    const holdCreate = await mobileFetch('/orders', {
      method: 'POST',
      token: capToken,
      idempotencyKey: 'mob-hold-tbl-12-001',
      body: {
        branchId: 'branch-main',
        tableId: 'tbl-12',
        items: [{ productId: 'prod-fish-fry', quantity: 1, note: 'Spice: Medium' }],
        held: true,
        submitImmediately: false,
      },
    });
    assert.equal(holdCreate.status, 201);
    const mobileOrderId = holdCreate.body.data.id;
    assert.equal(holdCreate.body.data.status, 'HOLD');

    // 3. Mobile Captain resumes held order, adds an item, and submits with Idempotency-Key
    const resumeRes = await mobileFetch(`/orders/${mobileOrderId}/resume`, {
      method: 'POST',
      token: capToken,
    });
    assert.equal(resumeRes.status, 200);
    assert.equal(resumeRes.body.data.status, 'DRAFT');

    const addPreKotItem = await mobileFetch(`/orders/${mobileOrderId}/items`, {
      method: 'POST',
      token: capToken,
      body: {
        items: [{ productId: 'prod-butter-naan', quantity: 2 }],
        reason: 'Added before submit',
      },
    });
    assert.equal(addPreKotItem.status, 200);
    assert.equal(addPreKotItem.body.data.modificationKot, null);

    const submitRes = await mobileFetch(`/orders/${mobileOrderId}/submit`, {
      method: 'POST',
      token: capToken,
      idempotencyKey: 'mob-submit-tbl-12-001',
    });
    assert.equal(submitRes.status, 200);
    assert.equal(submitRes.body.data.status, 'WAITING_CONFIRMATION');

    // Replay with same Idempotency-Key returns cached response with X-Idempotent-Replay: true
    const submitReplay = await mobileFetch(`/orders/${mobileOrderId}/submit`, {
      method: 'POST',
      token: capToken,
      idempotencyKey: 'mob-submit-tbl-12-001',
    });
    assert.equal(submitReplay.status, 200);
    assert.equal(submitReplay.headers.get('x-idempotent-replay'), 'true');

    // 4. Reception confirms the order
    const recLogin = await mobileFetch('/auth/login', {
      method: 'POST',
      body: { username: 'reception', password: 'reception123' },
    });
    const recToken = recLogin.body.data.tokens.access;
    const confirmRes = await mobileFetch(`/orders/${mobileOrderId}/confirm`, {
      method: 'POST',
      token: recToken,
    });
    assert.equal(confirmRes.status, 200);
    const initialKotId = confirmRes.body.data.kot.id;

    // 5. Mobile Kitchen logs in and runs parallel dashboard queries (KotRepository.getQueue)
    const kitLogin = await mobileFetch('/auth/login', {
      method: 'POST',
      body: { username: 'kitchen', password: 'kitchen123' },
    });
    const kitToken = kitLogin.body.data.tokens.access;

    const [activeQueue, readyKots, cancelledKots] = await Promise.all([
      mobileFetch('/kitchen/queue?branchId=branch-main', { token: kitToken }),
      mobileFetch('/kots?branchId=branch-main&status=READY&limit=20', { token: kitToken }),
      mobileFetch('/kots?branchId=branch-main&status=CANCELLED&limit=10', { token: kitToken }),
    ]);
    assert.equal(activeQueue.status, 200);
    assert.equal(readyKots.status, 200);
    assert.equal(cancelledKots.status, 200);
    assert.ok(activeQueue.body.data.some((k) => k.id === initialKotId));

    // 6. Mobile Kitchen transitions KOT: NEW -> PREPARING -> READY
    const kitPrep = await mobileFetch(`/kots/${initialKotId}/status`, {
      method: 'POST',
      token: kitToken,
      body: { status: 'PREPARING' },
    });
    assert.equal(kitPrep.status, 200);

    const kitReady = await mobileFetch(`/kots/${initialKotId}/status`, {
      method: 'POST',
      token: kitToken,
      body: { status: 'READY' },
    });
    assert.equal(kitReady.status, 200);

    // 7. Mobile Captain polls unread notifications (realtimeService.ts) and marks KOT_READY read
    const capNotifs = await mobileFetch(
      '/notifications?branchId=branch-main&unreadOnly=true',
      { token: capToken }
    );
    assert.equal(capNotifs.status, 200);
    const kotReadyAlert = capNotifs.body.data.find(
      (n) => n.eventType === 'KOT_READY' && n.metadata?.orderId === mobileOrderId
    );
    assert.ok(kotReadyAlert);

    const ackAlert = await mobileFetch(`/notifications/${kotReadyAlert.id}/read`, {
      method: 'POST',
      token: capToken,
    });
    assert.equal(ackAlert.status, 200);
  });
});
