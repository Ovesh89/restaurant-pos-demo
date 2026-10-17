import { STORAGE_KEYS } from '../../../constants/storageKeys.js';
import { SYSTEM_ROLES } from '../../../constants/roles.js';
import { storageAdapter } from '../../storage/localStorageAdapter.js';
import { auditRepository } from '../auditRepository.js';

class UserLocalRepository {
  async getUsers(filters = {}) {
    const users = storageAdapter.getItem(STORAGE_KEYS.USERS) || [];
    let list = [...users];

    if (filters.role) {
      const r = filters.role.toLowerCase();
      list = list.filter((u) => u.role?.toLowerCase() === r);
    }

    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        (u) =>
          u.name?.toLowerCase().includes(q) ||
          u.username?.toLowerCase().includes(q) ||
          u.mobile?.includes(q)
      );
    }

    if (filters.isActive !== undefined && filters.isActive !== null && filters.isActive !== '') {
      list = list.filter((u) => Boolean(u.isActive) === Boolean(filters.isActive));
    }

    const total = list.length;
    let paginated = list;
    if (filters.page || filters.limit) {
      const pageNum = Math.max(1, parseInt(filters.page, 10) || 1);
      const limitNum = Math.max(1, parseInt(filters.limit, 10) || 20);
      const totalPages = Math.max(1, Math.ceil(total / limitNum));
      paginated = list.slice((pageNum - 1) * limitNum, pageNum * limitNum);
      paginated.pagination = {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
        pages: totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      };
    } else {
      paginated.pagination = {
        total,
        page: 1,
        limit: total || 20,
        totalPages: 1,
        pages: 1,
        hasNext: false,
        hasPrev: false,
      };
    }
    paginated.items = paginated;
    return paginated;
  }

  async getUserById(id) {
    const users = await this.getUsers();
    return users.find((u) => u.id === id) || null;
  }

  async createUser(userData, actor = { id: 'admin', name: 'Admin' }) {
    const users = await this.getUsers();

    // Check unique username
    const exists = users.some(
      (u) => u.username.toLowerCase() === userData.username.trim().toLowerCase()
    );
    if (exists) {
      throw new Error(`Username "${userData.username}" is already taken.`);
    }

    const newUser = {
      id: `user-${Date.now()}`,
      name: userData.name.trim(),
      username: userData.username.trim().toLowerCase(),
      password: userData.password || 'pos123',
      role: userData.role,
      mobile: userData.mobile?.trim() || '',
      branchId: userData.branchId || 'branch-001',
      isActive: true,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    storageAdapter.setItem(STORAGE_KEYS.USERS, users);

    await auditRepository.logEvent({
      actorId: actor.id,
      actorName: actor.name,
      action: 'USER_CREATED',
      entityType: 'User',
      entityId: newUser.id,
      details: `Created new staff account for ${newUser.name} (${newUser.role}).`
    });

    return newUser;
  }

  async updateUser(id, userData, actor = { id: 'admin', name: 'Admin' }) {
    const users = await this.getUsers();
    const index = users.findIndex((u) => u.id === id);
    if (index === -1) {
      throw new Error('User not found.');
    }

    // Check username uniqueness if changed
    if (userData.username) {
      const duplicate = users.find(
        (u) => u.id !== id && u.username.toLowerCase() === userData.username.trim().toLowerCase()
      );
      if (duplicate) {
        throw new Error(`Username "${userData.username}" is already taken.`);
      }
    }

    users[index] = {
      ...users[index],
      name: userData.name?.trim() || users[index].name,
      username: userData.username ? userData.username.trim().toLowerCase() : users[index].username,
      role: userData.role || users[index].role,
      mobile: userData.mobile !== undefined ? userData.mobile.trim() : users[index].mobile,
      branchId: userData.branchId || users[index].branchId,
      updatedAt: new Date().toISOString()
    };

    if (userData.password) {
      users[index].password = userData.password;
    }

    storageAdapter.setItem(STORAGE_KEYS.USERS, users);

    await auditRepository.logEvent({
      actorId: actor.id,
      actorName: actor.name,
      action: 'USER_UPDATED',
      entityType: 'User',
      entityId: id,
      details: `Updated details for staff account ${users[index].name}.`
    });

    return users[index];
  }

  async toggleUserStatus(id, actor = { id: 'admin', name: 'Admin' }) {
    const users = await this.getUsers();
    const index = users.findIndex((u) => u.id === id);
    if (index === -1) {
      throw new Error('User not found.');
    }

    const targetUser = users[index];

    // Safety check: Prevent deactivating the last active Owner/Admin
    if (targetUser.isActive && (targetUser.role === SYSTEM_ROLES.OWNER || targetUser.role === SYSTEM_ROLES.ADMIN)) {
      const activeAdmins = users.filter(
        (u) => u.isActive && (u.role === SYSTEM_ROLES.OWNER || u.role === SYSTEM_ROLES.ADMIN)
      );
      if (activeAdmins.length <= 1) {
        throw new Error('Cannot deactivate the last active Admin or Owner account.');
      }
    }

    targetUser.isActive = !targetUser.isActive;
    targetUser.updatedAt = new Date().toISOString();
    storageAdapter.setItem(STORAGE_KEYS.USERS, users);

    await auditRepository.logEvent({
      actorId: actor.id,
      actorName: actor.name,
      action: targetUser.isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      entityType: 'User',
      entityId: id,
      details: `${targetUser.name} (${targetUser.role}) was ${targetUser.isActive ? 'activated' : 'deactivated'}.`
    });

    return targetUser;
  }
}

export const userLocalRepository = new UserLocalRepository();
