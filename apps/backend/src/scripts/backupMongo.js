import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BSON } from 'mongodb';
import { getDatabase, closeMongoConnection } from '../config/database.js';

export const COLLECTIONS_TO_BACKUP = [
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../..');

/**
 * Exports all 19 POS collections to EJSON files with a manifest.json.
 * Compatible with the legacy Django backup_mongodb.py snapshot format.
 */
export async function backupDatabase({ targetDir = null, db = null, quiet = false } = {}) {
  const targetDb = db || (await getDatabase());
  const now = new Date();
  const timestamp = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+Z$/, '')
    .replace('T', '_');

  const resolvedPath = targetDir
    ? path.resolve(targetDir)
    : path.join(REPO_ROOT, 'backups', `backup_${timestamp}`);

  await fs.mkdir(resolvedPath, { recursive: true });

  const manifest = {
    timestamp: now.toISOString(),
    database: targetDb.databaseName,
    collections: {},
  };

  if (!quiet) {
    console.log(`[backup-mongodb] Starting MongoDB backup from "${targetDb.databaseName}" to: ${resolvedPath}`);
  }

  for (const colName of COLLECTIONS_TO_BACKUP) {
    const col = targetDb.collection(colName);
    const docs = await col.find({}).toArray();
    const filePath = path.join(resolvedPath, `${colName}.json`);

    await fs.writeFile(
      filePath,
      BSON.EJSON.stringify(docs, { relaxed: true }, 2),
      'utf8'
    );

    manifest.collections[colName] = docs.length;
    if (!quiet) {
      console.log(`  [OK] Exported ${String(docs.length).padStart(4, ' ')} records from '${colName}'`);
    }
  }

  const manifestFile = path.join(resolvedPath, 'manifest.json');
  await fs.writeFile(
    manifestFile,
    BSON.EJSON.stringify(manifest, { relaxed: true }, 2),
    'utf8'
  );

  if (!quiet) {
    console.log(`[SUCCESS] Backup completed. Manifest written to ${manifestFile}`);
  }

  return {
    backupDir: resolvedPath,
    manifestFile,
    manifest,
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const outIdx = process.argv.findIndex((arg) => arg === '--output' || arg === '-o');
  const targetDir = outIdx !== -1 && process.argv[outIdx + 1] ? process.argv[outIdx + 1] : null;

  backupDatabase({ targetDir })
    .then(async () => {
      await closeMongoConnection();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[backup-mongodb] Error:', err);
      await closeMongoConnection();
      process.exit(1);
    });
}
