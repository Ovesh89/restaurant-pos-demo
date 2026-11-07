/**
 * API Menu Category Repository
 * Connects to Express/Django REST API menu category endpoints (/api/v1/menu/categories/*)
 * Integrated with central TanStack Query client for unified cross-screen caching
 */

import { apiClient } from '../../api/apiClient.js';
import { queryClient } from '../../../config/queryClient.js';
import { queryKeys } from '../../../constants/queryKeys.js';
import { CACHE_POLICIES } from '../../../config/cachePolicies.js';
import { cacheInvalidationService } from '../../cache/cacheInvalidationService.js';

class CategoryApiRepository {
  normalizeCategory(cat) {
    if (!cat) return null;
    const id = cat.id || cat._id;
    return {
      ...cat,
      id,
      _id: cat._id || id,
      kotRequired: cat.kotRequired !== undefined ? Boolean(cat.kotRequired) : true,
    };
  }

  async getCategories(includeInactive = false) {
    const branchId = 'branch-main';
    return queryClient.fetchQuery({
      queryKey: queryKeys.categories(branchId, includeInactive),
      queryFn: async () => {
        const query = includeInactive ? '?isActiveOnly=false' : '?isActiveOnly=true';
        const categories = await apiClient.get(`/menu/categories${query}`);
        const items = Array.isArray(categories)
          ? categories
          : (Array.isArray(categories?.items)
            ? categories.items
            : (Array.isArray(categories?.categories)
              ? categories.categories
              : []));
        return items
          .filter((c) => !c.isDeleted && (includeInactive ? true : c.isActive !== false))
          .map((c) => this.normalizeCategory(c))
          .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      },
      staleTime: CACHE_POLICIES.CATEGORIES.staleTime,
      gcTime: CACHE_POLICIES.CATEGORIES.gcTime,
    });
  }

  async getCategoryById(id) {
    return queryClient.fetchQuery({
      queryKey: queryKeys.category(id),
      queryFn: async () => {
        const cat = await apiClient.get(`/menu/categories/${id}`);
        if (cat?.isDeleted) return null;
        return this.normalizeCategory(cat);
      },
      staleTime: CACHE_POLICIES.CATEGORIES.staleTime,
      gcTime: CACHE_POLICIES.CATEGORIES.gcTime,
    });
  }

  async createCategory(categoryData) {
    const payload = {
      name: categoryData.name.trim(),
      code: categoryData.code?.trim().toUpperCase() || '',
      sortOrder: Number(categoryData.sortOrder) || 1,
      isActive: categoryData.isActive !== undefined ? Boolean(categoryData.isActive) : true,
      kotRequired: categoryData.kotRequired !== undefined ? Boolean(categoryData.kotRequired) : true,
    };
    const created = await apiClient.post('/menu/categories', payload);
    const normalized = this.normalizeCategory(created);
    cacheInvalidationService.invalidateCategories('branch-main');
    return normalized;
  }

  async updateCategory(id, categoryData) {
    const payload = {};
    if (categoryData.name) payload.name = categoryData.name.trim();
    if (categoryData.code !== undefined) payload.code = categoryData.code.trim().toUpperCase();
    if (categoryData.sortOrder !== undefined) payload.sortOrder = Number(categoryData.sortOrder);
    if (categoryData.isActive !== undefined) payload.isActive = Boolean(categoryData.isActive);
    if (categoryData.kotRequired !== undefined) payload.kotRequired = Boolean(categoryData.kotRequired);

    const updated = await apiClient.patch(`/menu/categories/${id}`, payload);
    const normalized = this.normalizeCategory(updated);
    cacheInvalidationService.invalidateCategories('branch-main');
    return normalized;
  }

  async toggleCategoryStatus(id) {
    const current = await this.getCategoryById(id);
    const updated = await apiClient.patch(`/menu/categories/${id}`, {
      isActive: !current.isActive
    });
    const normalized = this.normalizeCategory(updated);
    cacheInvalidationService.invalidateCategories('branch-main');
    return normalized;
  }

  async deleteCategory(id) {
    const res = await apiClient.delete(`/menu/categories/${id}`);
    cacheInvalidationService.invalidateCategories('branch-main');
    return res;
  }
}

export const categoryApiRepository = new CategoryApiRepository();
