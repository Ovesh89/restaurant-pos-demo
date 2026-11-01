import { getDatabase, closeMongoConnection } from '../apps/backend/src/config/database.js';
import fs from 'node:fs';
import path from 'node:path';

async function resetOrders() {
  const db = await getDatabase();
  console.log(`Connected to database: ${db.databaseName}`);

  // 1. Snapshot / Backup current transactional records before resetting
  const backupDir = path.resolve('backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDir, `orders_reset_backup_${timestamp}.json`);

  const existingOrders = await db.collection('orders').find().toArray();
  const existingKots = await db.collection('kots').find().toArray();
  const existingBills = await db.collection('bills').find().toArray();
  const existingPayments = await db.collection('payments').find().toArray();

  const backupData = {
    timestamp,
    database: db.databaseName,
    counts: {
      orders: existingOrders.length,
      kots: existingKots.length,
      bills: existingBills.length,
      payments: existingPayments.length,
    },
    orders: existingOrders,
    kots: existingKots,
    bills: existingBills,
    payments: existingPayments,
  };

  fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), 'utf8');
  console.log(`Backup created successfully: ${backupFile} (${existingOrders.length} orders backed up)`);

  // 2. Clear transactional collections
  const delOrders = await db.collection('orders').deleteMany({});
  const delKots = await db.collection('kots').deleteMany({});
  const delBills = await db.collection('bills').deleteMany({});
  const delPayments = await db.collection('payments').deleteMany({});

  // 3. Reset all tables to AVAILABLE with activeOrderId = null
  const resetTables = await db.collection('tables').updateMany(
    {},
    {
      $set: {
        status: 'AVAILABLE',
        activeOrderId: null,
        updatedAt: new Date(),
      },
    }
  );

  console.log('Reset Summary:');
  console.log(`- Orders deleted: ${delOrders.deletedCount}`);
  console.log(`- KOTs deleted: ${delKots.deletedCount}`);
  console.log(`- Bills deleted: ${delBills.deletedCount}`);
  console.log(`- Payments deleted: ${delPayments.deletedCount}`);
  console.log(`- Tables reset to AVAILABLE: ${resetTables.modifiedCount}`);

  await closeMongoConnection();
}

resetOrders().catch(async (err) => {
  console.error('Failed to reset orders:', err);
  await closeMongoConnection().catch(() => {});
  process.exit(1);
});
