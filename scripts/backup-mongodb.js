import { backupDatabase } from '../apps/backend/src/scripts/backupMongo.js';
import { closeMongoConnection } from '../apps/backend/src/config/database.js';

export { backupDatabase };

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
