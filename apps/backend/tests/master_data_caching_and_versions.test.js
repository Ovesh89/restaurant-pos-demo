import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setupTestDatabase, teardownTestDatabase } from './helpers/testDb.js';

describe('Centralized Master Data Revision Tracking & Freshness Verification', () => {
  let app;
  let ownerToken;
  const branchId = 'branch-main';

  before(async () => {
    await setupTestDatabase({ seed: true });
    app = createApp();

    const ownerLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'owner', password: 'owner123' });
    ownerToken = ownerLogin.body.data.tokens.access;
  });

  after(async () => {
    await teardownTestDatabase();
  });

  it('1. GET /api/v1/meta/master-data-versions returns standard baseline versions for branch', async () => {
    const res = await request(app)
      .get(`/api/v1/meta/master-data-versions?branchId=${branchId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.versions);
    assert.equal(typeof res.body.data.versions.categories, 'number');
    assert.equal(typeof res.body.data.versions.products, 'number');
    assert.equal(typeof res.body.data.versions.tables, 'number');
    assert.equal(typeof res.body.data.versions.settings, 'number');
    assert.equal(res.body.data.branchId, branchId);
  });

  it('2. Creating or updating a Category increments the categories revision version', async () => {
    const baselineRes = await request(app)
      .get(`/api/v1/meta/master-data-versions?branchId=${branchId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    const initialCatVer = baselineRes.body.data.versions.categories;

    // Create a new category
    const createRes = await request(app)
      .post('/api/v1/menu/categories')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        branchId,
        name: 'Fresh Tandoor Bread',
        code: 'BREAD',
        sortOrder: 10,
        isActive: true,
      });

    assert.equal(createRes.status, 201);
    const createdCatId = createRes.body.data.id;

    // Check version again
    const postCreateRes = await request(app)
      .get(`/api/v1/meta/master-data-versions?branchId=${branchId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    const postCreateVer = postCreateRes.body.data.versions.categories;
    assert.ok(postCreateVer > initialCatVer, `Expected categories version to increase from ${initialCatVer}, got ${postCreateVer}`);

    // Update category
    const updateRes = await request(app)
      .patch(`/api/v1/menu/categories/${createdCatId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Fresh Tandoor Naan & Roti' });
    assert.equal(updateRes.status, 200);

    const postUpdateRes = await request(app)
      .get(`/api/v1/meta/master-data-versions?branchId=${branchId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    assert.ok(postUpdateRes.body.data.versions.categories > postCreateVer);
  });

  it('3. Creating or updating a Product or Price increments the products revision version', async () => {
    const baselineRes = await request(app)
      .get(`/api/v1/meta/master-data-versions?branchId=${branchId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    const initialProdVer = baselineRes.body.data.versions.products;

    // Create a product
    const createRes = await request(app)
      .post('/api/v1/menu/products')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        branchId,
        categoryId: 'cat-tandoor-se',
        name: 'Garlic Paneer Tikka',
        code: 'GPT-01',
        price: '340.00',
        available: true,
        kitchenStation: 'Tandoor',
      });

    assert.equal(createRes.status, 201);
    const productId = createRes.body.data.id;

    const afterCreateRes = await request(app)
      .get(`/api/v1/meta/master-data-versions?branchId=${branchId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    assert.ok(afterCreateRes.body.data.versions.products > initialProdVer);

    // Update product price via POST /api/v1/menu/products/:id/price
    const priceRes = await request(app)
      .post(`/api/v1/menu/products/${productId}/price`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        price: '360.00',
        reason: 'Raw material butter cost increase',
      });
    assert.equal(priceRes.status, 200);

    const afterPriceRes = await request(app)
      .get(`/api/v1/meta/master-data-versions?branchId=${branchId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    assert.ok(afterPriceRes.body.data.versions.products > afterCreateRes.body.data.versions.products);
  });

  it('4. Updating a table increments the tables revision version', async () => {
    const baselineRes = await request(app)
      .get(`/api/v1/meta/master-data-versions?branchId=${branchId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    const initialTblVer = baselineRes.body.data.versions.tables;

    const updateRes = await request(app)
      .patch('/api/v1/tables/tbl-01')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ capacity: 6 });

    assert.equal(updateRes.status, 200);

    const afterRes = await request(app)
      .get(`/api/v1/meta/master-data-versions?branchId=${branchId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    assert.ok(afterRes.body.data.versions.tables > initialTblVer);
  });

  it('5. Updating branch settings increments branches and settings revision versions', async () => {
    const baselineRes = await request(app)
      .get(`/api/v1/meta/master-data-versions?branchId=${branchId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    const initialSettingsVer = baselineRes.body.data.versions.settings;

    const updateRes = await request(app)
      .patch(`/api/v1/branches/${branchId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ tagline: 'Modern Fine Dining & Tandoor Bar' });

    assert.equal(updateRes.status, 200);

    const afterRes = await request(app)
      .get(`/api/v1/meta/master-data-versions?branchId=${branchId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    assert.ok(afterRes.body.data.versions.settings > initialSettingsVer);
  });
});
