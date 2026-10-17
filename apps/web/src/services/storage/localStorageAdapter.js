import { STORAGE_KEYS, STORAGE_VERSION } from '../../constants/storageKeys.js';
import {
  INITIAL_BRANCHES,
  INITIAL_AREAS,
  INITIAL_TABLES,
  INITIAL_CATEGORIES,
  INITIAL_PRODUCTS,
  INITIAL_USERS,
  INITIAL_ROLES
} from '../../mock-data/seedData.js';

class LocalStorageAdapter {
  constructor() {
    this.isInitialized = false;
  }

  /**
   * Initializes the storage schema and populates deterministic seed data if needed
   */
  initialize() {
    try {
      const storedVersion = this.getItem(STORAGE_KEYS.VERSION);

      if (!storedVersion || Number(storedVersion) < STORAGE_VERSION) {
        console.info(`[StorageAdapter] Initializing storage (version ${STORAGE_VERSION})...`);
        this.seedAll();
        this.setItem(STORAGE_KEYS.VERSION, STORAGE_VERSION);
      } else {
        // Ensure core collections exist even if empty
        this.ensureCollection(STORAGE_KEYS.USERS, INITIAL_USERS);
        this.ensureCollection(STORAGE_KEYS.ROLES, INITIAL_ROLES);
        this.ensureCollection(STORAGE_KEYS.BRANCHES, INITIAL_BRANCHES);
        this.ensureCollection(STORAGE_KEYS.AREAS, INITIAL_AREAS);
        this.ensureCollection(STORAGE_KEYS.TABLES, INITIAL_TABLES);
        this.ensureCollection(STORAGE_KEYS.CATEGORIES, INITIAL_CATEGORIES);
        this.ensureCollection(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS);
        this.ensureCollection(STORAGE_KEYS.PRICE_HISTORY, []);
        this.ensureCollection(STORAGE_KEYS.AUDIT_LOGS, []);
        this.ensureCollection(STORAGE_KEYS.ORDERS, []);
        this.ensureCollection(STORAGE_KEYS.KOTS, []);
        this.ensureCollection(STORAGE_KEYS.BILLS, []);
      }

      this.isInitialized = true;
    } catch (err) {
      console.error('[StorageAdapter] Failed to initialize storage:', err);
    }
  }

  ensureCollection(key, defaultData) {
    if (this.getItem(key) === null) {
      this.setItem(key, defaultData);
    }
  }

  /**
   * Seed all initial data deterministically
   */
  seedAll() {
    this.setItem(STORAGE_KEYS.VERSION, STORAGE_VERSION);
    this.setItem(STORAGE_KEYS.BRANCHES, INITIAL_BRANCHES);
    this.setItem(STORAGE_KEYS.AREAS, INITIAL_AREAS);
    this.setItem(STORAGE_KEYS.TABLES, INITIAL_TABLES);
    this.setItem(STORAGE_KEYS.CATEGORIES, INITIAL_CATEGORIES);
    this.setItem(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS);
    this.setItem(STORAGE_KEYS.USERS, INITIAL_USERS);
    this.setItem(STORAGE_KEYS.ROLES, INITIAL_ROLES);
    this.setItem(STORAGE_KEYS.PRICE_HISTORY, [
      {
        id: 'ph-init-1',
        productId: 'prod-08',
        productName: 'Mutton Raan (Special)',
        oldPrice: 1100,
        newPrice: 1200,
        changedBy: 'Rajesh Sharma (Owner)',
        reason: 'Raw ingredient cost revision for leg of lamb',
        changedAt: '2026-02-15T10:30:00.000Z'
      }
    ]);
    this.setItem(STORAGE_KEYS.AUDIT_LOGS, [
      {
        id: 'audit-init-1',
        actorId: 'user-001',
        actorName: 'Rajesh Sharma (Owner)',
        action: 'SYSTEM_INITIALIZED',
        entityType: 'System',
        entityId: 'seed',
        details: 'Initial system seed loaded successfully with default branches, tables, menu and staff.',
        timestamp: new Date().toISOString()
      }
    ]);
    this.setItem(STORAGE_KEYS.ORDERS, []);
    this.setItem(STORAGE_KEYS.ORDER_EVENTS, []);
    this.setItem(STORAGE_KEYS.KOTS, []);
    this.setItem(STORAGE_KEYS.BILLS, []);
    this.setItem(STORAGE_KEYS.PAYMENTS, []);
    this.setItem(STORAGE_KEYS.CUSTOMERS, []);
  }

  /**
   * Reset data to seed (useful for development demo testing)
   */
  resetToSeedData() {
    // Preserve current session if any
    const currentSession = this.getItem(STORAGE_KEYS.SESSION);
    
    // Clear all keys with restaurant_pos prefix
    Object.values(STORAGE_KEYS).forEach((key) => {
      localStorage.removeItem(key);
    });

    this.seedAll();

    if (currentSession) {
      this.setItem(STORAGE_KEYS.SESSION, currentSession);
    }
  }

  getItem(key) {
    try {
      const value = localStorage.getItem(key);
      if (value === null || value === undefined) return null;
      return JSON.parse(value);
    } catch (err) {
      console.error(`[StorageAdapter] Error reading key "${key}":`, err);
      return null;
    }
  }

  setItem(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.error(`[StorageAdapter] Error writing key "${key}":`, err);
      return false;
    }
  }

  removeItem(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (err) {
      console.error(`[StorageAdapter] Error removing key "${key}":`, err);
      return false;
    }
  }
}

export const storageAdapter = new LocalStorageAdapter();
