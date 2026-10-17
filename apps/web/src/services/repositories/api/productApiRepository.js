/**
 * API Product Repository
 * Connects to Django REST API product and price history endpoints (/api/v1/menu/products/*)
 */

import { apiClient, AppError } from '../../api/apiClient.js';

class ProductApiRepository {
  normalizeProduct(prod) {
    if (!prod) return null;
    const isAvail = prod.available !== undefined
      ? Boolean(prod.available)
      : (prod.isAvailable !== undefined ? Boolean(prod.isAvailable) : true);

    const station = prod.kitchenStation || prod.station || 'Main Curry';
    const tax = prod.taxConfig?.rate ? Number(prod.taxConfig.rate) : (Number(prod.taxRate) || 5.0);

    const rawPrice = prod.currentPrice !== undefined ? prod.currentPrice : prod.price;
    const price = Number(rawPrice) || 0;
    const id = prod.id || prod._id;

    return {
      ...prod,
      id,
      _id: prod._id || id,
      code: prod.code || '',
      name: prod.name || '',
      price,
      currentPrice: prod.currentPrice !== undefined ? String(prod.currentPrice) : price.toFixed(2),
      isAvailable: isAvail,
      available: isAvail,
      station: station,
      kitchenStation: station,
      taxRate: tax,
      taxConfig: prod.taxConfig || { rate: String(tax), mode: 'EXCLUSIVE' },
      isActive: prod.isActive !== undefined ? Boolean(prod.isActive) : true
    };
  }

  async getProducts(filters = {}) {
    const params = new URLSearchParams();
    if (filters.categoryId) params.append('categoryId', filters.categoryId);
    if (filters.onlyAvailable) params.append('isAvailableOnly', 'true');
    if (filters.search) params.append('search', filters.search);
    if (filters.station) params.append('station', filters.station);
    if (filters.branchId) params.append('branchId', filters.branchId);
    if (filters.page) params.append('page', String(filters.page));
    if (filters.limit) params.append('limit', String(filters.limit));
    else if (!filters.page) params.append('limit', '200');

    const queryStr = params.toString() ? `?${params.toString()}` : '';
    const response = await apiClient.get(`/menu/products${queryStr}`);
    const rawList = Array.isArray(response)
      ? response
      : (Array.isArray(response?.items)
        ? response.items
        : (Array.isArray(response?.products)
          ? response.products
          : []));

    let list = rawList.map((p) => this.normalizeProduct(p)).filter(Boolean);

    if (filters.onlyAvailable) {
      list = list.filter((p) => p.isAvailable && p.isActive);
    }

    const total = Number(response?.pagination?.total ?? list.length);
    const pageNum = Number(response?.pagination?.page ?? filters.page ?? 1);
    const limitNum = Number(response?.pagination?.limit ?? filters.limit ?? list.length ?? 20);
    const totalPages = Number(response?.pagination?.totalPages ?? response?.pagination?.pages ?? Math.max(1, Math.ceil(total / (limitNum || 1))));

    list.pagination = response?.pagination || {
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

  async getProductById(id) {
    const res = await apiClient.get(`/menu/products/${id}`);
    const item = (res && typeof res === 'object' && !Array.isArray(res) && ('item' in res || 'product' in res))
      ? (res.item || res.product)
      : res;
    return this.normalizeProduct(item);
  }

  async createProduct(productData) {
    const price = Number(productData.price);
    if (isNaN(price) || price < 0) {
      throw new AppError('Valid non-negative price is required.', 'VALIDATION_ERROR');
    }

    const payload = {
      code: productData.code?.trim().toUpperCase() || '',
      name: productData.name.trim(),
      categoryId: productData.categoryId,
      price: price.toFixed(2),
      taxConfig: {
        rate: Number(productData.taxRate || 5.0).toFixed(2),
        mode: 'EXCLUSIVE'
      },
      available: productData.isAvailable !== undefined ? Boolean(productData.isAvailable) : true,
      kitchenStation: productData.station || 'Main Curry',
      description: productData.description?.trim() || '',
      isActive: true
    };

    const created = await apiClient.post('/menu/products', payload);
    const item = (created && typeof created === 'object' && ('item' in created || 'product' in created))
      ? (created.item || created.product)
      : created;
    return this.normalizeProduct(item);
  }

  async updateProduct(id, productData, actor = {}, priceChangeReason = '') {
    const current = await this.getProductById(id);
    const newPrice = Number(productData.price);
    const priceChanged = !isNaN(newPrice) && newPrice !== current.price;

    if (priceChanged) {
      if (!priceChangeReason || !priceChangeReason.trim()) {
        throw new AppError('A mandatory reason is required to modify product selling price.', 'VALIDATION_ERROR');
      }
      await apiClient.post(`/menu/products/${id}/price`, {
        newPrice: newPrice.toFixed(2),
        reason: priceChangeReason.trim()
      });
    }

    const payload = {};
    if (productData.name) payload.name = productData.name.trim();
    if (productData.categoryId) payload.categoryId = productData.categoryId;
    if (productData.station) payload.kitchenStation = productData.station;
    if (productData.description !== undefined) payload.description = productData.description.trim();
    if (productData.isAvailable !== undefined) payload.available = Boolean(productData.isAvailable);

    const updated = await apiClient.patch(`/menu/products/${id}`, payload);
    const item = (updated && typeof updated === 'object' && ('item' in updated || 'product' in updated))
      ? (updated.item || updated.product)
      : updated;
    return this.normalizeProduct(item);
  }

  async toggleProductAvailability(id) {
    const current = await this.getProductById(id);
    const updated = await apiClient.patch(`/menu/products/${id}`, {
      available: !current.isAvailable
    });
    const item = (updated && typeof updated === 'object' && ('item' in updated || 'product' in updated))
      ? (updated.item || updated.product)
      : updated;
    return this.normalizeProduct(item);
  }

  async toggleProductStatus(id) {
    const current = await this.getProductById(id);
    const endpoint = current.isActive
      ? `/menu/products/${id}/deactivate`
      : `/menu/products/${id}/activate`;
    const updated = await apiClient.post(endpoint);
    const item = (updated && typeof updated === 'object' && ('item' in updated || 'product' in updated))
      ? (updated.item || updated.product)
      : updated;
    return this.normalizeProduct(item);
  }

  async getPriceHistory(productId = null) {
    if (!productId) return [];
    const history = await apiClient.get(`/menu/products/${productId}/price-history`);
    const rawList = Array.isArray(history)
      ? history
      : (Array.isArray(history?.items)
        ? history.items
        : []);
    return rawList;
  }

  async recordPriceChange(historyEntry) {
    const { productId, newPrice, reason } = historyEntry;
    const res = await apiClient.post(`/menu/products/${productId}/price`, {
      newPrice: Number(newPrice).toFixed(2),
      reason: reason?.trim() || 'Manual price adjustment'
    });
    return res?.historyEntry || res;
  }
}

export const productApiRepository = new ProductApiRepository();
