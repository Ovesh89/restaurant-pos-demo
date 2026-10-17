import { ALL_PERMISSIONS } from '../../config/permissions.js';
import {
  AuthenticationAppError,
  ConflictAppError,
  NotFoundAppError,
  PermissionDeniedAppError,
  ValidationAppError,
} from '../../middleware/errorHandler.js';
import { auditService } from '../audit/service.js';
import { checkPassword, makePassword } from './password.js';
import { roleRepository, userRepository, UserRepository } from './repositories.js';
import { decodeToken, generateAccessToken, generateRefreshToken } from './tokens.js';

export class IdentityService {
  constructor() {
    this.userRepo = userRepository;
    this.roleRepo = roleRepository;
  }

  async login(username, password) {
    if (!username || !password) {
      throw new ValidationAppError('Username and password are required.');
    }

    const userDoc = await this.userRepo.findByUsername(username);
    if (!userDoc) {
      throw new AuthenticationAppError('Invalid username or password.');
    }

    if (!userDoc.isActive) {
      throw new PermissionDeniedAppError(
        'User account is deactivated. Please contact an administrator.'
      );
    }

    const pwdHash = userDoc.passwordHash || '';
    if (!checkPassword(password, pwdHash)) {
      throw new AuthenticationAppError('Invalid username or password.');
    }

    const userId = String(userDoc._id);
    const roles = await this.roleRepo.findByIds(userDoc.roleIds || []);
    const permissionsSet = new Set();
    for (const r of roles) {
      for (const p of r.permissions || []) {
        permissionsSet.add(p);
      }
    }

    await this.userRepo.updateById(userId, {
      lastLoginAt: UserRepository.utcNowIso(),
    });

    const accessToken = generateAccessToken(userId, userDoc.username);
    const refreshToken = generateRefreshToken(userId);

    const safeUser = UserRepository.sanitizeUser(userDoc);
    const branchId = (safeUser.branchIds || [])[0] || null;

    await auditService.logAction({
      branchId,
      action: 'AUTH_LOGIN',
      entityType: 'user',
      entityId: userId,
      actorUserId: userId,
      actorName: safeUser.displayName || safeUser.username,
    });

    return {
      tokens: {
        access: accessToken,
        refresh: refreshToken,
        tokenType: 'Bearer',
      },
      user: safeUser,
      roles: roles.map((r) => ({ id: r.id, code: r.code, name: r.name })),
      permissions: Array.from(permissionsSet).sort(),
    };
  }

  async refreshAccessToken(refreshToken) {
    if (!refreshToken || typeof refreshToken !== 'string') {
      throw new ValidationAppError('Refresh token is required.');
    }

    const payload = decodeToken(refreshToken.trim(), 'refresh');
    const userId = payload.sub;
    const userDoc = await this.userRepo.findById(userId);

    if (!userDoc) {
      throw new AuthenticationAppError('User not found.');
    }
    if (!userDoc.isActive) {
      throw new PermissionDeniedAppError('User account is deactivated.');
    }

    const accessToken = generateAccessToken(userId, userDoc.username);

    // Decision 1 Compatibility Shim:
    // Return both top-level `access` (expected by Mobile client.ts) and nested `tokens.access` (expected by Web apiClient.js)
    return {
      access: accessToken,
      tokenType: 'Bearer',
      tokens: {
        access: accessToken,
        tokenType: 'Bearer',
      },
    };
  }

  async logout(user) {
    const branchId = (user.branchIds || [])[0] || null;
    await auditService.logAction({
      branchId,
      action: 'AUTH_LOGOUT',
      entityType: 'user',
      entityId: user.id,
      actorUserId: user.id,
      actorName: user.displayName,
    });
    return { loggedOut: true };
  }

  async getMe(user) {
    const userDoc = await this.userRepo.findSafeById(user.id);
    if (!userDoc) {
      throw new NotFoundAppError('User not found.');
    }
    const roles = await this.roleRepo.findByIds(userDoc.roleIds || []);
    const permissionsSet = new Set();
    for (const r of roles) {
      for (const p of r.permissions || []) {
        permissionsSet.add(p);
      }
    }

    return {
      user: userDoc,
      roles: roles.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        permissions: r.permissions || [],
      })),
      permissions: Array.from(permissionsSet).sort(),
    };
  }

  // --- Users CRUD ---

  async listUsers({ branchId = null, isActive = null, search = null, roleId = null, role = null, page = 1, limit = 50 } = {}) {
    const query = {};
    if (branchId) query.branchIds = branchId;
    if (isActive !== null && isActive !== undefined) query.isActive = Boolean(isActive);

    const targetRole = roleId || (role ? (role.startsWith('role-') ? role : `role-${role.toLowerCase()}`) : null);
    if (targetRole) {
      query.roleIds = targetRole;
    }

    if (search && String(search).trim()) {
      const qClean = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { username: { $regex: qClean, $options: 'i' } },
        { displayName: { $regex: qClean, $options: 'i' } },
        { email: { $regex: qClean, $options: 'i' } },
        { mobile: { $regex: qClean, $options: 'i' } },
        { phone: { $regex: qClean, $options: 'i' } },
      ];
    }

    const result = await this.userRepo.findPaginated(query, {
      page,
      limit,
      sort: [['createdAt', -1]],
      projection: { passwordHash: 0 },
    });

    const allRoleIds = new Set();
    for (const u of result.items) {
      for (const rid of u.roleIds || []) {
        allRoleIds.add(rid);
      }
    }
    const rolesList = await this.roleRepo.findByIds(Array.from(allRoleIds));
    const roleMap = new Map(rolesList.map((r) => [r.id, r]));

    for (const u of result.items) {
      u.roles = (u.roleIds || [])
        .filter((rid) => roleMap.has(rid))
        .map((rid) => {
          const r = roleMap.get(rid);
          return { id: r.id, code: r.code, name: r.name };
        });
    }

    return result;
  }

  async getUser(userId) {
    const userDoc = await this.userRepo.findSafeById(userId);
    if (!userDoc) {
      throw new NotFoundAppError(`User '${userId}' not found.`);
    }
    const roles = await this.roleRepo.findByIds(userDoc.roleIds || []);
    userDoc.roles = roles.map((r) => ({ id: r.id, code: r.code, name: r.name }));
    return userDoc;
  }

  async createUser(data, actor) {
    const rawUsername = String(data.username || '').trim().toLowerCase();
    if (!rawUsername || rawUsername.length < 3) {
      throw new ValidationAppError('Username must be at least 3 characters.');
    }
    if (!data.password || String(data.password).length < 4) {
      throw new ValidationAppError('Password must be at least 4 characters.');
    }
    if (!data.displayName || !String(data.displayName).trim()) {
      throw new ValidationAppError('displayName is required.');
    }
    if (!Array.isArray(data.roleIds) || data.roleIds.length === 0) {
      throw new ValidationAppError('At least one roleId is required.');
    }

    const existing = await this.userRepo.findByUsername(rawUsername);
    if (existing) {
      throw new ConflictAppError(`Username '${rawUsername}' already exists.`);
    }

    const roles = await this.roleRepo.findByIds(data.roleIds);
    if (roles.length !== data.roleIds.length) {
      throw new ValidationAppError('One or more specified roleIds do not exist.');
    }

    const doc = {
      username: rawUsername,
      passwordHash: makePassword(data.password),
      displayName: String(data.displayName).trim(),
      email: data.email || null,
      mobile: data.mobile || null,
      roleIds: data.roleIds.map(String),
      branchIds: Array.isArray(data.branchIds) ? data.branchIds.map(String) : ['branch-main'],
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
      lastLoginAt: null,
    };

    const created = await this.userRepo.insertOne(doc, 'usr');
    const safeCreated = UserRepository.sanitizeUser(created);
    safeCreated.roles = roles.map((r) => ({ id: r.id, code: r.code, name: r.name }));

    await auditService.logAction({
      branchId: (doc.branchIds || [])[0] || null,
      action: 'USER_CREATED',
      entityType: 'user',
      entityId: safeCreated.id,
      actorUserId: actor.id,
      actorName: actor.displayName,
      after: safeCreated,
    });

    return safeCreated;
  }

  async updateUser(userId, data, actor) {
    const beforeDoc = await this.userRepo.findById(userId);
    if (!beforeDoc) {
      throw new NotFoundAppError(`User '${userId}' not found.`);
    }

    const updateFields = {};
    if (data.displayName !== undefined) {
      updateFields.displayName = String(data.displayName).trim();
    }
    if (data.username !== undefined) {
      const cleanUsername = String(data.username).trim().toLowerCase();
      if (!cleanUsername) {
        throw new ValidationAppError('Username cannot be empty.');
      }
      if (cleanUsername !== beforeDoc.username) {
        const existing = await this.userRepo.findByUsername(cleanUsername);
        if (existing && String(existing._id || existing.id) !== String(userId)) {
          throw new ConflictAppError(`Username '${cleanUsername}' is already taken.`);
        }
        updateFields.username = cleanUsername;
      }
    }
    if ('email' in data) updateFields.email = data.email;
    if ('mobile' in data) updateFields.mobile = data.mobile;
    if (data.password) {
      if (String(data.password).length < 4) {
        throw new ValidationAppError('Password must be at least 4 characters.');
      }
      updateFields.passwordHash = makePassword(data.password);
    }
    if ('roleIds' in data && Array.isArray(data.roleIds)) {
      const roles = await this.roleRepo.findByIds(data.roleIds);
      if (roles.length !== data.roleIds.length) {
        throw new ValidationAppError('One or more specified roleIds do not exist.');
      }
      updateFields.roleIds = data.roleIds.map(String);
    }
    if ('branchIds' in data && Array.isArray(data.branchIds)) {
      updateFields.branchIds = data.branchIds.map(String);
    }
    if ('isActive' in data) {
      updateFields.isActive = Boolean(data.isActive);
    }

    const updated = await this.userRepo.updateById(userId, updateFields);
    const safeUpdated = UserRepository.sanitizeUser(updated);
    const roles = await this.roleRepo.findByIds(safeUpdated.roleIds || []);
    safeUpdated.roles = roles.map((r) => ({ id: r.id, code: r.code, name: r.name }));

    await auditService.logAction({
      branchId: (safeUpdated.branchIds || [])[0] || null,
      action: 'USER_UPDATED',
      entityType: 'user',
      entityId: userId,
      actorUserId: actor.id,
      actorName: actor.displayName,
      before: UserRepository.sanitizeUser(beforeDoc),
      after: safeUpdated,
    });

    return safeUpdated;
  }

  async setUserActiveStatus(userId, isActive, actor) {
    const beforeDoc = await this.userRepo.findById(userId);
    if (!beforeDoc) {
      throw new NotFoundAppError(`User '${userId}' not found.`);
    }

    const updated = await this.userRepo.updateById(userId, { isActive: Boolean(isActive) });
    const safeUpdated = UserRepository.sanitizeUser(updated);

    await auditService.logAction({
      branchId: (safeUpdated.branchIds || [])[0] || null,
      action: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      entityType: 'user',
      entityId: userId,
      actorUserId: actor.id,
      actorName: actor.displayName,
      before: { isActive: beforeDoc.isActive },
      after: { isActive: Boolean(isActive) },
    });

    return safeUpdated;
  }

  async deleteUser(userId, actor) {
    if (String(actor.id) === String(userId)) {
      throw new ValidationAppError('You cannot delete your own account.');
    }

    const beforeDoc = await this.userRepo.findById(userId);
    if (!beforeDoc) {
      throw new NotFoundAppError(`User '${userId}' not found.`);
    }

    // Safety check: Prevent deleting the last active Owner or Admin
    const roles = await this.roleRepo.findByIds(beforeDoc.roleIds || []);
    const isOwnerOrAdmin = roles.some((r) => ['OWNER', 'ADMIN'].includes(String(r.code).toUpperCase()));
    if (isOwnerOrAdmin) {
      const allUsers = await this.userRepo.findMany({ isActive: true });
      const otherAdmins = [];
      for (const u of allUsers) {
        if (String(u._id) === String(userId)) continue;
        const uRoles = await this.roleRepo.findByIds(u.roleIds || []);
        if (uRoles.some((r) => ['OWNER', 'ADMIN'].includes(String(r.code).toUpperCase()))) {
          otherAdmins.push(u);
        }
      }
      if (otherAdmins.length === 0) {
        throw new ValidationAppError('Cannot delete the last remaining active Admin or Owner account.');
      }
    }

    await this.userRepo.deleteById(userId);

    await auditService.logAction({
      branchId: (beforeDoc.branchIds || [])[0] || null,
      action: 'USER_DELETED',
      entityType: 'user',
      entityId: userId,
      actorUserId: actor.id,
      actorName: actor.displayName,
      before: UserRepository.sanitizeUser(beforeDoc),
    });

    return { success: true, id: userId, username: beforeDoc.username };
  }

  // --- Roles CRUD ---

  async listRoles() {
    return this.roleRepo.findAllActive();
  }

  async getRole(roleId) {
    const role = await this.roleRepo.findById(roleId);
    if (!role) {
      throw new NotFoundAppError(`Role '${roleId}' not found.`);
    }
    return role;
  }

  async createRole(data, actor) {
    const code = String(data.code || '').trim().toUpperCase();
    const name = String(data.name || '').trim();
    if (!code || !name) {
      throw new ValidationAppError('Role code and name are required.');
    }

    const existing = await this.roleRepo.findByCode(code);
    if (existing) {
      throw new ConflictAppError(`Role with code '${code}' already exists.`);
    }

    const perms = Array.isArray(data.permissions) ? data.permissions : [];
    const invalidPerms = perms.filter((p) => !ALL_PERMISSIONS.includes(p));
    if (invalidPerms.length > 0) {
      throw new ValidationAppError(`Unknown permission code(s): ${invalidPerms.join(', ')}`);
    }

    const doc = {
      code,
      name,
      description: data.description || '',
      permissions: Array.from(new Set(perms)).sort(),
      isSystem: false,
    };

    const created = await this.roleRepo.insertOne(doc, 'role');

    await auditService.logAction({
      action: 'ROLE_CREATED',
      entityType: 'role',
      entityId: created.id,
      actorUserId: actor.id,
      actorName: actor.displayName,
      after: created,
    });

    return created;
  }

  async updateRole(roleId, data, actor) {
    const beforeDoc = await this.roleRepo.findById(roleId);
    if (!beforeDoc) {
      throw new NotFoundAppError(`Role '${roleId}' not found.`);
    }

    const updateFields = {};
    if (data.name !== undefined) updateFields.name = String(data.name).trim();
    if (data.description !== undefined) updateFields.description = data.description;
    if ('permissions' in data && Array.isArray(data.permissions)) {
      const perms = data.permissions;
      const invalidPerms = perms.filter((p) => !ALL_PERMISSIONS.includes(p));
      if (invalidPerms.length > 0) {
        throw new ValidationAppError(`Unknown permission code(s): ${invalidPerms.join(', ')}`);
      }
      updateFields.permissions = Array.from(new Set(perms)).sort();
    }

    const updated = await this.roleRepo.updateById(roleId, updateFields);

    await auditService.logAction({
      action: 'ROLE_UPDATED',
      entityType: 'role',
      entityId: roleId,
      actorUserId: actor.id,
      actorName: actor.displayName,
      before: beforeDoc,
      after: updated,
    });

    return updated;
  }
}

export const identityService = new IdentityService();
