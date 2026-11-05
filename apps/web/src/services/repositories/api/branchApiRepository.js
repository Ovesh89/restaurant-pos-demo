/**
 * API Branch & Area Repository
 * Connects to Django/Express REST API branch and area endpoints (/api/v1/branches, /api/v1/areas)
 * Integrated with central TanStack Query client for unified cross-screen caching
 */

import { apiClient } from '../../api/apiClient.js';
import { queryClient } from '../../../config/queryClient.js';
import { queryKeys } from '../../../constants/queryKeys.js';
import { CACHE_POLICIES } from '../../../config/cachePolicies.js';
import { cacheInvalidationService } from '../../cache/cacheInvalidationService.js';

class BranchApiRepository {
  normalizeBranch(branch) {
    if (!branch) return null;
    return {
      ...branch,
      id: branch._id || branch.id
    };
  }

  normalizeArea(area) {
    if (!area) return null;
    return {
      ...area,
      id: area._id || area.id
    };
  }

  async getBranches() {
    return queryClient.fetchQuery({
      queryKey: queryKeys.branches(),
      queryFn: async () => {
        const branches = await apiClient.get('/branches');
        const items = Array.isArray(branches) ? branches : [];
        return items.map((b) => this.normalizeBranch(b));
      },
      staleTime: CACHE_POLICIES.BRANCHES.staleTime,
      gcTime: CACHE_POLICIES.BRANCHES.gcTime,
    });
  }

  async getAreas(branchId = 'branch-main') {
    const currentBranch = branchId || 'branch-main';
    return queryClient.fetchQuery({
      queryKey: queryKeys.areas(currentBranch),
      queryFn: async () => {
        const query = currentBranch ? `?branchId=${currentBranch}` : '';
        const areas = await apiClient.get(`/areas${query}`);
        const items = Array.isArray(areas) ? areas : [];
        return items
          .map((a) => this.normalizeArea(a))
          .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      },
      staleTime: CACHE_POLICIES.AREAS.staleTime,
      gcTime: CACHE_POLICIES.AREAS.gcTime,
    });
  }

  async createArea(areaData) {
    const branchId = areaData.branchId || 'branch-main';
    const payload = {
      branchId,
      name: areaData.name.trim(),
      sortOrder: Number(areaData.sortOrder) || 1,
      isActive: true
    };
    const created = await apiClient.post('/areas', payload);
    const normalized = this.normalizeArea(created);
    cacheInvalidationService.invalidateAreas(branchId);
    return normalized;
  }

  async updateArea(id, areaData) {
    const payload = {};
    if (areaData.name) payload.name = areaData.name.trim();
    if (areaData.sortOrder !== undefined) payload.sortOrder = Number(areaData.sortOrder);
    if (areaData.isActive !== undefined) payload.isActive = Boolean(areaData.isActive);

    const updated = await apiClient.patch(`/areas/${id}`, payload);
    const normalized = this.normalizeArea(updated);
    cacheInvalidationService.invalidateAreas(areaData.branchId || 'branch-main');
    return normalized;
  }

  async toggleAreaStatus(id) {
    const areas = await this.getAreas();
    const current = areas.find((a) => a.id === id);
    const newStatus = current ? !current.isActive : false;

    const updated = await apiClient.patch(`/areas/${id}`, {
      isActive: newStatus
    });
    const normalized = this.normalizeArea(updated);
    cacheInvalidationService.invalidateAreas('branch-main');
    return normalized;
  }

  async deleteArea(id) {
    const res = await apiClient.delete(`/areas/${id}`);
    cacheInvalidationService.invalidateAreas('branch-main');
    return res;
  }
}

export const branchApiRepository = new BranchApiRepository();
