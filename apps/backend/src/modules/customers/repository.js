import {
  BaseMongoRepository,
  paginateMongoQuery,
  utcNowIso,
} from '../../repositories/BaseMongoRepository.js';
import { toDecimal, formatMoney } from '../../utils/decimal.js';

export class CustomerRepository extends BaseMongoRepository {
  constructor() {
    super('customers');
  }

  async findByMobile(branchId, mobile) {
    return this.findOne({
      branchId,
      $or: [{ mobile }, { phone: mobile }],
    });
  }

  async searchCustomers({ branchId, query = null, page = 1, limit = 20 }) {
    const filterQuery = { branchId };
    if (query && String(query).trim()) {
      const qClean = String(query).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filterQuery.$or = [
        { name: { $regex: qClean, $options: 'i' } },
        { mobile: { $regex: qClean, $options: 'i' } },
        { phone: { $regex: qClean, $options: 'i' } },
        { email: { $regex: qClean, $options: 'i' } },
      ];
    }

    return paginateMongoQuery(this, filterQuery, {
      page,
      limit,
      sort: { lastVisitAt: -1, createdAt: -1 },
    });
  }

  async recordVisitAndSpend(customerId, spendAmount) {
    const doc = await this.findById(customerId);
    if (!doc) return null;

    const currentVisits = Number(doc.visitCount ?? doc.totalVisits ?? 0);
    const currentSpendDec = toDecimal(doc.totalSpending ?? doc.totalSpend ?? '0.00');
    const newSpendStr = formatMoney(currentSpendDec.plus(toDecimal(spendAmount || '0.00')));
    const newVisits = currentVisits + 1;
    const now = utcNowIso();

    return this.updateById(customerId, {
      visitCount: newVisits,
      totalVisits: newVisits,
      totalSpending: newSpendStr,
      totalSpend: newSpendStr,
      lastVisitAt: now,
      updatedAt: now,
    });
  }
}

export const customerRepository = new CustomerRepository();
