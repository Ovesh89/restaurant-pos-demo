import {
  AuthenticationAppError,
  PermissionDeniedAppError,
} from './errorHandler.js';
import { decodeToken } from '../modules/identity/tokens.js';
import { roleRepository, userRepository } from '../modules/identity/repositories.js';

/**
 * JWT Bearer Authentication Middleware.
 * Mirrors MongoJWTAuthentication in Django apps/identity/authentication.py 1:1.
 */
export async function authenticate(req, _res, next) {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization || '';
    if (!authHeader) {
      throw new AuthenticationAppError('Authentication credentials were not provided.');
    }

    const parts = String(authHeader).trim().split(/\s+/);
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      throw new AuthenticationAppError(
        'Invalid Authorization header format. Expected "Bearer <token>".'
      );
    }

    const token = parts[1];
    const payload = decodeToken(token, 'access');
    const userId = payload.sub;
    if (!userId) {
      throw new AuthenticationAppError('Invalid token payload.');
    }

    const userDoc = await userRepository.findById(userId);
    if (!userDoc) {
      throw new AuthenticationAppError('User account not found.');
    }

    if (!userDoc.isActive) {
      throw new PermissionDeniedAppError('User account is deactivated.');
    }

    const roleIds = userDoc.roleIds || [];
    const roles = await roleRepository.findByIds(roleIds);
    const permissionsSet = new Set();
    const roleCodes = [];

    for (const r of roles) {
      if (r.code) roleCodes.push(r.code);
      for (const perm of r.permissions || []) {
        permissionsSet.add(perm);
      }
    }

    req.user = {
      id: String(userDoc._id),
      _id: String(userDoc._id),
      username: userDoc.username || '',
      displayName: userDoc.displayName || userDoc.username || '',
      email: userDoc.email,
      mobile: userDoc.mobile,
      roleIds,
      branchIds: userDoc.branchIds || [],
      isActive: Boolean(userDoc.isActive),
      roles,
      roleCodes,
      permissions: Array.from(permissionsSet).sort(),
      hasPermission(perm) {
        if (roleCodes.includes('OWNER') || roleCodes.includes('ADMIN')) return true;
        return permissionsSet.has(perm);
      },
      hasAnyPermission(perms = []) {
        if (roleCodes.includes('OWNER') || roleCodes.includes('ADMIN')) return true;
        return perms.some((p) => permissionsSet.has(p));
      },
    };

    return next();
  } catch (err) {
    return next(err);
  }
}
