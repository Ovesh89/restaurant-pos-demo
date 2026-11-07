import { getDatabase, closeMongoConnection } from '../config/database.js';
import { categories, products, restaurantProfile } from './menuData.js';

export async function migrateNewMenu(db = null) {
  const targetDb = db || (await getDatabase());
  const dbName = targetDb.databaseName;

  if (dbName === 'restaurant_pos_dev' || dbName === 'restaurant_pos_test') {
    throw new Error(`[SAFETY VIOLATION] Refusing to run on legacy database "${dbName}".`);
  }

  const now = new Date().toISOString();
  const branchId = 'branch-main';

  console.log(`[Menu Migration] Starting on database: "${dbName}"...`);

  // 1. Soft-delete all existing menu categories
  const catSoftDelResult = await targetDb.collection('categories').updateMany(
    {},
    {
      $set: {
        isDeleted: true,
        deletedAt: now,
        isActive: false,
        updatedAt: now,
      },
    }
  );
  console.log(`[Menu Migration] Soft-deleted ${catSoftDelResult.matchedCount} existing categories.`);

  // 2. Soft-delete all existing menu products (dishes)
  const prodSoftDelResult = await targetDb.collection('products').updateMany(
    {},
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
  console.log(`[Menu Migration] Soft-deleted ${prodSoftDelResult.matchedCount} existing products.`);

  // 3. Upsert Branch Profile
  await targetDb.collection('branches').updateOne(
    { _id: branchId },
    {
      $set: {
        name: restaurantProfile.name,
        address: restaurantProfile.address,
        phone: restaurantProfile.phone,
        phoneNumbers: restaurantProfile.phoneNumbers,
        email: restaurantProfile.email,
        tagline: restaurantProfile.tagline,
        gstin: restaurantProfile.gstin,
        timezone: restaurantProfile.timezone,
        currency: restaurantProfile.currency,
        invoiceConfig: {
          prefix: 'INV-',
          terms: restaurantProfile.notice,
        },
        isActive: true,
        updatedAt: now,
      },
      $setOnInsert: {
        _id: branchId,
        id: branchId,
        code: 'MAIN',
        createdAt: now,
      },
    },
    { upsert: true }
  );

  // 4. Upsert 16 New Menu Categories
  let newCatCount = 0;
  for (const [cid, code, name, description, sortOrder] of categories) {
    await targetDb.collection('categories').updateOne(
      { _id: cid },
      {
        $set: {
          code,
          name,
          description: description || `${name} items`,
          sortOrder,
          isActive: true,
          isDeleted: false,
          kotRequired: true,
          updatedAt: now,
        },
        $setOnInsert: {
          _id: cid,
          id: cid,
          branchId,
          createdAt: now,
        },
      },
      { upsert: true }
    );
    newCatCount++;
  }
  console.log(`[Menu Migration] Upserted ${newCatCount} new active categories.`);

  // 5. Upsert 123 New Menu Products
  let newProdCount = 0;
  for (const [pid, catId, code, name, price, station, sortOrder, desc] of products) {
    await targetDb.collection('products').updateOne(
      { _id: pid },
      {
        $set: {
          categoryId: catId,
          code,
          name,
          description: desc || `Freshly prepared ${name}`,
          currentPrice: price,
          currency: 'INR',
          taxConfig: { rate: '5.00', mode: 'EXCLUSIVE' },
          available: true,
          kitchenStation: station,
          sortOrder,
          isActive: true,
          isDeleted: false,
          updatedAt: now,
        },
        $setOnInsert: {
          _id: pid,
          id: pid,
          branchId,
          createdAt: now,
        },
      },
      { upsert: true }
    );

    const phId = `ph_new_${pid}`;
    await targetDb.collection('price_history').updateOne(
      { _id: phId },
      {
        $set: {
          newPrice: price,
          updatedAt: now,
        },
        $setOnInsert: {
          _id: phId,
          id: phId,
          productId: pid,
          branchId,
          oldPrice: null,
          reason: 'New Menu Card 2026 pricing seed',
          changedByUserId: 'user-owner',
          changedByName: 'Green Tandoor Owner',
          changedAt: now,
          createdAt: now,
        },
      },
      { upsert: true }
    );

    newProdCount++;
  }
  console.log(`[Menu Migration] Upserted ${newProdCount} new active products with pricing.`);

  // 6. Bump revisions for real-time frontend / mobile synchronization
  await targetDb.collection('meta_revisions').updateOne(
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

  // 7. Audit log record
  await targetDb.collection('audit_logs').insertOne({
    _id: `audit_menu_migration_${Date.now()}`,
    branchId,
    action: 'MENU_MIGRATION_UPDATED',
    entityType: 'menu',
    entityId: 'catalog',
    actorUserId: 'user-owner',
    actorName: 'System Administrator',
    metadata: {
      softDeletedCategories: catSoftDelResult.matchedCount,
      softDeletedProducts: prodSoftDelResult.matchedCount,
      newCategoriesCount: newCatCount,
      newProductsCount: newProdCount,
    },
    timestamp: now,
    createdAt: now,
  });

  console.log('[Menu Migration] Successfully finished menu update and audit logging.');
  return {
    softDeletedCategories: catSoftDelResult.matchedCount,
    softDeletedProducts: prodSoftDelResult.matchedCount,
    newCategoriesCount: newCatCount,
    newProductsCount: newProdCount,
  };
}

// Direct execution
if (process.argv[1] && process.argv[1].endsWith('migrateNewMenu.js')) {
  migrateNewMenu()
    .then(async (res) => {
      console.log('[Menu Migration] Done:', JSON.stringify(res, null, 2));
      await closeMongoConnection();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[Menu Migration] Failed:', err);
      await closeMongoConnection();
      process.exit(1);
    });
}
