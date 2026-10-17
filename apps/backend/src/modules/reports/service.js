import { getCollection } from '../../config/database.js';
import { toDecimal, roundMoney, formatMoney } from '../../utils/decimal.js';

function buildDateFilter(dateFrom = null, dateTo = null) {
  if (!dateFrom && !dateTo) return null;
  const filter = {};
  if (dateFrom) {
    filter.$gte = dateFrom;
  }
  if (dateTo) {
    // Decision 7 Compatibility Shim: expand YYYY-MM-DD to end-of-day UTC
    filter.$lte = /^\d{4}-\d{2}-\d{2}$/.test(dateTo)
      ? `${dateTo}T23:59:59.999Z`
      : dateTo;
  }
  return filter;
}

class ReportService {
  async getSalesReport({ branchId, dateFrom = null, dateTo = null }) {
    const billsCol = await getCollection('bills');
    const query = {
      branchId,
      status: { $in: ['COMPLETED', 'PAID'] },
    };
    const dateFilter = buildDateFilter(dateFrom, dateTo);
    if (dateFilter) {
      query.generatedAt = dateFilter;
    }

    const bills = await billsCol.find(query).toArray();

    const byDayMap = new Map();
    let overallSales = toDecimal(0);
    let overallSubtotal = toDecimal(0);
    let overallDiscount = toDecimal(0);
    let overallTax = toDecimal(0);
    let overallRounding = toDecimal(0);
    let totalBills = 0;

    for (const bill of bills) {
      const day = String(bill.generatedAt || bill.createdAt || '').slice(0, 10) || 'unknown';
      const bSub = toDecimal(bill.subtotal || '0.00');
      const bDisc = toDecimal(bill.discount?.amount ?? bill.discountAmount ?? '0.00');
      const bTax = toDecimal(bill.tax || '0.00');
      const bRound = toDecimal(bill.rounding || '0.00');
      const bTotal = toDecimal(bill.grandTotal || '0.00');

      overallSubtotal = overallSubtotal.plus(bSub);
      overallDiscount = overallDiscount.plus(bDisc);
      overallTax = overallTax.plus(bTax);
      overallRounding = overallRounding.plus(bRound);
      overallSales = overallSales.plus(bTotal);
      totalBills += 1;

      const dayAcc = byDayMap.get(day) || {
        date: day,
        billCount: 0,
        subtotal: toDecimal(0),
        discount: toDecimal(0),
        tax: toDecimal(0),
        rounding: toDecimal(0),
        totalSales: toDecimal(0),
      };

      dayAcc.billCount += 1;
      dayAcc.subtotal = dayAcc.subtotal.plus(bSub);
      dayAcc.discount = dayAcc.discount.plus(bDisc);
      dayAcc.tax = dayAcc.tax.plus(bTax);
      dayAcc.rounding = dayAcc.rounding.plus(bRound);
      dayAcc.totalSales = dayAcc.totalSales.plus(bTotal);
      byDayMap.set(day, dayAcc);
    }

    const daily = [...byDayMap.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({
        date: d.date,
        billCount: d.billCount,
        subtotal: formatMoney(d.subtotal),
        discount: formatMoney(d.discount),
        tax: formatMoney(d.tax),
        rounding: formatMoney(d.rounding),
        totalSales: formatMoney(d.totalSales),
      }));

    const avgBill =
      totalBills > 0 ? roundMoney(overallSales.div(totalBills)) : toDecimal(0);

    const summary = {
      branchId,
      totalBills,
      totalSales: formatMoney(overallSales),
      totalSubtotal: formatMoney(overallSubtotal),
      totalDiscount: formatMoney(overallDiscount),
      totalTax: formatMoney(overallTax),
      totalRounding: formatMoney(overallRounding),
      averageBillValue: formatMoney(avgBill),
    };

    return {
      ...summary,
      summary,
      daily,
    };
  }

  async getItemsReport({
    branchId,
    dateFrom = null,
    dateTo = null,
    categoryId = null,
  }) {
    const billsCol = await getCollection('bills');
    const query = {
      branchId,
      status: { $in: ['COMPLETED', 'PAID'] },
    };
    const dateFilter = buildDateFilter(dateFrom, dateTo);
    if (dateFilter) {
      query.generatedAt = dateFilter;
    }

    const bills = await billsCol.find(query).toArray();
    const itemMap = new Map();

    for (const bill of bills) {
      for (const it of bill.items || []) {
        if ((it.status || 'ACTIVE') === 'CANCELLED') continue;
        if (categoryId && it.categoryId && it.categoryId !== categoryId) continue;

        const pid = it.productId || it.productName || 'unknown';
        const qty = Number(it.quantity || 1);
        const lineRev = toDecimal(
          it.lineSubtotal ?? toDecimal(it.unitPrice || 0).times(qty)
        );

        const entry = itemMap.get(pid) || {
          productId: it.productId,
          productName: it.productName || it.name || 'Dish',
          code: it.code || '',
          quantitySold: 0,
          totalRevenueDec: toDecimal(0),
        };

        entry.quantitySold += qty;
        entry.totalRevenueDec = entry.totalRevenueDec.plus(lineRev);
        itemMap.set(pid, entry);
      }
    }

    return [...itemMap.values()]
      .sort((a, b) => b.totalRevenueDec.comparedTo(a.totalRevenueDec))
      .map((entry) => {
        const rev = formatMoney(entry.totalRevenueDec);
        return {
          productId: entry.productId,
          productName: entry.productName,
          name: entry.productName,
          code: entry.code,
          quantitySold: entry.quantitySold,
          quantity: entry.quantitySold,
          totalRevenue: rev,
          revenue: rev,
        };
      });
  }

  async getCaptainsReport({ branchId, dateFrom = null, dateTo = null }) {
    const ordersCol = await getCollection('orders');
    const billsCol = await getCollection('bills');

    const orderQuery = {
      branchId,
      status: { $in: ['COMPLETED', 'SERVED', 'BILLING', 'BILL_PENDING', 'PAID'] },
    };
    const dateFilter = buildDateFilter(dateFrom, dateTo);
    if (dateFilter) {
      orderQuery.createdAt = dateFilter;
    }

    const orders = await ordersCol.find(orderQuery).toArray();
    const captainMap = new Map();

    for (const ord of orders) {
      const capId = ord.captainId || 'unknown';
      const entry = captainMap.get(capId) || {
        captainId: capId,
        captainName: ord.captainName || 'Unknown Captain',
        totalOrders: 0,
        tableSet: new Set(),
        orderIds: [],
      };
      entry.totalOrders += 1;
      if (ord.tableId) entry.tableSet.add(ord.tableId);
      entry.orderIds.push(ord._id);
      captainMap.set(capId, entry);
    }

    const results = [];
    for (const entry of captainMap.values()) {
      const bills = await billsCol
        .find({
          branchId,
          status: { $in: ['COMPLETED', 'PAID'] },
          orderId: { $in: entry.orderIds },
        })
        .toArray();

      let totalSalesDec = toDecimal(0);
      for (const b of bills) {
        totalSalesDec = totalSalesDec.plus(toDecimal(b.grandTotal || '0.00'));
      }
      const totalSales = formatMoney(totalSalesDec);

      results.push({
        captainId: entry.captainId,
        captainName: entry.captainName,
        name: entry.captainName,
        totalOrders: entry.totalOrders,
        orderCount: entry.totalOrders,
        ordersCount: entry.totalOrders,
        uniqueTablesServed: entry.tableSet.size,
        totalSales,
        revenue: totalSales,
      });
    }

    return results.sort((a, b) => b.totalOrders - a.totalOrders);
  }

  async getPaymentsReport({ branchId, dateFrom = null, dateTo = null }) {
    const paymentsCol = await getCollection('payments');
    const query = {
      branchId,
      status: { $in: ['VALID', 'SUCCESS'] },
    };
    const dateFilter = buildDateFilter(dateFrom, dateTo);
    if (dateFilter) {
      query.collectedAt = dateFilter;
    }

    const payments = await paymentsCol.find(query).toArray();
    const modeMap = new Map();
    let totalCollectedDec = toDecimal(0);
    let totalTransactions = 0;

    for (const p of payments) {
      const mode = String(p.mode || 'OTHER').toUpperCase();
      const amtDec = toDecimal(p.amount || '0.00');
      totalCollectedDec = totalCollectedDec.plus(amtDec);
      totalTransactions += 1;

      const entry = modeMap.get(mode) || {
        mode,
        transactionCount: 0,
        totalCollectedDec: toDecimal(0),
      };
      entry.transactionCount += 1;
      entry.totalCollectedDec = entry.totalCollectedDec.plus(amtDec);
      modeMap.set(mode, entry);
    }

    const modes = [...modeMap.values()]
      .sort((a, b) => b.totalCollectedDec.comparedTo(a.totalCollectedDec))
      .map((m) => {
        const formattedAmt = formatMoney(m.totalCollectedDec);
        return {
          mode: m.mode,
          transactionCount: m.transactionCount,
          count: m.transactionCount,
          totalCollected: formattedAmt,
          totalAmount: formattedAmt,
          amount: formattedAmt,
        };
      });

    return {
      summary: {
        totalTransactions,
        totalCollected: formatMoney(totalCollectedDec),
      },
      byMode: modes,
      items: modes,
    };
  }

  async getDiscountsReport({ branchId, dateFrom = null, dateTo = null }) {
    const discountsCol = await getCollection('discounts');
    const query = { branchId };
    const dateFilter = buildDateFilter(dateFrom, dateTo);
    if (dateFilter) {
      query.appliedAt = dateFilter;
    }

    const docs = await discountsCol.find(query).sort({ appliedAt: -1 }).toArray();
    let totalDiscountDec = toDecimal(0);
    const records = docs.map((d) => {
      const amtDec = toDecimal(d.amount || '0.00');
      totalDiscountDec = totalDiscountDec.plus(amtDec);
      return {
        id: String(d._id),
        billId: d.billId,
        type: d.type,
        value: d.value,
        amount: formatMoney(amtDec),
        reason: d.reason,
        appliedByName: d.appliedByName,
        appliedAt: d.appliedAt,
      };
    });

    return {
      totalDiscountAmount: formatMoney(totalDiscountDec),
      discountCount: records.length,
      discounts: records,
    };
  }

  async getCancellationsReport({ branchId, dateFrom = null, dateTo = null }) {
    const eventsCol = await getCollection('order_events');
    const query = {
      branchId,
      $or: [
        { eventType: { $in: ['ORDER_CANCELLED', 'ORDER_REJECTED'] } },
        { type: { $in: ['ORDER_CANCELLED', 'ORDER_REJECTED'] } },
      ],
    };
    const dateFilter = buildDateFilter(dateFrom, dateTo);
    if (dateFilter) {
      query.timestamp = dateFilter;
    }

    const events = await eventsCol.find(query).sort({ timestamp: -1 }).toArray();
    const cancellations = [];
    const rejections = [];

    for (const ev of events) {
      const evType = ev.eventType || ev.type;
      const item = {
        id: String(ev._id),
        orderId: ev.orderId,
        eventType: evType,
        actorId: ev.actorId,
        reason: ev.reason,
        timestamp: ev.timestamp || ev.createdAt,
      };
      if (evType === 'ORDER_CANCELLED') {
        cancellations.push(item);
      } else {
        rejections.push(item);
      }
    }

    return {
      totalCancelled: cancellations.length,
      totalRejected: rejections.length,
      cancellations,
      rejections,
    };
  }
}

export const reportService = new ReportService();
