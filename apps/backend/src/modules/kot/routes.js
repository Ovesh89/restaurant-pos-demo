import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireAnyPermission, ensureBranchAccess } from '../../middleware/permissions.js';
import { asyncHandler, ValidationAppError } from '../../middleware/errorHandler.js';
import { successResponse } from '../../utils/response.js';
import { kotService, kitchenService } from './service.js';

const router = Router();

// GET /api/v1/kots
router.get(
  '/kots',
  authenticate,
  asyncHandler(async (req, res) => {
    const branchId =
      req.query.branchId ||
      (Array.isArray(req.user.branchIds) && req.user.branchIds[0]) ||
      'branch-main';
    ensureBranchAccess(req.user, branchId);

    const result = await kotService.listKots({
      branchId,
      status: req.query.status,
      orderId: req.query.orderId,
      kitchenStation: req.query.kitchenStation || req.query.station,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      page: parseInt(req.query.page || '1', 10) || 1,
      limit: parseInt(req.query.limit || '50', 10) || 50,
    });

    return successResponse(res, result);
  })
);

// GET /api/v1/kots/:id
router.get(
  '/kots/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const kot = await kotService.getKot(req.params.id);
    ensureBranchAccess(req.user, kot.branchId);
    return successResponse(res, kot);
  })
);

// GET /api/v1/kots/:id/print
router.get(
  '/kots/:id/print',
  authenticate,
  asyncHandler(async (req, res) => {
    const kot = await kotService.getKot(req.params.id);
    ensureBranchAccess(req.user, kot.branchId);
    const payload = await kotService.getPrintPayload(req.params.id);
    return successResponse(res, payload);
  })
);

// POST /api/v1/kots/:id/print-status
router.post(
  '/kots/:id/print-status',
  authenticate,
  asyncHandler(async (req, res) => {
    const kot = await kotService.getKot(req.params.id);
    ensureBranchAccess(req.user, kot.branchId);

    const { printStatus } = req.body || {};
    if (!printStatus) {
      throw new ValidationAppError('printStatus is required.');
    }

    const updated = await kotService.updatePrintStatus(req.params.id, printStatus);
    return successResponse(res, updated, 'Print status updated.');
  })
);

// POST /api/v1/kots/:id/status
router.post(
  '/kots/:id/status',
  authenticate,
  requireAnyPermission(['kitchen.update', 'kot.manage']),
  asyncHandler(async (req, res) => {
    const kot = await kotService.getKot(req.params.id);
    ensureBranchAccess(req.user, kot.branchId);

    const { status, notes } = req.body || {};
    if (!status) {
      throw new ValidationAppError('status is required.');
    }

    const updatedKot = await kitchenService.updateKotStatus({
      kotId: req.params.id,
      newStatus: String(status).toUpperCase(),
      actorId: req.user.id,
      actorName: req.user.displayName || req.user.username,
      notes,
    });

    return successResponse(res, updatedKot, `KOT marked as ${updatedKot.status}.`);
  })
);

// GET /api/v1/kitchen/queue
router.get(
  '/kitchen/queue',
  authenticate,
  asyncHandler(async (req, res) => {
    const branchId =
      req.query.branchId ||
      (Array.isArray(req.user.branchIds) && req.user.branchIds[0]) ||
      'branch-main';
    ensureBranchAccess(req.user, branchId);

    const kitchenStation = req.query.station || req.query.kitchenStation || null;
    const queue = await kitchenService.getKitchenQueue({
      branchId,
      kitchenStation,
    });

    return successResponse(res, queue);
  })
);

export default router;
