import {
  getDatabase,
  setDatabaseName,
  closeMongoConnection,
} from '../../src/config/database.js';
import { initIndexes } from '../../src/scripts/initIndexes.js';
import { seedDemoData } from '../../src/scripts/seedDemoData.js';

export const TEST_DB_NAME = 'restaurant_pos_demo_test';

const COLLECTIONS_TO_CLEAN = [
  'branches',
  'areas',
  'tables',
  'categories',
  'products',
  'price_history',
  'roles',
  'users',
  'orders',
  'order_events',
  'kots',
  'notifications',
  'bills',
  'payments',
  'customers',
  'discounts',
  'audit_logs',
  'counters',
  'idempotency_keys',
];

export async function setupTestDatabase({ seed = true } = {}) {
  setDatabaseName(TEST_DB_NAME);
  const db = await getDatabase(TEST_DB_NAME);

  if (!db.databaseName.includes('test')) {
    throw new Error(`[SAFETY VIOLATION] Refusing to clean non-test database "${db.databaseName}"!`);
  }

  for (const colName of COLLECTIONS_TO_CLEAN) {
    await db.collection(colName).deleteMany({});
  }

  await initIndexes(db);
  if (seed) {
    await seedDemoData(db);
  }
  return db;
}

export async function teardownTestDatabase() {
  await closeMongoConnection();
}
