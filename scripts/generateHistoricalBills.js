import crypto from 'node:crypto';
import { getDatabase, closeMongoConnection } from '../apps/backend/src/config/database.js';
import { BillingCalculator } from '../apps/backend/src/modules/billing/calculator.js';
import { toDecimal, formatMoney } from '../apps/backend/src/utils/decimal.js';

function padZero(num, size = 3) {
  return String(num).padStart(size, '0');
}

async function getInitialDateCounters(db) {
  const counters = {};
  const orders = await db.collection('orders').find({}, { projection: { orderNumber: 1 } }).toArray();
  const bills = await db.collection('bills').find({}, { projection: { billNumber: 1 } }).toArray();
  const kots = await db.collection('kots').find({}, { projection: { kotNumber: 1 } }).toArray();

  const processNum = (str, prefix) => {
    if (!str || !str.startsWith(prefix)) return;
    const parts = str.split('-');
    if (parts.length >= 3) {
      const dKey = parts[1];
      const seq = parseInt(parts[2], 10);
      if (!isNaN(seq)) {
        counters[dKey] = Math.max(counters[dKey] || 0, seq);
      }
    }
  };

  orders.forEach(o => processNum(o.orderNumber, 'ORD-'));
  bills.forEach(b => processNum(b.billNumber, 'BILL-'));
  kots.forEach(k => processNum(k.kotNumber, 'KOT-'));

  return counters;
}

async function run() {
  const db = await getDatabase();
  console.log(`Connected to database: ${db.databaseName}`);

  const branch = await db.collection('branches').findOne({ _id: 'branch-main' });
  const branchTaxConfig = branch?.taxConfig || { rate: '0.00', gstRate: '0.00', mode: 'EXCLUSIVE' };
  console.log('Branch Tax Config:', branchTaxConfig);

  const products = await db.collection('products').find({ isActive: true }).toArray();
  const categories = await db.collection('categories').find().toArray();
  const catMap = new Map(categories.map(c => [c._id || c.id, c.name]));

  console.log(`Loaded ${products.length} products and ${categories.length} categories.`);

  // Group items
  const starters = products.filter(p => {
    const cat = (p.categoryId || '').toLowerCase();
    const name = p.name.toLowerCase();
    return (
      cat.includes('starter') ||
      cat.includes('tikka') ||
      cat.includes('tandoor-se') ||
      cat.includes('chinese') ||
      name.includes('tikka') ||
      name.includes('lolipop') ||
      name.includes('kurkure') ||
      name.includes('chilli') ||
      name.includes('dana') ||
      name.includes('kabab') ||
      name.includes('leg') ||
      name.includes('65')
    ) && !name.includes('biryani') && !name.includes('rice') && !name.includes('roti') && !name.includes('naan');
  });

  const mainCourses = products.filter(p => {
    const cat = (p.categoryId || '').toLowerCase();
    const name = p.name.toLowerCase();
    return (
      cat.includes('gravy') ||
      cat.includes('tawa') ||
      cat.includes('mughalai') ||
      cat.includes('mutton') ||
      cat.includes('paneer') ||
      cat.includes('ande')
    ) && !name.includes('tikka') && !name.includes('kabab') && !name.includes('leg') && !name.includes('rice') && !name.includes('roti');
  });

  const rotis = products.filter(p => {
    const cat = (p.categoryId || '').toLowerCase();
    const name = p.name.toLowerCase();
    return cat.includes('roti') || name.includes('naan') || name.includes('roti') || name.includes('chapati');
  });

  const rices = products.filter(p => {
    const cat = (p.categoryId || '').toLowerCase();
    const name = p.name.toLowerCase();
    return cat.includes('rice') || name.includes('biryani') || name.includes('pulao') || name.includes('rice');
  });

  const beveragesAndSides = products.filter(p => {
    const cat = (p.categoryId || '').toLowerCase();
    const name = p.name.toLowerCase();
    return cat.includes('beverage') || cat.includes('papad') || name.includes('soft drink') || name.includes('butter milk') || name.includes('papad');
  });

  console.log(`Categorized:
  - Starters: ${starters.length}
  - Main Courses: ${mainCourses.length}
  - Rotis: ${rotis.length}
  - Rices: ${rices.length}
  - Beverages & Sides: ${beveragesAndSides.length}`);

  const tables = await db.collection('tables').find().toArray();
  const mainTables = tables.filter(t => t.tableNumber && /^T-?\d+/i.test(t.tableNumber));
  console.log(`Using ${mainTables.length} tables (e.g. ${mainTables.slice(0, 5).map(t => t.tableNumber).join(', ')})`);

  const captains = [
    { id: 'user-captain', name: 'Captain Rahul' },
    { id: 'user-captain-sanjid', name: 'Captain Sanjid' },
    { id: 'user-captain-arbaz', name: 'Captain Arbaz' },
    { id: 'user-captain-naees', name: 'Captain Naees' },
  ];

  const customersList = [
    null,
    null,
    null,
    { name: 'Ovesh', mobile: '9712907574' },
    { name: 'Irfan Patel', mobile: '9825123456' },
    { name: 'Sameer Khan', mobile: '9876543210' },
    { name: 'Zaid Sheikh', mobile: '9724112233' },
    { name: 'Farhan Saiyed', mobile: '9898012345' },
    null,
    null
  ];

  // Bill dates schedule: July to November 2026
  // Format: [year, month, day, hour, min, type]
  const billSchedule = [
    // --- JULY 2026 (17 bills: 13 weekend, 4 weekday) ---
    // Sat Jul 4
    { year: 2026, month: 7, day: 4, hour: 13, min: 45, type: 'MIX' },
    { year: 2026, month: 7, day: 4, hour: 20, min: 30, type: 'FULL_MEAL' },
    // Sun Jul 5
    { year: 2026, month: 7, day: 5, hour: 14, min: 15, type: 'FEAST' },
    { year: 2026, month: 7, day: 5, hour: 21, min: 10, type: 'STARTERS_DRINKS' },
    // Wed Jul 8 (Weekday)
    { year: 2026, month: 7, day: 8, hour: 20, min: 45, type: 'FULL_MEAL' },
    // Sat Jul 11
    { year: 2026, month: 7, day: 11, hour: 13, min: 20, type: 'RICE_MIX' },
    { year: 2026, month: 7, day: 11, hour: 21, min: 15, type: 'FULL_MEAL' },
    // Sun Jul 12
    { year: 2026, month: 7, day: 12, hour: 14, min: 0, type: 'FEAST' },
    { year: 2026, month: 7, day: 12, hour: 20, min: 40, type: 'MIX' },
    // Fri Jul 17 (Weekday)
    { year: 2026, month: 7, day: 17, hour: 21, min: 30, type: 'FULL_MEAL' },
    // Sat Jul 18
    { year: 2026, month: 7, day: 18, hour: 13, min: 15, type: 'STARTERS_DRINKS' },
    { year: 2026, month: 7, day: 18, hour: 21, min: 45, type: 'FEAST' },
    // Sun Jul 19
    { year: 2026, month: 7, day: 19, hour: 20, min: 25, type: 'FULL_MEAL' },
    // Tue Jul 21 (Weekday)
    { year: 2026, month: 7, day: 21, hour: 20, min: 15, type: 'RICE_MIX' },
    // Sat Jul 25
    { year: 2026, month: 7, day: 25, hour: 21, min: 10, type: 'FULL_MEAL' },
    // Sun Jul 26
    { year: 2026, month: 7, day: 26, hour: 20, min: 50, type: 'FEAST' },
    // Fri Jul 31 (Weekday)
    { year: 2026, month: 7, day: 31, hour: 21, min: 0, type: 'MIX' },

    // --- AUGUST 2026 (17 bills: 13 weekend, 4 weekday) ---
    // Sat Aug 1
    { year: 2026, month: 8, day: 1, hour: 13, min: 30, type: 'MIX' },
    { year: 2026, month: 8, day: 1, hour: 20, min: 45, type: 'FULL_MEAL' },
    // Sun Aug 2
    { year: 2026, month: 8, day: 2, hour: 14, min: 10, type: 'FEAST' },
    { year: 2026, month: 8, day: 2, hour: 21, min: 20, type: 'STARTERS_DRINKS' },
    // Thu Aug 6 (Weekday)
    { year: 2026, month: 8, day: 6, hour: 20, min: 15, type: 'FULL_MEAL' },
    // Sat Aug 8
    { year: 2026, month: 8, day: 8, hour: 13, min: 40, type: 'RICE_MIX' },
    { year: 2026, month: 8, day: 8, hour: 21, min: 0, type: 'FULL_MEAL' },
    // Sun Aug 9
    { year: 2026, month: 8, day: 9, hour: 20, min: 35, type: 'FEAST' },
    // Tue Aug 11 (Weekday)
    { year: 2026, month: 8, day: 11, hour: 20, min: 0, type: 'STARTERS_DRINKS' },
    // Sat Aug 15 (Independence Day Weekend)
    { year: 2026, month: 8, day: 15, hour: 13, min: 45, type: 'FEAST' },
    { year: 2026, month: 8, day: 15, hour: 21, min: 30, type: 'FULL_MEAL' },
    // Sun Aug 16
    { year: 2026, month: 8, day: 16, hour: 21, min: 5, type: 'MIX' },
    // Wed Aug 19 (Weekday)
    { year: 2026, month: 8, day: 19, hour: 20, min: 45, type: 'RICE_MIX' },
    // Sat Aug 22
    { year: 2026, month: 8, day: 22, hour: 20, min: 50, type: 'FULL_MEAL' },
    // Sun Aug 23
    { year: 2026, month: 8, day: 23, hour: 21, min: 15, type: 'FEAST' },
    // Fri Aug 28 (Weekday)
    { year: 2026, month: 8, day: 28, hour: 21, min: 10, type: 'FULL_MEAL' },
    // Sat Aug 29
    { year: 2026, month: 8, day: 29, hour: 20, min: 30, type: 'STARTERS_DRINKS' },

    // --- SEPTEMBER 2026 (16 bills: 12 weekend, 4 weekday) ---
    // Thu Sep 3 (Weekday)
    { year: 2026, month: 9, day: 3, hour: 20, min: 10, type: 'FULL_MEAL' },
    // Sat Sep 5
    { year: 2026, month: 9, day: 5, hour: 13, min: 25, type: 'MIX' },
    { year: 2026, month: 9, day: 5, hour: 21, min: 0, type: 'FEAST' },
    // Sun Sep 6
    { year: 2026, month: 9, day: 6, hour: 14, min: 0, type: 'FULL_MEAL' },
    { year: 2026, month: 9, day: 6, hour: 20, min: 45, type: 'STARTERS_DRINKS' },
    // Tue Sep 8 (Weekday)
    { year: 2026, month: 9, day: 8, hour: 20, min: 30, type: 'RICE_MIX' },
    // Sat Sep 12
    { year: 2026, month: 9, day: 12, hour: 13, min: 15, type: 'FULL_MEAL' },
    { year: 2026, month: 9, day: 12, hour: 21, min: 15, type: 'FEAST' },
    // Sun Sep 13
    { year: 2026, month: 9, day: 13, hour: 20, min: 30, type: 'MIX' },
    // Wed Sep 16 (Weekday)
    { year: 2026, month: 9, day: 16, hour: 20, min: 15, type: 'FULL_MEAL' },
    // Sat Sep 19
    { year: 2026, month: 9, day: 19, hour: 13, min: 45, type: 'RICE_MIX' },
    { year: 2026, month: 9, day: 19, hour: 21, min: 30, type: 'FEAST' },
    // Sun Sep 20
    { year: 2026, month: 9, day: 20, hour: 21, min: 0, type: 'FULL_MEAL' },
    // Fri Sep 25 (Weekday)
    { year: 2026, month: 9, day: 25, hour: 21, min: 0, type: 'STARTERS_DRINKS' },
    // Sat Sep 26
    { year: 2026, month: 9, day: 26, hour: 20, min: 45, type: 'FULL_MEAL' },
    // Sun Sep 27
    { year: 2026, month: 9, day: 27, hour: 21, min: 15, type: 'FEAST' },

    // --- OCTOBER 2026 (17 bills: 13 weekend, 4 weekday) ---
    // Sat Oct 3
    { year: 2026, month: 10, day: 3, hour: 13, min: 15, type: 'MIX' },
    { year: 2026, month: 10, day: 3, hour: 20, min: 45, type: 'FULL_MEAL' },
    // Sun Oct 4
    { year: 2026, month: 10, day: 4, hour: 14, min: 0, type: 'FEAST' },
    { year: 2026, month: 10, day: 4, hour: 21, min: 0, type: 'STARTERS_DRINKS' },
    // Wed Oct 7 (Weekday)
    { year: 2026, month: 10, day: 7, hour: 20, min: 15, type: 'FULL_MEAL' },
    // Sat Oct 10
    { year: 2026, month: 10, day: 10, hour: 13, min: 30, type: 'RICE_MIX' },
    { year: 2026, month: 10, day: 10, hour: 21, min: 15, type: 'FEAST' },
    // Sun Oct 11
    { year: 2026, month: 10, day: 11, hour: 20, min: 30, type: 'FULL_MEAL' },
    // Thu Oct 15 (Weekday)
    { year: 2026, month: 10, day: 15, hour: 20, min: 30, type: 'MIX' },
    // Sat Oct 17
    { year: 2026, month: 10, day: 17, hour: 13, min: 45, type: 'FULL_MEAL' },
    { year: 2026, month: 10, day: 17, hour: 21, min: 30, type: 'FEAST' },
    // Sun Oct 18
    { year: 2026, month: 10, day: 18, hour: 21, min: 0, type: 'STARTERS_DRINKS' },
    // Tue Oct 20 (Weekday)
    { year: 2026, month: 10, day: 20, hour: 20, min: 0, type: 'FULL_MEAL' },
    // Sat Oct 24
    { year: 2026, month: 10, day: 24, hour: 20, min: 45, type: 'FEAST' },
    // Sun Oct 25
    { year: 2026, month: 10, day: 25, hour: 21, min: 15, type: 'FULL_MEAL' },
    // Wed Oct 28 (Weekday)
    { year: 2026, month: 10, day: 28, hour: 20, min: 45, type: 'RICE_MIX' },
    // Sat Oct 31 (will pick up starting from seq 003 since 001 and 002 exist!)
    { year: 2026, month: 10, day: 31, hour: 21, min: 30, type: 'FEAST' },

    // --- NOVEMBER 2026 (Nov 1 - Nov 4, 2026) ---
    // Sun Nov 1
    { year: 2026, month: 11, day: 1, hour: 13, min: 30, type: 'RICE_MIX' },
    { year: 2026, month: 11, day: 1, hour: 20, min: 30, type: 'FULL_MEAL' },
    { year: 2026, month: 11, day: 1, hour: 21, min: 45, type: 'FEAST' },
    // Mon Nov 2 (will pick up starting after existing orders on Nov 2)
    { year: 2026, month: 11, day: 2, hour: 20, min: 15, type: 'STARTERS_DRINKS' },
    // Tue Nov 3 (will pick up starting after existing orders on Nov 3)
    { year: 2026, month: 11, day: 3, hour: 20, min: 45, type: 'FULL_MEAL' },
    // Wed Nov 4
    { year: 2026, month: 11, day: 4, hour: 21, min: 0, type: 'MIX' },
  ];

  console.log(`Planned ${billSchedule.length} bills across July - November 2026.`);

  // Pick helper
  const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const pickRandomN = (arr, n) => {
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, n);
  };

  // Pre-load current max sequence per dateKey
  const dateCounters = await getInitialDateCounters(db);
  console.log('Initial date counters from existing DB data:', Object.keys(dateCounters).length, 'keys');

  const createdBills = [];
  const createdOrders = [];
  const createdKots = [];
  const createdPayments = [];

  for (let idx = 0; idx < billSchedule.length; idx++) {
    const sch = billSchedule[idx];
    const orderDate = new Date(Date.UTC(sch.year, sch.month - 1, sch.day, sch.hour - 5, sch.min - 30));
    const completeDate = new Date(orderDate.getTime() + 35 * 60 * 1000);

    const dateKey = `${padZero(sch.day, 2)}${padZero(sch.month, 2)}${String(sch.year).slice(-2)}`;
    dateCounters[dateKey] = (dateCounters[dateKey] || 0) + 1;
    const seqNum = padZero(dateCounters[dateKey], 3);

    const orderNumber = `ORD-${dateKey}-${seqNum}`;
    const billNumber = `BILL-${dateKey}-${seqNum}`;
    const kotNumber = `KOT-${dateKey}-${seqNum}`;

    const orderId = crypto.randomUUID();
    const billId = crypto.randomUUID();
    const kotId = crypto.randomUUID();
    const paymentId = crypto.randomUUID();

    const table = mainTables[idx % mainTables.length];
    const captain = captains[idx % captains.length];
    const customer = customersList[idx % customersList.length];

    // Select items based on bill type
    const rawItems = [];

    if (sch.type === 'STARTERS_DRINKS') {
      // 2-3 starters, 2-4 cold drinks
      const selectedStarters = pickRandomN(starters, 2 + (idx % 2));
      for (const st of selectedStarters) {
        rawItems.push({
          product: st,
          quantity: 1 + (Math.random() > 0.6 ? 1 : 0),
        });
      }
      const selectedDrinks = pickRandomN(beveragesAndSides, 1 + (idx % 2));
      for (const dr of selectedDrinks) {
        rawItems.push({
          product: dr,
          quantity: 2 + (idx % 3),
        });
      }
    } else if (sch.type === 'RICE_MIX') {
      // 1-2 Biryani / Rice, 1-2 starters, drinks
      const selectedRice = pickRandomN(rices, 1 + (idx % 2));
      for (const rc of selectedRice) {
        rawItems.push({
          product: rc,
          quantity: 1 + (idx % 2),
        });
      }
      const selectedStarters = pickRandomN(starters, 1 + (idx % 2));
      for (const st of selectedStarters) {
        rawItems.push({
          product: st,
          quantity: 1,
        });
      }
      const drink = pickRandom(beveragesAndSides);
      rawItems.push({
        product: drink,
        quantity: 2,
      });
    } else if (sch.type === 'FULL_MEAL') {
      // 1-2 Starters, 1-2 Main Course, 4-7 Rotis, Drinks/Papad
      const selectedStarters = pickRandomN(starters, 1 + (idx % 2));
      for (const st of selectedStarters) {
        rawItems.push({
          product: st,
          quantity: 1,
        });
      }
      const selectedMains = pickRandomN(mainCourses, 1 + (idx % 2));
      for (const mc of selectedMains) {
        rawItems.push({
          product: mc,
          quantity: 1,
        });
      }
      // Multiple rotis: 4, 5, 6, 7!
      const rotiCounts = [4, 5, 6, 7];
      const rotiQty = rotiCounts[idx % rotiCounts.length];
      const selectedRoti = pickRandom(rotis);
      rawItems.push({
        product: selectedRoti,
        quantity: rotiQty,
      });
      // Maybe 1 papad or soft drink
      if (Math.random() > 0.3) {
        rawItems.push({
          product: pickRandom(beveragesAndSides),
          quantity: 2,
        });
      }
    } else {
      // FEAST or MIX: heavy bill with starters, chicken/mutton main courses, rotis, rice, drinks
      const selectedStarters = pickRandomN(starters, 2 + (idx % 2));
      for (const st of selectedStarters) {
        rawItems.push({
          product: st,
          quantity: 1,
        });
      }
      const selectedMains = pickRandomN(mainCourses, 2);
      for (const mc of selectedMains) {
        rawItems.push({
          product: mc,
          quantity: 1,
        });
      }
      // Rotis: 6 or 7
      const rotiCounts = [6, 7, 8];
      const rotiQty = rotiCounts[idx % rotiCounts.length];
      const selectedRoti = pickRandom(rotis);
      rawItems.push({
        product: selectedRoti,
        quantity: rotiQty,
      });
      // 1 Rice
      const selectedRice = pickRandom(rices);
      rawItems.push({
        product: selectedRice,
        quantity: 1,
      });
      // Drinks
      const selectedDrink = pickRandom(beveragesAndSides);
      rawItems.push({
        product: selectedDrink,
        quantity: 3,
      });
    }

    // Convert rawItems to order & bill item structures
    const orderItems = rawItems.map((item) => {
      const p = item.product;
      const itemId = crypto.randomUUID();
      const unitPrice = p.currentPrice || '100.00';
      const qty = item.quantity || 1;
      const lineSub = formatMoney(toDecimal(unitPrice).times(qty));
      const categoryName = catMap.get(p.categoryId) || 'General';

      return {
        _id: itemId,
        id: itemId,
        productId: p._id || p.id,
        productName: p.name,
        name: p.name,
        code: p.code || '',
        station: p.kitchenStation || 'MAIN',
        categoryId: p.categoryId || 'cat-general',
        categoryName,
        kotRequired: true,
        quantity: qty,
        unitPrice: formatMoney(toDecimal(unitPrice)),
        taxConfig: {
          rate: formatMoney(toDecimal(branchTaxConfig.rate || 0)),
          mode: branchTaxConfig.mode || 'EXCLUSIVE',
        },
        taxAmount: '0.00',
        lineSubtotal: lineSub,
        lineTotal: lineSub,
        note: '',
        status: 'ACTIVE',
        isCustom: false,
        createdAt: orderDate.toISOString(),
        updatedAt: orderDate.toISOString(),
      };
    });

    // Calculate financials using BillingCalculator
    const calcResult = BillingCalculator.calculateBill({
      items: orderItems,
      discountInput: null,
      branchTaxConfig,
      paidAmountInput: '0.00',
    });

    const subtotal = calcResult.subtotal;
    const grandTotal = calcResult.grandTotal;

    // Build Order Document
    const orderDoc = {
      _id: orderId,
      id: orderId,
      orderNumber,
      orderNo: orderNumber,
      branchId: 'branch-main',
      orderType: 'DINE_IN',
      tableId: table._id || table.id,
      tableNumber: table.tableNumber,
      tableNo: table.tableNumber,
      captainId: captain.id,
      captainName: captain.name,
      customerId: customer ? customer.id || null : null,
      customerName: customer ? customer.name : '',
      customerPhone: customer ? customer.mobile : '',
      onlineOrderRef: '',
      status: 'COMPLETED',
      source: 'CAPTAIN',
      held: false,
      notes: '',
      items: orderItems,
      financials: {
        subtotal,
        discountAmount: '0.00',
        taxableAmount: calcResult.taxableAmount,
        taxTotal: calcResult.tax,
        grandTotal,
        paidAmount: grandTotal,
        balanceDue: '0.00',
        paymentStatus: 'PAID',
      },
      kotRevision: 1,
      submittedAt: orderDate.toISOString(),
      confirmedAt: orderDate.toISOString(),
      confirmedBy: captain.name,
      servedAt: new Date(orderDate.getTime() + 25 * 60 * 1000).toISOString(),
      completedAt: completeDate.toISOString(),
      cancelledAt: null,
      cancellationReason: null,
      rejectionReason: null,
      createdAt: orderDate.toISOString(),
      updatedAt: completeDate.toISOString(),
      _historicalSeed: true,
    };

    // Build KOT Document
    const kotDoc = {
      _id: kotId,
      id: kotId,
      kotNumber,
      orderId,
      orderNumber,
      branchId: 'branch-main',
      tableId: table._id || table.id,
      tableNumber: table.tableNumber,
      captainId: captain.id,
      captainName: captain.name,
      revision: 1,
      type: 'NEW',
      status: 'SERVED',
      kitchenStation: 'MAIN',
      items: orderItems.map(it => ({
        productId: it.productId,
        productName: it.productName,
        quantity: it.quantity,
        note: '',
        station: it.station || 'MAIN',
        changeType: 'ADD',
      })),
      notes: '',
      printStatus: 'PRINTED',
      printedAt: orderDate.toISOString(),
      preparingAt: new Date(orderDate.getTime() + 2 * 60 * 1000).toISOString(),
      readyAt: new Date(orderDate.getTime() + 20 * 60 * 1000).toISOString(),
      servedAt: new Date(orderDate.getTime() + 25 * 60 * 1000).toISOString(),
      createdAt: orderDate.toISOString(),
      updatedAt: completeDate.toISOString(),
      _historicalSeed: true,
    };

    // Build Bill Document
    const billDoc = {
      _id: billId,
      id: billId,
      billNumber,
      billNo: billNumber,
      branchId: 'branch-main',
      orderId,
      orderNumber,
      orderNo: orderNumber,
      tableId: table._id || table.id,
      tableNumber: table.tableNumber,
      tableNo: table.tableNumber,
      captainId: captain.id,
      captainName: captain.name,
      customerId: customer ? customer.id || null : null,
      customerName: customer ? customer.name : '',
      customerMobile: customer ? customer.mobile : '',
      items: calcResult.items,
      subtotal: calcResult.subtotal,
      discount: calcResult.discount,
      taxableAmount: calcResult.taxableAmount,
      tax: calcResult.tax,
      taxRate: calcResult.taxRate,
      taxMode: calcResult.taxMode,
      cgst: calcResult.cgst,
      sgst: calcResult.sgst,
      taxBreakdown: calcResult.taxBreakdown,
      rounding: calcResult.rounding,
      grandTotal: calcResult.grandTotal,
      paidAmount: calcResult.grandTotal,
      balanceAmount: '0.00',
      status: 'COMPLETED',
      generatedBy: 'user-cashier',
      generatedByName: 'Cashier',
      generatedAt: completeDate.toISOString(),
      completedAt: completeDate.toISOString(),
      createdAt: completeDate.toISOString(),
      updatedAt: completeDate.toISOString(),
      _historicalSeed: true,
    };

    // Build Payment Document
    const paymentModes = ['CASH', 'UPI', 'UPI', 'CARD', 'CASH'];
    const pMode = paymentModes[idx % paymentModes.length];
    const paymentDoc = {
      _id: paymentId,
      id: paymentId,
      branchId: 'branch-main',
      billId,
      orderId,
      mode: pMode,
      amount: grandTotal,
      referenceNumber: pMode === 'UPI' ? `UPI-${dateKey}-${1000 + idx}` : (pMode === 'CARD' ? `TXN-${100000 + idx}` : null),
      collectedBy: 'user-cashier',
      collectedByName: 'Cashier',
      collectedAt: completeDate.toISOString(),
      status: 'VALID',
      createdAt: completeDate.toISOString(),
      updatedAt: completeDate.toISOString(),
      _historicalSeed: true,
    };

    createdOrders.push(orderDoc);
    createdKots.push(kotDoc);
    createdBills.push(billDoc);
    createdPayments.push(paymentDoc);
  }

  console.log(`Inserting ${createdOrders.length} orders, ${createdKots.length} KOTs, ${createdBills.length} bills, ${createdPayments.length} payments...`);

  const orderRes = await db.collection('orders').insertMany(createdOrders);
  const kotRes = await db.collection('kots').insertMany(createdKots);
  const billRes = await db.collection('bills').insertMany(createdBills);
  const payRes = await db.collection('payments').insertMany(createdPayments);

  console.log(`Success! Inserted:
  - Orders: ${orderRes.insertedCount}
  - KOTs: ${kotRes.insertedCount}
  - Bills: ${billRes.insertedCount}
  - Payments: ${payRes.insertedCount}`);

  // Summary by Month
  const monthMap = {};
  for (const b of createdBills) {
    const m = b.generatedAt.slice(0, 7);
    monthMap[m] = (monthMap[m] || 0) + 1;
  }
  console.log('Bills count by month:', monthMap);

  // Day of week breakdown
  const dayOfWeekMap = { Saturday: 0, Sunday: 0, Weekday: 0 };
  for (const b of createdBills) {
    const dt = new Date(b.generatedAt);
    const day = dt.getUTCDay();
    if (day === 6) dayOfWeekMap.Saturday++;
    else if (day === 0) dayOfWeekMap.Sunday++;
    else dayOfWeekMap.Weekday++;
  }
  console.log('Day of week breakdown:', dayOfWeekMap);

  // Sample bill details
  const sample = createdBills[0];
  console.log(`Sample Bill ${sample.billNumber} on ${sample.generatedAt}:
  - Items (${sample.items.length}): ${sample.items.map(it => `${it.productName || it.name} x${it.quantity} (₹${it.lineSubtotal})`).join(', ')}
  - Subtotal: ₹${sample.subtotal}
  - Grand Total: ₹${sample.grandTotal}
  - Status: ${sample.status}`);

  await closeMongoConnection();
}

run().catch(console.error);
