import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import {
  requirePermissions,
  requireAnyPermission,
  ensureBranchAccess,
} from '../../middleware/permissions.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { successResponse, createdResponse } from '../../utils/response.js';
import { orderService } from './service.js';

const router = Router();

// GET /api/v1/orders
router.get(
  '/orders',
  authenticate,
  asyncHandler(async (req, res) => {
    const branchId =
      req.query.branchId ||
      (Array.isArray(req.user.branchIds) && req.user.branchIds[0]) ||
      'branch-main';
    ensureBranchAccess(req.user, branchId);

    const result = await orderService.listOrders({
      branchId,
      status: req.query.status,
      tableId: req.query.tableId,
      captainId: req.query.captainId,
      customerId: req.query.customerId,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      search: req.query.search || req.query.q || null,
      page: parseInt(req.query.page || '1', 10) || 1,
      limit: parseInt(req.query.limit || '20', 10) || 20,
    });

    return successResponse(res, result);
  })
);

// POST /api/v1/orders
router.post(
  '/orders',
  authenticate,
  requirePermissions(['order.create']),
  asyncHandler(async (req, res) => {
    const branchId =
      req.body?.branchId ||
      (Array.isArray(req.user.branchIds) && req.user.branchIds[0]) ||
      'branch-main';
    ensureBranchAccess(req.user, branchId);

    const order = await orderService.createOrder({
      data: { ...req.body, branchId },
      captainId: req.user.id,
      captainName: req.user.displayName || req.user.username,
    });

    return createdResponse(res, order, 'Order created successfully.');
  })
);

// GET /api/v1/orders/history
router.get(
  '/orders/history',
  authenticate,
  requireAnyPermission([
    'order.view',
    'order.confirm',
    'order.create',
    'report.view',
    'billing.generate',
    'billing.create',
  ]),
  asyncHandler(async (req, res) => {
    const branchId =
      req.query.branchId ||
      (Array.isArray(req.user.branchIds) && req.user.branchIds[0]) ||
      'branch-main';
    ensureBranchAccess(req.user, branchId);

    const history = await orderService.getOrderHistory({
      branchId,
      dateFrom: req.query.dateFrom || req.query.startDate || null,
      dateTo: req.query.dateTo || req.query.endDate || null,
      month: req.query.month || null,
      customerId: req.query.customerId || null,
      categoryId: req.query.categoryId || null,
      status: req.query.status || null,
      search: req.query.search || req.query.q || null,
      page: parseInt(req.query.page || '1', 10) || 1,
      limit: parseInt(req.query.limit || '50', 10) || 50,
    });

    return successResponse(res, history);
  })
);

// GET /api/v1/orders/:id
router.get(
  '/orders/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const order = await orderService.getOrder(req.params.id);
    ensureBranchAccess(req.user, order.branchId);
    return successResponse(res, order);
  })
);

// POST /api/v1/orders/:id/submit
router.post(
  '/orders/:id/submit',
  authenticate,
  requireAnyPermission(['order.submit', 'order.create']),
  asyncHandler(async (req, res) => {
    const order = await orderService.submitOrder({
      orderId: req.params.id,
      actorId: req.user.id,
      actorName: req.user.displayName || req.user.username,
    });
    return successResponse(res, order, 'Order submitted for Reception review.');
  })
);

// POST /api/v1/orders/:id/hold
router.post(
  '/orders/:id/hold',
  authenticate,
  requireAnyPermission(['order.hold', 'order.modify', 'order.create']),
  asyncHandler(async (req, res) => {
    const order = await orderService.holdOrder({
      orderId: req.params.id,
      reason: req.body?.reason,
      actorId: req.user.id,
      actorName: req.user.displayName || req.user.username,
    });
    return successResponse(res, order, 'Order placed on hold.');
  })
);

// POST /api/v1/orders/:id/resume
router.post(
  '/orders/:id/resume',
  authenticate,
  requireAnyPermission(['order.resume', 'order.modify', 'order.create']),
  asyncHandler(async (req, res) => {
    const order = await orderService.resumeOrder({
      orderId: req.params.id,
      actorId: req.user.id,
      actorName: req.user.displayName || req.user.username,
    });
    return successResponse(res, order, 'Order resumed.');
  })
);

// POST /api/v1/orders/:id/confirm
router.post(
  '/orders/:id/confirm',
  authenticate,
  requirePermissions(['order.confirm']),
  asyncHandler(async (req, res) => {
    const result = await orderService.confirmOrder({
      orderId: req.params.id,
      actorId: req.user.id,
      actorName: req.user.displayName || req.user.username,
    });
    return successResponse(res, result, 'Order confirmed and KOT issued to kitchen.');
  })
);

// POST /api/v1/orders/:id/reject
router.post(
  '/orders/:id/reject',
  authenticate,
  requireAnyPermission(['order.reject', 'order.confirm']),
  asyncHandler(async (req, res) => {
    const order = await orderService.rejectOrder({
      orderId: req.params.id,
      reason: req.body?.reason,
      actorId: req.user.id,
      actorName: req.user.displayName || req.user.username,
    });
    return successResponse(res, order, 'Order rejected.');
  })
);

// POST /api/v1/orders/:id/items
router.post(
  '/orders/:id/items',
  authenticate,
  requireAnyPermission(['order.modify', 'order.create']),
  asyncHandler(async (req, res) => {
    const result = await orderService.addOrModifyItems({
      orderId: req.params.id,
      itemsToAdd: req.body?.items,
      reason: req.body?.reason,
      actorId: req.user.id,
      actorName: req.user.displayName || req.user.username,
    });
    return successResponse(res, result, 'Order items modified successfully.');
  })
);

// POST /api/v1/orders/:id/cancel
router.post(
  '/orders/:id/cancel',
  authenticate,
  requirePermissions(['order.cancel']),
  asyncHandler(async (req, res) => {
    const order = await orderService.cancelOrder({
      orderId: req.params.id,
      reason: req.body?.reason,
      actorId: req.user.id,
      actorName: req.user.displayName || req.user.username,
    });
    return successResponse(res, order, 'Order cancelled.');
  })
);

// POST /api/v1/orders/:id/cancel-item
router.post(
  '/orders/:id/cancel-item',
  authenticate,
  requirePermissions(['order.cancel']),
  asyncHandler(async (req, res) => {
    const result = await orderService.cancelOrderItem({
      orderId: req.params.id,
      itemId: req.body?.itemId,
      reason: req.body?.reason,
      actorId: req.user.id,
      actorName: req.user.displayName || req.user.username,
    });
    return successResponse(res, result, 'Order item cancelled.');
  })
);

// GET /api/v1/orders/:id/events
router.get(
  '/orders/:id/events',
  authenticate,
  asyncHandler(async (req, res) => {
    const events = await orderService.getOrderEvents(req.params.id);
    return successResponse(res, events);
  })
);

export default router;
