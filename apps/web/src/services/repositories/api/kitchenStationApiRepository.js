import { apiClient } from '../../api/apiClient.js';

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
    const query = isActiveOnly ? '?isActiveOnly=true' : '';
    const res = await apiClient.get(`/kitchen-stations${query}`);
    const items = Array.isArray(res) ? res : (res?.data || []);
    return items
      .map((s) => this.normalizeStation(s))
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }

  async getStationById(id) {
    const res = await apiClient.get(`/kitchen-stations/${id}`);
    return this.normalizeStation(res?.data || res);
  }

  async createStation(stationData) {
    const payload = {
      branchId: stationData.branchId || 'branch-main',
      name: stationData.name.trim(),
      code: stationData.code ? stationData.code.trim().toUpperCase() : '',
      description: stationData.description ? stationData.description.trim() : '',
      sortOrder: Number(stationData.sortOrder || 0),
      isActive: stationData.isActive !== undefined ? Boolean(stationData.isActive) : true,
    };
    const res = await apiClient.post('/kitchen-stations', payload);
    return this.normalizeStation(res?.data || res);
  }

  async updateStation(id, stationData) {
    const payload = {};
    if (stationData.name !== undefined) payload.name = stationData.name.trim();
    if (stationData.code !== undefined) payload.code = stationData.code.trim().toUpperCase();
    if (stationData.description !== undefined) payload.description = stationData.description.trim();
    if (stationData.sortOrder !== undefined) payload.sortOrder = Number(stationData.sortOrder);
    if (stationData.isActive !== undefined) payload.isActive = Boolean(stationData.isActive);

    const res = await apiClient.patch(`/kitchen-stations/${id}`, payload);
    return this.normalizeStation(res?.data || res);
  }

  async deleteStation(id) {
    const res = await apiClient.delete(`/kitchen-stations/${id}`);
    return res;
  }

  async toggleStationStatus(id) {
    const stations = await this.getStations(false);
    const current = stations.find((s) => s.id === id);
    const newStatus = current ? !current.isActive : false;

    return this.updateStation(id, { isActive: newStatus });
  }

  // Aliases for compatibility
  async getKitchenStations(isActiveOnly = false) {
    return this.getStations(isActiveOnly);
  }

  async getKitchenStationById(id) {
    return this.getStationById(id);
  }

  async createKitchenStation(stationData) {
    return this.createStation(stationData);
  }

  async updateKitchenStation(id, stationData) {
    return this.updateStation(id, stationData);
  }

  async deleteKitchenStation(id) {
    return this.deleteStation(id);
  }

  async toggleKitchenStationStatus(id) {
    return this.toggleStationStatus(id);
  }
}

export const kitchenStationApiRepository = new KitchenStationApiRepository();
