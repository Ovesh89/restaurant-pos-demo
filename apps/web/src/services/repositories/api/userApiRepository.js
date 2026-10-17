/**
 * API User Repository
 * Connects to Django REST API user management endpoints (/api/v1/users/*)
 */

import { apiClient } from '../../api/apiClient.js';

class UserApiRepository {
  normalizeUser(user) {
    if (!user) return null;
    const roleCode = user.roles?.[0]?.code?.toLowerCase() ||
      (user.roleIds?.[0]?.replace('role-', '') || 'staff');

    return {
      ...user,
      id: user.id || user._id,
      name: user.displayName || user.name || user.username,
      displayName: user.displayName,
      role: roleCode,
      branchId: user.branchIds?.[0] || user.branchId || 'branch-main',
      branchIds: user.branchIds || ['branch-main']
    };
  }

  async getUsers(filters = {}) {
    const params = new URLSearchParams();
    if (filters.role) params.append('role', filters.role);
    if (filters.roleId) params.append('roleId', filters.roleId);
    if (filters.search) params.append('search', filters.search);
    if (filters.branchId) params.append('branchId', filters.branchId);
    if (filters.isActive !== undefined && filters.isActive !== null && filters.isActive !== '') {
      params.append('isActive', String(filters.isActive));
    }
    if (filters.page) params.append('page', String(filters.page));
    if (filters.limit) params.append('limit', String(filters.limit));
    else if (!filters.page) params.append('limit', '100');

    const res = await apiClient.get(`/users?${params.toString()}`);
    const items = Array.isArray(res) ? res : res?.items || [];
    let list = items.map((u) => this.normalizeUser(u));

    const total = Number(res?.pagination?.total ?? list.length);
    const pageNum = Number(res?.pagination?.page ?? filters.page ?? 1);
    const limitNum = Number(res?.pagination?.limit ?? filters.limit ?? list.length ?? 20);
    const totalPages = Number(res?.pagination?.totalPages ?? res?.pagination?.pages ?? Math.max(1, Math.ceil(total / (limitNum || 1))));

    list.pagination = res?.pagination || {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages,
      pages: totalPages,
      hasNext: pageNum < totalPages,
      hasPrev: pageNum > 1,
    };
    list.items = list;

    return list;
  }

  async getUserById(id) {
    const user = await apiClient.get(`/users/${id}`);
    return this.normalizeUser(user);
  }

  async createUser(userData) {
    const roleId = userData.role ? `role-${userData.role.toLowerCase()}` : 'role-captain';
    const payload = {
      username: userData.username.trim().toLowerCase(),
      displayName: userData.name.trim(),
      password: userData.password || 'pos123',
      mobile: userData.mobile?.trim() || '',
      roleIds: userData.roleIds || [roleId],
      branchIds: userData.branchIds || [userData.branchId || 'branch-main'],
      isActive: true
    };

    const created = await apiClient.post('/users', payload);
    return this.normalizeUser(created);
  }

  async updateUser(id, userData) {
    const payload = {};
    if (userData.name) payload.displayName = userData.name.trim();
    if (userData.username) payload.username = userData.username.trim().toLowerCase();
    if (userData.mobile !== undefined) payload.mobile = userData.mobile.trim();
    if (userData.password) payload.password = userData.password;
    if (userData.role) payload.roleIds = [`role-${userData.role.toLowerCase()}`];
    if (userData.roleIds) payload.roleIds = userData.roleIds;
    if (userData.branchId) payload.branchIds = [userData.branchId];
    if (userData.branchIds) payload.branchIds = userData.branchIds;

    const updated = await apiClient.patch(`/users/${id}`, payload);
    return this.normalizeUser(updated);
  }

  async toggleUserStatus(id) {
    const current = await this.getUserById(id);
    const endpoint = current.isActive ? `/users/${id}/deactivate` : `/users/${id}/activate`;
    const updated = await apiClient.post(endpoint);
    return this.normalizeUser(updated);
  }
}

export const userApiRepository = new UserApiRepository();
