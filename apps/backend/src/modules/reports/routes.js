import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermissions, ensureBranchAccess } from '../../middleware/permissions.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { successResponse } from '../../utils/response.js';
import { reportService } from './service.js';

const router = Router();

function extractReportParams(req) {
  const branchId =
    req.query.branchId ||
    (Array.isArray(req.user.branchIds) && req.user.branchIds[0]) ||
    'branch-main';
  ensureBranchAccess(req.user, branchId);

  return {
    branchId,
    dateFrom: req.query.dateFrom || null,
    dateTo: req.query.dateTo || null,
    categoryId: req.query.categoryId || null,
  };
}

// GET /api/v1/reports/sales
router.get(
  '/reports/sales',
  authenticate,
  requirePermissions(['report.view']),
  asyncHandler(async (req, res) => {
    const params = extractReportParams(req);
    const report = await reportService.getSalesReport(params);
    return successResponse(res, report);
  })
);

// GET /api/v1/reports/items
router.get(
  '/reports/items',
  authenticate,
  requirePermissions(['report.view']),
  asyncHandler(async (req, res) => {
    const params = extractReportParams(req);
    const report = await reportService.getItemsReport(params);
    return successResponse(res, report);
  })
);

// GET /api/v1/reports/captains
router.get(
  '/reports/captains',
  authenticate,
  requirePermissions(['report.view']),
  asyncHandler(async (req, res) => {
    const params = extractReportParams(req);
    const report = await reportService.getCaptainsReport(params);
    return successResponse(res, report);
  })
);

// GET /api/v1/reports/payments
router.get(
  '/reports/payments',
  authenticate,
  requirePermissions(['report.view']),
  asyncHandler(async (req, res) => {
    const params = extractReportParams(req);
    const report = await reportService.getPaymentsReport(params);
    return successResponse(res, report);
  })
);

// GET /api/v1/reports/discounts
router.get(
  '/reports/discounts',
  authenticate,
  requirePermissions(['report.view']),
  asyncHandler(async (req, res) => {
    const params = extractReportParams(req);
    const report = await reportService.getDiscountsReport(params);
    return successResponse(res, report);
  })
);

// GET /api/v1/reports/cancellations
router.get(
  '/reports/cancellations',
  authenticate,
  requirePermissions(['report.view']),
  asyncHandler(async (req, res) => {
    const params = extractReportParams(req);
    const report = await reportService.getCancellationsReport(params);
    return successResponse(res, report);
  })
);

export default router;
