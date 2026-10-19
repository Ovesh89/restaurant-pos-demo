import { getDatabase, closeMongoConnection } from '../config/database.js';
import { fileURLToPath } from 'node:url';

/**
 * Initialize all 28 MongoDB indexes across the 19 collections.
 * Mirrors scripts/init_indexes.py in Django source backend 1:1.
 */
export async function initIndexes(db = null) {
  const targetDb = db || (await getDatabase());
  const dbName = targetDb.databaseName;

  if (dbName === 'restaurant_pos_dev' || dbName === 'restaurant_pos_test') {
    throw new Error(`[SAFETY VIOLATION] Refusing to modify indexes on legacy database "${dbName}".`);
  }

  // 1. branches
  await targetDb.collection('branches').createIndexes([
    { key: { code: 1 }, name: 'idx_branches_code_unique', unique: true },
    { key: { isActive: 1 }, name: 'idx_branches_active' },
  ]);

  // 2. areas
  await targetDb.collection('areas').createIndexes([
    { key: { branchId: 1, isActive: 1, sortOrder: 1 }, name: 'idx_areas_branch_active_sort' },
  ]);

  // 3. tables
  await targetDb.collection('tables').createIndexes([
    { key: { branchId: 1, tableNumber: 1 }, name: 'idx_tables_branch_number_unique', unique: true },
    { key: { branchId: 1, areaId: 1, status: 1 }, name: 'idx_tables_branch_area_status' },
  ]);

  // 4. categories
  await targetDb.collection('categories').createIndexes([
    { key: { branchId: 1, isActive: 1, sortOrder: 1 }, name: 'idx_categories_branch_active_sort' },
  ]);

  // 5. products
  await targetDb.collection('products').createIndexes([
    {
      key: { branchId: 1, categoryId: 1, isActive: 1, available: 1 },
      name: 'idx_products_branch_cat_active_avail',
    },
    { key: { branchId: 1, name: 1 }, name: 'idx_products_branch_name' },
  ]);

  // 6. price_history
  await targetDb.collection('price_history').createIndexes([
    { key: { productId: 1, changedAt: -1 }, name: 'idx_price_history_product_date' },
  ]);

  // 7. roles
  await targetDb.collection('roles').createIndexes([
    { key: { code: 1 }, name: 'idx_roles_code_unique', unique: true },
  ]);

  // 8. users
  await targetDb.collection('users').createIndexes([
    { key: { username: 1 }, name: 'idx_users_username_unique', unique: true },
    { key: { branchIds: 1, isActive: 1 }, name: 'idx_users_branches_active' },
  ]);

  // 9. orders
  await targetDb.collection('orders').createIndexes([
    { key: { orderNumber: 1 }, name: 'idx_orders_number_unique', unique: true },
    { key: { branchId: 1, status: 1, createdAt: -1 }, name: 'idx_orders_branch_status_date' },
    { key: { branchId: 1, tableId: 1, status: 1 }, name: 'idx_orders_branch_table_status' },
    { key: { branchId: 1, captainId: 1, createdAt: -1 }, name: 'idx_orders_branch_captain_date' },
  ]);

  // 10. order_events
  await targetDb.collection('order_events').createIndexes([
    { key: { orderId: 1, createdAt: 1 }, name: 'idx_order_events_order_date' },
  ]);

  // 11. kots
  await targetDb.collection('kots').createIndexes([
    { key: { kotNumber: 1 }, name: 'idx_kots_number_unique', unique: true },
    { key: { branchId: 1, status: 1, createdAt: 1 }, name: 'idx_kots_branch_status_date' },
    { key: { orderId: 1, revision: 1 }, name: 'idx_kots_order_revision' },
  ]);

  // 12. notifications
  await targetDb.collection('notifications').createIndexes([
    {
      key: { branchId: 1, recipientRole: 1, isRead: 1, createdAt: -1 },
      name: 'idx_notifications_branch_role_read_date',
    },
    {
      key: { recipientUserId: 1, isRead: 1, createdAt: -1 },
      name: 'idx_notifications_user_read_date',
    },
  ]);

  // 13. bills
  await targetDb.collection('bills').createIndexes([
    { key: { billNumber: 1 }, name: 'idx_bills_number_unique', unique: true },
    { key: { orderId: 1 }, name: 'idx_bills_order_unique', unique: true },
    { key: { branchId: 1, status: 1, createdAt: -1 }, name: 'idx_bills_branch_status_date' },
  ]);

  // 14. payments
  await targetDb.collection('payments').createIndexes([
    { key: { billId: 1, createdAt: 1 }, name: 'idx_payments_bill_date' },
    { key: { branchId: 1, mode: 1, createdAt: -1 }, name: 'idx_payments_branch_mode_date' },
    {
      key: { idempotencyKey: 1 },
      name: 'idx_payments_idempotency_sparse',
      unique: true,
      sparse: true,
    },
  ]);

  // 15. discounts
  await targetDb.collection('discounts').createIndexes([
    { key: { billId: 1 }, name: 'idx_discounts_bill' },
  ]);

  // 16. customers
  await targetDb.collection('customers').createIndexes([
    { key: { branchId: 1, phone: 1 }, name: 'idx_customers_branch_phone_unique', unique: true },
    { key: { branchId: 1, name: 1 }, name: 'idx_customers_branch_name' },
  ]);

  // 17. audit_logs
  await targetDb.collection('audit_logs').createIndexes([
    { key: { branchId: 1, createdAt: -1 }, name: 'idx_audit_branch_date' },
    { key: { entityType: 1, entityId: 1, createdAt: -1 }, name: 'idx_audit_entity_date' },
    { key: { actorUserId: 1, createdAt: -1 }, name: 'idx_audit_actor_date' },
    { key: { createdAt: 1 }, name: 'idx_audit_created_at' },
  ]);

  // 18. idempotency_keys
  await targetDb.collection('idempotency_keys').createIndexes([
    {
      key: { key: 1, path: 1, method: 1 },
      name: 'idx_idempotency_key_unique',
      unique: true,
    },
  ]);

  return true;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
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
}
