import { STORAGE_KEYS } from '../../../constants/storageKeys.js';
import { storageAdapter } from '../../storage/localStorageAdapter.js';
import { auditRepository } from '../auditRepository.js';

class RoleLocalRepository {
  async getRoles() {
    return storageAdapter.getItem(STORAGE_KEYS.ROLES) || [];
  }

  async getRoleById(id) {
    const roles = await this.getRoles();
    return roles.find((r) => r.id === id || r.name === id) || null;
  }

  async updateRolePermissions(roleId, permissions, actor = { id: 'admin', name: 'Admin' }) {
    const roles = await this.getRoles();
    const index = roles.findIndex((r) => r.id === roleId || r.name === roleId);
    if (index === -1) {
      throw new Error('Role not found.');
    }

    const previousCount = roles[index].permissions.length;
    roles[index].permissions = permissions;
    roles[index].updatedAt = new Date().toISOString();

    storageAdapter.setItem(STORAGE_KEYS.ROLES, roles);

    await auditRepository.logEvent({
      actorId: actor.id,
      actorName: actor.name,
      action: 'ROLE_PERMISSIONS_UPDATED',
      entityType: 'Role',
      entityId: roleId,
      details: `Updated permissions for role "${roles[index].label}" (${previousCount} -> ${permissions.length} permissions).`
    });

    return roles[index];
  }
}

export const roleLocalRepository = new RoleLocalRepository();
