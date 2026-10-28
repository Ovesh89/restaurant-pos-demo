import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import {
  requireAnyPermission,
  ensureBranchAccess,
} from '../../middleware/permissions.js';
import {
  asyncHandler,
  PermissionDeniedAppError,
} from '../../middleware/errorHandler.js';
import { successResponse, createdResponse } from '../../utils/response.js';
import { toDecimal } from '../../utils/decimal.js';
import { orderService } from '../orders/service.js';
import { billingService, paymentService } from './service.js';

const router = Router();

// POST /api/v1/orders/:id/bill
router.post(
  '/orders/:id/bill',
  authenticate,
  requireAnyPermission(['billing.create', 'billing.generate']),
  asyncHandler(async (req, res) => {
    const order = await orderService.getOrder(req.params.id);
    ensureBranchAccess(req.user, order.branchId);

    const isCaptain = (req.user.role || '').toLowerCase() === 'captain';
    const discountData = req.body?.discount || null;

    if (isCaptain && discountData && (toDecimal(discountData.value || 0).gt(0) || toDecimal(discountData.amount || 0).gt(0))) {
      throw new PermissionDeniedAppError('Captains are not permitted to apply discounts.');
    }

    const bill = await billingService.generateBill({
      orderId: req.params.id,
      actorId: req.user.id,
      actorName: req.user.displayName || req.user.username,
      discountInput: isCaptain ? null : discountData,
    });

    const isExisting = Boolean(bill._isExisting);
    delete bill._isExisting;

    if (isExisting) {
      return successResponse(res, bill, 'Active bill retrieved.');
    }
    return createdResponse(res, bill, 'Bill generated successfully.');
  })
);

// GET /api/v1/bills
router.get(
  '/bills',
  authenticate,
  asyncHandler(async (req, res) => {
    const branchId =
      req.query.branchId ||
      (Array.isArray(req.user.branchIds) && req.user.branchIds[0]) ||
      'branch-main';
    ensureBranchAccess(req.user, branchId);

    const result = await billingService.listBills({
      branchId,
      status: req.query.status,
      orderId: req.query.orderId,
      customerId: req.query.customerId,
      dateFrom: req.query.dateFrom || req.query.fromDate,
      dateTo: req.query.dateTo || req.query.toDate,
      search: req.query.search || req.query.q || null,
      page: parseInt(req.query.page || '1', 10) || 1,
      limit: parseInt(req.query.limit || '20', 10) || 20,
    });

    return successResponse(res, result);
  })
);

// GET /api/v1/bills/:id
router.get(
  '/bills/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const bill = await billingService.getBill(req.params.id);
    ensureBranchAccess(req.user, bill.branchId);
    return successResponse(res, bill);
  })
);

// POST /api/v1/bills/:id/discount
router.post(
  '/bills/:id/discount',
  authenticate,
  requireAnyPermission(['discount.apply', 'discount.approve', 'billing.discount']),
  asyncHandler(async (req, res) => {
    const isCaptain = (req.user.role || '').toLowerCase() === 'captain';
    if (isCaptain) {
      throw new PermissionDeniedAppError('Captains are not permitted to apply discounts.');
    }

    const bill = await billingService.getBill(req.params.id);
    ensureBranchAccess(req.user, bill.branchId);

    const { type, value, reason } = req.body || {};
    const dType = String(type || '').toUpperCase();
    const dVal = toDecimal(value || 0);

    // High percentage discount (>20%) requires discount.approve or billing.discount
    const perms = req.user.permissions || [];
    if (
      dType === 'PERCENTAGE' &&
      dVal.gt(20) &&
      !perms.includes('discount.approve') &&
      !perms.includes('billing.discount')
    ) {
      throw new PermissionDeniedAppError(
        'Discounts above 20% require manager approval permission (discount.approve).'
      );
    }

    const updatedBill = await billingService.applyDiscount({
      billId: req.params.id,
      discountType: type,
      discountValue: value,
      reason,
      actorId: req.user.id,
      actorName: req.user.displayName || req.user.username,
    });

    return successResponse(res, updatedBill, 'Discount applied successfully.');
  })
);

// POST /api/v1/bills/:id/close
router.post(
  '/bills/:id/close',
  authenticate,
  requireAnyPermission([
    'billing.close',
    'billing.create',
    'billing.generate',
    'payment.record',
    'payment.collect',
  ]),
  asyncHandler(async (req, res) => {
    const isCaptain = (req.user.role || '').toLowerCase() === 'captain';
    if (isCaptain) {
      throw new PermissionDeniedAppError('Captains are not permitted to close or alter bills.');
    }

    const bill = await billingService.getBill(req.params.id);
    ensureBranchAccess(req.user, bill.branchId);

    const updatedBill = await billingService.closeBill({
      billId: req.params.id,
      actorId: req.user.id,
      actorName: req.user.displayName || req.user.username,
    });

    return successResponse(res, updatedBill, 'Bill closed and order completed.');
  })
);

// GET & POST /api/v1/bills/:id/print
const billPrintHandler = asyncHandler(async (req, res) => {
  const bill = await billingService.getBill(req.params.id);
  ensureBranchAccess(req.user, bill.branchId);

  const payload = await billingService.getPrintPayload(req.params.id);
  return successResponse(res, payload);
});

router.get('/bills/:id/print', authenticate, billPrintHandler);
router.post('/bills/:id/print', authenticate, billPrintHandler);

// GET /api/v1/bills/:id/payments
router.get(
  '/bills/:id/payments',
  authenticate,
  asyncHandler(async (req, res) => {
    const bill = await billingService.getBill(req.params.id);
    ensureBranchAccess(req.user, bill.branchId);

    const payments = await paymentService.listPayments(req.params.id);
    return successResponse(res, payments);
  })
);

// POST /api/v1/bills/:id/payments
router.post(
  '/bills/:id/payments',
  authenticate,
  requireAnyPermission(['payment.record', 'payment.collect']),
  asyncHandler(async (req, res) => {
    const bill = await billingService.getBill(req.params.id);
    ensureBranchAccess(req.user, bill.branchId);

    const { mode, amount, referenceNumber, idempotencyKey } = req.body || {};
    const result = await paymentService.addPayment({
      billId: req.params.id,
      mode,
      amount,
      referenceNumber,
      idempotencyKey,
      actorId: req.user.id,
      actorName: req.user.displayName || req.user.username,
    });

    if (result.isDuplicate) {
      return successResponse(res, result, 'Payment recorded successfully.');
    }
    return createdResponse(res, result, 'Payment recorded successfully.');
  })
);

export default router;
