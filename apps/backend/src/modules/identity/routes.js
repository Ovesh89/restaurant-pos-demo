import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import {
  asyncHandler,
  PermissionDeniedAppError,
  ValidationAppError,
} from '../../middleware/errorHandler.js';
import { requirePermissions, requireRole } from '../../middleware/permissions.js';
import { createdResponse, successResponse } from '../../utils/response.js';
import { identityService } from './service.js';

const router = Router();

// POST /api/v1/auth/login
router.post(
  '/auth/login',
  asyncHandler(async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
      throw new ValidationAppError('Username and password are required.');
    }
    const result = await identityService.login(username, password);
    return successResponse(res, result, 'Login successful.');
  })
);

// POST /api/v1/auth/refresh
router.post(
  '/auth/refresh',
  asyncHandler(async (req, res) => {
    const { refresh } = req.body || {};
    if (!refresh) {
      throw new ValidationAppError('Refresh token is required.');
    }
    const result = await identityService.refreshAccessToken(refresh);
    return successResponse(res, result, 'Token refreshed successfully.');
  })
);

// POST /api/v1/auth/logout
router.post(
  '/auth/logout',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await identityService.logout(req.user);
    return successResponse(res, result, 'Logged out successfully.');
  })
);

// GET /api/v1/me
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await identityService.getMe(req.user);
    return successResponse(res, result);
  })
);

// GET /api/v1/users
router.get(
  '/users',
  authenticate,
  requirePermissions(['user.view']),
  asyncHandler(async (req, res) => {
    const { branchId, isActive: isActiveParam, search, roleId, role, page = 1, limit = 50 } = req.query;
    let isActive = null;
    if (isActiveParam !== undefined && isActiveParam !== null && isActiveParam !== '') {
      isActive = ['true', '1', 'yes'].includes(String(isActiveParam).toLowerCase());
    }
    const result = await identityService.listUsers({
      branchId: branchId || null,
      isActive,
      search: search || req.query.q || null,
      roleId: roleId || null,
      role: role || null,
      page,
      limit,
    });
    return successResponse(res, result);
  })
);

// POST /api/v1/users
router.post(
  '/users',
  authenticate,
  requirePermissions(['user.manage']),
  asyncHandler(async (req, res) => {
    const created = await identityService.createUser(req.body || {}, req.user);
    return createdResponse(res, created, 'User created successfully.');
  })
);

// GET /api/v1/users/:userId
router.get(
  '/users/:userId',
  authenticate,
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    if (req.user.id !== userId && !req.user.hasPermission('user.view')) {
      throw new PermissionDeniedAppError('Missing required permission(s): user.view');
    }
    const user = await identityService.getUser(userId);
    return successResponse(res, user);
  })
);

// PATCH /api/v1/users/:userId
// Decision 4 Compatibility Shim: allow self-profile/password updates for any authenticated user,
// while requiring user.manage for administrative fields or updating other users.
router.patch(
  '/users/:userId',
  authenticate,
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const body = req.body || {};
    const isSelf = req.user.id === userId;
    const hasAdminFields =
      'roleIds' in body || 'branchIds' in body || 'isActive' in body;

    if (!isSelf || hasAdminFields) {
      if (!req.user.hasPermission('user.manage')) {
        throw new PermissionDeniedAppError('Missing required permission(s): user.manage');
      }
    }

    const updated = await identityService.updateUser(userId, body, req.user);
    return successResponse(res, updated, 'User updated successfully.');
  })
);

// POST /api/v1/users/:userId/activate
router.post(
  '/users/:userId/activate',
  authenticate,
  requirePermissions(['user.manage']),
  asyncHandler(async (req, res) => {
    const updated = await identityService.setUserActiveStatus(
      req.params.userId,
      true,
      req.user
    );
    return successResponse(res, updated, 'User activated.');
  })
);

// POST /api/v1/users/:userId/deactivate
router.post(
  '/users/:userId/deactivate',
  authenticate,
  requirePermissions(['user.manage']),
  asyncHandler(async (req, res) => {
    const updated = await identityService.setUserActiveStatus(
      req.params.userId,
      false,
      req.user
    );
    return successResponse(res, updated, 'User deactivated.');
  })
);

// DELETE /api/v1/users/:userId
router.delete(
  '/users/:userId',
  authenticate,
  requireRole(['owner', 'admin']),
  asyncHandler(async (req, res) => {
    const result = await identityService.deleteUser(
      req.params.userId,
      req.user
    );
    return successResponse(res, result, 'User account deleted successfully.');
  })
);

// GET /api/v1/roles
router.get(
  '/roles',
  authenticate,
  requirePermissions(['role.view']),
  asyncHandler(async (_req, res) => {
    const roles = await identityService.listRoles();
    return successResponse(res, roles);
  })
);

// POST /api/v1/roles
router.post(
  '/roles',
  authenticate,
  requirePermissions(['role.manage']),
  asyncHandler(async (req, res) => {
    const created = await identityService.createRole(req.body || {}, req.user);
    return createdResponse(res, created, 'Role created successfully.');
  })
);

// GET /api/v1/roles/:roleId
router.get(
  '/roles/:roleId',
  authenticate,
  requirePermissions(['role.view']),
  asyncHandler(async (req, res) => {
    const role = await identityService.getRole(req.params.roleId);
    return successResponse(res, role);
  })
);

// PATCH /api/v1/roles/:roleId
router.patch(
  '/roles/:roleId',
  authenticate,
  requirePermissions(['role.manage']),
  asyncHandler(async (req, res) => {
    const updated = await identityService.updateRole(
      req.params.roleId,
      req.body || {},
      req.user
    );
    return successResponse(res, updated, 'Role updated successfully.');
  })
);

export default router;
