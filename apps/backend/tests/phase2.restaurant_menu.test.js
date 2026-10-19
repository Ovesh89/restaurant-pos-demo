import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setupTestDatabase, teardownTestDatabase } from './helpers/testDb.js';

describe('Phase 2B — Branches, Areas, Tables, Menu Categories, Products & Price History Contracts', () => {
  let app;
  let ownerToken;
  let captainToken;

  before(async () => {
    await setupTestDatabase({ seed: true });
    app = createApp();

    const ownerLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'owner', password: 'owner123' });
    ownerToken = ownerLogin.body.data.tokens.access;

    const captainLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'captain', password: 'captain123' });
    captainToken = captainLogin.body.data.tokens.access;
  });

  after(async () => {
    await teardownTestDatabase();
  });

  it('supports GET/POST /api/v1/branches and GET/PATCH /api/v1/branches/:branchId (Decision 3 shim)', async () => {
    const listRes = await request(app)
      .get('/api/v1/branches')
      .set('Authorization', `Bearer ${ownerToken}`);
    assert.equal(listRes.status, 200);
    assert.equal(listRes.body.data.length, 1);
    assert.equal(listRes.body.data[0].id, 'branch-main');

    // Mobile & Web Settings call GET /api/v1/branches/branch-main
    const detailRes = await request(app)
      .get('/api/v1/branches/branch-main')
      .set('Authorization', `Bearer ${captainToken}`);
    assert.equal(detailRes.status, 200);
    assert.equal(detailRes.body.data.code, 'MAIN');
    assert.equal(detailRes.body.data.taxConfig.rate, '5.00');

    // Web Settings calls PATCH /api/v1/branches/branch-main
    const patchRes = await request(app)
      .patch('/api/v1/branches/branch-main')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Green Tandoor — Flagship',
        invoiceConfig: {
          prefix: 'GT-',
          terms: 'Thank you! Visit Again.',
        },
      });
    assert.equal(patchRes.status, 200);
    assert.equal(patchRes.body.data.name, 'Green Tandoor — Flagship');
    assert.equal(patchRes.body.data.invoiceConfig.prefix, 'GT-');

    // Public unauthenticated /restaurant/branding endpoint returns initial branding
    const brandingRes = await request(app).get('/api/v1/restaurant/branding');
    assert.equal(brandingRes.status, 200);
    assert.ok(brandingRes.body.data.restaurantName);
    assert.ok(brandingRes.body.data.logo);

    // Update restaurant branding & logo variants via PATCH /branches/branch-main
    const updateBrandingRes = await request(app)
      .patch('/api/v1/branches/branch-main')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        restaurantName: 'Royal Spice Palace',
        tagline: 'Fine Dining & Grill',
        logo: 'data:image/png;base64,mockColorLogo',
        logoWhite: 'data:image/png;base64,mockWhiteLogo',
        logoReceipt: 'data:image/png;base64,mockReceiptLogo',
      });
    assert.equal(updateBrandingRes.status, 200);
    assert.equal(updateBrandingRes.body.data.restaurantName, 'Royal Spice Palace');
    assert.equal(updateBrandingRes.body.data.tagline, 'Fine Dining & Grill');
    assert.equal(updateBrandingRes.body.data.logo, 'data:image/png;base64,mockColorLogo');

    // Public branding reflects updated branding immediately without auth token
    const updatedBrandingRes = await request(app).get('/api/v1/restaurant/branding');
    assert.equal(updatedBrandingRes.status, 200);
    assert.equal(updatedBrandingRes.body.data.restaurantName, 'Royal Spice Palace');
    assert.equal(updatedBrandingRes.body.data.tagline, 'Fine Dining & Grill');
    assert.equal(updatedBrandingRes.body.data.logo, 'data:image/png;base64,mockColorLogo');

    // Create second branch & verify branch isolation for Captain
    const branch2Res = await request(app)
      .post('/api/v1/branches')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ code: 'SOUTH', name: 'Green Tandoor — South' });
    assert.equal(branch2Res.status, 201);
    const secondBranchId = branch2Res.body.data.id;

    // Captain only belongs to branch-main -> 403 PERMISSION_DENIED on secondBranchId
    const forbiddenBranchRes = await request(app)
      .get(`/api/v1/areas?branchId=${secondBranchId}`)
      .set('Authorization', `Bearer ${captainToken}`);
    assert.equal(forbiddenBranchRes.status, 403);
    assert.equal(forbiddenBranchRes.body.error.code, 'PERMISSION_DENIED');
  });

  it('supports Areas and Tables CRUD, duplicate tableNumber 409, and tbl-XX <-> table-XX alias lookup', async () => {
    const areasRes = await request(app)
      .get('/api/v1/areas?branchId=branch-main&isActiveOnly=true')
      .set('Authorization', `Bearer ${captainToken}`);
    assert.equal(areasRes.status, 200);
    assert.equal(areasRes.body.data.length, 3);

    const createAreaRes = await request(app)
      .post('/api/v1/areas')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ branchId: 'branch-main', name: 'VIP Lounge', sortOrder: 4 });
    assert.equal(createAreaRes.status, 201);
    const vipAreaId = createAreaRes.body.data.id;

    const patchAreaRes = await request(app)
      .patch(`/api/v1/areas/${vipAreaId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'VIP Executive Lounge' });
    assert.equal(patchAreaRes.status, 200);
    assert.equal(patchAreaRes.body.data.name, 'VIP Executive Lounge');

    // Tables list
    const tablesRes = await request(app)
      .get('/api/v1/tables?branchId=branch-main&isActive=true')
      .set('Authorization', `Bearer ${captainToken}`);
    assert.equal(tablesRes.status, 200);
    assert.equal(tablesRes.body.data.length, 20);

    // Table lookup via canonical tbl-01 AND alias table-01
    const tblRes1 = await request(app)
      .get('/api/v1/tables/tbl-01')
      .set('Authorization', `Bearer ${captainToken}`);
    assert.equal(tblRes1.status, 200);
    assert.equal(tblRes1.body.data.id, 'tbl-01');

    const tblRes2 = await request(app)
      .get('/api/v1/tables/table-01')
      .set('Authorization', `Bearer ${captainToken}`);
    assert.equal(tblRes2.status, 200);
    assert.equal(tblRes2.body.data.id, 'tbl-01');

    // Create table & verify duplicate tableNumber returns 409 CONFLICT
    const createTableRes = await request(app)
      .post('/api/v1/tables')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        branchId: 'branch-main',
        areaId: vipAreaId,
        tableNumber: 'VIP-01',
        capacity: 8,
      });
    assert.equal(createTableRes.status, 201);

    const dupTableRes = await request(app)
      .post('/api/v1/tables')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        branchId: 'branch-main',
        areaId: vipAreaId,
        tableNumber: 'VIP-01',
        capacity: 4,
      });
    assert.equal(dupTableRes.status, 409);
    assert.equal(dupTableRes.body.error.code, 'CONFLICT');
  });

  it('supports Menu Categories & Products CRUD (with Decision 5 optional branchId shim) and Price History (with Decision 2 newPrice shim)', async () => {
    // 1. Categories list (17 seeded categories from menu card)
    const catListRes = await request(app)
      .get('/api/v1/menu/categories?branchId=branch-main&isActiveOnly=true')
      .set('Authorization', `Bearer ${captainToken}`);
    assert.equal(catListRes.status, 200);
    assert.equal(catListRes.body.data.length, 17);

    // 2. Create category omitting branchId (Web categoryApiRepository contract)
    const createCatRes = await request(app)
      .post('/api/v1/menu/categories')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Chef Specials', code: 'SPC', sortOrder: 18 });
    assert.equal(createCatRes.status, 201);
    assert.equal(createCatRes.body.data.branchId, 'branch-main');
    const specialCatId = createCatRes.body.data.id;

    // 3. Products paginated list (159 seeded products from menu card)
    const prodListRes = await request(app)
      .get('/api/v1/menu/products?isAvailableOnly=true&limit=200')
      .set('Authorization', `Bearer ${captainToken}`);
    assert.equal(prodListRes.status, 200);
    assert.equal(prodListRes.body.data.items.length, 159);
    assert.equal(prodListRes.body.data.pagination.total, 159);

    // Search filter
    const searchRes = await request(app)
      .get('/api/v1/menu/products?search=Chicken&limit=100')
      .set('Authorization', `Bearer ${captainToken}`);
    assert.equal(searchRes.status, 200);
    assert.equal(searchRes.body.data.items.length, 33);

    // 4. Create product omitting branchId (Web productApiRepository contract)
    const createProdRes = await request(app)
      .post('/api/v1/menu/products')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        code: 'SPC-01',
        name: 'TandooriLobster Platter',
        categoryId: specialCatId,
        price: '850.00',
        taxConfig: { rate: '5.00', mode: 'EXCLUSIVE' },
        available: true,
        kitchenStation: 'TANDOOR',
      });
    assert.equal(createProdRes.status, 201);
    assert.equal(createProdRes.body.data.currentPrice, '850.00');
    const newProdId = createProdRes.body.data.id;

    // 5. Price change using `newPrice` (Web productApiRepository contract — Decision 2 shim)
    const priceChangeWebRes = await request(app)
      .post(`/api/v1/menu/products/${newProdId}/price`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ newPrice: '900.00', reason: 'Seasonal seafood cost adjustment' });
    assert.equal(priceChangeWebRes.status, 200);
    assert.equal(priceChangeWebRes.body.data.currentPrice, '900.00');

    // 6. Price change using `price` (Django contract)
    const priceChangeDjangoRes = await request(app)
      .post(`/api/v1/menu/products/${newProdId}/price`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ price: '925.00', reason: 'Festival menu update' });
    assert.equal(priceChangeDjangoRes.status, 200);
    assert.equal(priceChangeDjangoRes.body.data.currentPrice, '925.00');

    // 7. Verify immutable price history has 3 entries (initial + 2 changes)
    const historyRes = await request(app)
      .get(`/api/v1/menu/products/${newProdId}/price-history`)
      .set('Authorization', `Bearer ${ownerToken}`);
    assert.equal(historyRes.status, 200);
    assert.equal(historyRes.body.data.length, 3);
    assert.equal(historyRes.body.data[0].newPrice, '925.00');
    assert.equal(historyRes.body.data[0].oldPrice, '900.00');
    assert.equal(historyRes.body.data[1].newPrice, '900.00');
    assert.equal(historyRes.body.data[1].oldPrice, '850.00');
    assert.equal(historyRes.body.data[2].newPrice, '850.00');
    assert.equal(historyRes.body.data[2].oldPrice, null);
  });
});
