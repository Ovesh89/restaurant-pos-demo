import { MongoClient } from 'mongodb';
import { env } from './env.js';

let clientInstance = null;
let activeDbName = env.mongodbDatabase;

/**
 * Override active database name (used by automated test suite to force restaurant_pos_mern_test).
 */
export function setDatabaseName(dbName) {
  if (dbName === 'restaurant_pos_dev' || dbName === 'restaurant_pos_test') {
    throw new Error(`[SAFETY VIOLATION] Cannot switch to legacy database "${dbName}".`);
  }
  activeDbName = dbName;
}

export function getDatabaseName() {
  return activeDbName;
}

export async function getMongoClient() {
  if (!clientInstance) {
    clientInstance = new MongoClient(env.mongodbUri, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
    });
    await clientInstance.connect();
  }
  return clientInstance;
}

export async function getDatabase(dbName = null) {
  const targetName = dbName || activeDbName;
  if (targetName === 'restaurant_pos_dev' || targetName === 'restaurant_pos_test') {
    throw new Error(`[SAFETY VIOLATION] Refusing access to legacy database "${targetName}".`);
  }
  const client = await getMongoClient();
  return client.db(targetName);
}

export const getDb = getDatabase;

export async function getCollection(collectionName, dbName = null) {
  const db = await getDatabase(dbName);
  return db.collection(collectionName);
}

/**
 * Ping MongoDB and return health status matching Django api/db.py check_mongodb_connection().
 */
export async function checkMongoConnection() {
  try {
    const client = await getMongoClient();
    const db = client.db(activeDbName);
    await client.db('admin').command({ ping: 1 });
    const serverInfo = await client.db('admin').command({ buildInfo: 1 }).catch(() => null);
    return {
      connected: true,
      database: db.databaseName,
      version: serverInfo?.version || 'MongoDB Atlas',
      error: null,
    };
  } catch (err) {
    return {
      connected: false,
      database: activeDbName,
      version: null,
      error: err.message,
    };
  }
}

/**
 * Execute work inside a MongoDB transaction when connected to a replica set,
 * falling back cleanly on standalone mongod (codes 20 / 263).
 */
export async function atomicTransaction(workFn) {
  const client = await getMongoClient();
  const session = client.startSession();
  try {
    let result;
    try {
      await session.withTransaction(async () => {
        result = await workFn(session);
      });
      return result;
    } catch (err) {
      if (
        err?.code === 20 ||
        err?.code === 263 ||
        err?.codeName === 'IllegalOperation' ||
        String(err?.message || '').includes('Transaction numbers are only allowed')
      ) {
        return await workFn(null);
      }
      throw err;
    }
  } finally {
    await session.endSession();
  }
}

export async function closeMongoConnection() {
  if (clientInstance) {
    await clientInstance.close();
    clientInstance = null;
  }
}
