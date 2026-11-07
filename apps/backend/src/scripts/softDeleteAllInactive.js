import { getDatabase, closeMongoConnection } from '../config/database.js';

export async function softDeleteAllInactive() {
  const db = await getDatabase();
  const dbName = db.databaseName;

  if (dbName === 'restaurant_pos_dev' || dbName === 'restaurant_pos_test') {
    throw new Error(`[SAFETY VIOLATION] Refusing to run on legacy database "${dbName}".`);
  }

  const now = new Date().toISOString();
  const branchId = 'branch-main';

  console.log(`[Soft Delete Inactive] Running on database: "${dbName}"...`);

  // 1. Soft-delete all categories where isActive is false OR isDeleted is true
  const catResult = await db.collection('categories').updateMany(
    {
      $or: [
        { isActive: false },
        { isDeleted: true },
      ],
    },
    {
      $set: {
        isDeleted: true,
        deletedAt: now,
        isActive: false,
        updatedAt: now,
      },
    }
  );
  console.log(`[Soft Delete Inactive] Categories updated: ${catResult.matchedCount}`);

  // 2. Soft-delete all products where isActive is false OR isDeleted is true
  const prodResult = await db.collection('products').updateMany(
    {
      $or: [
        { isActive: false },
        { isDeleted: true },
      ],
    },
    {
      $set: {
        isDeleted: true,
        deletedAt: now,
        isActive: false,
        available: false,
        updatedAt: now,
      },
    }
  );
  console.log(`[Soft Delete Inactive] Products updated: ${prodResult.matchedCount}`);

  // 3. Bump meta revisions so web/mobile cache refreshes
  await db.collection('meta_revisions').updateOne(
    { _id: `rev_${branchId}` },
    {
      $inc: {
        categories: 1,
        products: 1,
      },
      $set: {
        branchId,
        updatedAt: now,
      },
    },
    { upsert: true }
  );

  // 4. Verify counts
  const activeCats = await db.collection('categories').countDocuments({
    isDeleted: { $ne: true },
    isActive: true,
  });
  const deletedCats = await db.collection('categories').countDocuments({
    isDeleted: true,
  });

  const activeProds = await db.collection('products').countDocuments({
    isDeleted: { $ne: true },
    isActive: true,
  });
  const deletedProds = await db.collection('products').countDocuments({
    isDeleted: true,
  });

  console.log('[Soft Delete Inactive] Results:', {
    activeCategories: activeCats,
    softDeletedCategories: deletedCats,
    activeProducts: activeProds,
    softDeletedProducts: deletedProds,
  });

  return {
    activeCategories: activeCats,
    softDeletedCategories: deletedCats,
    activeProducts: activeProds,
    softDeletedProducts: deletedProds,
  };
}

if (process.argv[1] && process.argv[1].endsWith('softDeleteAllInactive.js')) {
  softDeleteAllInactive()
    .then(async () => {
      await closeMongoConnection();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error(err);
      await closeMongoConnection();
      process.exit(1);
    });
}
