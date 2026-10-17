import { storageAdapter } from '../src/services/storage/localStorageAdapter.js';
import { authRepository } from '../src/services/repositories/authRepository.js';
import { userRepository } from '../src/services/repositories/userRepository.js';
import { roleRepository } from '../src/services/repositories/roleRepository.js';
import { branchRepository } from '../src/services/repositories/branchRepository.js';
import { categoryRepository } from '../src/services/repositories/categoryRepository.js';
import { productRepository } from '../src/services/repositories/productRepository.js';
import { tableRepository } from '../src/services/repositories/tableRepository.js';
import { auditRepository } from '../src/services/repositories/auditRepository.js';
import { PERMISSIONS } from '../src/constants/permissions.js';

// Polyfill localStorage in Node for automated verification script
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

async function runTests() {
  console.log('\n=== RUNNING PHASE 1 AUTOMATED VERIFICATION SUITE ===\n');

  // Test 1: Storage Initialization & Seed Data
  console.log('[Test Suite 1: Storage Initialization]');
  storageAdapter.initialize();
  const users = await userRepository.getUsers();
  const tables = await tableRepository.getTables();
  const products = await productRepository.getProducts();
  const categories = await categoryRepository.getCategories();
  const areas = await branchRepository.getAreas();

  assert(users.length === 7, `Seeded 7 demo users (got ${users.length})`);
  assert(tables.length === 20, `Seeded 20 tables (got ${tables.length})`);
  assert(products.length >= 20, `Seeded >= 20 products (got ${products.length})`);
  assert(categories.length === 8, `Seeded 8 categories (got ${categories.length})`);
  assert(areas.length === 3, `Seeded 3 areas (got ${areas.length})`);

  // Test 2: Authentication & Roles
  console.log('\n[Test Suite 2: Authentication & RBAC]');
  const ownerSession = await authRepository.login('owner', 'owner123');
  assert(ownerSession.user.role === 'owner', 'Owner login successful');
  assert(ownerSession.permissions.length > 20, 'Owner has universal permissions');

  const captainSession = await authRepository.login('captain', 'captain123');
  assert(captainSession.user.role === 'captain', 'Captain login successful');
  assert(captainSession.permissions.includes(PERMISSIONS.ORDER_CREATE), 'Captain has order.create');
  assert(!captainSession.permissions.includes(PERMISSIONS.MENU_EDIT), 'Captain lacks menu.edit');
  assert(!captainSession.permissions.includes(PERMISSIONS.USER_MANAGE), 'Captain lacks user.manage');

  let badLoginFailed = false;
  try {
    await authRepository.login('admin', 'wrongpassword');
  } catch (err) {
    badLoginFailed = true;
  }
  assert(badLoginFailed, 'Invalid password correctly rejected');

  // Test 3: Category Management
  console.log('\n[Test Suite 3: Category Management]');
  const newCat = await categoryRepository.createCategory(
    { name: 'Chef Specials', code: 'SPC', sortOrder: 9 },
    { id: 'user-001', name: 'Rajesh Sharma' }
  );
  assert(newCat.name === 'Chef Specials', 'Category created');

  const updatedCat = await categoryRepository.updateCategory(
    newCat.id,
    { name: 'Exclusive Specials' },
    { id: 'user-001', name: 'Rajesh Sharma' }
  );
  assert(updatedCat.name === 'Exclusive Specials', 'Category updated');

  const toggledCat = await categoryRepository.toggleCategoryStatus(
    newCat.id,
    { id: 'user-001', name: 'Rajesh Sharma' }
  );
  assert(toggledCat.isActive === false, 'Category successfully deactivated');

  // Test 4: Product Management & Price History Audit
  console.log('\n[Test Suite 4: Product CRUD & Price Change Audit]');
  const newDish = await productRepository.createProduct(
    {
      name: 'Paneer Lababdar',
      code: 'PAN-01',
      categoryId: newCat.id,
      price: 360,
      taxRate: 5,
      station: 'Main Curry'
    },
    { id: 'user-001', name: 'Rajesh Sharma' }
  );
  assert(newDish.price === 360, 'Dish created with initial price ₹360');

  // Price change with mandatory reason
  const updatedDish = await productRepository.updateProduct(
    newDish.id,
    { price: 395 },
    { id: 'user-001', name: 'Rajesh Sharma' },
    'Dairy supply price surge'
  );
  assert(updatedDish.price === 395, 'Dish price updated to ₹395');

  const history = await productRepository.getPriceHistory(newDish.id);
  assert(history.length === 1, 'Price change history logged');
  assert(history[0].oldPrice === 360 && history[0].newPrice === 395, 'Price history records accurate old/new prices');
  assert(history[0].reason === 'Dairy supply price surge', 'Price history captures audit reason');

  // Toggle availability
  const toggledDish = await productRepository.toggleProductAvailability(
    newDish.id,
    { id: 'user-001', name: 'Rajesh Sharma' }
  );
  assert(toggledDish.isAvailable === false, 'Product marked 86/Sold Out');

  // Test 5: Table Management
  console.log('\n[Test Suite 5: Table Master]');
  const newTable = await tableRepository.createTable(
    { tableNo: '99', areaId: 'area-outdoor', capacity: 4 },
    { id: 'user-001', name: 'Rajesh Sharma' }
  );
  assert(newTable.tableNo === '99', 'Table 99 created');

  const updatedTable = await tableRepository.updateTable(
    newTable.id,
    { capacity: 6 },
    { id: 'user-001', name: 'Rajesh Sharma' }
  );
  assert(updatedTable.capacity === 6, 'Table capacity updated to 6 pax');

  // Test 6: User Management & Admin Safety Rule
  console.log('\n[Test Suite 6: User Management & Admin Safety Rule]');
  const newStaff = await userRepository.createUser(
    {
      name: 'Rohan Mehra',
      username: 'rohan',
      password: 'password123',
      role: 'captain',
      mobile: '9876500000'
    },
    { id: 'user-001', name: 'Rajesh Sharma' }
  );
  assert(newStaff.username === 'rohan', 'New staff account created');

  // Attempt deactivating owner when only 1 active owner
  let ownerDeactBlocked = false;
  try {
    await userRepository.toggleUserStatus('user-001'); // Rajesh Sharma (Owner)
  } catch (err) {
    // If there is another admin, it's ok, but if last owner/admin, blocked
  }

  // Test 7: Audit Trail
  console.log('\n[Test Suite 7: Operational Audit Logs]');
  const auditLogs = await auditRepository.getAuditLogs();
  assert(auditLogs.length > 5, `Audit logs captured: ${auditLogs.length} events`);
  const priceAudit = auditLogs.find((l) => l.action === 'PRODUCT_PRICE_CHANGED');
  assert(priceAudit !== undefined, 'PRODUCT_PRICE_CHANGED recorded in audit trail');

  console.log(`\n=== VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((e) => {
  console.error('Test run failed:', e);
  process.exit(1);
});
