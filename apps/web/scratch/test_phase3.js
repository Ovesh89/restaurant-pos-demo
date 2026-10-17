import { storageAdapter } from '../src/services/storage/localStorageAdapter.js';
import { billingCalculator, DISCOUNT_TYPES, PAYMENT_MODES } from '../src/services/calculations/billingCalculator.js';
import { customerRepository } from '../src/services/repositories/customerRepository.js';
import { orderRepository } from '../src/services/repositories/orderRepository.js';
import { billRepository, BILL_STATUS } from '../src/services/repositories/billRepository.js';
import { reportRepository } from '../src/services/repositories/reportRepository.js';
import { tableRepository } from '../src/services/repositories/tableRepository.js';
import { productRepository } from '../src/services/repositories/productRepository.js';
import { auditRepository } from '../src/services/repositories/auditRepository.js';
import { printService } from '../src/services/printing/printService.js';
import { ORDER_STATUS } from '../src/constants/orderStatus.js';
import { TABLE_STATUS } from '../src/constants/tableStatus.js';

// Polyfill localStorage in Node for test runner
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

async function runPhase3Tests() {
  console.log('\n=== RUNNING PHASE 3 BILLING, PAYMENTS, CRM & REPORTS TEST SUITE ===\n');

  storageAdapter.initialize();

  // Test Suite 1: Billing Calculator Pure Math Engine
  console.log('[Test Suite 1: Deterministic Billing Calculator Engine]');
  const sampleItems = [
    { productId: 'p1', name: 'Paneer Butter Masala', quantity: 2, unitPrice: 320 }, // 640
    { productId: 'p2', name: 'Garlic Naan', quantity: 3, unitPrice: 60 }            // 180
  ];
  // Subtotal = 640 + 180 = 820

  // 1A: No discount, 5% GST
  const calc1 = billingCalculator.calculate({
    items: sampleItems,
    discount: { type: DISCOUNT_TYPES.FIXED, value: 0, reason: '' },
    taxRate: 5.0,
    payments: []
  });
  assert(calc1.subtotal === 820, `Subtotal calculated correctly: ₹${calc1.subtotal} (expected 820)`);
  assert(calc1.discountAmount === 0, 'Zero discount applied');
  assert(calc1.taxableAmount === 820, 'Taxable amount equals subtotal when no discount');
  // CGST: 2.5% of 820 = 20.50, SGST: 2.5% of 820 = 20.50, Total Tax = 41.00
  assert(calc1.cgstAmount === 20.5, `CGST is 2.5% (₹${calc1.cgstAmount})`);
  assert(calc1.sgstAmount === 20.5, `SGST is 2.5% (₹${calc1.sgstAmount})`);
  assert(calc1.taxAmount === 41, `Total Tax is ₹${calc1.taxAmount}`);
  // Raw = 820 + 41 = 861. Rounding = 0, Grand total = 861
  assert(calc1.grandTotal === 861, `Grand Total is ₹${calc1.grandTotal}`);
  assert(calc1.paidAmount === 0, 'Paid amount is 0');
  assert(calc1.balance === 861, `Balance is ₹${calc1.balance}`);
  assert(calc1.isSettled === false, 'Bill is not yet settled');

  // 1B: Percentage Discount (10% on 820 = 82)
  const calc2 = billingCalculator.calculate({
    items: sampleItems,
    discount: { type: DISCOUNT_TYPES.PERCENTAGE, value: 10, reason: 'Loyalty guest discount' },
    taxRate: 5.0,
    payments: []
  });
  assert(calc2.discountAmount === 82, `10% Discount is ₹${calc2.discountAmount} (expected 82)`);
  assert(calc2.taxableAmount === 738, `Taxable amount is ₹${calc2.taxableAmount} (expected 738)`);
  // 5% tax on 738 = 36.90
  assert(calc2.taxAmount === 36.9, `Tax on discounted total is ₹${calc2.taxAmount}`);
  // Raw = 738 + 36.90 = 774.90 -> rounded to 775, rounding delta = +0.10
  assert(calc2.grandTotal === 775, `Grand Total rounded to whole rupee: ₹${calc2.grandTotal}`);
  assert(calc2.rounding === 0.1, `Rounding delta captured: ${calc2.rounding}`);

  // Test Suite 2: Customer CRM Management
  console.log('\n[Test Suite 2: Customer CRM Directory & Spend Tracking]');
  const newGuest = await customerRepository.createCustomer({
    name: 'Vikram Malhotra',
    mobile: '9876543210',
    email: 'vikram@example.com',
    notes: 'VIP regular table guest'
  }, { id: 'admin', name: 'Admin' });

  assert(newGuest.id.startsWith('cust-'), `Customer created with ID: ${newGuest.id}`);
  assert(newGuest.name === 'Vikram Malhotra', 'Customer name stored correctly');
  assert(newGuest.visitCount === 0, 'Initial visit count is 0');
  assert(newGuest.totalSpend === 0, 'Initial spend is 0');

  // Search customer
  const foundByPhone = await customerRepository.getCustomers('9876543210');
  assert(foundByPhone.length === 1 && foundByPhone[0].id === newGuest.id, 'Search by exact mobile returns correct guest');

  const foundByName = await customerRepository.getCustomers('vikram');
  assert(foundByName.length === 1 && foundByName[0].id === newGuest.id, 'Case-insensitive name search works');

  // Test Suite 3: Bill Generation & Split Payments (Mixed Mode)
  console.log('\n[Test Suite 3: Bill Generation, Multi-Mode Payment & Table Settlement]');
  const tables = await tableRepository.getTables();
  const table07 = tables.find((t) => t.tableNo === '07');
  assert(table07 !== undefined, 'Table 07 found');

  const products = await productRepository.getProducts();
  const butterChicken = products.find((p) => p.name.includes('Butter Chicken')) || products[0];
  const naan = products.find((p) => p.name.includes('Naan')) || products[1];

  // Create an active order
  const order = await orderRepository.createOrder({
    tableId: table07.id,
    tableNo: table07.tableNo,
    captainId: 'captain-01',
    captainName: 'Rajesh Captain',
    pax: 2,
    notes: 'Dinner dining',
    items: [
      {
        productId: butterChicken.id,
        name: butterChicken.name,
        code: butterChicken.code,
        quantity: 1,
        unitPrice: butterChicken.price,
        taxRate: 5
      },
      {
        productId: naan.id,
        name: naan.name,
        code: naan.code,
        quantity: 2,
        unitPrice: naan.price,
        taxRate: 5
      }
    ]
  }, { id: 'captain-01', name: 'Rajesh Captain' });

  assert(order.id !== undefined, `Created order ${order.orderNo} for Table 07`);

  // Confirm order and mark as served
  await orderRepository.confirmOrder(order.id, { id: 'reception', name: 'Reception User' });
  await orderRepository.markAsServed(order.id, { id: 'waiter', name: 'Server' });

  // Generate Bill for this order
  const generatedBill = await billRepository.generateBill({
    order,
    discount: { type: DISCOUNT_TYPES.FIXED, value: 50, reason: 'Welcome discount coupon' },
    customer: newGuest,
    actor: { id: 'cashier', name: 'Pooja Cashier' }
  });

  assert(generatedBill.billNo.startsWith('INV-'), `Invoice generated with sequence: ${generatedBill.billNo}`);
  assert(generatedBill.status === BILL_STATUS.PENDING, 'Bill status initialized as PENDING');
  assert(generatedBill.discountAmount === 50, '₹50 fixed discount applied correctly');
  assert(generatedBill.customerId === newGuest.id, 'Linked to customer Vikram Malhotra');

  // Verify table is in BILL_PENDING operational state
  const updatedTable = await tableRepository.getTableById(table07.id);
  assert(updatedTable.status === TABLE_STATUS.BILL_PENDING, 'Table status transitioned to BILL_PENDING');

  // Perform Mixed Payment: Split Payment Part 1 (UPI partial)
  console.log('  --> Recording Split Payment Part 1: UPI ₹200');
  const split1 = await billRepository.addPayment(
    generatedBill.id,
    { mode: PAYMENT_MODES.UPI, amount: 200, reference: 'UPI/HDFC/99882233' },
    { id: 'cashier', name: 'Pooja Cashier' }
  );

  assert(split1.isSettled === false, 'Bill is not yet settled after partial payment');
  assert(split1.bill.paidAmount === 200, 'Paid amount updated to ₹200');
  assert(split1.bill.payments.length === 1, '1 payment logged in bill');
  assert(split1.bill.status === BILL_STATUS.PENDING, 'Bill remains PENDING');

  // Verify Table is STILL occupied/bill pending
  const tableCheck = await tableRepository.getTableById(table07.id);
  assert(tableCheck.status === TABLE_STATUS.BILL_PENDING, 'Table remains BILL_PENDING while balance exists');

  // Perform Mixed Payment: Split Payment Part 2 (Cash for remaining balance)
  const remainingBal = split1.bill.balance;
  console.log(`  --> Recording Split Payment Part 2: Cash ₹${remainingBal}`);
  const split2 = await billRepository.addPayment(
    generatedBill.id,
    { mode: PAYMENT_MODES.CASH, amount: remainingBal, reference: 'Counter Cash' },
    { id: 'cashier', name: 'Pooja Cashier' }
  );

  assert(split2.isSettled === true, 'Bill is now SETTLED (isSettled === true)');
  assert(split2.bill.status === BILL_STATUS.PAID, 'Bill status marked PAID');
  assert(split2.bill.balance === 0, 'Bill balance reached ₹0');
  assert(split2.bill.payments.length === 2, '2 separate split payments recorded');

  // Verify Order Lifecycle: Order MUST be COMPLETED!
  const finalOrder = await orderRepository.getOrderById(order.id);
  assert(finalOrder.status === ORDER_STATUS.COMPLETED, `Associated order ${order.orderNo} transitioned to COMPLETED`);

  // Verify Table Lifecycle: Table MUST be AVAILABLE!
  const finalTable = await tableRepository.getTableById(table07.id);
  assert(finalTable.status === TABLE_STATUS.AVAILABLE, `Table ${table07.tableNo} released back to AVAILABLE`);
  assert(finalTable.currentOrderId === null, 'Table currentOrderId cleared to null');

  // Verify Customer spend and visit tracking updated!
  const updatedGuest = await customerRepository.getCustomerById(newGuest.id);
  assert(updatedGuest.visitCount === 1, `Customer visit count incremented to ${updatedGuest.visitCount}`);
  assert(updatedGuest.totalSpend === split2.bill.grandTotal, `Customer total spend updated to ₹${updatedGuest.totalSpend}`);

  // Test Suite 4: Bill Cancellation with Mandatory Reason
  console.log('\n[Test Suite 4: Bill Cancellation Rule & Audit Trail]');
  // Create another dummy bill to test cancellation
  const dummyBill = await billRepository.generateBill({
    order: {
      id: 'test-ord-dummy',
      orderNo: 'ORD-999',
      tableId: 't-dummy',
      tableNo: '99',
      items: [{ productId: 'p1', name: 'Test Dish', quantity: 1, unitPrice: 100, taxRate: 5 }]
    },
    actor: { id: 'admin', name: 'Admin' }
  });

  let threwWithoutReason = false;
  try {
    await billRepository.cancelBill(dummyBill.id, '');
  } catch (err) {
    threwWithoutReason = true;
  }
  assert(threwWithoutReason, 'Bill cancellation without reason throws validation error');

  const cancelledBill = await billRepository.cancelBill(dummyBill.id, 'Wrong order punched by cashier', { id: 'admin', name: 'Admin' });
  assert(cancelledBill.status === BILL_STATUS.CANCELLED, 'Bill status transitioned to CANCELLED');
  assert(cancelledBill.cancellationReason === 'Wrong order punched by cashier', 'Cancellation reason saved');

  // Test Suite 5: Operational Sales Reports Aggregation
  console.log('\n[Test Suite 5: Operational Sales & Performance Reports]');
  const report = await reportRepository.getSalesReport();
  assert(report.totalOrdersCount >= 1, `Total paid invoices count: ${report.totalOrdersCount}`);
  assert(report.totalNetSales > 0, `Total net sales calculated: ₹${report.totalNetSales}`);
  assert(report.paymentBreakdown.UPI === 200, `Payment breakdown UPI matches ₹200 (actual ₹${report.paymentBreakdown.UPI})`);
  assert(report.paymentBreakdown.CASH === remainingBal, `Payment breakdown CASH matches ₹${remainingBal}`);
  assert(report.itemSales.length > 0, `Item sales ranking contains ${report.itemSales.length} items`);
  assert(report.captainSales.length > 0, `Captain sales performance contains ${report.captainSales.length} captains`);

  // Test Suite 6: Thermal Invoice Print Formatting
  console.log('\n[Test Suite 6: Thermal Invoice Print Formatter]');
  let printOutputCaptured = false;
  const mockWindow = {
    document: {
      write: (html) => {
        if (
          html.includes(split2.bill.billNo) &&
          html.includes('TAX INVOICE') &&
          html.includes('CGST') &&
          html.includes('SGST') &&
          html.includes('Payment Breakdown') &&
          html.includes('UPI') &&
          html.includes('CASH')
        ) {
          printOutputCaptured = true;
        }
      },
      close: () => {}
    },
    focus: () => {},
    print: () => {},
    close: () => {}
  };

  printService.printInvoice(split2.bill, finalOrder, updatedGuest, mockWindow);
  assert(printOutputCaptured, 'Thermal invoice HTML format renders tax invoice with split payment modes & itemized totals');

  console.log(`\n=======================================================`);
  console.log(`Phase 3 Test Results: ${passed} PASSED, ${failed} FAILED`);
  console.log(`=======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase3Tests().catch((err) => {
  console.error('Fatal error during Phase 3 verification:', err);
  process.exit(1);
});
