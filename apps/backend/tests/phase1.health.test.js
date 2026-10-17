import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setupTestDatabase, teardownTestDatabase, TEST_DB_NAME } from './helpers/testDb.js';
import { BaseMongoRepository } from '../src/repositories/BaseMongoRepository.js';
import { getNextSequence } from '../src/utils/sequence.js';
import { formatMoney, toDecimal } from '../src/utils/decimal.js';
import { normalizePhoneNumber } from '../src/utils/phone.js';
import { successResponse } from '../src/utils/response.js';

describe('Phase 1 — MERN Foundation, Health, Idempotency & Repository Contracts', () => {
  let app;
  let db;

  before(async () => {
    db = await setupTestDatabase({ seed: true });
    app = createApp();
  });

  after(async () => {
    await teardownTestDatabase();
  });

  it('GET / returns unwrapped service and connected MongoDB info on restaurant_pos_mern_test', async () => {
    const res = await request(app).get('/');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.equal(res.body.service, 'restaurant-pos-backend');
    assert.equal(res.body.database, 'connected');
    assert.equal(res.body.mongodb.status, 'connected');
    assert.equal(res.body.mongodb.database, TEST_DB_NAME);
  });

  it('GET /health and /api/health work both with and without trailing slashes', async () => {
    for (const path of ['/health', '/health/', '/api/health', '/api/health/']) {
      const res = await request(app).get(path);
      assert.equal(res.status, 200, `Failed for ${path}`);
      assert.equal(res.body.status, 'ok');
      assert.equal(res.body.database, 'connected');
      assert.equal(res.body.mongodb.database, TEST_DB_NAME);
    }
  });

  it('GET /ready and /api/ready return ready status', async () => {
    for (const path of ['/ready', '/ready/', '/api/ready', '/api/ready/']) {
      const res = await request(app).get(path);
      assert.equal(res.status, 200, `Failed for ${path}`);
      assert.equal(res.body.status, 'ready');
      assert.equal(res.body.database, 'connected');
    }
  });

  it('GET /api/schema/ and /api/docs/ serve OpenAPI 3.0 spec and Swagger UI', async () => {
    const schemaRes = await request(app).get('/api/schema/');
    assert.equal(schemaRes.status, 200);
    assert.equal(schemaRes.body.openapi, '3.0.3');
    assert.equal(schemaRes.body.info.title, 'Restaurant POS & KOT Management API');

    const docsRes = await request(app).get('/api/docs/');
    assert.equal(docsRes.status, 200);
    assert.ok(docsRes.text.includes('swagger-ui'));
  });

  it('propagates X-Correlation-ID and X-Request-ID headers', async () => {
    const customId = 'corr-test-12345';
    const res1 = await request(app).get('/health').set('X-Correlation-ID', customId);
    assert.equal(res1.headers['x-correlation-id'], customId);

    const reqId = 'req-mobile-98765';
    const res2 = await request(app).get('/api/health').set('X-Request-ID', reqId);
    assert.equal(res2.headers['x-correlation-id'], reqId);

    const res3 = await request(app).get('/health');
    assert.ok(res3.headers['x-correlation-id']);
  });

  it('returns standard 404 NOT_FOUND envelope for unknown routes and 400 VALIDATION_ERROR for malformed JSON', async () => {
    const notFoundRes = await request(app).get('/api/v1/unknown-endpoint');
    assert.equal(notFoundRes.status, 404);
    assert.equal(notFoundRes.body.success, false);
    assert.equal(notFoundRes.body.error.code, 'NOT_FOUND');

    const badJsonRes = await request(app)
      .post('/api/v1/unknown-endpoint')
      .set('Content-Type', 'application/json')
      .send('{"brokenJson": ');
    assert.equal(badJsonRes.status, 400);
    assert.equal(badJsonRes.body.success, false);
    assert.equal(badJsonRes.body.error.code, 'VALIDATION_ERROR');
  });

  it('enforces Idempotency-Key replay and 409 CONCURRENT_REQUEST lock', async () => {
    const testApp = createApp();
    // Register a test mutation route before 404 handler by mounting a sub-app or testing on a custom express instance
    let counter = 0;
    const customApp = (await import('express')).default();
    const { correlationIdMiddleware } = await import('../src/middleware/correlationId.js');
    const { idempotencyMiddleware } = await import('../src/middleware/idempotency.js');
    customApp.use((await import('express')).default.json());
    customApp.use(correlationIdMiddleware);
    customApp.use(idempotencyMiddleware);
    customApp.post('/api/v1/test-mutation', (_req, res) => {
      counter += 1;
      return successResponse(res, { callCount: counter }, 'Created', 201);
    });

    const idemKey = 'idem-test-key-001';
    const first = await request(customApp)
      .post('/api/v1/test-mutation')
      .set('Idempotency-Key', idemKey)
      .send({ foo: 'bar' });

    assert.equal(first.status, 201);
    assert.equal(first.body.data.callCount, 1);
    assert.equal(first.headers['x-idempotent-replay'], undefined);

    // Wait briefly for async updateOne to complete
    await new Promise((r) => setTimeout(r, 50));

    // Replay with same Idempotency-Key must return cached response without incrementing counter
    const second = await request(customApp)
      .post('/api/v1/test-mutation')
      .set('Idempotency-Key', idemKey)
      .send({ foo: 'bar' });

    assert.equal(second.status, 201);
    assert.equal(second.body.data.callCount, 1);
    assert.equal(second.headers['x-idempotent-replay'], 'true');
    assert.equal(counter, 1);

    // Simulate an in-flight PROCESSING key and verify 409 CONCURRENT_REQUEST
    await db.collection('idempotency_keys').insertOne({
      key: 'idem-in-flight-002',
      path: '/api/v1/test-mutation',
      method: 'POST',
      status: 'PROCESSING',
      createdAt: new Date().toISOString(),
    });

    const concurrent = await request(customApp)
      .post('/api/v1/test-mutation')
      .set('Idempotency-Key', 'idem-in-flight-002')
      .send({});

    assert.equal(concurrent.status, 409);
    assert.equal(concurrent.body.success, false);
    assert.equal(concurrent.body.error.code, 'CONCURRENT_REQUEST');
  });

  it('verifies BaseMongoRepository string _id/id serialization, pagination, and seeded collections', async () => {
    const productRepo = new BaseMongoRepository('products', 'prod');
    const paginated = await productRepo.findPaginated(
      { branchId: 'branch-main', isActive: true },
      { page: 1, limit: 10, sort: [['sortOrder', 1]] }
    );

    assert.equal(paginated.pagination.total, 89);
    assert.equal(paginated.items.length, 10);
    assert.equal(paginated.pagination.page, 1);
    assert.equal(paginated.pagination.limit, 10);
    assert.equal(paginated.pagination.totalPages, 9);
    assert.equal(paginated.pagination.hasNext, true);
    assert.equal(paginated.pagination.hasPrev, false);

    const firstProd = paginated.items[0];
    assert.equal(typeof firstProd._id, 'string');
    assert.equal(firstProd.id, firstProd._id);
  });

  it('verifies atomic sequence counter generation, decimal formatting, and phone normalization', async () => {
    const ord1 = await getNextSequence('ord', 'ORD', 'MAIN', 2026);
    const ord2 = await getNextSequence('ord', 'ORD', 'MAIN', 2026);
    const kot1 = await getNextSequence('kot', 'KOT', 'MAIN', 2026);
    const bill1 = await getNextSequence('bill', 'BILL', 'MAIN', 2026);

    assert.equal(ord1, 'ORD-2026-000001');
    assert.equal(ord2, 'ORD-2026-000002');
    assert.equal(kot1, 'KOT-2026-000001');
    assert.equal(bill1, 'BILL-2026-000001');

    assert.equal(formatMoney(toDecimal('15.375')), '15.38');
    assert.equal(formatMoney(240), '240.00');
    assert.equal(normalizePhoneNumber('+91 98765-43210'), '9876543210');
  });
});
