import { seedDemoData } from '../apps/backend/src/scripts/seedDemoData.js';
import { getDatabase, closeMongoConnection } from '../apps/backend/src/config/database.js';

import { categories, products } from '../apps/backend/src/scripts/menuData.js';

export { seedDemoData };

seedDemoData()
  .then(async () => {
    const db = await getDatabase();
    console.log(
      `[seed-demo-data] Successfully seeded demo data into "${db.databaseName}" (7 roles, 7 users, 3 areas, 20 tables, ${categories.length} categories, ${products.length} products).`
    );
    await closeMongoConnection();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('[seed-demo-data] Error:', err);
    await closeMongoConnection();
    process.exit(1);
  });
