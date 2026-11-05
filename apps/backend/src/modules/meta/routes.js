import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { successResponse } from '../../utils/response.js';
import { revisionService } from './revisionService.js';

const router = Router();

// GET /api/v1/meta/master-data-versions
router.get(
  '/meta/master-data-versions',
  asyncHandler(async (req, res) => {
    const branchId =
      req.query.branchId ||
      (req.user?.branchIds || [])[0] ||
      'branch-main';

    const result = await revisionService.getMasterDataVersions(branchId);
    return successResponse(res, result);
  })
);

export default router;
