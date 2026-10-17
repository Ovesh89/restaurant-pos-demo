/**
 * API Menu Category Repository
 * Connects to Django REST API menu category endpoints (/api/v1/menu/categories/*)
 */

import { apiClient } from '../../api/apiClient.js';

class CategoryApiRepository {
  normalizeCategory(cat) {
    if (!cat) return null;
    const id = cat.id || cat._id;
    return {
      ...cat,
      id,
      _id: cat._id || id
    };
  }

  async getCategories(includeInactive = true) {
    const query = includeInactive ? '' : '?isActiveOnly=true';
    const categories = await apiClient.get(`/menu/categories${query}`);
    const items = Array.isArray(categories)
      ? categories
      : (Array.isArray(categories?.items)
        ? categories.items
        : (Array.isArray(categories?.categories)
          ? categories.categories
          : []));
    return items
      .map((c) => this.normalizeCategory(c))
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }

  async getCategoryById(id) {
    const cat = await apiClient.get(`/menu/categories/${id}`);
    return this.normalizeCategory(cat);
  }

  async createCategory(categoryData) {
    const payload = {
      name: categoryData.name.trim(),
      code: categoryData.code?.trim().toUpperCase() || '',
      sortOrder: Number(categoryData.sortOrder) || 1,
      isActive: true
    };
    const created = await apiClient.post('/menu/categories', payload);
    return this.normalizeCategory(created);
  }

  async updateCategory(id, categoryData) {
    const payload = {};
    if (categoryData.name) payload.name = categoryData.name.trim();
    if (categoryData.code !== undefined) payload.code = categoryData.code.trim().toUpperCase();
    if (categoryData.sortOrder !== undefined) payload.sortOrder = Number(categoryData.sortOrder);
    if (categoryData.isActive !== undefined) payload.isActive = Boolean(categoryData.isActive);

    const updated = await apiClient.patch(`/menu/categories/${id}`, payload);
    return this.normalizeCategory(updated);
  }

  async toggleCategoryStatus(id) {
    const current = await this.getCategoryById(id);
    const updated = await apiClient.patch(`/menu/categories/${id}`, {
      isActive: !current.isActive
    });
    return this.normalizeCategory(updated);
  }
}

export const categoryApiRepository = new CategoryApiRepository();
