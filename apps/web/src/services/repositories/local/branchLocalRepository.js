import { STORAGE_KEYS } from '../../../constants/storageKeys.js';
import { storageAdapter } from '../../storage/localStorageAdapter.js';
import { auditRepository } from '../auditRepository.js';

class BranchLocalRepository {
  async getBranches() {
    return storageAdapter.getItem(STORAGE_KEYS.BRANCHES) || [];
  }

  async getAreas(branchId = 'branch-001') {
    const areas = storageAdapter.getItem(STORAGE_KEYS.AREAS) || [];
    return areas
      .filter((a) => !branchId || a.branchId === branchId)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }

  async createArea(areaData, actor = { id: 'admin', name: 'Admin' }) {
    const areas = storageAdapter.getItem(STORAGE_KEYS.AREAS) || [];
    const newArea = {
      id: `area-${Date.now()}`,
      branchId: areaData.branchId || 'branch-001',
      name: areaData.name.trim(),
      code: areaData.code?.trim().toUpperCase() || '',
      sortOrder: Number(areaData.sortOrder) || areas.length + 1,
      isActive: true,
      createdAt: new Date().toISOString()
    };

    areas.push(newArea);
    storageAdapter.setItem(STORAGE_KEYS.AREAS, areas);

    await auditRepository.logEvent({
      actorId: actor.id,
      actorName: actor.name,
      action: 'AREA_CREATED',
      entityType: 'Area',
      entityId: newArea.id,
      details: `Created dining area "${newArea.name}".`
    });

    return newArea;
  }

  async updateArea(id, areaData, actor = { id: 'admin', name: 'Admin' }) {
    const areas = storageAdapter.getItem(STORAGE_KEYS.AREAS) || [];
    const index = areas.findIndex((a) => a.id === id);
    if (index === -1) {
      throw new Error('Area not found.');
    }

    areas[index] = {
      ...areas[index],
      name: areaData.name?.trim() || areas[index].name,
      code: areaData.code !== undefined ? areaData.code.trim().toUpperCase() : areas[index].code,
      sortOrder: areaData.sortOrder !== undefined ? Number(areaData.sortOrder) : areas[index].sortOrder,
      updatedAt: new Date().toISOString()
    };

    storageAdapter.setItem(STORAGE_KEYS.AREAS, areas);

    await auditRepository.logEvent({
      actorId: actor.id,
      actorName: actor.name,
      action: 'AREA_UPDATED',
      entityType: 'Area',
      entityId: id,
      details: `Updated dining area "${areas[index].name}".`
    });

    return areas[index];
  }

  async toggleAreaStatus(id, actor = { id: 'admin', name: 'Admin' }) {
    const areas = storageAdapter.getItem(STORAGE_KEYS.AREAS) || [];
    const index = areas.findIndex((a) => a.id === id);
    if (index === -1) {
      throw new Error('Area not found.');
    }

    areas[index].isActive = !areas[index].isActive;
    areas[index].updatedAt = new Date().toISOString();
    storageAdapter.setItem(STORAGE_KEYS.AREAS, areas);

    await auditRepository.logEvent({
      actorId: actor.id,
      actorName: actor.name,
      action: areas[index].isActive ? 'AREA_ACTIVATED' : 'AREA_DEACTIVATED',
      entityType: 'Area',
      entityId: id,
      details: `Dining area "${areas[index].name}" was ${areas[index].isActive ? 'activated' : 'deactivated'}.`
    });

    return areas[index];
  }
}

export const branchLocalRepository = new BranchLocalRepository();
