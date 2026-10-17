/**
 * API Branch & Area Repository
 * Connects to Django REST API branch and area endpoints (/api/v1/branches, /api/v1/areas)
 */

import { apiClient } from '../../api/apiClient.js';

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
    const branches = await apiClient.get('/branches');
    const items = Array.isArray(branches) ? branches : [];
    return items.map((b) => this.normalizeBranch(b));
  }

  async getAreas(branchId = 'branch-main') {
    const query = branchId ? `?branchId=${branchId}` : '';
    const areas = await apiClient.get(`/areas${query}`);
    const items = Array.isArray(areas) ? areas : [];
    return items
      .map((a) => this.normalizeArea(a))
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }

  async createArea(areaData) {
    const payload = {
      branchId: areaData.branchId || 'branch-main',
      name: areaData.name.trim(),
      sortOrder: Number(areaData.sortOrder) || 1,
      isActive: true
    };
    const created = await apiClient.post('/areas', payload);
    return this.normalizeArea(created);
  }

  async updateArea(id, areaData) {
    const payload = {};
    if (areaData.name) payload.name = areaData.name.trim();
    if (areaData.sortOrder !== undefined) payload.sortOrder = Number(areaData.sortOrder);
    if (areaData.isActive !== undefined) payload.isActive = Boolean(areaData.isActive);

    const updated = await apiClient.patch(`/areas/${id}`, payload);
    return this.normalizeArea(updated);
  }

  async toggleAreaStatus(id) {
    const areas = await this.getAreas();
    const current = areas.find((a) => a.id === id);
    const newStatus = current ? !current.isActive : false;

    const updated = await apiClient.patch(`/areas/${id}`, {
      isActive: newStatus
    });
    return this.normalizeArea(updated);
  }
}

export const branchApiRepository = new BranchApiRepository();
