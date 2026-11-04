import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole, ensureBranchAccess } from '../../middleware/permissions.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { successResponse } from '../../utils/response.js';
import { accountsService } from './service.js';

const router = Router();

// Permitted management roles: Admin, Owner, Super Admin
const ADMIN_ROLES = ['OWNER', 'ADMIN', 'SUPER_ADMIN', 'SUPERADMIN'];

// GET /api/v1/accounts/status - Get current operational date & session
router.get(
  ['/accounts/status', '/accounts/operational-status'],
  authenticate,
  requireRole(ADMIN_ROLES),
  asyncHandler(async (_req, res) => {
    const status = accountsService.getOperationalStatus();
    return successResponse(res, status);
  })
);

// GET /api/v1/accounts/daily-summary - Daily order calculations, payment breakdown & order ledger
router.get(
  ['/accounts/daily-summary', '/accounts/summary'],
  authenticate,
  requireRole(ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const branchId =
      req.query.branchId ||
      (Array.isArray(req.user.branchIds) && req.user.branchIds[0]) ||
      'branch-main';
    ensureBranchAccess(req.user, branchId);

    const date = req.query.date || null;
    const session = req.query.session || 'ALL';

    const result = await accountsService.getDailySummary({
      branchId,
      date,
      session,
    });

    return successResponse(res, result);
  })
);

export default router;
