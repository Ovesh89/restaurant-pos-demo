import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import {
  requireAnyPermission,
  ensureBranchAccess,
} from '../../middleware/permissions.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { successResponse, createdResponse } from '../../utils/response.js';
import { customerService } from './service.js';

const router = Router();

// GET /api/v1/customers
router.get(
  '/customers',
  authenticate,
  requireAnyPermission(['customer.view', 'customer.manage', 'customer.edit']),
  asyncHandler(async (req, res) => {
    const branchId =
      req.query.branchId ||
      (Array.isArray(req.user.branchIds) && req.user.branchIds[0]) ||
      'branch-main';
    ensureBranchAccess(req.user, branchId);

    const query = req.query.search || req.query.q || null;
    const page = parseInt(req.query.page || '1', 10) || 1;
    const limit = parseInt(req.query.limit || '20', 10) || 20;

    const result = await customerService.searchCustomers({
      branchId,
      query,
      page,
      limit,
    });

    return successResponse(res, result);
  })
);

// POST /api/v1/customers
router.post(
  '/customers',
  authenticate,
  requireAnyPermission(['customer.manage', 'customer.edit', 'billing.create']),
  asyncHandler(async (req, res) => {
    const branchId =
      req.body?.branchId ||
      (Array.isArray(req.user.branchIds) && req.user.branchIds[0]) ||
      'branch-main';
    ensureBranchAccess(req.user, branchId);

    const customer = await customerService.createCustomer(branchId, req.body || {});
    return createdResponse(res, customer, 'Customer profile created successfully.');
  })
);

// GET /api/v1/customers/:id
router.get(
  '/customers/:id',
  authenticate,
  requireAnyPermission(['customer.view', 'customer.manage', 'customer.edit']),
  asyncHandler(async (req, res) => {
    const customer = await customerService.getCustomer(req.params.id);
    ensureBranchAccess(req.user, customer.branchId);
    return successResponse(res, customer);
  })
);

// PATCH / PUT /api/v1/customers/:id
const updateHandler = asyncHandler(async (req, res) => {
  const existing = await customerService.getCustomer(req.params.id);
  ensureBranchAccess(req.user, existing.branchId);
  const updated = await customerService.updateCustomer(req.params.id, req.body || {});
  return successResponse(res, updated, 'Customer profile updated.');
});

router.patch(
  '/customers/:id',
  authenticate,
  requireAnyPermission(['customer.manage', 'customer.edit']),
  updateHandler
);

router.put(
  '/customers/:id',
  authenticate,
  requireAnyPermission(['customer.manage', 'customer.edit']),
  updateHandler
);

// GET /api/v1/customers/:id/orders & /api/v1/customers/:id/history
const customerOrdersHandler = asyncHandler(async (req, res) => {
  const existing = await customerService.getCustomer(req.params.id);
  ensureBranchAccess(req.user, existing.branchId);
  const limit = parseInt(req.query.limit || '20', 10) || 20;
  const orders = await customerService.getCustomerOrders(req.params.id, limit);
  return successResponse(res, orders);
});

router.get(
  '/customers/:id/orders',
  authenticate,
  requireAnyPermission(['customer.view', 'customer.manage', 'customer.edit']),
  customerOrdersHandler
);

router.get(
  '/customers/:id/history',
  authenticate,
  requireAnyPermission(['customer.view', 'customer.manage', 'customer.edit']),
  customerOrdersHandler
);

export default router;
