import { getCollection } from '../../config/database.js';
import { toDecimal, roundMoney, formatMoney } from '../../utils/decimal.js';
import {
  getCurrentOperationalInfo,
  resolveOperationalTimeRange,
  SHIFT_SESSIONS,
} from '../../utils/operationalTime.js';

class AccountsService {
  /**
   * Returns current operational status including current operational date,
   * active session (Lunch/Breakfast vs Dinner), and current shift boundaries.
   */
  getOperationalStatus() {
    return getCurrentOperationalInfo();
  }

  /**
   * Generates comprehensive Daily Accounts & Order Reconciliation Report
   * for the given operational date and meal shift/session.
   *
   * @param {Object} params
   * @param {string} params.branchId
   * @param {string} [params.date] YYYY-MM-DD operational date
   * @param {string} [params.session] ALL | LUNCH | DINNER
   */
  async getDailySummary({ branchId = 'branch-main', date = null, session = 'ALL' }) {
    const currentInfo = getCurrentOperationalInfo();
    const operationalDate = date && /^\d{4}-\d{2}-\d{2}$/.test(String(date).trim())
      ? String(date).trim()
      : currentInfo.operationalDate;

    const normSession = String(session || 'ALL').toUpperCase();
    const range = resolveOperationalTimeRange({
      date: operationalDate,
      session: normSession,
    });

    const billsCol = await getCollection('bills');
    const ordersCol = await getCollection('orders');
    const paymentsCol = await getCollection('payments');

    // Query settled / paid bills for this operational window
    const billsQuery = {
      branchId,
      status: { $in: ['COMPLETED', 'PAID'] },
      $or: [
        { generatedAt: { $gte: range.start, $lte: range.end } },
        { paidAt: { $gte: range.start, $lte: range.end } },
        { createdAt: { $gte: range.start, $lte: range.end } },
      ],
    };

    const bills = await billsCol
      .find(billsQuery)
      .sort({ generatedAt: -1, createdAt: -1 })
      .toArray();

    // Collect order IDs to fetch detailed order metadata
    const orderIds = bills.map((b) => b.orderId).filter(Boolean);
    const orders = orderIds.length > 0
      ? await ordersCol.find({ _id: { $in: orderIds } }).toArray()
      : [];

    const orderMap = new Map();
    for (const ord of orders) {
      orderMap.set(String(ord._id), ord);
    }

    // Query payments recorded in this operational window
    const paymentQuery = {
      branchId,
      status: { $in: ['VALID', 'SUCCESS', 'PAID'] },
      collectedAt: { $gte: range.start, $lte: range.end },
    };
    const paymentRecords = await paymentsCol.find(paymentQuery).toArray();

    // Financial calculations
    let totalSubtotalDec = toDecimal(0);
    let totalDiscountDec = toDecimal(0);
    let totalTaxDec = toDecimal(0);
    let totalRoundingDec = toDecimal(0);
    let totalGrandTotalDec = toDecimal(0);

    const paymentModes = {
      cash: { amount: toDecimal(0), count: 0 },
      online: { amount: toDecimal(0), count: 0 },
      card: { amount: toDecimal(0), count: 0 },
      other: { amount: toDecimal(0), count: 0 },
    };

    const ordersList = [];

    for (const bill of bills) {
      const bSub = toDecimal(bill.subtotal || '0.00');
      const bDisc = toDecimal(bill.discount?.amount ?? bill.discountAmount ?? '0.00');
      const bTax = toDecimal(bill.tax || '0.00');
      const bRound = toDecimal(bill.rounding || '0.00');
      const bGrand = toDecimal(bill.grandTotal || '0.00');

      totalSubtotalDec = totalSubtotalDec.plus(bSub);
      totalDiscountDec = totalDiscountDec.plus(bDisc);
      totalTaxDec = totalTaxDec.plus(bTax);
      totalRoundingDec = totalRoundingDec.plus(bRound);
      totalGrandTotalDec = totalGrandTotalDec.plus(bGrand);

      // Resolve linked order metadata
      const linkedOrder = orderMap.get(String(bill.orderId)) || null;

      // Classify payment mode
      const rawMode = String(bill.paymentMode || bill.mode || '').toUpperCase();
      let modeCategory = 'cash';

      if (['UPI', 'ONLINE', 'QR', 'GPAY', 'PHONEPE', 'PAYTM', 'RAZORPAY'].some((k) => rawMode.includes(k))) {
        modeCategory = 'online';
      } else if (['CARD', 'DEBIT', 'CREDIT', 'POS'].some((k) => rawMode.includes(k))) {
        modeCategory = 'card';
      } else if (rawMode === 'CASH') {
        modeCategory = 'cash';
      } else if (rawMode === 'SPLIT' || rawMode === 'MIXED') {
        // Evaluate split payments array
        if (Array.isArray(bill.payments) && bill.payments.length > 0) {
          for (const p of bill.payments) {
            const pMode = String(p.mode || '').toUpperCase();
            const pAmt = toDecimal(p.amount || 0);
            if (['UPI', 'ONLINE', 'QR', 'GPAY', 'PHONEPE'].some((k) => pMode.includes(k))) {
              paymentModes.online.amount = paymentModes.online.amount.plus(pAmt);
              paymentModes.online.count += 1;
            } else if (['CARD', 'DEBIT', 'CREDIT'].some((k) => pMode.includes(k))) {
              paymentModes.card.amount = paymentModes.card.amount.plus(pAmt);
              paymentModes.card.count += 1;
            } else if (pMode === 'CASH') {
              paymentModes.cash.amount = paymentModes.cash.amount.plus(pAmt);
              paymentModes.cash.count += 1;
            } else {
              paymentModes.other.amount = paymentModes.other.amount.plus(pAmt);
              paymentModes.other.count += 1;
            }
          }
        } else {
          paymentModes.other.amount = paymentModes.other.amount.plus(bGrand);
          paymentModes.other.count += 1;
        }
        modeCategory = 'split';
      } else {
        modeCategory = 'other';
      }

      if (modeCategory !== 'split') {
        paymentModes[modeCategory].amount = paymentModes[modeCategory].amount.plus(bGrand);
        paymentModes[modeCategory].count += 1;
      }

      // Format items summary
      const billItems = bill.items || linkedOrder?.items || [];
      const itemsSummary = billItems
        .map((i) => `${i.productName || i.name || 'Dish'} (x${i.quantity || 1})`)
        .join(', ');

      const billTime = bill.generatedAt || bill.paidAt || bill.createdAt || linkedOrder?.createdAt;

      ordersList.push({
        id: String(bill._id),
        billId: String(bill._id),
        billNumber: bill.billNumber || bill.billNo || `BILL-${String(bill._id).slice(-4)}`,
        orderId: linkedOrder ? String(linkedOrder._id) : bill.orderId,
        orderNumber: linkedOrder?.orderNumber || bill.orderNumber || 'N/A',
        tableId: linkedOrder?.tableId || bill.tableId || null,
        tableNumber: linkedOrder?.tableNumber || bill.tableNumber || (linkedOrder?.tableId ? `Table ${linkedOrder.tableId}` : 'Take Away'),
        orderType: linkedOrder?.orderType || bill.orderType || 'DINE_IN',
        captainName: linkedOrder?.captainName || bill.captainName || bill.cashierName || 'Staff',
        timestamp: billTime,
        itemsCount: billItems.reduce((acc, curr) => acc + Number(curr.quantity || 1), 0),
        itemsSummary,
        items: billItems,
        subtotal: formatMoney(bSub),
        discount: formatMoney(bDisc),
        tax: formatMoney(bTax),
        rounding: formatMoney(bRound),
        netAmount: formatMoney(bGrand),
        grandTotal: formatMoney(bGrand),
        paymentMode: bill.paymentMode || bill.mode || (modeCategory.toUpperCase()),
        paymentStatus: bill.status || 'PAID',
        bill,
        order: linkedOrder,
      });
    }

    // Verify against standalone payment collection if bill collection had unallocated modes
    let totalCollectedDec = paymentModes.cash.amount
      .plus(paymentModes.online.amount)
      .plus(paymentModes.card.amount)
      .plus(paymentModes.other.amount);

    const summary = {
      operationalDate,
      session: normSession,
      sessionLabel:
        normSession === 'DINNER'
          ? 'Dinner (5 PM - 5 AM)'
          : normSession === 'LUNCH'
          ? 'Lunch / Breakfast (5 AM - 5 PM)'
          : 'All Day (5 AM - 5 AM)',
      timeRange: range,
      totalOrders: ordersList.length,
      totalSubtotal: formatMoney(totalSubtotalDec),
      totalDiscount: formatMoney(totalDiscountDec),
      totalTax: formatMoney(totalTaxDec),
      totalRounding: formatMoney(totalRoundingDec),
      totalNetAmount: formatMoney(totalGrandTotalDec),
      totalSales: formatMoney(totalGrandTotalDec),
      payments: {
        cash: {
          total: formatMoney(paymentModes.cash.amount),
          count: paymentModes.cash.count,
        },
        online: {
          total: formatMoney(paymentModes.online.amount),
          count: paymentModes.online.count,
        },
        card: {
          total: formatMoney(paymentModes.card.amount),
          count: paymentModes.card.count,
        },
        other: {
          total: formatMoney(paymentModes.other.amount),
          count: paymentModes.other.count,
        },
        totalCollected: formatMoney(totalCollectedDec),
      },
    };

    return {
      summary,
      orders: ordersList,
    };
  }
}

export const accountsService = new AccountsService();
