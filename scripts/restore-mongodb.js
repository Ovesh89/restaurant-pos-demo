import { restoreDatabase } from '../apps/backend/src/scripts/restoreMongo.js';
import { closeMongoConnection } from '../apps/backend/src/config/database.js';

export { restoreDatabase };

const args = process.argv.slice(2);
const dropFirst = args.includes('--drop');
const positional = args.filter((a) => !a.startsWith('-'));
const sourceDir = positional[0];

if (!sourceDir) {
  console.error('Usage: node scripts/restore-mongodb.js <backup_directory> [--drop]');
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
