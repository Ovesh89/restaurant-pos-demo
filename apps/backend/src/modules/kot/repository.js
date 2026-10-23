import {
  BaseMongoRepository,
  paginateMongoQuery,
} from '../../repositories/BaseMongoRepository.js';

export class KOTRepository extends BaseMongoRepository {
  constructor() {
    super('kots');
  }

  async findByOrder(orderId) {
    return this.findMany({ orderId }, { sort: { revision: 1, createdAt: 1 } });
  }

  async findByOrderIds(orderIds = []) {
    if (!Array.isArray(orderIds) || orderIds.length === 0) return [];
    return this.findMany(
      { orderId: { $in: orderIds } },
      { sort: { revision: 1, createdAt: 1 } }
    );
  }

  async getNextRevision(orderId) {
    const count = await this.count({ orderId });
    return count + 1;
  }

  async findByKotNumber(branchId, kotNumber) {
    return this.findOne({ branchId, kotNumber });
  }

  async listKots({
    branchId = null,
    status = null,
    orderId = null,
    kitchenStation = null,
    dateFrom = null,
    dateTo = null,
    page = 1,
    limit = 50,
  } = {}) {
    const query = {};
    if (branchId) {
      query.branchId = branchId;
    }
    if (status) {
      if (typeof status === 'string' && status.includes(',')) {
        query.status = {
          $in: status
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        };
      } else {
        query.status = status;
      }
    }
    if (orderId) {
      query.orderId = orderId;
    }
    if (kitchenStation && kitchenStation !== 'ALL' && kitchenStation !== 'All Stations') {
      query.kitchenStation = kitchenStation;
    }
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = dateFrom;
      if (dateTo) query.createdAt.$lte = dateTo;
    }

    return paginateMongoQuery(this, query, {
      page,
      limit,
      sort: { createdAt: -1 },
    });
  }

  async findActiveQueue(branchId, kitchenStation = null) {
    const query = {
      branchId,
      status: { $in: ['NEW', 'PREPARING'] },
    };
    if (kitchenStation && kitchenStation !== 'ALL' && kitchenStation !== 'All Stations') {
      query.kitchenStation = kitchenStation;
    }
    return this.findMany(query, { sort: { createdAt: 1 } });
  }

  async cancelKotsForOrder(orderId, reason = 'Order cancelled or rejected') {
    const now = BaseMongoRepository.utcNowIso();
    const col = await this.collection();
    const orderIdKeys = Array.isArray(orderId) ? orderId : [String(orderId)];
    return col.updateMany(
      { orderId: { $in: orderIdKeys }, status: { $nin: ['CANCELLED', 'SERVED'] } },
      {
        $set: {
          status: 'CANCELLED',
          notes: `CANCELLED: ${reason}`,
          updatedAt: now,
        },
      }
    );
  }
}

export const kotRepository = new KOTRepository();
