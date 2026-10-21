import { MongoClient } from 'mongodb';
import { env } from './env.js';

let clientInstance = null;
let activeDbName = env.mongodbDatabase;
const LOCAL_FALLBACK_URI = 'mongodb://127.0.0.1:27017';

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

function isTopologyClosed(client) {
  if (!client) return true;
  try {
    if (client.topology && typeof client.topology.isClosed === 'function') {
      return client.topology.isClosed();
    }
  } catch (_) {}
  return false;
}

export async function getMongoClient() {
  // If client exists and topology is still open, reuse it
  if (clientInstance && !isTopologyClosed(clientInstance)) {
    return clientInstance;
  }

  // If a previous instance existed but is closed/dead, clean it up
  if (clientInstance) {
    try {
      await clientInstance.close();
    } catch (_) {}
    clientInstance = null;
  }

  const primaryUri = env.mongodbUri;
  let newClient = null;

  try {
    newClient = new MongoClient(primaryUri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });
    await newClient.connect();
    clientInstance = newClient;
    return clientInstance;
  } catch (primaryErr) {
    if (newClient) {
      try {
        await newClient.close();
      } catch (_) {}
      newClient = null;
    }

    // If primary was a remote URI (e.g. Atlas) and failed (SSL alert 80, IP blocked, timeout),
    // attempt graceful fallback to local MongoDB instance if running
    const isLocalUri = primaryUri.includes('127.0.0.1') || primaryUri.includes('localhost');
    if (!isLocalUri) {
      console.warn(
        `[MongoDB] Primary connection to "${primaryUri.replace(/:[^@]+@/, ':***@')}" failed (${primaryErr.message}). Attempting local fallback (${LOCAL_FALLBACK_URI})...`
      );
      try {
        const fallbackClient = new MongoClient(LOCAL_FALLBACK_URI, {
          serverSelectionTimeoutMS: 3000,
          connectTimeoutMS: 3000,
        });
        await fallbackClient.connect();
        clientInstance = fallbackClient;
        console.log(`[MongoDB] Connected to local fallback database successfully.`);
        return clientInstance;
      } catch (fallbackErr) {
        clientInstance = null;
        throw new Error(
          `MongoDB connection failed. Primary: ${primaryErr.message} | Local fallback: ${fallbackErr.message}`
        );
      }
    }

    clientInstance = null;
    throw primaryErr;
  }
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
      version: serverInfo?.version || 'MongoDB',
      error: null,
    };
  } catch (err) {
    if (clientInstance) {
      try {
        await clientInstance.close();
      } catch (_) {}
      clientInstance = null;
    }
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
    try {
      await clientInstance.close();
    } finally {
      clientInstance = null;
    }
  }
}
