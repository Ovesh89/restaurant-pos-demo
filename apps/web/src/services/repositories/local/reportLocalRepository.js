import { STORAGE_KEYS } from '../../../constants/storageKeys.js';
import { storageAdapter } from '../../storage/localStorageAdapter.js';
import { BILL_STATUS } from '../billRepository.js';

class ReportLocalRepository {
  /**
   * Generates aggregated sales report within an optional date range
   */
  async getSalesReport({ startDate = null, endDate = null } = {}) {
    const bills = storageAdapter.getItem(STORAGE_KEYS.BILLS) || [];
    const payments = storageAdapter.getItem(STORAGE_KEYS.PAYMENTS) || [];

    // Filter paid bills
    let paidBills = bills.filter((b) => b.status === BILL_STATUS.PAID);

    if (startDate) {
      const s = new Date(startDate).getTime();
      paidBills = paidBills.filter((b) => new Date(b.createdAt).getTime() >= s);
    }

    if (endDate) {
      const e = new Date(endDate).getTime();
      paidBills = paidBills.filter((b) => new Date(b.createdAt).getTime() <= e);
    }

    // Totals
    const totalOrdersCount = paidBills.length;
    const totalSubtotal = paidBills.reduce((acc, b) => acc + (b.subtotal || 0), 0);
    const totalDiscount = paidBills.reduce((acc, b) => acc + (b.discountAmount || 0), 0);
    const totalTax = paidBills.reduce((acc, b) => acc + (b.taxAmount || 0), 0);
    const totalNetSales = paidBills.reduce((acc, b) => acc + (b.grandTotal || 0), 0);

    // Payment Modes Breakdown
    const paymentBreakdown = {
      CASH: 0,
      UPI: 0,
      CARD: 0,
      OTHER: 0
    };

    paidBills.forEach((b) => {
      (b.payments || []).forEach((p) => {
        const mode = p.mode?.toUpperCase() || 'OTHER';
        paymentBreakdown[mode] = (paymentBreakdown[mode] || 0) + Number(p.amount || 0);
      });
    });

    // Item-Wise Sales breakdown
    const itemMap = {};
    paidBills.forEach((b) => {
      (b.items || []).forEach((itm) => {
        if (!itemMap[itm.name]) {
          itemMap[itm.name] = {
            name: itm.name,
            code: itm.code || '',
            quantity: 0,
            revenue: 0
          };
        }
        itemMap[itm.name].quantity += Number(itm.quantity || 0);
        itemMap[itm.name].revenue += Number(itm.quantity || 0) * Number(itm.unitPrice || 0);
      });
    });

    const itemSales = Object.values(itemMap).sort((a, b) => b.revenue - a.revenue);

    // Captain-Wise Sales breakdown
    const captainMap = {};
    paidBills.forEach((b) => {
      const capName = b.captainName || 'Staff';
      if (!captainMap[capName]) {
        captainMap[capName] = {
          name: capName,
          ordersCount: 0,
          totalSales: 0
        };
      }
      captainMap[capName].ordersCount += 1;
      captainMap[capName].totalSales += b.grandTotal;
    });

    const captainSales = Object.values(captainMap).sort((a, b) => b.totalSales - a.totalSales);

    return {
      totalOrdersCount,
      totalSubtotal,
      totalDiscount,
      totalTax,
      totalNetSales,
      paymentBreakdown,
      itemSales,
      captainSales
    };
  }
}

export const reportLocalRepository = new ReportLocalRepository();
