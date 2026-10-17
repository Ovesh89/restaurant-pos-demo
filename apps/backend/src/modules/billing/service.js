import crypto from 'node:crypto';
import { utcNowIso } from '../../repositories/BaseMongoRepository.js';
import { getNextSequence } from '../../utils/sequence.js';
import { Decimal, toDecimal, formatMoney } from '../../utils/decimal.js';
import {
  NotFoundAppError,
  ValidationAppError,
  StateConflictError,
} from '../../middleware/errorHandler.js';
import { branchRepository, tableRepository } from '../restaurant/repositories.js';
import { orderRepository, orderEventRepository } from '../orders/repositories.js';
import { customerRepository } from '../customers/repository.js';
import { auditService } from '../audit/service.js';
import { BillingCalculator } from './calculator.js';
import {
  billRepository,
  discountRepository,
  paymentRepository,
} from './repositories.js';

const VALID_PAYMENT_MODES = ['CASH', 'UPI', 'CARD', 'OTHER'];

class BillingService {
  async generateBill({ orderId, actorId, actorName, discountInput = null }) {
    const order = await orderRepository.findById(orderId);
    if (!order) {
      throw new NotFoundAppError('Order not found.');
    }

    const orderStatus = order.status;
    if (['CANCELLED', 'REJECTED'].includes(orderStatus)) {
      throw new StateConflictError(
        `Cannot generate bill for ${orderStatus.toLowerCase()} order.`
      );
    }

    // Idempotency check: if any bill exists for this order, return it with _isExisting flag
    const existingBill = await billRepository.findOne({ orderId });
    if (existingBill) {
      const payments = await paymentRepository.findByBill(existingBill._id);
      return {
        ...existingBill,
        payments,
        _isExisting: true,
      };
    }

    const activeItems = (order.items || []).filter(
      (it) => (it.status || 'ACTIVE') !== 'CANCELLED'
    );
    if (activeItems.length === 0) {
      throw new ValidationAppError('Cannot generate bill for order without items.');
    }

    const branch = await branchRepository.findById(order.branchId);
    const branchTaxConfig = branch?.taxConfig || { gstRate: '5.00', mode: 'EXCLUSIVE' };

    const calcResult = BillingCalculator.calculateBill({
      items: activeItems,
      discountInput,
      branchTaxConfig,
      paidAmountInput: '0.00',
    });

    const billNumber = await getNextSequence('bill', 'BILL', branch?.code || 'MAIN');
    const now = utcNowIso();

    const billDoc = {
      _id: crypto.randomUUID(),
      billNumber,
      branchId: order.branchId,
      orderId,
      orderNumber: order.orderNumber,
      tableId: order.tableId,
      tableNumber: order.tableNumber,
      captainId: order.captainId,
      captainName: order.captainName,
      customerId: order.customerId || null,
      items: calcResult.items,
      subtotal: calcResult.subtotal,
      discount: calcResult.discount,
      taxableAmount: calcResult.taxableAmount,
      tax: calcResult.tax,
      cgst: calcResult.cgst,
      sgst: calcResult.sgst,
      taxBreakdown: calcResult.taxBreakdown,
      rounding: calcResult.rounding,
      grandTotal: calcResult.grandTotal,
      paidAmount: '0.00',
      balanceAmount: calcResult.grandTotal,
      status: 'PAYMENT_PENDING',
      generatedBy: actorId,
      generatedByName: actorName,
      generatedAt: now,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const serializedBill = await billRepository.insertOne(billDoc);

    if (
      calcResult.discount &&
      calcResult.discount.type !== 'NONE' &&
      toDecimal(calcResult.discount.amount).gt(0)
    ) {
      await discountRepository.recordDiscount({
        branchId: order.branchId,
        billId: serializedBill.id,
        orderId,
        discountType: calcResult.discount.type,
        discountValue: calcResult.discount.value,
        amount: calcResult.discount.amount,
        reason: calcResult.discount.reason || 'Billing discount',
        appliedBy: actorId,
        appliedByName: actorName,
      });
    }

    await orderRepository.updateStatus(orderId, 'BILLING');
    if (order.tableId) {
      await tableRepository.updateById(order.tableId, { status: 'BILL_PENDING' });
    }

    await orderEventRepository.recordEvent({
      orderId,
      branchId: order.branchId,
      eventType: 'BILL_GENERATED',
      fromStatus: orderStatus,
      toStatus: 'BILLING',
      actorId,
      metadata: {
        billId: serializedBill.id,
        billNumber,
        grandTotal: serializedBill.grandTotal,
      },
    });

    await auditService.logAction({
      branchId: order.branchId,
      actorId,
      actorName,
      action: 'BILL_GENERATED',
      entityType: 'BILL',
      entityId: serializedBill.id,
      metadata: {
        billNumber,
        orderId,
        grandTotal: serializedBill.grandTotal,
      },
    });

    return {
      ...serializedBill,
      payments: [],
    };
  }

  async applyDiscount({
    billId,
    discountType,
    discountValue,
    reason,
    actorId,
    actorName,
  }) {
    if (!reason || !String(reason).trim()) {
      throw new ValidationAppError('A mandatory reason is required to apply a discount.');
    }

    const dType = String(discountType || '').toUpperCase();
    if (!['PERCENTAGE', 'FIXED'].includes(dType)) {
      throw new ValidationAppError(
        "Discount type must be either 'PERCENTAGE' or 'FIXED'."
      );
    }

    const bill = await billRepository.findById(billId);
    if (!bill) {
      throw new NotFoundAppError('Bill not found.');
    }

    if (bill.status === 'CANCELLED') {
      throw new StateConflictError('Cannot apply discount to a cancelled bill.');
    }

    const branch = await branchRepository.findById(bill.branchId);
    const branchTaxConfig = branch?.taxConfig || null;

    const trimmedReason = String(reason).trim();
    const calcResult = BillingCalculator.calculateBill({
      items: bill.items || [],
      discountInput: {
        type: dType,
        value: discountValue,
        reason: trimmedReason,
      },
      branchTaxConfig,
      paidAmountInput: bill.paidAmount || '0.00',
    });

    const updatedBill = await billRepository.updateFinancials(billId, calcResult);

    // If the bill was COMPLETED and now has a balance (e.g. discount reduced), status becomes PARTIALLY_PAID
    if (bill.status === 'COMPLETED' && toDecimal(calcResult.balanceAmount).gt(0)) {
      await billRepository.updateById(billId, { status: 'PARTIALLY_PAID' });
      updatedBill.status = 'PARTIALLY_PAID';
    } else if (toDecimal(calcResult.balanceAmount).lte(0) && bill.status !== 'CANCELLED') {
      await billRepository.updateById(billId, { status: 'COMPLETED' });
      updatedBill.status = 'COMPLETED';
    }

    await discountRepository.recordDiscount({
      branchId: bill.branchId,
      billId,
      orderId: bill.orderId,
      discountType: dType,
      discountValue: calcResult.discount.value,
      amount: calcResult.discount.amount,
      reason: trimmedReason,
      appliedBy: actorId,
      appliedByName: actorName,
    });

    await auditService.logAction({
      branchId: bill.branchId,
      actorId,
      actorName,
      action: 'BILL_DISCOUNT_APPLIED',
      entityType: 'BILL',
      entityId: billId,
      reason: trimmedReason,
      metadata: {
        discount: calcResult.discount,
        newGrandTotal: calcResult.grandTotal,
      },
    });

    const payments = await paymentRepository.findByBill(billId);
    return {
      ...updatedBill,
      payments,
    };
  }

  async getBill(billId) {
    const bill = await billRepository.findById(billId);
    if (!bill) {
      throw new NotFoundAppError('Bill not found.');
    }
    const payments = await paymentRepository.findByBill(billId);
    return {
      ...bill,
      payments,
    };
  }

  async listBills(filters = {}) {
    const paginated = await billRepository.listBills(filters);
    const billIds = paginated.items.map((b) => b._id || b.id);
    if (billIds.length > 0) {
      const allPayments = await paymentRepository.findByBillIds(billIds);
      const paymentsByBillId = new Map();
      for (const p of allPayments) {
        const list = paymentsByBillId.get(p.billId) || [];
        list.push(p);
        paymentsByBillId.set(p.billId, list);
      }
      paginated.items = paginated.items.map((b) => ({
        ...b,
        payments: paymentsByBillId.get(b._id || b.id) || [],
      }));
    }
    return paginated;
  }

  async closeBill({ billId, actorId, actorName }) {
    const bill = await billRepository.findById(billId);
    if (!bill) {
      throw new NotFoundAppError('Bill not found.');
    }

    if (bill.status === 'COMPLETED') {
      const payments = await paymentRepository.findByBill(billId);
      return { ...bill, payments };
    }

    if (bill.status === 'CANCELLED') {
      throw new StateConflictError('Cannot close a cancelled bill.');
    }

    const balance = toDecimal(bill.balanceAmount || '0.00');
    if (balance.gt(0)) {
      throw new ValidationAppError(
        `Cannot close bill ${bill.billNumber}: outstanding unpaid balance of ₹${formatMoney(balance)} remaining.`
      );
    }

    const now = utcNowIso();
    const updatedBill = await billRepository.updateById(billId, {
      status: 'COMPLETED',
      completedAt: now,
      updatedAt: now,
    });

    const orderId = bill.orderId;
    if (orderId) {
      await orderRepository.updateStatus(orderId, 'COMPLETED', {
        completedAt: now,
      });
      await orderEventRepository.recordEvent({
        orderId,
        branchId: bill.branchId,
        eventType: 'ORDER_COMPLETED',
        fromStatus: 'BILLING',
        toStatus: 'COMPLETED',
        actorId,
        metadata: { billId, billNumber: bill.billNumber },
      });
    }

    const tableId = bill.tableId;
    if (tableId) {
      await tableRepository.updateById(tableId, {
        status: 'AVAILABLE',
        activeOrderId: null,
      });
    }

    const customerId = bill.customerId;
    if (customerId) {
      await customerRepository.recordVisitAndSpend(
        customerId,
        bill.grandTotal || '0.00'
      );
    }

    await auditService.logAction({
      branchId: bill.branchId,
      actorId,
      actorName,
      action: 'BILL_CLOSED',
      entityType: 'BILL',
      entityId: billId,
      metadata: {
        billNumber: bill.billNumber,
        orderId,
        grandTotal: bill.grandTotal,
      },
    });

    const payments = await paymentRepository.findByBill(billId);
    return {
      ...updatedBill,
      payments,
    };
  }

  async getPrintPayload(billId) {
    const bill = await this.getBill(billId);
    const branch = (await branchRepository.findById(bill.branchId)) || {};
    const customer = bill.customerId
      ? await customerRepository.findById(bill.customerId)
      : null;

    const itemsFormatted = (bill.items || []).map((it, idx) => ({
      index: idx + 1,
      productId: it.productId,
      name: it.productName || it.name || '',
      productName: it.productName || it.name || '',
      quantity: it.quantity || 1,
      unitPrice: it.unitPrice || '0.00',
      lineSubtotal: it.lineSubtotal || '0.00',
      total: it.lineSubtotal || '0.00',
    }));

    const order = bill.orderId ? await orderRepository.findById(bill.orderId) : null;
    const captainName = bill.captainName || order?.captainName || '';

    return {
      billId: bill._id,
      billNumber: bill.billNumber,
      orderId: bill.orderId,
      orderNumber: bill.orderNumber,
      tableNumber: bill.tableNumber,
      status: bill.status,
      generatedAt: bill.generatedAt,
      header: {
        storeName: branch.name || 'Restaurant POS',
        restaurantName: branch.name || 'Restaurant POS',
        address: branch.address || '',
        branchAddress: branch.address || '',
        phone: branch.phone || '',
        branchPhone: branch.phone || '',
        gstin: branch.gstin || branch.taxConfig?.gstin || '',
      },
      invoice: {
        billNumber: bill.billNumber,
        orderNumber: bill.orderNumber,
        tableNumber: bill.tableNumber,
        date: bill.generatedAt,
        billedBy: bill.generatedByName,
        captainName,
        customerName: customer?.name || null,
        customerMobile: customer?.mobile || customer?.phone || null,
      },
      items: itemsFormatted,
      subtotal: bill.subtotal,
      discount: bill.discount,
      taxableAmount: bill.taxableAmount,
      tax: bill.tax,
      cgst: bill.cgst,
      sgst: bill.sgst,
      taxBreakdown: bill.taxBreakdown,
      rounding: bill.rounding,
      grandTotal: bill.grandTotal,
      paidAmount: bill.paidAmount,
      balanceAmount: bill.balanceAmount,
      financials: {
        subtotal: bill.subtotal,
        discount: bill.discount,
        taxableAmount: bill.taxableAmount,
        tax: bill.tax,
        cgst: bill.cgst,
        sgst: bill.sgst,
        rounding: bill.rounding,
        grandTotal: bill.grandTotal,
        paidAmount: bill.paidAmount,
        balanceAmount: bill.balanceAmount,
      },
      payments: bill.payments || [],
      footer: {
        terms: branch.invoiceConfig?.terms || 'Thank you for dining with us.',
        message: branch.invoiceConfig?.terms || 'Thank you for dining with us.',
      },
    };
  }
}

class PaymentService {
  async addPayment({
    billId,
    mode,
    amount,
    referenceNumber = null,
    idempotencyKey = null,
    actorId,
    actorName,
  }) {
    if (idempotencyKey) {
      const existingPayment = await paymentRepository.findByIdempotencyKey(idempotencyKey);
      if (existingPayment) {
        const currentBill = await billingService.getBill(billId);
        return {
          payment: existingPayment,
          bill: currentBill,
          isDuplicate: true,
        };
      }
    }

    const cleanMode = String(mode || '').toUpperCase().trim();
    if (!VALID_PAYMENT_MODES.includes(cleanMode)) {
      throw new ValidationAppError(
        `Invalid payment mode '${mode}'. Must be one of: ${VALID_PAYMENT_MODES.join(', ')}.`
      );
    }

    const bill = await billRepository.findById(billId);
    if (!bill) {
      throw new NotFoundAppError('Bill not found.');
    }

    if (['COMPLETED', 'CANCELLED'].includes(bill.status)) {
      throw new StateConflictError(
        `Cannot add payment to a ${bill.status.toLowerCase()} bill.`
      );
    }

    let payAmt;
    try {
      payAmt = toDecimal(amount);
    } catch {
      throw new ValidationAppError('Payment amount must be a valid number.');
    }

    if (payAmt.lte(0)) {
      throw new ValidationAppError('Payment amount must be greater than zero.');
    }

    const currentBalance = toDecimal(bill.balanceAmount || '0.00');
    if (payAmt.gt(currentBalance)) {
      throw new ValidationAppError(
        `Payment amount of ₹${formatMoney(payAmt)} exceeds outstanding balance of ₹${formatMoney(currentBalance)}.`
      );
    }

    const now = utcNowIso();
    const paymentDoc = {
      _id: crypto.randomUUID(),
      branchId: bill.branchId,
      billId,
      orderId: bill.orderId,
      mode: cleanMode,
      amount: formatMoney(payAmt),
      referenceNumber: referenceNumber ? String(referenceNumber).trim() : null,
      collectedBy: actorId,
      collectedByName: actorName,
      collectedAt: now,
      status: 'VALID',
      ...(idempotencyKey ? { idempotencyKey: String(idempotencyKey).trim() } : {}),
      createdAt: now,
      updatedAt: now,
    };

    const createdPayment = await paymentRepository.recordPayment(paymentDoc);

    const currentPaid = toDecimal(bill.paidAmount || '0.00');
    const newPaid = currentPaid.plus(payAmt);
    const grandTotal = toDecimal(bill.grandTotal || '0.00');
    const newBalance = Decimal.max(0, grandTotal.minus(newPaid));
    const newStatus = newBalance.eq(0) ? 'PAID' : 'PAYMENT_PENDING';

    const updatedBill = await billRepository.updateById(billId, {
      paidAmount: formatMoney(newPaid),
      balanceAmount: formatMoney(newBalance),
      status: newStatus,
      updatedAt: now,
    });

    if (newBalance.eq(0) && bill.tableId) {
      await tableRepository.updateById(bill.tableId, { status: 'PAID' });
    }

    await auditService.logAction({
      branchId: bill.branchId,
      actorId,
      actorName,
      action: 'PAYMENT_COLLECTED',
      entityType: 'PAYMENT',
      entityId: createdPayment.id,
      metadata: {
        billId,
        billNumber: bill.billNumber,
        mode: cleanMode,
        amount: formatMoney(payAmt),
        newBalance: formatMoney(newBalance),
      },
    });

    const allPayments = await paymentRepository.findByBill(billId);
    return {
      payment: createdPayment,
      bill: {
        ...updatedBill,
        payments: allPayments,
      },
      isDuplicate: false,
    };
  }

  async listPayments(billId) {
    return paymentRepository.findByBill(billId);
  }
}

export const billingService = new BillingService();
export const paymentService = new PaymentService();
