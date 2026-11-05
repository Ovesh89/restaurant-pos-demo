/**
 * API Role Repository
 * Connects to Django/Express REST API role management endpoints (/api/v1/roles/*)
 * Integrated with central TanStack Query client for unified cross-screen caching
 */

import { apiClient } from '../../api/apiClient.js';
import { queryClient } from '../../../config/queryClient.js';
import { queryKeys } from '../../../constants/queryKeys.js';
import { CACHE_POLICIES } from '../../../config/cachePolicies.js';
import { cacheInvalidationService } from '../../cache/cacheInvalidationService.js';

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
    return queryClient.fetchQuery({
      queryKey: queryKeys.roles(),
      queryFn: async () => {
        const roles = await apiClient.get('/roles');
        const items = Array.isArray(roles) ? roles : [];
        return items.map((r) => this.normalizeRole(r));
      },
      staleTime: CACHE_POLICIES.ROLES_PERMISSIONS.staleTime,
      gcTime: CACHE_POLICIES.ROLES_PERMISSIONS.gcTime,
    });
  }

  async getRoleById(id) {
    const role = await apiClient.get(`/roles/${id}`);
    return this.normalizeRole(role);
  }

  async updateRolePermissions(roleId, permissions) {
    const updated = await apiClient.patch(`/roles/${roleId}`, {
      permissions
    });
    const normalized = this.normalizeRole(updated);
    cacheInvalidationService.invalidateRoles();
    return normalized;
  }
}

export const roleApiRepository = new RoleApiRepository();
