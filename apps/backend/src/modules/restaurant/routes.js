import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import {
  requireAnyPermission,
  requirePermissions,
} from '../../middleware/permissions.js';
import { createdResponse, successResponse } from '../../utils/response.js';
import { restaurantService } from './service.js';

const router = Router();

function resolveBranchId(req) {
  return (
    req.query.branchId ||
    req.body?.branchId ||
    (req.user?.branchIds || [])[0] ||
    'branch-main'
  );
}

// --- Branches ---

// GET /api/v1/branches
router.get(
  '/branches',
  authenticate,
  requireAnyPermission(['branch.view', 'table.view', 'menu.view']),
  asyncHandler(async (req, res) => {
    const branches = await restaurantService.listBranches(req.user);
    return successResponse(res, branches);
  })
);

// POST /api/v1/branches
router.post(
  '/branches',
  authenticate,
  requirePermissions(['branch.manage']),
  asyncHandler(async (req, res) => {
    const created = await restaurantService.createBranch(req.body || {}, req.user);
    return createdResponse(res, created, 'Branch created successfully.');
  })
);

// --- Public Restaurant Branding ---
// GET /api/v1/restaurant/branding (Public endpoint for login screen, tab title, and branding assets)
router.get(
  '/restaurant/branding',
  asyncHandler(async (req, res) => {
    const branchId = req.query.branchId || 'branch-main';
    const branch = await restaurantService.branchRepo.findById(branchId);
    if (!branch) {
      return successResponse(res, {
        restaurantName: 'Green Tandoor Se',
        tagline: 'Garden Restaurant',
        branchName: 'Main Branch (Gandhinagar)',
        logo: '/logo.png',
        logoWhite: '/logo-white.png',
        logoBlack: '/logo-black.png',
        logoReceipt: '/logo-receipt.png',
        logoRedReceipt: '/logo-red-receipt.png',
        favicon: '/favicon.png',
        requireOrderApproval: true,
        defaultTaxRate: 5.0,
        taxConfig: { rate: '5.00', mode: 'EXCLUSIVE', gstin: '24ABCDE1234F1Z5' },
      });
    }
    const defaultTaxRate = Number(
      branch.taxConfig?.rate !== undefined
        ? branch.taxConfig.rate
        : branch.taxConfig?.gstRate !== undefined
        ? branch.taxConfig.gstRate
        : 5.0
    );
    return successResponse(res, {
      restaurantName: branch.restaurantName || branch.name || 'Green Tandoor Se',
      tagline: branch.tagline !== undefined ? branch.tagline : 'Garden Restaurant',
      branchName: branch.name || 'Main Branch (Gandhinagar)',
      address: branch.address || '',
      phone: branch.phone || '',
      email: branch.email || '',
      gstin: branch.gstin || branch.taxConfig?.gstin || '',
      defaultTaxRate,
      taxConfig: branch.taxConfig || { rate: String(defaultTaxRate), mode: 'EXCLUSIVE', gstin: branch.gstin || '' },
      logo: branch.logo || '/logo.png',
      logoWhite: branch.logoWhite || '/logo-white.png',
      logoBlack: branch.logoBlack || '/logo-black.png',
      logoReceipt: branch.logoReceipt || '/logo-receipt.png',
      logoRedReceipt: branch.logoRedReceipt || '/logo-red-receipt.png',
      favicon: branch.favicon || '/favicon.png',
      requireOrderApproval: branch.requireOrderApproval !== undefined ? Boolean(branch.requireOrderApproval) : true,
    });
  })
);

// GET /api/v1/branches/:branchId (Decision 3 compatibility endpoint for Web Settings & Mobile Branch lookup)
router.get(
  '/branches/:branchId',
  authenticate,
  asyncHandler(async (req, res) => {
    const branch = await restaurantService.getBranch(req.params.branchId, req.user);
    return successResponse(res, branch);
  })
);

// PATCH /api/v1/branches/:branchId (Decision 3 compatibility endpoint for Web Settings persistence)
router.patch(
  '/branches/:branchId',
  authenticate,
  requirePermissions(['branch.manage']),
  asyncHandler(async (req, res) => {
    const updated = await restaurantService.updateBranch(
      req.params.branchId,
      req.body || {},
      req.user
    );
    return successResponse(res, updated, 'Branch updated successfully.');
  })
);

// --- Areas ---

// GET /api/v1/areas
router.get(
  '/areas',
  authenticate,
  requireAnyPermission(['area.view', 'table.view']),
  asyncHandler(async (req, res) => {
    const branchId = resolveBranchId(req);
    const isActiveOnly = ['true', '1', 'yes'].includes(
      String(req.query.isActiveOnly || 'false').toLowerCase()
    );
    const areas = await restaurantService.listAreas(branchId, req.user, isActiveOnly);
    return successResponse(res, areas);
  })
);

// POST /api/v1/areas
router.post(
  '/areas',
  authenticate,
  requirePermissions(['area.manage']),
  asyncHandler(async (req, res) => {
    const created = await restaurantService.createArea(req.body || {}, req.user);
    return createdResponse(res, created, 'Area created successfully.');
  })
);

// PATCH /api/v1/areas/:areaId
router.patch(
  '/areas/:areaId',
  authenticate,
  requirePermissions(['area.manage']),
  asyncHandler(async (req, res) => {
    const updated = await restaurantService.updateArea(
      req.params.areaId,
      req.body || {},
      req.user
    );
    return successResponse(res, updated, 'Area updated successfully.');
  })
);

// DELETE /api/v1/areas/:areaId
router.delete(
  '/areas/:areaId',
  authenticate,
  requirePermissions(['area.manage']),
  asyncHandler(async (req, res) => {
    const result = await restaurantService.deleteArea(req.params.areaId, req.user);
    return successResponse(res, result, 'Area deleted successfully.');
  })
);

// --- Kitchen Stations ---

// GET /api/v1/kitchen-stations
router.get(
  '/kitchen-stations',
  authenticate,
  requireAnyPermission(['kot.view', 'menu.view', 'table.view']),
  asyncHandler(async (req, res) => {
    const branchId = resolveBranchId(req);
    const isActiveOnly = ['true', '1', 'yes'].includes(
      String(req.query.isActiveOnly || 'false').toLowerCase()
    );
    const stations = await restaurantService.listKitchenStations(branchId, req.user, isActiveOnly);
    return successResponse(res, stations);
  })
);

// POST /api/v1/kitchen-stations
router.post(
  '/kitchen-stations',
  authenticate,
  requireAnyPermission(['menu.manage', 'branch.manage', 'settings.manage']),
  asyncHandler(async (req, res) => {
    const created = await restaurantService.createKitchenStation(req.body || {}, req.user);
    return createdResponse(res, created, 'Kitchen station created successfully.');
  })
);

// GET /api/v1/kitchen-stations/:stationId
router.get(
  '/kitchen-stations/:stationId',
  authenticate,
  requireAnyPermission(['kot.view', 'menu.view']),
  asyncHandler(async (req, res) => {
    const station = await restaurantService.getKitchenStation(req.params.stationId, req.user);
    return successResponse(res, station);
  })
);

// PATCH /api/v1/kitchen-stations/:stationId
router.patch(
  '/kitchen-stations/:stationId',
  authenticate,
  requireAnyPermission(['menu.manage', 'branch.manage', 'settings.manage']),
  asyncHandler(async (req, res) => {
    const updated = await restaurantService.updateKitchenStation(
      req.params.stationId,
      req.body || {},
      req.user
    );
    return successResponse(res, updated, 'Kitchen station updated successfully.');
  })
);

// DELETE /api/v1/kitchen-stations/:stationId
router.delete(
  '/kitchen-stations/:stationId',
  authenticate,
  requireAnyPermission(['menu.manage', 'branch.manage', 'settings.manage']),
  asyncHandler(async (req, res) => {
    const result = await restaurantService.deleteKitchenStation(
      req.params.stationId,
      req.user
    );
    return successResponse(res, result, 'Kitchen station deleted successfully.');
  })
);

// --- Tables ---


// GET /api/v1/tables
router.get(
  '/tables',
  authenticate,
  requirePermissions(['table.view']),
  asyncHandler(async (req, res) => {
    const branchId = resolveBranchId(req);
    const { areaId, status, isActive: isActiveParam } = req.query;
    let isActive = null;
    if (isActiveParam !== undefined && isActiveParam !== null && isActiveParam !== '') {
      isActive = ['true', '1', 'yes'].includes(String(isActiveParam).toLowerCase());
    }
    const tables = await restaurantService.listTables(branchId, req.user, {
      areaId: areaId || null,
      status: status || null,
      isActive,
    });
    return successResponse(res, tables);
  })
);

// POST /api/v1/tables
router.post(
  '/tables',
  authenticate,
  requirePermissions(['table.manage']),
  asyncHandler(async (req, res) => {
    const created = await restaurantService.createTable(req.body || {}, req.user);
    return createdResponse(res, created, 'Table created successfully.');
  })
);

// GET /api/v1/tables/:tableId
router.get(
  '/tables/:tableId',
  authenticate,
  requirePermissions(['table.view']),
  asyncHandler(async (req, res) => {
    const table = await restaurantService.getTable(req.params.tableId, req.user);
    return successResponse(res, table);
  })
);

// PATCH /api/v1/tables/:tableId
router.patch(
  '/tables/:tableId',
  authenticate,
  requirePermissions(['table.manage']),
  asyncHandler(async (req, res) => {
    const updated = await restaurantService.updateTable(
      req.params.tableId,
      req.body || {},
      req.user
    );
    return successResponse(res, updated, 'Table updated successfully.');
  })
);

// POST /api/v1/tables/transfer and POST /api/v1/tables/:tableId/transfer
router.post(
  ['/tables/transfer', '/tables/:tableId/transfer'],
  authenticate,
  requireAnyPermission(['table.manage', 'order.modify', 'order.create']),
  asyncHandler(async (req, res) => {
    const fromTableId = req.params.tableId || req.body?.fromTableId || req.body?.sourceTableId;
    const toTableId = req.body?.toTableId || req.body?.destinationTableId || req.body?.targetTableId;
    const reason = req.body?.reason || '';

    const result = await restaurantService.transferTable(
      { fromTableId, toTableId, reason },
      req.user
    );
    return successResponse(
      res,
      result,
      `Table ${result.fromTable.tableNumber} transferred to Table ${result.toTable.tableNumber} successfully.`
    );
  })
);

export default router;
