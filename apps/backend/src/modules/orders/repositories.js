import crypto from 'node:crypto';
import {
  BaseMongoRepository,
  paginateMongoQuery,
  utcNowIso,
  serializeMongoDoc,
} from '../../repositories/BaseMongoRepository.js';

export function expandTableIdAliases(tableId) {
  if (!tableId || typeof tableId !== 'string') return [];
  const ids = [tableId];
  if (tableId.startsWith('table-')) {
    ids.push(`tbl-${tableId.slice(6)}`);
  } else if (tableId.startsWith('tbl-')) {
    ids.push(`table-${tableId.slice(4)}`);
  }
  return [...new Set(ids)];
}

export class OrderRepository extends BaseMongoRepository {
  constructor() {
    super('orders');
  }

  async findById(docId, projection = null) {
    if (!docId) return null;
    const col = await this.collection();
    const strId = String(docId);
    const doc = await col.findOne(
      {
        $or: [
          { _id: strId },
          { id: strId },
          { orderNumber: strId },
        ],
      },
      projection ? { projection } : undefined
    );
    return serializeMongoDoc(doc);
  }

  async findActiveByTable(branchId, tableId) {
    const aliases = expandTableIdAliases(tableId);
    const query = {
      branchId,
      tableId: aliases.length > 1 ? { $in: aliases } : tableId,
      status: { $nin: ['COMPLETED', 'CANCELLED', 'REJECTED'] },
    };
    return this.findOne(query);
  }

  async findByOrderNumber(branchId, orderNumber) {
    return this.findOne({ branchId, orderNumber });
  }

  async listOrders({
    branchId = null,
    status = null,
    tableId = null,
    captainId = null,
    customerId = null,
    dateFrom = null,
    dateTo = null,
    search = null,
    page = 1,
    limit = 20,
  } = {}) {
    const query = {};
    if (branchId) {
      query.branchId = branchId;
    }

    if (status) {
      const rawStatuses = Array.isArray(status)
        ? status
        : String(status)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);

      const expandedStatuses = new Set(rawStatuses);
      // Decision 8 Compatibility Shim: alias BILLING <-> BILL_PENDING
      if (expandedStatuses.has('BILLING') || expandedStatuses.has('BILL_PENDING')) {
        expandedStatuses.add('BILLING');
        expandedStatuses.add('BILL_PENDING');
      }

      // Hold / Draft Compatibility Shim
      if (expandedStatuses.has('HOLD') || expandedStatuses.has('DRAFT')) {
        expandedStatuses.add('HOLD');
        expandedStatuses.add('DRAFT');
      }

      const statusList = [...expandedStatuses];
      if (statusList.length === 2 && expandedStatuses.has('HOLD') && expandedStatuses.has('DRAFT')) {
        query.status = { $in: ['HOLD', 'DRAFT'] };
      } else if (statusList.length === 1) {
        query.status = statusList[0];
      } else if (statusList.length > 1) {
        query.status = { $in: statusList };
      }
    }

    if (tableId) {
      const aliases = expandTableIdAliases(tableId);
      query.tableId = aliases.length > 1 ? { $in: aliases } : tableId;
    }

    if (captainId) {
      query.captainId = captainId;
    }

    if (customerId) {
      query.customerId = customerId;
    }

    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = dateFrom;
      if (dateTo) {
        query.createdAt.$lte = /^\d{4}-\d{2}-\d{2}$/.test(dateTo)
          ? `${dateTo}T23:59:59.999Z`
          : dateTo;
      }
    }

    if (search && String(search).trim()) {
      const qClean = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { orderNumber: { $regex: qClean, $options: 'i' } },
        { orderNo: { $regex: qClean, $options: 'i' } },
        { tableNumber: { $regex: qClean, $options: 'i' } },
        { tableNo: { $regex: qClean, $options: 'i' } },
        { captainName: { $regex: qClean, $options: 'i' } },
      ];
    }

    return paginateMongoQuery(this, query, {
      page,
      limit,
      sort: { createdAt: -1 },
    });
  }

  async updateStatus(orderId, newStatus, extraFields = {}) {
    const updateData = {
      status: newStatus,
      updatedAt: utcNowIso(),
      ...extraFields,
    };
    return this.updateById(orderId, updateData);
  }
}

export class OrderEventRepository extends BaseMongoRepository {
  constructor() {
    super('order_events');
  }

  async recordEvent({
    orderId,
    branchId,
    eventType,
    fromStatus = null,
    toStatus,
    actorId,
    reason = null,
    metadata = {},
  }) {
    const now = utcNowIso();
    const doc = {
      _id: crypto.randomUUID(),
      orderId,
      branchId,
      type: eventType,
      eventType,
      fromStatus,
      toStatus,
      actorId,
      reason,
      metadata: metadata || {},
      timestamp: now,
      createdAt: now,
    };
    return this.insertOne(doc);
  }

  async listEventsForOrder(orderId) {
    return this.findMany({ orderId }, { sort: { timestamp: 1, createdAt: 1 } });
  }
}

export const orderRepository = new OrderRepository();
export const orderEventRepository = new OrderEventRepository();
