import {
  AuthenticationAppError,
  PermissionDeniedAppError,
} from './errorHandler.js';

/**
 * Require all specified permissions on req.user.
 */
export function requirePermissions(requiredPerms = []) {
  return function checkPermissions(req, _res, next) {
    if (!req.user) {
      return next(new AuthenticationAppError());
    }
    const missing = requiredPerms.filter((p) => !req.user.hasPermission(p));
    if (missing.length > 0) {
      return next(
        new PermissionDeniedAppError(
          `Missing required permission(s): ${missing.join(', ')}`
        )
      );
    }
    return next();
  };
}

/**
 * Require at least one of the specified permissions on req.user.
 */
export function requireAnyPermission(anyPerms = []) {
  return function checkAnyPermission(req, _res, next) {
    if (!req.user) {
      return next(new AuthenticationAppError());
    }
    if (anyPerms.length > 0 && !req.user.hasAnyPermission(anyPerms)) {
      return next(
        new PermissionDeniedAppError(
          `Requires at least one of permission(s): ${anyPerms.join(', ')}`
        )
      );
    }
    return next();
  };
}

/**
 * Verify that user is allowed to operate on branchId.
 * OWNER and ADMIN bypass branch restrictions.
 */
export function ensureBranchAccess(user, branchId) {
  if (!branchId) return true;
  if (!user) {
    throw new AuthenticationAppError();
  }
  const roleCodes = user.roleCodes || [];
  if (roleCodes.includes('OWNER') || roleCodes.includes('ADMIN')) {
    return true;
  }
  const branchIds = user.branchIds || [];
  if (!branchIds.includes(branchId)) {
    throw new PermissionDeniedAppError(
      `You do not have access to branch '${branchId}'.`
    );
  }
  return true;
}

/**
 * Require user to possess at least one of the specified roles (case-insensitive).
 */
export function requireRole(allowedRoles = []) {
  const normalized = allowedRoles.map((r) => String(r).toUpperCase());
  return function checkRole(req, _res, next) {
    if (!req.user) {
      return next(new AuthenticationAppError());
    }
    const userRoles = (req.user.roleCodes || []).map((r) => String(r).toUpperCase());
    const hasRole = userRoles.some((r) => normalized.includes(r));
    if (!hasRole) {
      return next(
        new PermissionDeniedAppError(
          `Action restricted to roles: ${allowedRoles.join(', ')}`
        )
      );
    }
    return next();
  };
}
