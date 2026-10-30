import { apiClient } from '../../api/apiClient.js';
import { APP_CONFIG } from '../../../config/appConfig.js';
import { BILL_STATUS } from '../local/billLocalRepository.js';

class BillApiRepository {
  normalizeBill(bill) {
    if (!bill) return null;

    const items = (bill.items || []).map((it) => {
      const unitPrice = Number(it.unitPrice !== undefined ? it.unitPrice : it.price) || 0;
      const qty = Number(it.quantity || 1);
      const taxRate = Number(
        it.taxConfig?.rate !== undefined
          ? it.taxConfig.rate
          : it.taxRate !== undefined
          ? it.taxRate
          : 5
      );
      const lineSubtotal = Number(
        it.lineSubtotal !== undefined
          ? it.lineSubtotal
          : unitPrice * qty
      );

      return {
        productId: it.productId,
        name: it.productName || it.name || '',
        productName: it.productName || it.name || '',
        code: it.code || '',
        quantity: qty,
        unitPrice,
        taxRate,
        lineSubtotal
      };
    });

    const payments = (bill.payments || []).map((p) => ({
      id: p.id || p._id,
      billId: p.billId || bill.id || bill._id,
      billNo: bill.billNumber || bill.billNo || '',
      orderId: bill.orderId,
      mode: p.mode || 'CASH',
      amount: Number(p.amount || 0),
      reference: p.referenceNumber || p.reference || '',
      collectedBy: p.collectedByName || p.collectedBy || 'Cashier',
      timestamp: p.collectedAt || p.timestamp || bill.createdAt
    }));

    const billNo = bill.billNumber || bill.billNo || '';
    const orderNo = bill.orderNumber || bill.orderNo || '';
    const tableNo = bill.tableNumber || bill.tableNo || '';

    const subtotal = Number(bill.subtotal || 0);
    const discountAmount = Number(
      bill.discount?.amount !== undefined ? bill.discount.amount : (bill.discountAmount || 0)
    );
    const discountType = bill.discount?.type || bill.discountType || 'FIXED';
    const discountValue = Number(
      bill.discount?.value !== undefined ? bill.discount.value : (bill.discountValue || 0)
    );
    const discountReason = bill.discount?.reason || bill.discountReason || '';

    const taxableValue = Number(
      bill.taxableAmount !== undefined
        ? bill.taxableAmount
        : bill.taxableValue !== undefined
        ? bill.taxableValue
        : Math.max(0, subtotal - discountAmount)
    );

    const taxAmount = Number(bill.tax !== undefined ? bill.tax : (bill.taxAmount || 0));

    let cgst = Number(bill.cgst !== undefined ? bill.cgst : (bill.cgstAmount || 0));
    let sgst = Number(bill.sgst !== undefined ? bill.sgst : (bill.sgstAmount || 0));
    if (cgst === 0 && sgst === 0 && taxAmount > 0) {
      cgst = Math.round((taxAmount / 2) * 100) / 100;
      sgst = Math.round((taxAmount - cgst) * 100) / 100;
    }

    const taxRate = Number(
      bill.taxRate !== undefined
        ? bill.taxRate
        : (bill.taxBreakdown?.[0]?.rate !== undefined && bill.taxBreakdown?.[1]?.rate !== undefined)
        ? (Number(bill.taxBreakdown[0].rate) + Number(bill.taxBreakdown[1].rate))
        : (bill.taxBreakdown?.[0]?.rate !== undefined ? Number(bill.taxBreakdown[0].rate) * 2 : 5)
    );

    const rounding = Number(bill.rounding || 0);
    const grandTotal = Number(bill.grandTotal || 0);
    const paidAmount = Number(bill.paidAmount || 0);
    const balance = Number(
      bill.balanceAmount !== undefined
        ? bill.balanceAmount
        : bill.balance !== undefined
        ? bill.balance
        : Math.max(0, grandTotal - paidAmount)
    );

    const rawStatus = bill.status || 'PAYMENT_PENDING';
    let status = BILL_STATUS.PENDING;
    if (rawStatus === 'COMPLETED' || rawStatus === 'PAID') {
      status = BILL_STATUS.PAID;
    } else if (rawStatus === 'CANCELLED') {
      status = BILL_STATUS.CANCELLED;
    }

    return {
      id: bill.id || bill._id,
      _id: bill.id || bill._id,
      billNo,
      billNumber: billNo,
      orderId: bill.orderId,
      orderNo,
      orderNumber: orderNo,
      tableId: bill.tableId,
      tableNo,
      tableNumber: tableNo,
      captainId: bill.captainId,
      captainName: bill.captainName || 'Staff',
      customerId: bill.customerId || null,
      customerName: bill.customerName || '',
      customerMobile: bill.customerMobile || '',
      items,
      subtotal,
      discountAmount,
      discountType,
      discountValue,
      discountReason,
      taxableValue,
      taxableAmount: taxableValue,
      taxRate,
      cgst,
      cgstAmount: cgst,
      sgst,
      sgstAmount: sgst,
      taxAmount,
      tax: taxAmount,
      rounding,
      grandTotal,
      paidAmount,
      balance,
      balanceAmount: balance,
      payments,
      status,
      rawStatus,
      isSettled: balance <= 0,
      generatedBy: bill.generatedByName || bill.generatedBy || 'Cashier',
      createdAt: bill.generatedAt || bill.createdAt,
      updatedAt: bill.updatedAt,
      completedAt: bill.completedAt || null
    };
  }

  async getBills(filters = {}) {
    const params = {
      branchId: filters.branchId || APP_CONFIG.DEFAULT_BRANCH_ID || 'branch-main',
    };

    if (filters.page) {
      params.page = filters.page;
    }
    if (filters.limit) {
      params.limit = filters.limit;
    } else if (!filters.page) {
      params.limit = 100;
    }

    if (filters.status) {
      if (filters.status === BILL_STATUS.PAID) {
        params.status = 'COMPLETED';
      } else if (filters.status === BILL_STATUS.PENDING) {
        params.status = 'PAYMENT_PENDING';
      } else {
        params.status = filters.status;
      }
    }

    if (filters.orderId) {
      params.orderId = filters.orderId;
    }

    if (filters.dateFrom) {
      params.dateFrom = filters.dateFrom;
    }

    if (filters.dateTo) {
      params.dateTo = filters.dateTo;
    }

    if (filters.search && String(filters.search).trim()) {
      params.search = String(filters.search).trim();
    }

    const res = await apiClient.get('/bills', { params });
    const rawList = Array.isArray(res) ? res : (res?.items || []);
    let list = rawList.map((b) => this.normalizeBill(b));

    const total = Number(res?.pagination?.total ?? list.length);
    const pageNum = Number(res?.pagination?.page ?? filters.page ?? 1);
    const limitNum = Number(res?.pagination?.limit ?? filters.limit ?? list.length ?? 20);
    const totalPages = Number(res?.pagination?.totalPages ?? res?.pagination?.pages ?? Math.max(1, Math.ceil(total / (limitNum || 1))));

    list.pagination = res?.pagination || {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages,
      pages: totalPages,
      hasNext: pageNum < totalPages,
      hasPrev: pageNum > 1,
    };
    list.items = list;

    return list;
  }

  async getBillById(id) {
    if (!id) return null;
    const res = await apiClient.get(`/bills/${id}`);
    return this.normalizeBill(res);
  }

  async getBillByOrderId(orderId) {
    if (!orderId) return null;
    const bills = await this.getBills({ orderId });
    return bills.find((b) => b.status !== BILL_STATUS.CANCELLED) || null;
  }

  async generateBill({
    order,
    discount = { type: 'FIXED', value: 0, reason: '' },
    taxRate = 5.0,
    customer = null,
    actor = { id: 'cashier', name: 'Cashier' },
    completeOrder = false,
  }) {
    const isCaptain = String(actor?.role || '').toLowerCase() === 'captain';
    const payload = {};
    if (isCaptain || completeOrder) {
      payload.completeOrder = true;
      payload.releaseTable = true;
    }
    const hasDiscount = !isCaptain && discount && Number(discount.value) > 0;
    if (hasDiscount) {
      payload.discount = {
        type: String(discount.type || 'FIXED').toUpperCase(),
        value: String(discount.value || '0'),
        reason: discount.reason?.trim() || 'Billing discount'
      };
    }

    const res = await apiClient.post(`/orders/${order.id}/bill`, payload);
    let bill = this.normalizeBill(res);

    // If an existing bill was retrieved and a new discount is requested, apply via /bills/{id}/discount
    if (!isCaptain && hasDiscount && bill?.id) {
      const currentDiscVal = Number(bill.discountValue || 0);
      const reqDiscVal = Number(discount.value);
      if (currentDiscVal !== reqDiscVal || bill.discountType !== String(discount.type || 'FIXED').toUpperCase()) {
        try {
          const updatedBill = await apiClient.post(`/bills/${bill.id}/discount`, {
            type: String(discount.type || 'FIXED').toUpperCase(),
            value: String(discount.value || '0'),
            reason: discount.reason?.trim() || 'Billing discount'
          });
          bill = this.normalizeBill(updatedBill);
        } catch (discErr) {
          console.warn('Failed to apply discount to existing bill:', discErr);
        }
      }
    }

    return bill;
  }

  async applyDiscount(billId, discount, actor = { id: 'cashier', name: 'Cashier' }) {
    if (String(actor?.role || '').toLowerCase() === 'captain') {
      throw new Error('Captains are not permitted to apply discounts.');
    }
    const payload = {
      type: String(discount.type || 'FIXED').toUpperCase(),
      value: String(discount.value || '0'),
      reason: discount.reason?.trim() || 'Post-settlement discount'
    };
    const res = await apiClient.post(`/bills/${billId}/discount`, payload);
    return this.normalizeBill(res);
  }

  async addPayment(billId, { mode, amount, reference = '' }, actor = { id: 'cashier', name: 'Cashier' }) {
    const paymentAmount = Number(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      throw new Error('Please enter a valid positive payment amount.');
    }

    const payload = {
      mode: String(mode).toUpperCase().trim(),
      amount: String(paymentAmount),
      referenceNumber: reference?.trim() || undefined,
      idempotencyKey: `pay-${billId}-${Date.now()}`
    };

    const res = await apiClient.post(`/bills/${billId}/payments`, payload);
    let bill = this.normalizeBill(res?.bill);
    const payment = res?.payment;

    // Check if fully settled (balance <= 0) and close bill to release table and complete order
    const isNowSettled = bill ? bill.balance <= 0 : false;
    if (isNowSettled && bill && bill.rawStatus !== 'COMPLETED') {
      try {
        const closedRes = await apiClient.post(`/bills/${billId}/close`);
        bill = this.normalizeBill(closedRes);
      } catch (err) {
        console.warn('Auto-closing bill completed with warning:', err.message);
      }
    }

    return { bill, payment, isSettled: isNowSettled };
  }

  async closeBill(billId, actor = { id: 'cashier', name: 'Cashier' }) {
    if (String(actor?.role || '').toLowerCase() === 'captain') {
      throw new Error('Captains are not permitted to alter or close bills.');
    }
    const closedRes = await apiClient.post(`/bills/${billId}/close`);
    return this.normalizeBill(closedRes);
  }

  async cancelBill(billId, reason, actor = { id: 'admin', name: 'Admin' }) {
    if (String(actor?.role || '').toLowerCase() === 'captain') {
      throw new Error('Captains are not permitted to alter or cancel bills.');
    }
    if (!reason || !reason.trim()) {
      throw new Error('Mandatory cancellation reason required.');
    }

    // Backend bills status update or audit log
    const bill = await this.getBillById(billId);
    if (bill) {
      bill.status = BILL_STATUS.CANCELLED;
      bill.cancellationReason = reason.trim();
    }
    return bill;
  }

  async getPrintPayload(billId) {
    return await apiClient.get(`/bills/${billId}/print`);
  }
}

export const billApiRepository = new BillApiRepository();
