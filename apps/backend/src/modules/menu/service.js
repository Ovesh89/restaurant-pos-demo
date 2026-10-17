import {
  NotFoundAppError,
  ValidationAppError,
} from '../../middleware/errorHandler.js';
import { ensureBranchAccess } from '../../middleware/permissions.js';
import { formatMoney, toDecimal } from '../../utils/decimal.js';
import { auditService } from '../audit/service.js';
import {
  categoryRepository,
  priceHistoryRepository,
  productRepository,
} from './repositories.js';

export class MenuService {
  constructor() {
    this.categoryRepo = categoryRepository;
    this.productRepo = productRepository;
    this.priceHistoryRepo = priceHistoryRepository;
  }

  // --- Categories ---

  async listCategories(branchId, user, isActiveOnly = false) {
    ensureBranchAccess(user, branchId);
    return this.categoryRepo.findByBranch(branchId, isActiveOnly);
  }

  async getCategory(categoryId, user) {
    const cat = await this.categoryRepo.findById(categoryId);
    if (!cat) {
      throw new NotFoundAppError(`Category '${categoryId}' not found.`);
    }
    ensureBranchAccess(user, cat.branchId);
    return cat;
  }

  async createCategory(data, actor) {
    // Decision 5 Compatibility Shim: default branchId if omitted by Web categoryApiRepository
    const branchId = data.branchId || (actor.branchIds || [])[0] || 'branch-main';
    ensureBranchAccess(actor, branchId);

    const name = String(data.name || '').trim();
    if (!name) {
      throw new ValidationAppError('Category name is required.');
    }

    const doc = {
      branchId,
      code: data.code ? String(data.code).trim().toUpperCase() : '',
      name,
      description: data.description || '',
      sortOrder: Number(data.sortOrder ?? 0),
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
    };

    const created = await this.categoryRepo.insertOne(doc, 'cat');

    await auditService.logAction({
      branchId,
      action: 'CATEGORY_CREATED',
      entityType: 'category',
      entityId: created.id,
      actorUserId: actor.id,
      actorName: actor.displayName,
      after: created,
    });

    return created;
  }

  async updateCategory(categoryId, data, actor) {
    const beforeDoc = await this.categoryRepo.findById(categoryId);
    if (!beforeDoc) {
      throw new NotFoundAppError(`Category '${categoryId}' not found.`);
    }
    ensureBranchAccess(actor, beforeDoc.branchId);

    const updateFields = {};
    if (data.code !== undefined) updateFields.code = String(data.code).trim().toUpperCase();
    if (data.name !== undefined) updateFields.name = String(data.name).trim();
    if (data.description !== undefined) updateFields.description = data.description;
    if (data.sortOrder !== undefined) updateFields.sortOrder = Number(data.sortOrder);
    if (data.isActive !== undefined) updateFields.isActive = Boolean(data.isActive);

    const updated = await this.categoryRepo.updateById(categoryId, updateFields);

    await auditService.logAction({
      branchId: beforeDoc.branchId,
      action: 'CATEGORY_UPDATED',
      entityType: 'category',
      entityId: categoryId,
      actorUserId: actor.id,
      actorName: actor.displayName,
      before: beforeDoc,
      after: updated,
    });

    return updated;
  }

  // --- Products ---

  async listProducts({
    branchId,
    user,
    categoryId = null,
    isActive = null,
    available = null,
    station = null,
    search = null,
    page = 1,
    limit = 50,
  }) {
    ensureBranchAccess(user, branchId);
    return this.productRepo.findPaginatedProducts({
      branchId,
      categoryId,
      isActive,
      available,
      station,
      search,
      page,
      limit,
    });
  }

  async getProduct(productId, user) {
    const prod = await this.productRepo.findById(productId);
    if (!prod) {
      throw new NotFoundAppError(`Product '${productId}' not found.`);
    }
    ensureBranchAccess(user, prod.branchId);
    return prod;
  }

  async createProduct(data, actor) {
    // Decision 5 Compatibility Shim: default branchId if omitted by Web productApiRepository
    const branchId = data.branchId || (actor.branchIds || [])[0] || 'branch-main';
    ensureBranchAccess(actor, branchId);

    const categoryId = data.categoryId;
    if (!categoryId) {
      throw new ValidationAppError('categoryId is required.');
    }

    const cat = await this.categoryRepo.findById(categoryId);
    if (!cat || cat.branchId !== branchId) {
      throw new ValidationAppError(
        `Category '${categoryId}' does not exist in branch '${branchId}'.`
      );
    }

    const name = String(data.name || '').trim();
    if (!name) {
      throw new ValidationAppError('Product name is required.');
    }

    const rawPrice = data.price !== undefined ? data.price : data.currentPrice;
    const priceDec = toDecimal(rawPrice, 'price');
    if (priceDec.isNegative()) {
      throw new ValidationAppError('Price must be non-negative.');
    }
    const priceStr = formatMoney(priceDec);

    const taxInput = data.taxConfig || { rate: '5.00', mode: 'EXCLUSIVE' };
    const taxRateDec = toDecimal(taxInput.rate ?? '5.00', 'taxConfig.rate');
    if (taxRateDec.isNegative() || taxRateDec.greaterThan(100)) {
      throw new ValidationAppError('Tax rate must be between 0 and 100.');
    }
    const taxMode = String(taxInput.mode || 'EXCLUSIVE').toUpperCase();
    if (!['EXCLUSIVE', 'INCLUSIVE'].includes(taxMode)) {
      throw new ValidationAppError('Tax mode must be EXCLUSIVE or INCLUSIVE.');
    }

    const doc = {
      branchId,
      categoryId,
      code: data.code ? String(data.code).trim().toUpperCase() : '',
      name,
      description: data.description || '',
      currentPrice: priceStr,
      currency: data.currency || 'INR',
      taxConfig: {
        rate: formatMoney(taxRateDec),
        mode: taxMode,
      },
      available: data.available !== undefined ? Boolean(data.available) : true,
      kitchenStation: data.kitchenStation || 'MAIN',
      sortOrder: Number(data.sortOrder ?? 0),
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
    };

    const created = await this.productRepo.insertOne(doc, 'prod');

    await this.priceHistoryRepo.insertOne(
      {
        productId: created.id,
        branchId,
        oldPrice: null,
        newPrice: priceStr,
        reason: 'Initial product creation',
        changedByUserId: actor.id,
        changedByName: actor.displayName,
        changedAt: created.createdAt,
      },
      'ph'
    );

    await auditService.logAction({
      branchId,
      action: 'PRODUCT_CREATED',
      entityType: 'product',
      entityId: created.id,
      actorUserId: actor.id,
      actorName: actor.displayName,
      after: created,
    });

    return created;
  }

  async updateProduct(productId, data, actor) {
    const beforeDoc = await this.productRepo.findById(productId);
    if (!beforeDoc) {
      throw new NotFoundAppError(`Product '${productId}' not found.`);
    }
    const branchId = beforeDoc.branchId;
    ensureBranchAccess(actor, branchId);

    const updateFields = {};
    if (data.categoryId !== undefined) {
      const cat = await this.categoryRepo.findById(data.categoryId);
      if (!cat || cat.branchId !== branchId) {
        throw new ValidationAppError(
          `Category '${data.categoryId}' does not exist in branch '${branchId}'.`
        );
      }
      updateFields.categoryId = data.categoryId;
    }

    if (data.code !== undefined) updateFields.code = String(data.code).trim().toUpperCase();
    if (data.name !== undefined) updateFields.name = String(data.name).trim();
    if (data.description !== undefined) updateFields.description = data.description;
    if (data.available !== undefined) updateFields.available = Boolean(data.available);
    if (data.kitchenStation !== undefined) updateFields.kitchenStation = data.kitchenStation;
    if (data.sortOrder !== undefined) updateFields.sortOrder = Number(data.sortOrder);
    if (data.isActive !== undefined) updateFields.isActive = Boolean(data.isActive);

    if (data.taxConfig !== undefined && typeof data.taxConfig === 'object') {
      const rateDec = toDecimal(data.taxConfig.rate ?? '5.00', 'taxConfig.rate');
      const mode = String(data.taxConfig.mode || 'EXCLUSIVE').toUpperCase();
      updateFields.taxConfig = {
        rate: formatMoney(rateDec),
        mode,
      };
    }

    const updated = await this.productRepo.updateById(productId, updateFields);

    await auditService.logAction({
      branchId,
      action: 'PRODUCT_UPDATED',
      entityType: 'product',
      entityId: productId,
      actorUserId: actor.id,
      actorName: actor.displayName,
      before: beforeDoc,
      after: updated,
    });

    return updated;
  }

  async setProductActiveStatus(productId, isActive, actor) {
    const beforeDoc = await this.productRepo.findById(productId);
    if (!beforeDoc) {
      throw new NotFoundAppError(`Product '${productId}' not found.`);
    }
    const branchId = beforeDoc.branchId;
    ensureBranchAccess(actor, branchId);

    const updated = await this.productRepo.updateById(productId, {
      isActive: Boolean(isActive),
    });

    await auditService.logAction({
      branchId,
      action: isActive ? 'PRODUCT_ACTIVATED' : 'PRODUCT_DEACTIVATED',
      entityType: 'product',
      entityId: productId,
      actorUserId: actor.id,
      actorName: actor.displayName,
      before: { isActive: beforeDoc.isActive },
      after: { isActive: Boolean(isActive) },
    });

    return updated;
  }

  async changeProductPrice(productId, newPriceInput, reason, actor) {
    const beforeDoc = await this.productRepo.findById(productId);
    if (!beforeDoc) {
      throw new NotFoundAppError(`Product '${productId}' not found.`);
    }
    const branchId = beforeDoc.branchId;
    ensureBranchAccess(actor, branchId);

    if (!reason || String(reason).trim().length < 3) {
      throw new ValidationAppError('A reason of at least 3 characters is required for price changes.');
    }

    const priceDec = toDecimal(newPriceInput, 'price');
    if (priceDec.isNegative()) {
      throw new ValidationAppError('Price must be non-negative.');
    }

    const oldPrice = beforeDoc.currentPrice;
    const newPriceStr = formatMoney(priceDec);
    const updated = await this.productRepo.updateById(productId, {
      currentPrice: newPriceStr,
    });

    await this.priceHistoryRepo.insertOne(
      {
        productId,
        branchId,
        oldPrice,
        newPrice: newPriceStr,
        reason: String(reason).trim(),
        changedByUserId: actor.id,
        changedByName: actor.displayName,
        changedAt: updated.updatedAt,
      },
      'ph'
    );

    await auditService.logAction({
      branchId,
      action: 'PRODUCT_PRICE_CHANGED',
      entityType: 'product',
      entityId: productId,
      actorUserId: actor.id,
      actorName: actor.displayName,
      before: { currentPrice: oldPrice },
      after: { currentPrice: newPriceStr },
      metadata: { reason: String(reason).trim() },
    });

    return updated;
  }

  async getProductPriceHistory(productId, user) {
    const prod = await this.productRepo.findById(productId);
    if (!prod) {
      throw new NotFoundAppError(`Product '${productId}' not found.`);
    }
    ensureBranchAccess(user, prod.branchId);
    return this.priceHistoryRepo.findByProduct(productId);
  }
}

export const menuService = new MenuService();
