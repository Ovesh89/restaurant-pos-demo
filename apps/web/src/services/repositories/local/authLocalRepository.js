import { STORAGE_KEYS } from '../../../constants/storageKeys.js';
import { storageAdapter } from '../../storage/localStorageAdapter.js';
import { auditRepository } from '../auditRepository.js';

class AuthLocalRepository {
  async login(username, password) {
    const users = storageAdapter.getItem(STORAGE_KEYS.USERS) || [];
    const user = users.find(
      (u) => u.username.toLowerCase() === username.trim().toLowerCase() && u.password === password
    );

    if (!user) {
      throw new Error('Invalid username or password');
    }

    if (!user.isActive) {
      throw new Error('This user account is deactivated. Please contact your manager or administrator.');
    }

    // Load roles to determine permissions
    const roles = storageAdapter.getItem(STORAGE_KEYS.ROLES) || [];
    const userRole = roles.find((r) => r.name === user.role);
    const permissions = userRole ? userRole.permissions : [];

    const sessionData = {
      token: `pos_token_${Date.now()}_${user.id}`,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        mobile: user.mobile,
        branchId: user.branchId,
        language: user.language || 'en'
      },
      permissions
    };

    storageAdapter.setItem(STORAGE_KEYS.SESSION, sessionData);

    await auditRepository.logEvent({
      actorId: user.id,
      actorName: user.name,
      action: 'USER_LOGIN',
      entityType: 'User',
      entityId: user.id,
      details: `${user.name} logged in successfully as ${user.role}.`
    });

    return sessionData;
  }

  async logout() {
    const session = this.getCurrentSession();
    if (session?.user) {
      await auditRepository.logEvent({
        actorId: session.user.id,
        actorName: session.user.name,
        action: 'USER_LOGOUT',
        entityType: 'User',
        entityId: session.user.id,
        details: `${session.user.name} logged out.`
      });
    }
    storageAdapter.removeItem(STORAGE_KEYS.SESSION);
    return true;
  }

  getCurrentSession() {
    return storageAdapter.getItem(STORAGE_KEYS.SESSION);
  }

  async updateProfile(userId, profileData) {
    const users = storageAdapter.getItem(STORAGE_KEYS.USERS) || [];
    const index = users.findIndex((u) => u.id === userId);
    if (index === -1) {
      throw new Error('User not found');
    }

    if (profileData.username) {
      const cleanUsername = profileData.username.trim().toLowerCase();
      const existing = users.find((u) => u.username.toLowerCase() === cleanUsername && u.id !== userId);
      if (existing) {
        throw new Error(`Username '${cleanUsername}' is already taken.`);
      }
      users[index].username = cleanUsername;
    }

    users[index] = {
      ...users[index],
      name: profileData.name || users[index].name,
      mobile: profileData.mobile !== undefined ? profileData.mobile : users[index].mobile,
      language: profileData.language || users[index].language || 'en',
      updatedAt: new Date().toISOString()
    };

    storageAdapter.setItem(STORAGE_KEYS.USERS, users);

    // Update current session if the same user
    const currentSession = this.getCurrentSession();
    if (currentSession?.user?.id === userId) {
      currentSession.user.name = users[index].name;
      currentSession.user.username = users[index].username;
      currentSession.user.mobile = users[index].mobile;
      currentSession.user.language = users[index].language;
      storageAdapter.setItem(STORAGE_KEYS.SESSION, currentSession);
    }

    await auditRepository.logEvent({
      actorId: userId,
      actorName: users[index].name,
      action: 'PROFILE_UPDATED',
      entityType: 'User',
      entityId: userId,
      details: `Profile details updated for ${users[index].name}.`
    });

    return users[index];
  }

  async changePassword(userId, oldPassword, newPassword) {
    const users = storageAdapter.getItem(STORAGE_KEYS.USERS) || [];
    const index = users.findIndex((u) => u.id === userId);
    if (index === -1) {
      throw new Error('User not found');
    }

    if (users[index].password !== oldPassword) {
      throw new Error('Current password does not match.');
    }

    if (!newPassword || newPassword.length < 4) {
      throw new Error('New password must be at least 4 characters long.');
    }

    users[index].password = newPassword;
    users[index].updatedAt = new Date().toISOString();
    storageAdapter.setItem(STORAGE_KEYS.USERS, users);

    await auditRepository.logEvent({
      actorId: userId,
      actorName: users[index].name,
      action: 'PASSWORD_CHANGED',
      entityType: 'User',
      entityId: userId,
      details: `Password changed for user ${users[index].username}.`
    });

    return true;
  }
}

export const authLocalRepository = new AuthLocalRepository();
