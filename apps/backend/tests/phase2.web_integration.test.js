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

describe('Phase 2C — End-to-End Web API Repositories Integration Against Express', () => {
  let server;
  let baseUrl;
  let apiClient;
  let authApiRepository;
  let userApiRepository;
  let roleApiRepository;
  let branchApiRepository;
  let tableApiRepository;
  let categoryApiRepository;
  let productApiRepository;
  let settingsApiRepository;

  before(async () => {
    await setupTestDatabase({ seed: true });
    const app = createApp();
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}/api/v1`;

    // Dynamically import Web API client & repositories from apps/web
    ({ apiClient } = await import('../../web/src/services/api/apiClient.js'));
    apiClient.getBaseUrl = () => baseUrl;

    ({ authApiRepository } = await import(
      '../../web/src/services/repositories/api/authApiRepository.js'
    ));
    ({ userApiRepository } = await import(
      '../../web/src/services/repositories/api/userApiRepository.js'
    ));
    ({ roleApiRepository } = await import(
      '../../web/src/services/repositories/api/roleApiRepository.js'
    ));
    ({ branchApiRepository } = await import(
      '../../web/src/services/repositories/api/branchApiRepository.js'
    ));
    ({ tableApiRepository } = await import(
      '../../web/src/services/repositories/api/tableApiRepository.js'
    ));
    ({ categoryApiRepository } = await import(
      '../../web/src/services/repositories/api/categoryApiRepository.js'
    ));
    ({ productApiRepository } = await import(
      '../../web/src/services/repositories/api/productApiRepository.js'
    ));
    ({ settingsApiRepository } = await import(
      '../../web/src/services/repositories/api/settingsApiRepository.js'
    ));
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await teardownTestDatabase();
  });

  it('authenticates via Web authApiRepository, restores session, refreshes token via apiClient, and updates profile', async () => {
    const session = await authApiRepository.login('owner', 'owner123');
    assert.equal(session.user.username, 'owner');
    assert.equal(session.user.role, 'owner');
    assert.ok(session.permissions.includes('menu.manage'));

    const restored = await authApiRepository.restoreSession();
    assert.equal(restored.user.id, 'user-owner');

    // Verify Web apiClient.handleTokenRefresh() works with Express /auth/refresh shim
    const refreshedOk = await apiClient.handleTokenRefresh();
    assert.equal(refreshedOk, true);

    const updatedProfile = await authApiRepository.updateProfile('user-owner', {
      name: 'Rajesh Owner',
      mobile: '9876543211',
    });
    assert.equal(updatedProfile.displayName, 'Rajesh Owner');
  });

  it('executes Web userApiRepository, roleApiRepository, branchApiRepository, tableApiRepository, and settingsApiRepository', async () => {
    const users = await userApiRepository.getUsers();
    assert.equal(users.length, 7);

    const createdUser = await userApiRepository.createUser({
      username: 'webcaptain',
      name: 'Web Captain',
      role: 'captain',
      mobile: '9811122233',
    });
    assert.equal(createdUser.username, 'webcaptain');
    assert.equal(createdUser.role, 'captain');

    const toggledUser = await userApiRepository.toggleUserStatus(createdUser.id);
    assert.equal(toggledUser.isActive, false);

    const roles = await roleApiRepository.getRoles();
    assert.equal(roles.length, 7);

    const areas = await branchApiRepository.getAreas('branch-main');
    assert.equal(areas.length, 3);

    const tables = await tableApiRepository.getTables('branch-main');
    assert.equal(tables.length, 20);
    assert.equal(tables[0].tableNo, 'T-01');

    // Web settingsApiRepository calls GET & PATCH /branches/branch-main
    const settings = await settingsApiRepository.getSettings();
    assert.equal(settings.defaultTaxRate, 5);

    const updatedSettings = await settingsApiRepository.updateSettings({
      ...settings,
      branchName: 'Green Garden — Indiranagar',
      invoicePrefix: 'GT-INV-',
    });
    assert.equal(updatedSettings.branchName, 'Green Garden — Indiranagar');
    assert.equal(updatedSettings.invoicePrefix, 'GT-INV-');
  });

  it('executes Web categoryApiRepository and productApiRepository (including price change and history)', async () => {
    const categories = await categoryApiRepository.getCategories();
    assert.equal(categories.length, 13);

    const newCat = await categoryApiRepository.createCategory({
      name: 'Sizzlers',
      code: 'SIZ',
      sortOrder: 18,
    });
    assert.equal(newCat.name, 'Sizzlers');

    const products = await productApiRepository.getProducts({ onlyAvailable: true });
    assert.equal(products.length, 159);

    const newProd = await productApiRepository.createProduct({
      code: 'SIZ-01',
      name: 'Paneer Shashlik Sizzler',
      categoryId: newCat.id,
      price: 420,
      taxRate: 5,
      station: 'MAIN',
      isAvailable: true,
    });
    assert.equal(newProd.price, 420);

    // Update product with price change (triggers POST /menu/products/:id/price with newPrice)
    const updatedProd = await productApiRepository.updateProduct(
      newProd.id,
      { price: 450, name: 'Paneer Shashlik Supreme Sizzler' },
      { id: 'user-owner', name: 'Owner' },
      'Upgraded sizzler portion size'
    );
    assert.equal(updatedProd.price, 450);
    assert.equal(updatedProd.name, 'Paneer Shashlik Supreme Sizzler');

    const history = await productApiRepository.getPriceHistory(newProd.id);
    assert.equal(history.length, 2);
    assert.equal(history[0].newPrice, '450.00');
    assert.equal(history[0].oldPrice, '420.00');
  });
});
