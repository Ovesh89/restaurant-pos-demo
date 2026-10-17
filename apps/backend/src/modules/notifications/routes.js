import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { successResponse } from '../../utils/response.js';
import { notificationService } from './service.js';

const router = Router();

router.get(
  '/notifications',
  authenticate,
  asyncHandler(async (req, res) => {
    const branchId =
      req.query.branchId ||
      (Array.isArray(req.user.branchIds) && req.user.branchIds[0]) ||
      'branch-main';
    const userRoleCodes =
      req.user.roleCodes ||
      (Array.isArray(req.user.roles) ? req.user.roles.map((r) => r.code).filter(Boolean) : []);
    const unreadOnly = String(req.query.unreadOnly || 'false').toLowerCase() === 'true';
    const limit = parseInt(req.query.limit || '50', 10) || 50;

    const items = await notificationService.listNotifications({
      branchId,
      userRoleCodes,
      userId: req.user.id,
      unreadOnly,
      limit,
    });

    return successResponse(res, items);
  })
);

router.post(
  '/notifications/:id/read',
  authenticate,
  asyncHandler(async (req, res) => {
    const updated = await notificationService.markAsRead(req.params.id);
    return successResponse(
      res,
      updated || { id: req.params.id, _id: req.params.id, isRead: true },
      'Notification marked as read.'
    );
  })
);

export default router;
