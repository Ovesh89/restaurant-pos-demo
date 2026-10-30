import crypto from 'node:crypto';
import {
  BaseMongoRepository,
  paginateMongoQuery,
  utcNowIso,
} from '../../repositories/BaseMongoRepository.js';

export class BillRepository extends BaseMongoRepository {
  constructor() {
    super('bills');
  }

  async findByOrder(orderId) {
    return this.findMany({ orderId }, { sort: { createdAt: -1 } });
  }

  async findActiveByOrder(orderId) {
    return this.findOne({
      orderId,
      status: { $in: ['PENDING', 'PAYMENT_PENDING', 'PARTIALLY_PAID', 'PAID'] },
    });
  }

  async findByBillNumber(branchId, billNumber) {
    return this.findOne({ branchId, billNumber });
  }

  async listBills({
    branchId,
    status = null,
    orderId = null,
    customerId = null,
    dateFrom = null,
    dateTo = null,
    search = null,
    page = 1,
    limit = 20,
  }) {
    const filterQuery = {};
    if (branchId) {
      filterQuery.branchId = branchId;
    }
    if (status) {
      if (typeof status === 'string' && status.includes(',')) {
        filterQuery.status = {
          $in: status
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        };
      } else {
        filterQuery.status = status;
      }
    }
    if (orderId) {
      filterQuery.orderId = orderId;
    }
    if (customerId) {
      filterQuery.customerId = customerId;
    }
    if (dateFrom || dateTo) {
      filterQuery.generatedAt = {};
      if (dateFrom) {
        filterQuery.generatedAt.$gte = /^\d{4}-\d{2}-\d{2}$/.test(dateFrom)
          ? `${dateFrom}T00:00:00.000Z`
          : dateFrom;
      }
      if (dateTo) {
        filterQuery.generatedAt.$lte = /^\d{4}-\d{2}-\d{2}$/.test(dateTo)
          ? `${dateTo}T23:59:59.999Z`
          : dateTo;
      }
    }
    if (search && String(search).trim()) {
      const qClean = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filterQuery.$or = [
        { billNumber: { $regex: qClean, $options: 'i' } },
        { billNo: { $regex: qClean, $options: 'i' } },
        { orderNumber: { $regex: qClean, $options: 'i' } },
        { orderNo: { $regex: qClean, $options: 'i' } },
        { tableNumber: { $regex: qClean, $options: 'i' } },
        { tableNo: { $regex: qClean, $options: 'i' } },
        { customerName: { $regex: qClean, $options: 'i' } },
        { customerMobile: { $regex: qClean, $options: 'i' } },
      ];
    }

    return paginateMongoQuery(this, filterQuery, {
      page,
      limit,
      sort: { generatedAt: -1, createdAt: -1 },
    });
  }

  async updateFinancials(billId, calcResult) {
    const now = utcNowIso();
    return this.updateById(billId, {
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
      paidAmount: calcResult.paidAmount,
      balanceAmount: calcResult.balanceAmount,
      updatedAt: now,
    });
  }
}

export class DiscountRepository extends BaseMongoRepository {
  constructor() {
    super('discounts');
  }

  async recordDiscount({
    branchId,
    billId,
    orderId,
    discountType,
    discountValue,
    amount,
    reason,
    appliedBy,
    appliedByName,
  }) {
    const now = utcNowIso();
    const doc = {
      _id: crypto.randomUUID(),
      branchId,
      billId,
      orderId,
      type: discountType,
      value: String(discountValue),
      amount: String(amount),
      reason,
      appliedBy,
      appliedByName,
      appliedAt: now,
      createdAt: now,
    };
    return this.insertOne(doc);
  }

  async listByBill(billId) {
    return this.findMany({ billId }, { sort: { appliedAt: -1 } });
  }
}

export class PaymentRepository extends BaseMongoRepository {
  constructor() {
    super('payments');
  }

  async findByBill(billId) {
    return this.findMany({ billId }, { sort: { collectedAt: 1, createdAt: 1 } });
  }

  async findByBillIds(billIds = []) {
    if (!Array.isArray(billIds) || billIds.length === 0) return [];
    return this.findMany(
      { billId: { $in: billIds } },
      { sort: { collectedAt: 1, createdAt: 1 } }
    );
  }

  async findByIdempotencyKey(idempotencyKey) {
    if (!idempotencyKey) return null;
    return this.findOne({ idempotencyKey: String(idempotencyKey) });
  }

  async recordPayment(paymentDoc) {
    return this.insertOne(paymentDoc);
  }
}

export const billRepository = new BillRepository();
export const discountRepository = new DiscountRepository();
export const paymentRepository = new PaymentRepository();
