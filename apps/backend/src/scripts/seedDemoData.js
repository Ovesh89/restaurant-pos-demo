import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { getDatabase, closeMongoConnection } from '../config/database.js';
import { DEFAULT_ROLE_PERMISSIONS } from '../config/permissions.js';
import { categories, products, restaurantProfile } from './menuData.js';

export function makePbkdf2Hash(password, salt = 'posmernsalt2026', iterations = 600000) {
  const digest = crypto
    .pbkdf2Sync(password, salt, iterations, 32, 'sha256')
    .toString('base64');
  return `pbkdf2_sha256$${iterations}$${salt}$${digest}`;
}

/**
 * Idempotently seed live restaurant profile & menu catalog data into restaurant_pos_mern_dev (or test DB).
 * Populates Green Tandoor Se Garden Restaurant menu (17 categories, 159 products) directly from menu card.
 */
export async function seedDemoData(db = null) {
  const targetDb = db || (await getDatabase());
  const dbName = targetDb.databaseName;

  if (dbName === 'restaurant_pos_dev' || dbName === 'restaurant_pos_test') {
    throw new Error(`[SAFETY VIOLATION] Refusing to seed legacy database "${dbName}".`);
  }

  const now = new Date().toISOString();

  // 1. Seed Main Branch Profile
  const branchId = 'branch-main';
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
        taxConfig: {
          rate: '5.00',
          gstin: restaurantProfile.gstin,
          mode: 'EXCLUSIVE',
        },
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

  // 2. Seed 7 System Roles
  const roleNames = {
    OWNER: 'Owner / Super Admin',
    ADMIN: 'Branch Admin',
    MANAGER: 'Manager',
    RECEPTION: 'Reception',
    CASHIER: 'Cashier',
    CAPTAIN: 'Captain / Waiter',
    KITCHEN: 'Kitchen / Chef',
  };

  for (const [code, perms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    const roleId = `role-${code.toLowerCase()}`;
    await targetDb.collection('roles').updateOne(
      { _id: roleId },
      {
        $set: {
          code,
          name: roleNames[code] || code,
          permissions: perms,
          isSystem: true,
          updatedAt: now,
        },
        $setOnInsert: {
          _id: roleId,
          id: roleId,
          description: `Default system role for ${code}`,
          createdAt: now,
        },
      },
      { upsert: true }
    );
  }

  // 3. Seed Users with Updated Restaurant Owner Profile
  const demoUsers = [
    ['user-owner', 'owner', 'owner123', 'Green Tandoor Owner', ['role-owner'], restaurantProfile.email, '9737581238'],
    ['user-admin', 'admin', 'admin123', 'Branch Admin', ['role-admin'], 'admin@greentandoor.local', '8866515313'],
    ['user-manager', 'manager', 'manager123', 'Floor Manager', ['role-manager'], 'manager@greentandoor.local', '9825071709'],
    ['user-reception', 'reception', 'reception123', 'Reception Desk', ['role-reception'], 'reception@greentandoor.local', '9737581238'],
    ['user-cashier', 'cashier', 'cashier123', 'Main Cashier', ['role-cashier'], 'cashier@greentandoor.local', '9737581238'],
    ['user-captain', 'captain', 'captain123', 'Captain Rahul', ['role-captain'], 'captain@greentandoor.local', '9737581238'],
    ['user-kitchen', 'kitchen', 'kitchen123', 'Head Chef Vikram', ['role-kitchen'], 'kitchen@greentandoor.local', '9737581238'],
  ];

  for (const [uid, username, pwd, displayName, roleIds, email, mobile] of demoUsers) {
    await targetDb.collection('users').updateOne(
      { _id: uid },
      {
        $set: {
          displayName,
          email,
          mobile,
          roleIds,
          branchIds: [branchId],
          isActive: true,
          updatedAt: now,
        },
        $setOnInsert: {
          _id: uid,
          id: uid,
          username,
          passwordHash: makePbkdf2Hash(pwd),
          language: 'en',
          lastLoginAt: null,
          createdAt: now,
        },
      },
      { upsert: true }
    );
  }

  // 4. Seed 3 Dining Areas
  const areas = [
    ['area-indoor', 'Indoor AC Hall', 1],
    ['area-family', 'Family Lounge', 2],
    ['area-rooftop', 'Garden Dining Area', 3],
  ];

  for (const [aid, name, sortOrder] of areas) {
    await targetDb.collection('areas').updateOne(
      { _id: aid },
      {
        $set: {
          name,
          sortOrder,
          isActive: true,
          updatedAt: now,
        },
        $setOnInsert: {
          _id: aid,
          id: aid,
          branchId,
          createdAt: now,
        },
      },
      { upsert: true }
    );
  }

  // 5. Seed 20 Tables (tbl-01 .. tbl-20, T-01 .. T-20)
  for (let i = 1; i <= 20; i += 1) {
    const padded = String(i).padStart(2, '0');
    const tid = `tbl-${padded}`;
    const tnum = `T-${padded}`;
    const areaId = i <= 8 ? 'area-indoor' : i <= 14 ? 'area-family' : 'area-rooftop';
    const capacity = i % 3 !== 0 ? 4 : 6;

    await targetDb.collection('tables').updateOne(
      { _id: tid },
      {
        $set: {
          tableNumber: tnum,
          capacity,
          isActive: true,
          updatedAt: now,
        },
        $setOnInsert: {
          _id: tid,
          id: tid,
          branchId,
          areaId,
          status: 'AVAILABLE',
          activeOrderId: null,
          createdAt: now,
        },
      },
      { upsert: true }
    );
  }

  // 6. Seed 17 Menu Categories from Menu Card
  const validCategoryIds = [];
  for (const [cid, code, name, description, sortOrder] of categories) {
    validCategoryIds.push(cid);
    await targetDb.collection('categories').updateOne(
      { _id: cid },
      {
        $set: {
          code,
          name,
          description: description || `${name} items`,
          sortOrder,
          isActive: true,
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
  }

  // Soft-deactivate any legacy demo categories not present in the live menu
  await targetDb.collection('categories').updateMany(
    { branchId, _id: { $nin: validCategoryIds } },
    { $set: { isActive: false, updatedAt: now } }
  );

  // 7. Seed Full 159-Dish Menu Catalog + Price History
  const validProductIds = [];
  for (const [pid, catId, code, name, price, station, sortOrder] of products) {
    validProductIds.push(pid);
    const res = await targetDb.collection('products').updateOne(
      { _id: pid },
      {
        $set: {
          categoryId: catId,
          code,
          name,
          description: `Freshly prepared ${name}`,
          currentPrice: price,
          currency: 'INR',
          taxConfig: { rate: '5.00', mode: 'EXCLUSIVE' },
          available: true,
          kitchenStation: station,
          sortOrder,
          isActive: true,
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

    const phId = `ph_seed_${pid}`;
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
          reason: 'Initial menu card catalog seed',
          changedByUserId: 'user-owner',
          changedByName: 'Green Tandoor Owner',
          changedAt: now,
          createdAt: now,
        },
      },
      { upsert: true }
    );
  }

  // Soft-deactivate legacy demo products not in current live menu card
  await targetDb.collection('products').updateMany(
    { branchId, _id: { $nin: validProductIds } },
    { $set: { available: false, isActive: false, updatedAt: now } }
  );

  return true;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  seedDemoData()
    .then(async () => {
      const db = await getDatabase();
      console.log(
        `[seed-demo-data] Successfully seeded live menu into "${db.databaseName}" (7 roles, 7 users, 3 areas, 20 tables, 17 categories, 159 products).`
      );
      await closeMongoConnection();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[seed-demo-data] Error:', err);
      await closeMongoConnection();
      process.exit(1);
    });
}
