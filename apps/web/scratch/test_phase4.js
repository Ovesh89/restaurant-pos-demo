import { storageAdapter } from '../src/services/storage/localStorageAdapter.js';
import { shiftRepository, SHIFT_STATUS, CASH_MOVEMENT_TYPE } from '../src/services/repositories/shiftRepository.js';
import { settingsRepository, DEFAULT_SETTINGS } from '../src/services/repositories/settingsRepository.js';
import { tableRepository } from '../src/services/repositories/tableRepository.js';
import { productRepository } from '../src/services/repositories/productRepository.js';
import { orderRepository } from '../src/services/repositories/orderRepository.js';
import { kotRepository } from '../src/services/repositories/kotRepository.js';
import { billRepository, BILL_STATUS } from '../src/services/repositories/billRepository.js';
import { auditRepository } from '../src/services/repositories/auditRepository.js';
import { DISCOUNT_TYPES, PAYMENT_MODES } from '../src/services/calculations/billingCalculator.js';
import { ORDER_STATUS, KOT_STATUS } from '../src/constants/orderStatus.js';
import { TABLE_STATUS } from '../src/constants/tableStatus.js';

// Polyfill in-memory localStorage for node test runner
const memoryStorage = {};
global.localStorage = {
  getItem: (key) => memoryStorage[key] || null,
  setItem: (key, val) => { memoryStorage[key] = String(val); },
  removeItem: (key) => { delete memoryStorage[key]; },
  clear: () => {
    for (const k in memoryStorage) delete memoryStorage[k];
  }
};

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function runPhase4Tests() {
  console.log('\n=== RUNNING PHASE 4 ADVANCED OPS, SHIFTS, SETTINGS & HARDENING SUITE ===\n');

  storageAdapter.initialize();

  // Test Suite 1: System Settings & Dynamic Configuration Engine
  console.log('[Test Suite 1: System Settings & Configuration]');
  const initialSettings = await settingsRepository.getSettings();
  assert(initialSettings.defaultTaxRate === 5.0, 'Default GST tax rate is 5.0%');
  assert(initialSettings.invoicePrefix === 'INV-', 'Default invoice prefix is INV-');
  assert(initialSettings.thermalWidth === '80mm', 'Default thermal printer roll width is 80mm');

  // Update Settings
  const updatedSettings = await settingsRepository.updateSettings({
    restaurantName: 'GTS Royal Dining & Lounge',
    defaultTaxRate: 12.0,
    invoicePrefix: 'GTS-INV-'
  }, { id: 'owner', name: 'Owner' });

  assert(updatedSettings.restaurantName === 'GTS Royal Dining & Lounge', 'Updated restaurant name persists');
  assert(updatedSettings.defaultTaxRate === 12.0, 'Updated tax rate 12.0% persists');
  assert(updatedSettings.invoicePrefix === 'GTS-INV-', 'Updated invoice prefix persists');

  // Factory Reset
  const restoredSettings = await settingsRepository.resetToDefaults({ id: 'owner', name: 'Owner' });
  assert(restoredSettings.restaurantName === DEFAULT_SETTINGS.restaurantName, 'Factory default settings restored');
  assert(restoredSettings.defaultTaxRate === 5.0, 'Tax rate restored to 5.0%');

  // Test Suite 2: Advanced Table Floor Operations (Transfer & Merge)
  console.log('\n[Test Suite 2: Advanced Table Transfer & Merge]');
  const tables = await tableRepository.getTables();
  const table03 = tables.find((t) => t.tableNo === '03');
  const table08 = tables.find((t) => t.tableNo === '08');
  assert(table03 !== undefined && table08 !== undefined, 'Table 03 and Table 08 exist');

  const products = await productRepository.getProducts();
  const starter = products[0];

  // Create an active order on Table 03
  const orderOn03 = await orderRepository.createOrder({
    table: table03,
    captain: { id: 'captain-01', name: 'Captain' },
    items: [{ productId: starter.id, name: starter.name, quantity: 2, price: starter.price, taxRate: 5 }],
    notes: 'Indoor corner table'
  });

  await orderRepository.confirmOrder(orderOn03.id, { id: 'reception', name: 'Reception' });
  const t03Before = await tableRepository.getTableById(table03.id);
  assert(t03Before.status === TABLE_STATUS.KOT_SENT, 'Table 03 is occupied with status KOT_SENT');

  // Execute Table Transfer: Table 03 -> Table 08
  console.log('  --> Executing Table Transfer: Table 03 -> Table 08');
  const transferResult = await tableRepository.transferTable({
    fromTableId: table03.id,
    toTableId: table08.id,
    reason: 'Guest requested larger table for friends joining',
    actor: { id: 'captain-01', name: 'Captain' }
  });

  assert(transferResult.order.tableId === table08.id, 'Order re-assigned to Table 08');
  assert(transferResult.order.tableNo === table08.tableNo, 'Order tableNo updated to Table 08');

  const t03After = await tableRepository.getTableById(table03.id);
  const t08After = await tableRepository.getTableById(table08.id);
  assert(t03After.status === TABLE_STATUS.AVAILABLE, 'Source Table 03 released back to AVAILABLE');
  assert(t03After.activeOrderId === null, 'Source Table 03 activeOrderId cleared');
  assert(t08After.status === TABLE_STATUS.KOT_SENT, 'Destination Table 08 received KOT_SENT status');
  assert(t08After.activeOrderId === orderOn03.id, 'Destination Table 08 linked to active order');

  // Verify KOTs associated with order also reflect Table 08
  const kotsOnOrder = await kotRepository.getKOTs({ orderId: orderOn03.id });
  assert(kotsOnOrder.every((k) => k.tableNo === table08.tableNo), 'All KOT tickets updated to reflect Table 08');

  // Test Suite 3: Shift Management & Cash Drawer Day Close
  console.log('\n[Test Suite 3: Shift Management & Cash Reconciliation]');
  const shift = await shiftRepository.openShift({
    openingFloat: 2500,
    branchId: 'branch-001',
    cashier: { id: 'cashier-01', name: 'Simran Cashier' }
  });

  assert(shift.shiftNo.startsWith('SH-'), `Shift opened with identifier ${shift.shiftNo}`);
  assert(shift.openingFloat === 2500, 'Opening cash float recorded as ₹2,500');
  assert(shift.status === SHIFT_STATUS.OPEN, 'Shift status is OPEN');

  // Verify duplicate open shift throws error
  let duplicateThrew = false;
  try {
    await shiftRepository.openShift({ openingFloat: 1000, cashier: { id: 'cashier-02', name: 'Cashier 2' } });
  } catch (err) {
    duplicateThrew = true;
  }
  assert(duplicateThrew, 'Attempt to open second active shift while one is open throws error');

  // Mid-shift cash in & cash out
  console.log('  --> Recording Mid-Shift Cash Movements');
  await shiftRepository.recordCashMovement({
    shiftId: shift.id,
    type: CASH_MOVEMENT_TYPE.IN,
    amount: 500,
    reason: 'Emergency change notes added to drawer',
    actor: { id: 'cashier-01', name: 'Simran Cashier' }
  });

  await shiftRepository.recordCashMovement({
    shiftId: shift.id,
    type: CASH_MOVEMENT_TYPE.OUT,
    amount: 200,
    reason: 'Paid ₹200 for local dairy milk delivery',
    actor: { id: 'cashier-01', name: 'Simran Cashier' }
  });

  // Settle bill on Table 08 to generate shift sales
  const billOn08 = await billRepository.generateBill({
    order: transferResult.order,
    actor: { id: 'cashier-01', name: 'Simran Cashier' }
  });

  // Split payment: Part Cash, Part UPI
  const halfCash = Math.floor(billOn08.grandTotal / 2);
  const remUPI = billOn08.grandTotal - halfCash;

  await billRepository.addPayment(billOn08.id, {
    mode: PAYMENT_MODES.CASH,
    amount: halfCash,
    reference: 'Cash Register'
  }, { id: 'cashier-01', name: 'Simran Cashier' });

  await billRepository.addPayment(billOn08.id, {
    mode: PAYMENT_MODES.UPI,
    amount: remUPI,
    reference: 'GPay/HDFC/112233'
  }, { id: 'cashier-01', name: 'Simran Cashier' });

  // Get live summary
  const summary = await shiftRepository.getShiftLiveSummary(shift.id);
  const expectedMath = 2500 + 500 - 200 + halfCash; // float + cashIn - cashOut + cashSales
  assert(summary.expectedCash === expectedMath, `Expected cash in drawer is ₹${summary.expectedCash} (exact match)`);
  assert(summary.cashSales === halfCash, `Cash sales matched ₹${halfCash}`);
  assert(summary.upiSales === remUPI, `UPI sales matched ₹${remUPI}`);

  // Close shift with exact cash
  const closedShift = await shiftRepository.closeShift({
    shiftId: shift.id,
    actualCash: summary.expectedCash,
    notes: 'Shift completed with 100% matched drawer balance.',
    actor: { id: 'cashier-01', name: 'Simran Cashier' }
  });

  assert(closedShift.status === SHIFT_STATUS.CLOSED, 'Shift status marked CLOSED');
  assert(closedShift.cashVariance === 0, 'Cash variance is ₹0 (Perfect match)');
  assert(closedShift.closedBy === 'Simran Cashier', 'Closed by Simran Cashier');

  // Test Suite 4: Complete E2E Golden Flow
  console.log('\n[Test Suite 4: Complete E2E Golden Restaurant Workflow]');
  // Captain -> Table 05 -> Chicken Tikka x2 -> Mutton Raan x1 -> Submit -> Confirm -> KOT -> Preparing -> Ready -> Move -> Bill -> Paid -> Table Available
  const table05 = tables.find((t) => t.tableNo === '05');
  const table14 = tables.find((t) => t.tableNo === '14');
  const butterChickenDish = products.find((p) => p.name.includes('Butter Chicken')) || products[0];
  const biryaniDish = products.find((p) => p.name.includes('Biryani')) || products[1];

  // 1. Captain takes order
  const goldenOrder = await orderRepository.createOrder({
    table: table05,
    captain: { id: 'captain-01', name: 'Aakash Captain' },
    items: [
      { productId: butterChickenDish.id, name: butterChickenDish.name, quantity: 2, price: butterChickenDish.price, taxRate: 5 },
      { productId: biryaniDish.id, name: biryaniDish.name, quantity: 1, price: biryaniDish.price, taxRate: 5 }
    ],
    notes: 'Less spicy please'
  });
  assert(goldenOrder.status === ORDER_STATUS.WAITING_CONFIRMATION, 'Order submitted to Reception');

  // 2. Reception confirms order -> KOT dispatched
  const confirmRes = await orderRepository.confirmOrder(goldenOrder.id, { id: 'reception', name: 'Reception User' });
  assert(confirmRes.order.status === ORDER_STATUS.KOT_SENT, 'Reception confirmed order, status KOT_SENT');
  assert(confirmRes.kotTicket.kotNo.startsWith('KOT-'), `KOT ${confirmRes.kotTicket.kotNo} generated for kitchen`);

  // 3. Kitchen prepares -> marks ready
  await kotRepository.updateKOTStatus(confirmRes.kotTicket.id, KOT_STATUS.PREPARING, { id: 'cook-01', name: 'Chef Chef' });
  await orderRepository.updateStatusFromKitchen(goldenOrder.id, KOT_STATUS.PREPARING, { id: 'cook-01', name: 'Chef Chef' });
  await kotRepository.updateKOTStatus(confirmRes.kotTicket.id, KOT_STATUS.READY, { id: 'cook-01', name: 'Chef Chef' });
  await orderRepository.updateStatusFromKitchen(goldenOrder.id, KOT_STATUS.READY, { id: 'cook-01', name: 'Chef Chef' });
  await orderRepository.markAsServed(goldenOrder.id, { id: 'captain-01', name: 'Aakash Captain' });

  const servedOrder = await orderRepository.getOrderById(goldenOrder.id);
  assert(servedOrder.status === ORDER_STATUS.SERVED, 'Order marked as SERVED to guests');

  // 4. Guest requests move to Table 14
  await tableRepository.transferTable({
    fromTableId: table05.id,
    toTableId: table14.id,
    reason: 'Guest moved to outdoor lawn table',
    actor: { id: 'reception', name: 'Reception' }
  });

  const t05Golden = await tableRepository.getTableById(table05.id);
  const t14Golden = await tableRepository.getTableById(table14.id);
  assert(t05Golden.status === TABLE_STATUS.AVAILABLE, 'Original Table 05 released to AVAILABLE');
  assert(t14Golden.status === TABLE_STATUS.READY, 'New Table 14 received transferred READY status');

  // 5. Billing generates invoice with 5% discount
  const transferredOrder = await orderRepository.getOrderById(goldenOrder.id);
  const goldenBill = await billRepository.generateBill({
    order: transferredOrder,
    discount: { type: DISCOUNT_TYPES.PERCENTAGE, value: 5, reason: 'Management courtesy' },
    actor: { id: 'cashier-01', name: 'Simran Cashier' }
  });
  assert(goldenBill.status === BILL_STATUS.PENDING, 'Invoice generated in PENDING state');

  // 6. Split Payment completes invoice
  await billRepository.addPayment(goldenBill.id, {
    mode: PAYMENT_MODES.UPI,
    amount: goldenBill.grandTotal,
    reference: 'UPI/PAYTM/99887766'
  }, { id: 'cashier-01', name: 'Simran Cashier' });

  // 7. Verify full table release and order completion
  const t14Final = await tableRepository.getTableById(table14.id);
  const ordFinal = await orderRepository.getOrderById(goldenOrder.id);
  assert(t14Final.status === TABLE_STATUS.AVAILABLE, 'Destination Table 14 automatically released to AVAILABLE');
  assert(ordFinal.status === ORDER_STATUS.COMPLETED, 'Golden order marked COMPLETED');

  // 8. Verify comprehensive audit trail
  const logs = await auditRepository.getAuditLogs();
  assert(logs.length >= 25, `Comprehensive audit trail recorded: ${logs.length} operational events`);

  console.log(`\n=======================================================`);
  console.log(`Phase 4 Test Results: ${passed} PASSED, ${failed} FAILED`);
  console.log(`=======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase4Tests().catch((err) => {
  console.error('Fatal error during Phase 4 verification:', err);
  process.exit(1);
});
