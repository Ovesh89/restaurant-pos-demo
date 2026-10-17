import { apiClient } from '../../api/apiClient.js';
import { APP_CONFIG } from '../../../config/appConfig.js';

class ReportApiRepository {
  async getSalesReport({ startDate = null, endDate = null } = {}) {
    const params = {
      branchId: APP_CONFIG.DEFAULT_BRANCH_ID || 'branch-main'
    };

    if (startDate) {
      params.dateFrom = startDate;
    }

    if (endDate) {
      params.dateTo = endDate;
    }

    // Query backend report endpoints in parallel
    const [salesRes, itemsRes, captainsRes, paymentsRes] = await Promise.all([
      apiClient.get('/reports/sales', { params }).catch((err) => {
        console.warn('Failed to fetch sales summary report:', err.message);
        return {};
      }),
      apiClient.get('/reports/items', { params }).catch((err) => {
        console.warn('Failed to fetch items report:', err.message);
        return [];
      }),
      apiClient.get('/reports/captains', { params }).catch((err) => {
        console.warn('Failed to fetch captains report:', err.message);
        return [];
      }),
      apiClient.get('/reports/payments', { params }).catch((err) => {
        console.warn('Failed to fetch payments report:', err.message);
        return [];
      })
    ]);

    const totalOrdersCount = Number(salesRes?.totalBills || 0);
    const totalSubtotal = Number(salesRes?.totalSubtotal || 0);
    const totalDiscount = Number(salesRes?.totalDiscount || 0);
    const totalTax = Number(salesRes?.totalTax || 0);
    const totalNetSales = Number(salesRes?.totalSales || 0);

    // Map Payment breakdown modes
    const paymentBreakdown = {
      CASH: 0,
      UPI: 0,
      CARD: 0,
      OTHER: 0
    };

    const paymentsList = Array.isArray(paymentsRes) ? paymentsRes : (paymentsRes?.items || []);
    paymentsList.forEach((p) => {
      const mode = (p.mode || 'OTHER').toUpperCase().trim();
      const amt = Number(p.totalAmount !== undefined ? p.totalAmount : p.amount || 0);
      if (paymentBreakdown[mode] !== undefined) {
        paymentBreakdown[mode] += amt;
      } else {
        paymentBreakdown.OTHER += amt;
      }
    });

    // Map item-wise sales
    const itemsList = Array.isArray(itemsRes) ? itemsRes : (itemsRes?.items || []);
    const itemSales = itemsList.map((i) => ({
      name: i.name || i.productName || 'Dish',
      code: i.code || '',
      quantity: Number(i.quantity || 0),
      revenue: Number(i.revenue || i.totalRevenue || 0)
    }));

    // Map captain-wise sales
    const captainsList = Array.isArray(captainsRes) ? captainsRes : (captainsRes?.items || []);
    const captainSales = captainsList.map((c) => ({
      name: c.name || c.captainName || 'Staff',
      ordersCount: Number(c.orderCount !== undefined ? c.orderCount : c.ordersCount || 0),
      totalSales: Number(c.totalSales || c.revenue || 0)
    }));

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

export const reportApiRepository = new ReportApiRepository();
