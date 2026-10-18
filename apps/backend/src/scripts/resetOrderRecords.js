import { getDatabase, closeMongoConnection } from '../config/database.js';

export async function resetOrderRecords(dbName = null) {
  const db = await getDatabase(dbName);
  console.log(`[ResetOrders] Connecting to database: ${db.databaseName}`);

  // Safety: Never wipe legacy Django DB
  if (db.databaseName === 'restaurant_pos_dev' || db.databaseName === 'restaurant_pos_test') {
    throw new Error(`[SAFETY VIOLATION] Refusing to modify legacy database "${db.databaseName}"!`);
  }

  // 1. Delete all orders
  const ordersResult = await db.collection('orders').deleteMany({});
  console.log(`[ResetOrders] Deleted ${ordersResult.deletedCount} orders.`);

  // 2. Delete all order events
  const eventsResult = await db.collection('order_events').deleteMany({});
  console.log(`[ResetOrders] Deleted ${eventsResult.deletedCount} order events.`);

  // 3. Delete all KOTs
  const kotsResult = await db.collection('kots').deleteMany({});
  console.log(`[ResetOrders] Deleted ${kotsResult.deletedCount} KOTs.`);

  // 4. Delete all bills
  const billsResult = await db.collection('bills').deleteMany({});
  console.log(`[ResetOrders] Deleted ${billsResult.deletedCount} bills.`);

  // 5. Delete all payments
  const paymentsResult = await db.collection('payments').deleteMany({});
  console.log(`[ResetOrders] Deleted ${paymentsResult.deletedCount} payments.`);

  // 6. Delete all discounts
  const discountsResult = await db.collection('discounts').deleteMany({});
  console.log(`[ResetOrders] Deleted ${discountsResult.deletedCount} discounts.`);

  // 7. Reset order, KOT, and bill counters
  const countersResult = await db.collection('counters').deleteMany({
    _id: { $regex: /^(ord_|kot_|bill_)/i }
  });
  console.log(`[ResetOrders] Cleared ${countersResult.deletedCount} order/kot/bill counters.`);

  // 8. Reset all dining tables to AVAILABLE and activeOrderId to null
  const tablesResult = await db.collection('tables').updateMany(
    {},
    {
      $set: {
        status: 'AVAILABLE',
        activeOrderId: null,
      }
    }
  );
  console.log(`[ResetOrders] Reset ${tablesResult.modifiedCount} table(s) to AVAILABLE with null activeOrderId.`);

  console.log('[ResetOrders] Order records successfully wiped and reset to zero!');
}

// Run directly if invoked via CLI
if (process.argv[1] && process.argv[1].endsWith('resetOrderRecords.js')) {
  resetOrderRecords()
    .then(() => {
      console.log('[ResetOrders] Done.');
      return closeMongoConnection();
    })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[ResetOrders] Error:', err);
      process.exit(1);
    });
}
