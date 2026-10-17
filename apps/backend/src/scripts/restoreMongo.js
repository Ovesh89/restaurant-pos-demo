import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BSON } from 'mongodb';
import { getDatabase, closeMongoConnection } from '../config/database.js';

/**
 * Restores POS collections from EJSON/JSON backup files with manifest validation.
 * Strictly refuses to write to legacy Django databases.
 */
export async function restoreDatabase({
  sourceDir,
  dropFirst = false,
  db = null,
  quiet = false,
} = {}) {
  if (!sourceDir) {
    throw new Error('sourceDir is required for restoreDatabase.');
  }

  const sourcePath = path.resolve(sourceDir);
  const manifestFile = path.join(sourcePath, 'manifest.json');

  let manifestRaw;
  try {
    manifestRaw = await fs.readFile(manifestFile, 'utf8');
  } catch {
    throw new Error(`Manifest not found in backup directory: ${manifestFile}`);
  }

  const manifest = BSON.EJSON.parse(manifestRaw);
  const targetDb = db || (await getDatabase());
  const dbName = targetDb.databaseName;

  if (dbName === 'restaurant_pos_dev' || dbName === 'restaurant_pos_test') {
    throw new Error(
      `[SAFETY VIOLATION] Refusing to restore into legacy Django database "${dbName}".`
    );
  }

  if (!quiet) {
    console.log(`[restore-mongodb] Starting MongoDB restore into "${dbName}" from: ${sourcePath}`);
    console.log(`[restore-mongodb] Backup created at: ${manifest.timestamp}`);
    console.log(`[restore-mongodb] Drop existing collections first: ${dropFirst}`);
  }

  const restoredCounts = {};

  for (const colName of Object.keys(manifest.collections || {})) {
    const filePath = path.join(sourcePath, `${colName}.json`);
    let rawDocs;
    try {
      rawDocs = await fs.readFile(filePath, 'utf8');
    } catch {
      if (!quiet) {
        console.warn(`  [WARN] Missing file for collection '${colName}', skipping.`);
      }
      continue;
    }

    const docs = BSON.EJSON.parse(rawDocs);
    const col = targetDb.collection(colName);

    if (dropFirst) {
      await col.deleteMany({});
    }

    if (Array.isArray(docs) && docs.length > 0) {
      for (const doc of docs) {
        await col.replaceOne({ _id: doc._id }, doc, { upsert: true });
      }
    }

    restoredCounts[colName] = Array.isArray(docs) ? docs.length : 0;
    if (!quiet) {
      console.log(
        `  [OK] Restored ${String(restoredCounts[colName]).padStart(4, ' ')} records into '${colName}'`
      );
    }
  }

  if (!quiet) {
    console.log('[SUCCESS] Database restore completed successfully.');
  }

  return {
    database: dbName,
    sourceDir: sourcePath,
    restoredCounts,
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const dropFirst = args.includes('--drop');
  const positional = args.filter((a) => !a.startsWith('-'));
  const sourceDir = positional[0];

  if (!sourceDir) {
    console.error('Usage: node restore-mongodb.js <backup_directory> [--drop]');
    process.exit(1);
  }

  restoreDatabase({ sourceDir, dropFirst })
    .then(async () => {
      await closeMongoConnection();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[restore-mongodb] Error:', err);
      await closeMongoConnection();
      process.exit(1);
    });
}
