import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import {
  requirePermissions,
  ensureBranchAccess,
} from '../../middleware/permissions.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { successResponse } from '../../utils/response.js';
import { auditService } from './service.js';

const router = Router();

// GET /api/v1/audit
router.get(
  '/audit',
  authenticate,
  requirePermissions(['audit.view']),
  asyncHandler(async (req, res) => {
    const branchId = req.query.branchId || null;
    if (branchId) {
      ensureBranchAccess(req.user, branchId);
    }

    const result = await auditService.listAuditLogs({
      branchId,
      entityType: req.query.entityType,
      entityId: req.query.entityId,
      action: req.query.action,
      actorId: req.query.actorId,
      actorUserId: req.query.actorUserId,
      dateFrom: req.query.dateFrom || req.query.fromDate,
      dateTo: req.query.dateTo || req.query.toDate,
      search: req.query.search || req.query.q || null,
      page: parseInt(req.query.page || '1', 10) || 1,
      limit: parseInt(req.query.limit || '20', 10) || 20,
    });

    return successResponse(res, result);
  })
);

// GET /api/v1/audit/:id
router.get(
  '/audit/:id',
  authenticate,
  requirePermissions(['audit.view']),
  asyncHandler(async (req, res) => {
    const log = await auditService.getAuditLog(req.params.id);
    if (log.branchId) {
      ensureBranchAccess(req.user, log.branchId);
    }
    return successResponse(res, log);
  })
);

// POST /api/v1/audit/cleanup
router.post(
  '/audit/cleanup',
  authenticate,
  requirePermissions(['audit.view']),
  asyncHandler(async (req, res) => {
    const days = parseInt(req.body?.days || 30, 10) || 30;
    const result = await auditService.purgeOldLogs(days);
    return successResponse(res, {
      message: `Audit logs older than ${result.retentionDays} days cleaned up successfully`,
      ...result,
    });
  })
);

export default router;

