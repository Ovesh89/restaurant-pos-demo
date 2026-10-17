import { initIndexes } from '../apps/backend/src/scripts/initIndexes.js';
import { getDatabase, closeMongoConnection } from '../apps/backend/src/config/database.js';

export { initIndexes };

initIndexes()
  .then(async () => {
    const db = await getDatabase();
    console.log(`[init-indexes] Successfully initialized indexes on "${db.databaseName}".`);
    await closeMongoConnection();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('[init-indexes] Error:', err);
    await closeMongoConnection();
    process.exit(1);
  });
