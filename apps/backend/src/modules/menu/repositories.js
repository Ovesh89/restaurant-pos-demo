import { BaseMongoRepository } from '../../repositories/BaseMongoRepository.js';

export class CategoryRepository extends BaseMongoRepository {
  constructor() {
    super('categories', 'cat');
  }

  async findByBranch(branchId, isActiveOnly = false) {
    const query = { branchId };
    if (isActiveOnly) query.isActive = true;
    return this.findMany(query, { sort: [['sortOrder', 1], ['name', 1]] });
  }
}

export class ProductRepository extends BaseMongoRepository {
  constructor() {
    super('products', 'prod');
  }

  async findPaginatedProducts({
    branchId,
    categoryId = null,
    isActive = null,
    available = null,
    station = null,
    search = null,
    page = 1,
    limit = 50,
  }) {
    const query = { branchId };
    if (categoryId) query.categoryId = categoryId;
    if (station && station !== 'ALL') {
      query.$or = [{ station }, { kitchenStation: station }];
    }
    if (isActive !== null && isActive !== undefined) query.isActive = Boolean(isActive);
    if (available !== null && available !== undefined) query.available = Boolean(available);
    if (search) {
      const escaped = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { code: { $regex: escaped, $options: 'i' } },
      ];
    }

    return this.findPaginated(query, {
      page,
      limit,
      sort: [['sortOrder', 1], ['name', 1]],
    });
  }
}

export class PriceHistoryRepository extends BaseMongoRepository {
  constructor() {
    super('price_history', 'ph');
  }

  async findByProduct(productId) {
    return this.findMany({ productId: String(productId) }, { sort: [['changedAt', -1]] });
  }
}

export const categoryRepository = new CategoryRepository();
export const productRepository = new ProductRepository();
export const priceHistoryRepository = new PriceHistoryRepository();
