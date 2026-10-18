import { STORAGE_KEYS } from '../../../constants/storageKeys.js';
import { storageAdapter } from '../../storage/localStorageAdapter.js';
import { auditRepository } from '../auditRepository.js';

const DEFAULT_STATIONS = [
  { id: 'station-main', name: 'Main Kitchen', code: 'MAIN', sortOrder: 1, isActive: true },
  { id: 'station-tandoor', name: 'Tandoor Station', code: 'TANDOOR', sortOrder: 2, isActive: true },
  { id: 'station-curry', name: 'Main Curry Station', code: 'CURRY', sortOrder: 3, isActive: true },
  { id: 'station-bar', name: 'Bar & Beverages', code: 'BAR', sortOrder: 4, isActive: true },
  { id: 'station-bakery', name: 'Breads & Bakery', code: 'BAKERY', sortOrder: 5, isActive: true },
  { id: 'station-dessert', name: 'Dessert Station', code: 'DESSERT', sortOrder: 6, isActive: true },
];

class KitchenStationLocalRepository {
  async getStations(isActiveOnly = false) {
    let stations = storageAdapter.getItem(STORAGE_KEYS.KITCHEN_STATIONS);
    if (!stations || !Array.isArray(stations) || stations.length === 0) {
      stations = DEFAULT_STATIONS;
      storageAdapter.setItem(STORAGE_KEYS.KITCHEN_STATIONS, stations);
    }
    if (isActiveOnly) {
      stations = stations.filter((s) => s.isActive);
    }
    return stations.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }

  async getStationById(id) {
    const stations = await this.getStations(false);
    return stations.find((s) => s.id === id) || null;
  }

  async createStation(stationData, actor = { id: 'admin', name: 'Admin' }) {
    const stations = await this.getStations(false);
    const newStation = {
      id: `station-${Date.now()}`,
      branchId: stationData.branchId || 'branch-001',
      name: stationData.name.trim(),
      code: stationData.code?.trim().toUpperCase() || '',
      description: stationData.description?.trim() || '',
      sortOrder: Number(stationData.sortOrder) || stations.length + 1,
      isActive: stationData.isActive !== undefined ? Boolean(stationData.isActive) : true,
      createdAt: new Date().toISOString(),
    };

    stations.push(newStation);
    storageAdapter.setItem(STORAGE_KEYS.KITCHEN_STATIONS, stations);

    await auditRepository.logEvent({
      actorId: actor.id,
      actorName: actor.name,
      action: 'KITCHEN_STATION_CREATED',
      entityType: 'KitchenStation',
      entityId: newStation.id,
      details: `Created kitchen station "${newStation.name}".`,
    });

    return newStation;
  }

  async updateStation(id, stationData, actor = { id: 'admin', name: 'Admin' }) {
    const stations = await this.getStations(false);
    const index = stations.findIndex((s) => s.id === id);
    if (index === -1) {
      throw new Error('Kitchen station not found.');
    }

    stations[index] = {
      ...stations[index],
      name: stationData.name?.trim() || stations[index].name,
      code: stationData.code !== undefined ? stationData.code.trim().toUpperCase() : stations[index].code,
      description: stationData.description !== undefined ? stationData.description.trim() : stations[index].description,
      sortOrder: stationData.sortOrder !== undefined ? Number(stationData.sortOrder) : stations[index].sortOrder,
      isActive: stationData.isActive !== undefined ? Boolean(stationData.isActive) : stations[index].isActive,
      updatedAt: new Date().toISOString(),
    };

    storageAdapter.setItem(STORAGE_KEYS.KITCHEN_STATIONS, stations);

    await auditRepository.logEvent({
      actorId: actor.id,
      actorName: actor.name,
      action: 'KITCHEN_STATION_UPDATED',
      entityType: 'KitchenStation',
      entityId: id,
      details: `Updated kitchen station "${stations[index].name}".`,
    });

    return stations[index];
  }

  async deleteStation(id, actor = { id: 'admin', name: 'Admin' }) {
    let stations = await this.getStations(false);
    const station = stations.find((s) => s.id === id);
    if (!station) {
      throw new Error('Kitchen station not found.');
    }

    stations = stations.filter((s) => s.id !== id);
    storageAdapter.setItem(STORAGE_KEYS.KITCHEN_STATIONS, stations);

    await auditRepository.logEvent({
      actorId: actor.id,
      actorName: actor.name,
      action: 'KITCHEN_STATION_DELETED',
      entityType: 'KitchenStation',
      entityId: id,
      details: `Deleted kitchen station "${station.name}".`,
    });

    return { success: true };
  }

  async toggleStationStatus(id, actor = { id: 'admin', name: 'Admin' }) {
    const station = await this.getStationById(id);
    if (!station) {
      throw new Error('Kitchen station not found.');
    }
    return this.updateStation(id, { isActive: !station.isActive }, actor);
  }

  // Aliases for compatibility
  async getKitchenStations(isActiveOnly = false) {
    return this.getStations(isActiveOnly);
  }

  async getKitchenStationById(id) {
    return this.getStationById(id);
  }

  async createKitchenStation(stationData, actor) {
    return this.createStation(stationData, actor);
  }

  async updateKitchenStation(id, stationData, actor) {
    return this.updateStation(id, stationData, actor);
  }

  async deleteKitchenStation(id, actor) {
    return this.deleteStation(id, actor);
  }

  async toggleKitchenStationStatus(id, actor) {
    return this.toggleStationStatus(id, actor);
  }
}

export const kitchenStationLocalRepository = new KitchenStationLocalRepository();
