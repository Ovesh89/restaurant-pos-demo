import { storageAdapter } from '../src/services/storage/localStorageAdapter.js';
import { authRepository } from '../src/services/repositories/authRepository.js';
import { userRepository } from '../src/services/repositories/userRepository.js';
import { productRepository } from '../src/services/repositories/productRepository.js';
import { tableRepository } from '../src/services/repositories/tableRepository.js';
import { orderRepository } from '../src/services/repositories/orderRepository.js';
import { kotRepository } from '../src/services/repositories/kotRepository.js';
import { auditRepository } from '../src/services/repositories/auditRepository.js';
import { printService } from '../src/services/printing/printService.js';
import { ORDER_STATUS, KOT_STATUS, KOT_TYPE } from '../src/constants/orderStatus.js';
import { TABLE_STATUS } from '../src/constants/tableStatus.js';

// Polyfill localStorage in Node for testing
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

async function runPhase2Tests() {
  console.log('\n=== RUNNING PHASE 2 FULL OPERATIONS VERIFICATION SUITE ===\n');

  storageAdapter.initialize();

  // Test 1: Captain Order Creation & Price Snapshot Rule
  console.log('[Test Suite 1: Captain Takes Order & Price Snapshot Rule]');
  const tables = await tableRepository.getTables();
  const table05 = tables.find((t) => t.tableNo === '05');
  assert(table05 !== undefined, 'Table 05 found');

  const products = await productRepository.getProducts();
  const chickenTikka = products.find((p) => p.name.includes('Chicken Tikka Masala') || p.name.includes('Butter Chicken'));
  const butterNaan = products.find((p) => p.name.includes('Butter Naan'));

  const captain = { id: 'user-006', name: 'Deepak Kumar (Captain)' };

  const initialItems = [
    {
      productId: chickenTikka.id,
      name: chickenTikka.name,
      code: chickenTikka.code,
      price: chickenTikka.price,
      quantity: 2,
      station: chickenTikka.station,
      notes: 'Extra spicy'
    },
    {
      productId: butterNaan.id,
      name: butterNaan.name,
      code: butterNaan.code,
      price: butterNaan.price,
      quantity: 3,
      station: butterNaan.station,
      notes: 'Crispy'
    }
  ];

  const order = await orderRepository.createOrder({
    table: table05,
    captain,
    items: initialItems,
    notes: 'VIP guest table'
  });

  assert(order.orderNo === 'ORD-001', 'Order ORD-001 created');
  assert(order.status === ORDER_STATUS.WAITING_CONFIRMATION, 'Status is WAITING_CONFIRMATION');
  assert(order.items[0].unitPrice === chickenTikka.price, 'Item captures unit price at order creation time');

  // Verify Table moved to OCCUPIED
  const updatedTable05 = await tableRepository.getTableById(table05.id);
  assert(updatedTable05.status === TABLE_STATUS.OCCUPIED, 'Table 05 moved to OCCUPIED');

  // Test Price Snapshot Rule: Modify menu price now
  console.log('\n[Test Suite 2: Price Snapshot Invariance]');
  await productRepository.updateProduct(
    chickenTikka.id,
    { price: chickenTikka.price + 100 },
    { id: 'admin', name: 'Admin' },
    'Price increase'
  );
  const reloadedOrder = await orderRepository.getOrderById(order.id);
  assert(
    reloadedOrder.items[0].unitPrice === chickenTikka.price,
    'Existing order price snapshot remained completely unchanged despite menu price hike'
  );

  // Test 3: Reception Confirmation & Automatic KOT Dispatch
  console.log('\n[Test Suite 3: Reception Review & Automatic KOT Generation]');
  const reception = { id: 'user-004', name: 'Pooja Nair (Reception)' };
  const confirmResult = await orderRepository.confirmOrder(order.id, reception);

  assert(confirmResult.order.status === ORDER_STATUS.KOT_SENT, 'Order moved to KOT_SENT');
  assert(confirmResult.kotTicket !== null, 'KOT Ticket automatically generated');
  assert(confirmResult.kotTicket.kotNo === 'KOT-001', 'KOT sequential number is KOT-001');
  assert(confirmResult.kotTicket.items.length === 2, 'KOT contains 2 line items');
  assert(confirmResult.kotTicket.items[0].notes === 'Extra spicy', 'KOT preserves line item preparation note');

  const tableAfterConfirm = await tableRepository.getTableById(table05.id);
  assert(tableAfterConfirm.status === TABLE_STATUS.KOT_SENT, 'Table 05 status updated to KOT_SENT');

  // Test 4: Kitchen KDS Workflow
  console.log('\n[Test Suite 4: Kitchen KDS Status Transitions]');
  const chef = { id: 'user-007', name: 'Chef Sanjeev' };
  const kotTicket = confirmResult.kotTicket;

  // Move to PREPARING
  await kotRepository.updateKOTStatus(kotTicket.id, KOT_STATUS.PREPARING, chef);
  await orderRepository.updateStatusFromKitchen(order.id, KOT_STATUS.PREPARING, chef);

  const orderPreparing = await orderRepository.getOrderById(order.id);
  const tablePreparing = await tableRepository.getTableById(table05.id);
  assert(orderPreparing.status === ORDER_STATUS.PREPARING, 'Order status moved to PREPARING');
  assert(tablePreparing.status === TABLE_STATUS.PREPARING, 'Table status moved to PREPARING');

  // Move to READY
  await kotRepository.updateKOTStatus(kotTicket.id, KOT_STATUS.READY, chef);
  await orderRepository.updateStatusFromKitchen(order.id, KOT_STATUS.READY, chef);

  const orderReady = await orderRepository.getOrderById(order.id);
  const tableReady = await tableRepository.getTableById(table05.id);
  assert(orderReady.status === ORDER_STATUS.READY, 'Order status moved to READY');
  assert(tableReady.status === TABLE_STATUS.READY, 'Table status moved to READY');

  // Test 5: Order Served
  console.log('\n[Test Suite 5: Service Flow]');
  await orderRepository.markAsServed(order.id, captain);
  const orderServed = await orderRepository.getOrderById(order.id);
  assert(orderServed.status === ORDER_STATUS.SERVED, 'Order marked as SERVED');

  // Test 6: Order Modification & Delta KOT Generation
  console.log('\n[Test Suite 6: Order Modification & Delta KOT]');
  const modifiedItems = [
    {
      ...orderServed.items[0], // Chicken Tikka
      quantity: 1 // reduced by 1
    },
    {
      ...orderServed.items[1], // Butter Naan
      quantity: 5 // increased by 2
    }
  ];

  const modResult = await orderRepository.modifyOrderItems(
    order.id,
    modifiedItems,
    'Guest requested 2 more naans and cancelled 1 tikka',
    captain
  );

  assert(modResult.order.kotRevision === 2, 'Order revision bumped to #2');
  assert(modResult.deltaKOT !== null, 'Delta KOT generated');
  assert(modResult.deltaKOT.type === KOT_TYPE.MODIFICATION, 'Delta KOT type is MODIFICATION');
  assert(modResult.deltaKOT.revision === 2, 'Delta KOT revision is #2');
  assert(modResult.deltaKOT.items.length === 2, 'Delta ticket contains both change events');

  // Test 7: Thermal Print Text Generation
  console.log('\n[Test Suite 7: Thermal KOT Formatting]');
  const printText = printService.generateKOTReceiptText(modResult.deltaKOT, modResult.order, table05);
  assert(printText.includes('*** KITCHEN ORDER TICKET ***'), 'Header present');
  assert(printText.includes('TABLE : Table 05'), 'Table present');
  assert(printText.includes('MODIFICATION REVISION #2'), 'Revision label present');

  // Test 8: Reception Rejection Flow
  console.log('\n[Test Suite 8: Reception Order Rejection Flow]');
  const table10 = tables.find((t) => t.tableNo === '10');
  const rejectTestOrder = await orderRepository.createOrder({
    table: table10,
    captain,
    items: [initialItems[0]]
  });
  assert(rejectTestOrder.status === ORDER_STATUS.WAITING_CONFIRMATION, 'New order waiting confirmation');

  await orderRepository.rejectOrder(rejectTestOrder.id, 'Kitchen Tandoor station closed for cleaning', reception);
  const rejectedOrder = await orderRepository.getOrderById(rejectTestOrder.id);
  assert(rejectedOrder.status === ORDER_STATUS.REJECTED, 'Order marked REJECTED');
  assert(rejectedOrder.rejectionReason === 'Kitchen Tandoor station closed for cleaning', 'Rejection reason recorded');

  const table10Released = await tableRepository.getTableById(table10.id);
  assert(table10Released.status === TABLE_STATUS.AVAILABLE, 'Table 10 released back to AVAILABLE');

  // Test 9: Order Cancellation Flow
  console.log('\n[Test Suite 9: Order Cancellation Flow]');
  const table12 = tables.find((t) => t.tableNo === '12');
  const cancelTestOrder = await orderRepository.createOrder({
    table: table12,
    captain,
    items: [initialItems[0]]
  });
  await orderRepository.confirmOrder(cancelTestOrder.id, reception);
  await orderRepository.cancelOrder(cancelTestOrder.id, 'Guest had emergency and left', reception);

  const cancelledOrder = await orderRepository.getOrderById(cancelTestOrder.id);
  assert(cancelledOrder.status === ORDER_STATUS.CANCELLED, 'Order status is CANCELLED');
  const table12Released = await tableRepository.getTableById(table12.id);
  assert(table12Released.status === TABLE_STATUS.AVAILABLE, 'Table 12 released back to AVAILABLE');

  console.log(`\n=== PHASE 2 TEST RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) process.exit(1);
}

runPhase2Tests().catch((e) => {
  console.error('Phase 2 test failed:', e);
  process.exit(1);
});
