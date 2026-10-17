import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler, ValidationAppError } from '../../middleware/errorHandler.js';
import { requirePermissions } from '../../middleware/permissions.js';
import { createdResponse, successResponse } from '../../utils/response.js';
import { menuService } from './service.js';

const router = Router();

function resolveBranchId(req) {
  return (
    req.query.branchId ||
    req.body?.branchId ||
    (req.user?.branchIds || [])[0] ||
    'branch-main'
  );
}

// --- Categories ---

// GET /api/v1/menu/categories
router.get(
  '/menu/categories',
  authenticate,
  requirePermissions(['menu.view']),
  asyncHandler(async (req, res) => {
    const branchId = resolveBranchId(req);
    const isActiveOnly = ['true', '1', 'yes'].includes(
      String(req.query.isActiveOnly || 'false').toLowerCase()
    );
    const categories = await menuService.listCategories(
      branchId,
      req.user,
      isActiveOnly
    );
    return successResponse(res, categories);
  })
);

// POST /api/v1/menu/categories
router.post(
  '/menu/categories',
  authenticate,
  requirePermissions(['menu.manage']),
  asyncHandler(async (req, res) => {
    const created = await menuService.createCategory(req.body || {}, req.user);
    return createdResponse(res, created, 'Category created successfully.');
  })
);

// GET /api/v1/menu/categories/:categoryId
router.get(
  '/menu/categories/:categoryId',
  authenticate,
  requirePermissions(['menu.view']),
  asyncHandler(async (req, res) => {
    const cat = await menuService.getCategory(req.params.categoryId, req.user);
    return successResponse(res, cat);
  })
);

// PATCH /api/v1/menu/categories/:categoryId
router.patch(
  '/menu/categories/:categoryId',
  authenticate,
  requirePermissions(['menu.manage']),
  asyncHandler(async (req, res) => {
    const updated = await menuService.updateCategory(
      req.params.categoryId,
      req.body || {},
      req.user
    );
    return successResponse(res, updated, 'Category updated successfully.');
  })
);

// --- Products ---

// GET /api/v1/menu/products
router.get(
  '/menu/products',
  authenticate,
  requirePermissions(['menu.view']),
  asyncHandler(async (req, res) => {
    const branchId = resolveBranchId(req);
    const {
      categoryId,
      isActive: isActiveParam,
      available: availableParam,
      isAvailableOnly: isAvailableOnlyParam,
      station,
      search,
      page = 1,
      limit = 50,
    } = req.query;

    let isActive = null;
    if (isActiveParam !== undefined && isActiveParam !== null && isActiveParam !== '') {
      isActive = ['true', '1', 'yes'].includes(String(isActiveParam).toLowerCase());
    }

    let available = null;
    if (availableParam !== undefined && availableParam !== null && availableParam !== '') {
      available = ['true', '1', 'yes'].includes(String(availableParam).toLowerCase());
    }

    if (
      isAvailableOnlyParam &&
      ['true', '1', 'yes'].includes(String(isAvailableOnlyParam).toLowerCase())
    ) {
      available = true;
      if (isActive === null) {
        isActive = true;
      }
    }

    const result = await menuService.listProducts({
      branchId,
      user: req.user,
      categoryId: categoryId || null,
      isActive,
      available,
      station: station || req.query.kitchenStation || null,
      search: search || null,
      page,
      limit,
    });
    return successResponse(res, result);
  })
);

// POST /api/v1/menu/products
router.post(
  '/menu/products',
  authenticate,
  requirePermissions(['menu.manage']),
  asyncHandler(async (req, res) => {
    const created = await menuService.createProduct(req.body || {}, req.user);
    return createdResponse(res, created, 'Product created successfully.');
  })
);

// GET /api/v1/menu/products/:productId
router.get(
  '/menu/products/:productId',
  authenticate,
  requirePermissions(['menu.view']),
  asyncHandler(async (req, res) => {
    const prod = await menuService.getProduct(req.params.productId, req.user);
    return successResponse(res, prod);
  })
);

// PATCH /api/v1/menu/products/:productId
router.patch(
  '/menu/products/:productId',
  authenticate,
  requirePermissions(['menu.manage']),
  asyncHandler(async (req, res) => {
    const updated = await menuService.updateProduct(
      req.params.productId,
      req.body || {},
      req.user
    );
    return successResponse(res, updated, 'Product updated successfully.');
  })
);

// POST /api/v1/menu/products/:productId/activate
router.post(
  '/menu/products/:productId/activate',
  authenticate,
  requirePermissions(['menu.manage']),
  asyncHandler(async (req, res) => {
    const updated = await menuService.setProductActiveStatus(
      req.params.productId,
      true,
      req.user
    );
    return successResponse(res, updated, 'Product activated.');
  })
);

// POST /api/v1/menu/products/:productId/deactivate
router.post(
  '/menu/products/:productId/deactivate',
  authenticate,
  requirePermissions(['menu.manage']),
  asyncHandler(async (req, res) => {
    const updated = await menuService.setProductActiveStatus(
      req.params.productId,
      false,
      req.user
    );
    return successResponse(res, updated, 'Product deactivated.');
  })
);

// POST /api/v1/menu/products/:productId/price
// Decision 2 Compatibility Shim: accept both `price` (Django contract) and `newPrice` (Web productApiRepository)
router.post(
  '/menu/products/:productId/price',
  authenticate,
  requirePermissions(['menu.price_change']),
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const rawPrice = body.price !== undefined ? body.price : body.newPrice;
    if (rawPrice === undefined || rawPrice === null || rawPrice === '') {
      throw new ValidationAppError('price (or newPrice) is required.');
    }
    const updated = await menuService.changeProductPrice(
      req.params.productId,
      rawPrice,
      body.reason,
      req.user
    );
    return successResponse(res, updated, 'Product price updated successfully.');
  })
);

// GET /api/v1/menu/products/:productId/price-history
router.get(
  '/menu/products/:productId/price-history',
  authenticate,
  requirePermissions(['menu.view']),
  asyncHandler(async (req, res) => {
    const history = await menuService.getProductPriceHistory(
      req.params.productId,
      req.user
    );
    return successResponse(res, history);
  })
);

export default router;
