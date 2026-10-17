import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { setupTestDatabase, teardownTestDatabase } from './helpers/testDb.js';

describe('Phase 2A — Identity, Authentication, Password Hashes, Users & Roles Contracts', () => {
  let app;
  let db;
  let ownerToken;
  let captainToken;

  before(async () => {
    db = await setupTestDatabase({ seed: true });
    app = createApp();
  });

  after(async () => {
    await teardownTestDatabase();
  });

  it('POST /api/v1/auth/login authenticates seeded owner and captain users and strips passwordHash', async () => {
    const ownerRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'owner', password: 'owner123' });

    assert.equal(ownerRes.status, 200);
    assert.equal(ownerRes.body.success, true);
    assert.ok(ownerRes.body.data.tokens.access);
    assert.ok(ownerRes.body.data.tokens.refresh);
    assert.equal(ownerRes.body.data.tokens.tokenType, 'Bearer');
    assert.equal(ownerRes.body.data.user.username, 'owner');
    assert.equal(ownerRes.body.data.user.passwordHash, undefined);
    assert.equal(ownerRes.body.data.roles[0].code, 'OWNER');
    assert.ok(ownerRes.body.data.permissions.includes('user.manage'));
    ownerToken = ownerRes.body.data.tokens.access;

    const captainRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'captain', password: 'captain123' });

    assert.equal(captainRes.status, 200);
    assert.equal(captainRes.body.data.roles[0].code, 'CAPTAIN');
    assert.ok(captainRes.body.data.permissions.includes('order.create'));
    assert.ok(!captainRes.body.data.permissions.includes('user.manage'));
    captainToken = captainRes.body.data.tokens.access;
  });

  it('verifies legacy Django MD5PasswordHasher (md5$<salt>$<hex>) hashes seamlessly', async () => {
    const salt = 'djangomd5salt';
    const plain = 'legacyPass99';
    const md5Hex = crypto.createHash('md5').update(`${salt}${plain}`, 'utf8').digest('hex');
    const djangoMd5Hash = `md5$${salt}$${md5Hex}`;

    await db.collection('users').insertOne({
      _id: 'usr-legacy-md5',
      id: 'usr-legacy-md5',
      username: 'legacymd5',
      passwordHash: djangoMd5Hash,
      displayName: 'Legacy MD5 Staff',
      roleIds: ['role-captain'],
      branchIds: ['branch-main'],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'legacymd5', password: plain });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.id, 'usr-legacy-md5');
  });

  it('POST /api/v1/auth/refresh returns both top-level access (Mobile) and nested tokens.access (Web)', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'captain', password: 'captain123' });

    const refreshToken = loginRes.body.data.tokens.refresh;
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refresh: refreshToken });

    assert.equal(refreshRes.status, 200);
    assert.equal(refreshRes.body.success, true);
    // Mobile contract: data.access
    assert.ok(refreshRes.body.data.access);
    assert.equal(refreshRes.body.data.tokenType, 'Bearer');
    // Web apiClient.js contract: data.tokens.access
    assert.ok(refreshRes.body.data.tokens?.access);
    assert.equal(refreshRes.body.data.tokens.access, refreshRes.body.data.access);
  });

  it('rejects wrong password (401), expired token (401), and refresh token used as access token (401)', async () => {
    const wrongPwd = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'owner', password: 'wrongpassword' });
    assert.equal(wrongPwd.status, 401);
    assert.equal(wrongPwd.body.error.code, 'UNAUTHORIZED');

    const expiredToken = jwt.sign(
      { sub: 'user-owner', username: 'owner', type: 'access', exp: Math.floor(Date.now() / 1000) - 60 },
      env.secretKey,
      { algorithm: 'HS256' }
    );
    const expRes = await request(app)
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${expiredToken}`);
    assert.equal(expRes.status, 401);
    assert.equal(expRes.body.error.code, 'UNAUTHORIZED');

    const refreshAsAccess = jwt.sign(
      { sub: 'user-owner', type: 'refresh', exp: Math.floor(Date.now() / 1000) + 3600 },
      env.secretKey,
      { algorithm: 'HS256' }
    );
    const wrongTypeRes = await request(app)
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${refreshAsAccess}`);
    assert.equal(wrongTypeRes.status, 401);
  });

  it('GET /api/v1/me and POST /api/v1/auth/logout work for authenticated users', async () => {
    const meRes = await request(app)
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${captainToken}`);

    assert.equal(meRes.status, 200);
    assert.equal(meRes.body.data.user.username, 'captain');
    assert.equal(meRes.body.data.roles[0].code, 'CAPTAIN');

    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${captainToken}`);

    assert.equal(logoutRes.status, 200);
    assert.equal(logoutRes.body.data.loggedOut, true);
  });

  it('supports Users CRUD, duplicate username 409, activation/deactivation, and self-profile PATCH shim', async () => {
    // 1. Paginated list
    const listRes = await request(app)
      .get('/api/v1/users?limit=50')
      .set('Authorization', `Bearer ${ownerToken}`);
    assert.equal(listRes.status, 200);
    assert.ok(Array.isArray(listRes.body.data.items));
    assert.ok(listRes.body.data.pagination.total >= 7);
    assert.equal(listRes.body.data.items[0].passwordHash, undefined);

    // 2. Create user
    const createRes = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        username: 'waiter02',
        password: 'waiterpassword',
        displayName: 'Waiter Two',
        mobile: '9876500002',
        roleIds: ['role-captain'],
        branchIds: ['branch-main'],
      });
    assert.equal(createRes.status, 201);
    assert.equal(createRes.body.data.username, 'waiter02');
    assert.equal(createRes.body.data.passwordHash, undefined);
    const createdUserId = createRes.body.data.id;

    // 3. Duplicate username -> 409 CONFLICT
    const dupRes = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        username: 'waiter02',
        password: 'waiterpassword',
        displayName: 'Duplicate Waiter',
        roleIds: ['role-captain'],
      });
    assert.equal(dupRes.status, 409);
    assert.equal(dupRes.body.error.code, 'CONFLICT');

    // 4. Decision 4 shim: Captain can update own displayName & mobile via PATCH /users/:id,
    //    but cannot escalate roleIds or update another user
    const selfPatchRes = await request(app)
      .patch('/api/v1/users/user-captain')
      .set('Authorization', `Bearer ${captainToken}`)
      .send({ displayName: 'Captain Rahul Updated', mobile: '9998887776' });
    assert.equal(selfPatchRes.status, 200);
    assert.equal(selfPatchRes.body.data.displayName, 'Captain Rahul Updated');

    const forbiddenRoleEscalation = await request(app)
      .patch('/api/v1/users/user-captain')
      .set('Authorization', `Bearer ${captainToken}`)
      .send({ roleIds: ['role-owner'] });
    assert.equal(forbiddenRoleEscalation.status, 403);
    assert.equal(forbiddenRoleEscalation.body.error.code, 'PERMISSION_DENIED');

    const forbiddenOtherUser = await request(app)
      .patch(`/api/v1/users/${createdUserId}`)
      .set('Authorization', `Bearer ${captainToken}`)
      .send({ displayName: 'Hacked Name' });
    assert.equal(forbiddenOtherUser.status, 403);

    // 5. Deactivate user & verify login is blocked with 403 PERMISSION_DENIED
    const deactRes = await request(app)
      .post(`/api/v1/users/${createdUserId}/deactivate`)
      .set('Authorization', `Bearer ${ownerToken}`);
    assert.equal(deactRes.status, 200);
    assert.equal(deactRes.body.data.isActive, false);

    const disabledLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'waiter02', password: 'waiterpassword' });
    assert.equal(disabledLoginRes.status, 403);
    assert.equal(disabledLoginRes.body.error.code, 'PERMISSION_DENIED');

    // 6. Re-activate user & verify login works
    const actRes = await request(app)
      .post(`/api/v1/users/${createdUserId}/activate`)
      .set('Authorization', `Bearer ${ownerToken}`);
    assert.equal(actRes.status, 200);
    assert.equal(actRes.body.data.isActive, true);

    const enabledLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'waiter02', password: 'waiterpassword' });
    assert.equal(enabledLoginRes.status, 200);
  });

  it('supports Roles list, detail, create, update, and validates permission codes', async () => {
    const rolesRes = await request(app)
      .get('/api/v1/roles')
      .set('Authorization', `Bearer ${ownerToken}`);
    assert.equal(rolesRes.status, 200);
    assert.equal(rolesRes.body.data.length, 7);

    const roleDetailRes = await request(app)
      .get('/api/v1/roles/role-captain')
      .set('Authorization', `Bearer ${ownerToken}`);
    assert.equal(roleDetailRes.status, 200);
    assert.equal(roleDetailRes.body.data.code, 'CAPTAIN');

    // Invalid permission code -> 400 VALIDATION_ERROR
    const invalidRoleRes = await request(app)
      .post('/api/v1/roles')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        code: 'SUPERVISOR',
        name: 'Supervisor',
        permissions: ['order.view', 'invalid.permission.code'],
      });
    assert.equal(invalidRoleRes.status, 400);
    assert.equal(invalidRoleRes.body.error.code, 'VALIDATION_ERROR');

    // Valid custom role creation & permission update
    const validRoleRes = await request(app)
      .post('/api/v1/roles')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        code: 'SUPERVISOR',
        name: 'Floor Supervisor',
        permissions: ['order.view', 'table.view'],
      });
    assert.equal(validRoleRes.status, 201);
    const customRoleId = validRoleRes.body.data.id;

    const patchRoleRes = await request(app)
      .patch(`/api/v1/roles/${customRoleId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        permissions: ['order.view', 'table.view', 'kot.view'],
      });
    assert.equal(patchRoleRes.status, 200);
    assert.deepEqual(patchRoleRes.body.data.permissions, ['kot.view', 'order.view', 'table.view']);
  });
});
