import { STORAGE_KEYS } from '../../../constants/storageKeys.js';
import { storageAdapter } from '../../storage/localStorageAdapter.js';
import { auditRepository } from '../auditRepository.js';

class ProductLocalRepository {
  async getProducts(filters = {}) {
    const products = storageAdapter.getItem(STORAGE_KEYS.PRODUCTS) || [];
    let list = [...products];

    if (filters.categoryId) {
      list = list.filter((p) => p.categoryId === filters.categoryId);
    }

    if (filters.station && filters.station !== 'ALL') {
      list = list.filter((p) => p.station === filters.station || p.kitchenStation === filters.station);
    }

    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q)
      );
    }

    if (filters.onlyAvailable) {
      list = list.filter((p) => p.isAvailable && p.isActive);
    }

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

  async getProductById(id) {
    const products = await this.getProducts();
    return products.find((p) => p.id === id) || null;
  }

  async createProduct(productData, actor = { id: 'admin', name: 'Admin' }) {
    const products = await this.getProducts();

    if (productData.code) {
      const codeExists = products.some(
        (p) => p.code.toLowerCase() === productData.code.trim().toLowerCase()
      );
      if (codeExists) {
        throw new Error(`Product with code "${productData.code}" already exists.`);
      }
    }

    const price = Number(productData.price);
    if (isNaN(price) || price < 0) {
      throw new Error('Valid price is required.');
    }

    const newProduct = {
      id: `prod-${Date.now()}`,
      name: productData.name.trim(),
      code: productData.code?.trim().toUpperCase() || `P-${Date.now().toString().slice(-4)}`,
      categoryId: productData.categoryId,
      price: price,
      taxRate: Number(productData.taxRate) || 5.0,
      isAvailable: productData.isAvailable !== undefined ? productData.isAvailable : true,
      isActive: true,
      station: productData.station || 'Main Curry',
      description: productData.description?.trim() || '',
      createdAt: new Date().toISOString()
    };

    products.push(newProduct);
    storageAdapter.setItem(STORAGE_KEYS.PRODUCTS, products);

    await auditRepository.logEvent({
      actorId: actor.id,
      actorName: actor.name,
      action: 'PRODUCT_CREATED',
      entityType: 'Product',
      entityId: newProduct.id,
      details: `Created menu product "${newProduct.name}" (${newProduct.code}) at ₹${newProduct.price}.`
    });

    return newProduct;
  }

  async updateProduct(id, productData, actor = { id: 'admin', name: 'Admin' }, priceChangeReason = '') {
    const products = await this.getProducts();
    const index = products.findIndex((p) => p.id === id);
    if (index === -1) {
      throw new Error('Product not found.');
    }

    const currentProduct = products[index];

    if (productData.code) {
      const duplicateCode = products.find(
        (p) => p.id !== id && p.code.toLowerCase() === productData.code.trim().toLowerCase()
      );
      if (duplicateCode) {
        throw new Error(`Product code "${productData.code}" is already in use.`);
      }
    }

    const newPrice = Number(productData.price);
    const priceChanged = !isNaN(newPrice) && newPrice !== currentProduct.price;

    if (priceChanged) {
      if (!priceChangeReason || !priceChangeReason.trim()) {
        throw new Error('A mandatory reason is required to modify product selling price.');
      }
      await this.recordPriceChange({
        productId: id,
        productName: currentProduct.name,
        oldPrice: currentProduct.price,
        newPrice: newPrice,
        reason: priceChangeReason.trim(),
        changedBy: actor.name,
        changedAt: new Date().toISOString()
      });
    }

    products[index] = {
      ...currentProduct,
      name: productData.name?.trim() || currentProduct.name,
      code: productData.code !== undefined ? productData.code.trim().toUpperCase() : currentProduct.code,
      categoryId: productData.categoryId || currentProduct.categoryId,
      price: priceChanged ? newPrice : currentProduct.price,
      taxRate: productData.taxRate !== undefined ? Number(productData.taxRate) : currentProduct.taxRate,
      station: productData.station || currentProduct.station,
      description: productData.description !== undefined ? productData.description.trim() : currentProduct.description,
      updatedAt: new Date().toISOString()
    };

    storageAdapter.setItem(STORAGE_KEYS.PRODUCTS, products);

    await auditRepository.logEvent({
      actorId: actor.id,
      actorName: actor.name,
      action: priceChanged ? 'PRODUCT_PRICE_CHANGED' : 'PRODUCT_UPDATED',
      entityType: 'Product',
      entityId: id,
      details: priceChanged
        ? `Price changed for "${products[index].name}" from ₹${currentProduct.price} to ₹${newPrice}. Reason: ${priceChangeReason}`
        : `Updated product "${products[index].name}".`
    });

    return products[index];
  }

  async toggleProductAvailability(id, actor = { id: 'admin', name: 'Admin' }) {
    const products = await this.getProducts();
    const index = products.findIndex((p) => p.id === id);
    if (index === -1) {
      throw new Error('Product not found.');
    }

    products[index].isAvailable = !products[index].isAvailable;
    products[index].updatedAt = new Date().toISOString();
    storageAdapter.setItem(STORAGE_KEYS.PRODUCTS, products);

    await auditRepository.logEvent({
      actorId: actor.id,
      actorName: actor.name,
      action: products[index].isAvailable ? 'PRODUCT_MARKED_AVAILABLE' : 'PRODUCT_MARKED_UNAVAILABLE',
      entityType: 'Product',
      entityId: id,
      details: `Product "${products[index].name}" marked as ${products[index].isAvailable ? 'available' : 'unavailable'}.`
    });

    return products[index];
  }

  async toggleProductStatus(id, actor = { id: 'admin', name: 'Admin' }) {
    const products = await this.getProducts();
    const index = products.findIndex((p) => p.id === id);
    if (index === -1) {
      throw new Error('Product not found.');
    }

    products[index].isActive = !products[index].isActive;
    products[index].updatedAt = new Date().toISOString();
    storageAdapter.setItem(STORAGE_KEYS.PRODUCTS, products);

    await auditRepository.logEvent({
      actorId: actor.id,
      actorName: actor.name,
      action: products[index].isActive ? 'PRODUCT_ACTIVATED' : 'PRODUCT_DEACTIVATED',
      entityType: 'Product',
      entityId: id,
      details: `Product "${products[index].name}" was ${products[index].isActive ? 'activated' : 'deactivated'}.`
    });

    return products[index];
  }

  async recordPriceChange(historyEntry) {
    const history = storageAdapter.getItem(STORAGE_KEYS.PRICE_HISTORY) || [];
    const entry = {
      id: `ph-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      ...historyEntry
    };
    history.unshift(entry);
    storageAdapter.setItem(STORAGE_KEYS.PRICE_HISTORY, history);
    return entry;
  }

  async getPriceHistory(productId = null) {
    const history = storageAdapter.getItem(STORAGE_KEYS.PRICE_HISTORY) || [];
    if (productId) {
      return history.filter((h) => h.productId === productId);
    }
    return history;
  }
}

export const productLocalRepository = new ProductLocalRepository();
