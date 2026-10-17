/**
 * API Role Repository
 * Connects to Django REST API role management endpoints (/api/v1/roles/*)
 */

import { apiClient } from '../../api/apiClient.js';

class RoleApiRepository {
  normalizeRole(role) {
    if (!role) return null;
    return {
      ...role,
      id: role._id || role.id,
      name: role.code?.toLowerCase() || role.name?.toLowerCase(),
      label: role.name,
      code: role.code,
      permissions: role.permissions || []
    };
  }

  async getRoles() {
    const roles = await apiClient.get('/roles');
    const items = Array.isArray(roles) ? roles : [];
    return items.map((r) => this.normalizeRole(r));
  }

  async getRoleById(id) {
    const role = await apiClient.get(`/roles/${id}`);
    return this.normalizeRole(role);
  }

  async updateRolePermissions(roleId, permissions) {
    const updated = await apiClient.patch(`/roles/${roleId}`, {
      permissions
    });
    return this.normalizeRole(updated);
  }
}

export const roleApiRepository = new RoleApiRepository();
