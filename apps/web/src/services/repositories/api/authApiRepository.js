/**
 * API Auth Repository
 * Connects to Django REST API authentication endpoints (/api/v1/auth/*, /api/v1/me, /api/v1/users/{id})
 */

import { apiClient } from '../../api/apiClient.js';
import { tokenStorage } from '../../api/tokenStorage.js';

class AuthApiRepository {
  async login(username, password) {
    const data = await apiClient.post('/auth/login', {
      username: username.trim(),
      password
    });

    const { tokens, user, roles, permissions } = data;
    tokenStorage.setTokens(tokens);

    // Map backend response into format expected by existing AuthContext
    const primaryRole = roles?.[0]?.code?.toLowerCase() || 'staff';
    const primaryBranch = user.branchIds?.[0] || 'branch-main';

    const sessionData = {
      token: tokens.access,
      user: {
        id: user.id,
        name: user.displayName || user.username,
        displayName: user.displayName,
        username: user.username,
        role: primaryRole,
        roleCode: roles?.[0]?.code,
        mobile: user.mobile || '',
        branchId: primaryBranch,
        branchIds: user.branchIds || [primaryBranch],
        isActive: user.isActive
      },
      permissions: permissions || []
    };

    tokenStorage.setSessionData(sessionData);
    return sessionData;
  }

  async logout() {
    try {
      await apiClient.post('/auth/logout');
    } catch (err) {
      console.warn('[AuthApiRepository] Logout request failed on server, clearing client session:', err);
    } finally {
      tokenStorage.clearTokens();
    }
    return true;
  }

  getCurrentSession() {
    return tokenStorage.getSessionData();
  }

  /**
   * Validates active session against /api/v1/me and updates cached permissions
   */
  async restoreSession() {
    const accessToken = tokenStorage.getAccessToken();
    if (!accessToken) return null;

    try {
      const data = await apiClient.get('/me');
      const { user, roles, permissions } = data;
      const primaryRole = roles?.[0]?.code?.toLowerCase() || 'staff';
      const primaryBranch = user.branchIds?.[0] || 'branch-main';

      const sessionData = {
        token: accessToken,
        user: {
          id: user.id,
          name: user.displayName || user.username,
          displayName: user.displayName,
          username: user.username,
          role: primaryRole,
          roleCode: roles?.[0]?.code,
          mobile: user.mobile || '',
          branchId: primaryBranch,
          branchIds: user.branchIds || [primaryBranch],
          isActive: user.isActive
        },
        permissions: permissions || []
      };

      tokenStorage.setSessionData(sessionData);
      return sessionData;
    } catch (err) {
      console.warn('[AuthApiRepository] Session restore failed:', err);
      return null;
    }
  }

  async updateProfile(userId, profileData) {
    const payload = {};
    if (profileData.name) payload.displayName = profileData.name.trim();
    if (profileData.username) payload.username = profileData.username.trim().toLowerCase();
    if (profileData.mobile !== undefined) payload.mobile = profileData.mobile.trim();

    const updated = await apiClient.patch(`/users/${userId}`, payload);

    // Update cached session
    const current = this.getCurrentSession();
    if (current && current.user?.id === userId) {
      current.user.name = updated.displayName || current.user.name;
      current.user.displayName = updated.displayName;
      current.user.username = updated.username || current.user.username;
      current.user.mobile = updated.mobile;
      tokenStorage.setSessionData(current);
    }

    return {
      ...updated,
      name: updated.displayName
    };
  }

  async changePassword(userId, oldPassword, newPassword) {
    await apiClient.patch(`/users/${userId}`, {
      password: newPassword
    });
    return true;
  }
}

export const authApiRepository = new AuthApiRepository();
