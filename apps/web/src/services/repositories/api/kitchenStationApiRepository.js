import { apiClient } from '../../api/apiClient.js';
import { queryClient } from '../../../config/queryClient.js';
import { queryKeys } from '../../../constants/queryKeys.js';
import { CACHE_POLICIES } from '../../../config/cachePolicies.js';
import { cacheInvalidationService } from '../../cache/cacheInvalidationService.js';

class KitchenStationApiRepository {
  normalizeStation(station) {
    if (!station) return null;
    return {
      ...station,
      id: station._id || station.id,
      name: station.name || 'Station',
      code: station.code || '',
      description: station.description || '',
      sortOrder: Number(station.sortOrder || 0),
      isActive: station.isActive !== undefined ? Boolean(station.isActive) : true,
    };
  }

  async getStations(isActiveOnly = false) {
    const branchId = 'branch-main';
    return queryClient.fetchQuery({
      queryKey: queryKeys.kitchenStations(branchId),
      queryFn: async () => {
        const query = isActiveOnly ? '?isActiveOnly=true' : '';
        const res = await apiClient.get(`/kitchen-stations${query}`);
        const items = Array.isArray(res) ? res : (res?.data || []);
        return items
          .map((s) => this.normalizeStation(s))
          .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      },
      staleTime: CACHE_POLICIES.KITCHEN_STATIONS.staleTime,
      gcTime: CACHE_POLICIES.KITCHEN_STATIONS.gcTime,
    });
  }

  async getStationById(id) {
    return queryClient.fetchQuery({
      queryKey: queryKeys.kitchenStation(id),
      queryFn: async () => {
        const res = await apiClient.get(`/kitchen-stations/${id}`);
        return this.normalizeStation(res?.data || res);
      },
      staleTime: CACHE_POLICIES.KITCHEN_STATIONS.staleTime,
      gcTime: CACHE_POLICIES.KITCHEN_STATIONS.gcTime,
    });
  }

  async createStation(stationData) {
    const branchId = stationData.branchId || 'branch-main';
    const payload = {
      branchId,
      name: stationData.name.trim(),
      code: stationData.code ? stationData.code.trim().toUpperCase() : '',
      description: stationData.description ? stationData.description.trim() : '',
      sortOrder: Number(stationData.sortOrder || 0),
      isActive: stationData.isActive !== undefined ? Boolean(stationData.isActive) : true,
    };
    const res = await apiClient.post('/kitchen-stations', payload);
    const normalized = this.normalizeStation(res?.data || res);
    cacheInvalidationService.invalidateKitchenStations(branchId);
    return normalized;
  }

  async updateStation(id, stationData) {
    const payload = {};
    if (stationData.name !== undefined) payload.name = stationData.name.trim();
    if (stationData.code !== undefined) payload.code = stationData.code.trim().toUpperCase();
    if (stationData.description !== undefined) payload.description = stationData.description.trim();
    if (stationData.sortOrder !== undefined) payload.sortOrder = Number(stationData.sortOrder);
    if (stationData.isActive !== undefined) payload.isActive = Boolean(stationData.isActive);

    const res = await apiClient.patch(`/kitchen-stations/${id}`, payload);
    const normalized = this.normalizeStation(res?.data || res);
    cacheInvalidationService.invalidateKitchenStations(stationData.branchId || 'branch-main');
    return normalized;
  }

  async deleteStation(id) {
    const res = await apiClient.delete(`/kitchen-stations/${id}`);
    cacheInvalidationService.invalidateKitchenStations('branch-main');
    return res;
  }
}

export const kitchenStationApiRepository = new KitchenStationApiRepository();
