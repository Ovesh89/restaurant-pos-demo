import { STORAGE_KEYS } from '../../../constants/storageKeys.js';
import { ORDER_STATUS } from '../../../constants/orderStatus.js';
import { TABLE_STATUS } from '../../../constants/tableStatus.js';
import { storageAdapter } from '../../storage/localStorageAdapter.js';
import { billingCalculator, DISCOUNT_TYPES } from '../../calculations/billingCalculator.js';
import { orderRepository } from '../orderRepository.js';
import { tableRepository } from '../tableRepository.js';
import { customerRepository } from '../customerRepository.js';
import { auditRepository } from '../auditRepository.js';

export const BILL_STATUS = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED'
};

class BillLocalRepository {
  async getBills(filters = {}) {
    const bills = storageAdapter.getItem(STORAGE_KEYS.BILLS) || [];
    let list = [...bills];

    if (filters.status) {
      list = list.filter((b) => b.status === filters.status);
    }

    if (filters.tableId) {
      list = list.filter((b) => b.tableId === filters.tableId);
    }

    if (filters.orderId) {
      list = list.filter((b) => b.orderId === filters.orderId);
    }

    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        (b) =>
          b.billNo.toLowerCase().includes(q) ||
          b.orderNo.toLowerCase().includes(q) ||
          b.tableNo.toLowerCase().includes(q) ||
          b.customerName?.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const total = list.length;
    let paginated = list;
    if (filters.page || filters.limit) {
      const pageNum = Math.max(1, parseInt(filters.page, 10) || 1);
      const limitNum = Math.max(1, parseInt(filters.limit, 10) || 20);
      const totalPages = Math.max(1, Math.ceil(total / limitNum));
      paginated = list.slice((pageNum - 1) * limitNum, pageNum * limitNum);
      paginated.pagination = {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
        pages: totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      };
    } else {
      paginated.pagination = {
        total,
        page: 1,
        limit: total || 20,
        totalPages: 1,
        pages: 1,
        hasNext: false,
        hasPrev: false,
      };
    }
    paginated.items = paginated;
    return paginated;
  }

  async getBillById(id) {
    const bills = storageAdapter.getItem(STORAGE_KEYS.BILLS) || [];
    return bills.find((b) => b.id === id) || null;
  }

  async getBillByOrderId(orderId) {
    const bills = await this.getBills();
    return bills.find((b) => b.orderId === orderId && b.status !== BILL_STATUS.CANCELLED) || null;
  }

  /**
   * Generates or Updates a final bill for an order using deterministic calculation
   */
  async generateBill({
    order,
    discount = { type: DISCOUNT_TYPES.FIXED, value: 0, reason: '' },
    taxRate = 5.0,
    customer = null,
    actor = { id: 'cashier', name: 'Cashier' }
  }) {
    const bills = storageAdapter.getItem(STORAGE_KEYS.BILLS) || [];

    // Check if open bill already exists for this order
    let existingIndex = bills.findIndex((b) => b.orderId === order.id && b.status !== BILL_STATUS.CANCELLED);
    let billNo = '';

    if (existingIndex > -1) {
      billNo = bills[existingIndex].billNo;
    } else {
      const count = bills.length + 1;
      billNo = `INV-${String(count).padStart(3, '0')}`;
    }

    const existingPayments = existingIndex > -1 ? bills[existingIndex].payments || [] : [];

    // Deterministic financial calculation from canonical order items
    const calc = billingCalculator.calculate({
      items: order.items,
      discount,
      taxRate,
      payments: existingPayments
    });

    const billData = {
      id: existingIndex > -1 ? bills[existingIndex].id : `bill-${Date.now()}`,
      billNo,
      billNumber: billNo,
      orderId: order.id,
      orderNo: order.orderNo,
      orderNumber: order.orderNo,
      tableId: order.tableId,
      tableNo: order.tableNo,
      tableNumber: order.tableNo,
      captainId: order.captainId,
      captainName: order.captainName,
      customerId: customer?.id || null,
      customerName: customer?.name || '',
      customerMobile: customer?.mobile || '',
      items: order.items.map((i) => ({
        productId: i.productId,
        name: i.name,
        code: i.code,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        taxRate: i.taxRate,
        lineSubtotal: (Number(i.quantity) || 1) * (Number(i.unitPrice) || 0)
      })),
      ...calc,
      tax: calc.taxAmount,
      balanceAmount: calc.balance,
      payments: existingPayments,
      status: calc.isSettled ? BILL_STATUS.PAID : BILL_STATUS.PENDING,
      rawStatus: calc.isSettled ? 'COMPLETED' : 'PAYMENT_PENDING',
      generatedBy: actor.name,
      createdAt: existingIndex > -1 ? bills[existingIndex].createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (existingIndex > -1) {
      bills[existingIndex] = billData;
    } else {
      bills.unshift(billData);
    }

    storageAdapter.setItem(STORAGE_KEYS.BILLS, bills);

    // Update order status to BILLING if not yet settled
    if (!calc.isSettled && order.status !== ORDER_STATUS.BILLING) {
      const orders = storageAdapter.getItem(STORAGE_KEYS.ORDERS) || [];
      const ordIdx = orders.findIndex((o) => o.id === order.id);
      if (ordIdx > -1) {
        orders[ordIdx].status = ORDER_STATUS.BILLING;
        storageAdapter.setItem(STORAGE_KEYS.ORDERS, orders);
      }
      if (order.tableId) {
        const tbl = await tableRepository.getTableById(order.tableId);
        if (tbl) {
          await tableRepository.updateOperationalStatus(order.tableId, TABLE_STATUS.BILL_PENDING, order.id, actor);
        }
      }
    }

    await auditRepository.logEvent({
      actorId: actor.id,
      actorName: actor.name,
      action: existingIndex > -1 ? 'BILL_RECALCULATED' : 'BILL_GENERATED',
      entityType: 'Bill',
      entityId: billData.id,
      details: `Generated Invoice ${billData.billNo} for Table ${billData.tableNo}. Grand Total: ₹${billData.grandTotal}.`
    });

    return billData;
  }

  /**
   * Records a payment entry (supports split/mixed payments: Cash, UPI, Card)
   */
  async addPayment(billId, { mode, amount, reference = '' }, actor = { id: 'cashier', name: 'Cashier' }) {
    const paymentAmount = Number(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      throw new Error('Please enter a valid positive payment amount.');
    }

    const bills = storageAdapter.getItem(STORAGE_KEYS.BILLS) || [];
    const index = bills.findIndex((b) => b.id === billId);
    if (index === -1) {
      throw new Error('Bill not found.');
    }

    const bill = bills[index];
    if (bill.status === BILL_STATUS.PAID) {
      throw new Error('This bill is already fully settled and closed.');
    }

    const newPayment = {
      id: `pay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      billId,
      billNo: bill.billNo,
      orderId: bill.orderId,
      mode,
      amount: paymentAmount,
      reference: reference.trim(),
      collectedBy: actor.name,
      timestamp: new Date().toISOString()
    };

    const updatedPayments = [...(bill.payments || []), newPayment];

    // Recalculate financial state
    const calc = billingCalculator.calculate({
      items: bill.items,
      discount: { type: bill.discountType, value: bill.discountValue, reason: bill.discountReason },
      taxRate: bill.taxRate,
      payments: updatedPayments
    });

    bill.payments = updatedPayments;
    bill.paidAmount = calc.paidAmount;
    bill.balance = calc.balance;
    bill.updatedAt = new Date().toISOString();

    const isNowSettled = calc.isSettled;

    if (isNowSettled) {
      bill.status = BILL_STATUS.PAID;
      bill.rawStatus = 'COMPLETED';
      bill.settledAt = new Date().toISOString();
      bill.completedAt = bill.settledAt;
    }

    bills[index] = bill;
    storageAdapter.setItem(STORAGE_KEYS.BILLS, bills);

    // Save payment log
    const allPayments = storageAdapter.getItem(STORAGE_KEYS.PAYMENTS) || [];
    allPayments.unshift(newPayment);
    storageAdapter.setItem(STORAGE_KEYS.PAYMENTS, allPayments);

    await auditRepository.logEvent({
      actorId: actor.id,
      actorName: actor.name,
      action: 'PAYMENT_COLLECTED',
      entityType: 'Payment',
      entityId: newPayment.id,
      details: `Collected ₹${paymentAmount} via ${mode} for ${bill.billNo} (Balance: ₹${calc.balance}).`
    });

    // If fully settled, close the Order & Release the Table!
    if (isNowSettled) {
      // Complete Order
      const orders = storageAdapter.getItem(STORAGE_KEYS.ORDERS) || [];
      const ordIdx = orders.findIndex((o) => o.id === bill.orderId);
      if (ordIdx > -1) {
        orders[ordIdx].status = ORDER_STATUS.COMPLETED;
        orders[ordIdx].updatedAt = new Date().toISOString();
        storageAdapter.setItem(STORAGE_KEYS.ORDERS, orders);
      }

      // Release Table
      if (bill.tableId) {
        const tbl = await tableRepository.getTableById(bill.tableId);
        if (tbl) {
          await tableRepository.updateOperationalStatus(
            bill.tableId,
            TABLE_STATUS.AVAILABLE,
            null,
            actor
          );
        }
      }

      // Record customer spend if linked
      if (bill.customerId) {
        await customerRepository.recordVisitAndSpend(bill.customerId, bill.grandTotal);
      }

      await auditRepository.logEvent({
        actorId: actor.id,
        actorName: actor.name,
        action: 'ORDER_COMPLETED',
        entityType: 'Order',
        entityId: bill.orderId,
        details: `Order ${bill.orderNo} fully settled with Invoice ${bill.billNo}. Table ${bill.tableNo} released to AVAILABLE.`
      });
    }

    return { bill, payment: newPayment, isSettled: isNowSettled };
  }

  async closeBill(billId, actor = { id: 'cashier', name: 'Cashier' }) {
    const bill = await this.getBillById(billId);
    if (!bill) {
      throw new Error('Bill not found.');
    }
    bill.status = BILL_STATUS.PAID;
    bill.rawStatus = 'COMPLETED';
    bill.completedAt = bill.completedAt || new Date().toISOString();
    bill.updatedAt = new Date().toISOString();

    const bills = storageAdapter.getItem(STORAGE_KEYS.BILLS) || [];
    const idx = bills.findIndex((b) => b.id === billId);
    if (idx > -1) {
      bills[idx] = bill;
      storageAdapter.setItem(STORAGE_KEYS.BILLS, bills);
    }
    return bill;
  }

  async applyDiscount(billId, discount, actor = { id: 'cashier', name: 'Cashier' }) {
    const bills = storageAdapter.getItem(STORAGE_KEYS.BILLS) || [];
    const index = bills.findIndex((b) => b.id === billId);
    if (index === -1) throw new Error('Bill not found.');

    const bill = bills[index];
    const calc = billingCalculator.calculateBill({
      items: bill.items,
      discount: {
        type: discount.type || DISCOUNT_TYPES.FIXED,
        value: Number(discount.value) || 0,
        reason: discount.reason || 'Post-settlement discount'
      },
      paidAmount: bill.paidAmount || 0
    });

    const updated = {
      ...bill,
      ...calc,
      tax: calc.taxAmount,
      balanceAmount: calc.balance,
      status: calc.isSettled ? BILL_STATUS.PAID : BILL_STATUS.PENDING,
      rawStatus: calc.isSettled ? 'COMPLETED' : 'PARTIALLY_PAID',
      updatedAt: new Date().toISOString()
    };
    bills[index] = updated;
    storageAdapter.setItem(STORAGE_KEYS.BILLS, bills);

    await auditRepository.logEvent({
      actorId: actor.id,
      actorName: actor.name,
      action: 'BILL_DISCOUNT_APPLIED',
      entityType: 'Bill',
      entityId: bill.id,
      details: `Updated discount on Bill ${bill.billNo}: ${discount.type} ${discount.value}. New Total: ₹${calc.grandTotal}`
    });

    return updated;
  }

  /**
   * Cancel / Void a bill with mandatory reason
   */
  async cancelBill(billId, reason, actor = { id: 'admin', name: 'Admin' }) {
    if (!reason || !reason.trim()) {
      throw new Error('Mandatory cancellation reason required.');
    }

    const bills = storageAdapter.getItem(STORAGE_KEYS.BILLS) || [];
    const index = bills.findIndex((b) => b.id === billId);
    if (index === -1) {
      throw new Error('Bill not found.');
    }

    const bill = bills[index];
    bill.status = BILL_STATUS.CANCELLED;
    bill.cancellationReason = reason.trim();
    bill.updatedAt = new Date().toISOString();

    bills[index] = bill;
    storageAdapter.setItem(STORAGE_KEYS.BILLS, bills);

    await auditRepository.logEvent({
      actorId: actor.id,
      actorName: actor.name,
      action: 'BILL_CANCELLED',
      entityType: 'Bill',
      entityId: billId,
      details: `Invoice ${bill.billNo} was cancelled. Reason: "${reason.trim()}".`
    });

    return bill;
  }
}

export const billLocalRepository = new BillLocalRepository();
