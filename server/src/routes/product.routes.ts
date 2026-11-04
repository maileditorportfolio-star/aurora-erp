import { Router } from 'express';
import { productController } from '../controllers/product.controller';
import { PERMISSIONS } from '../config/permissions';
import { requirePermission } from '../middlewares/rbac';
import { validateBody } from '../middlewares/validate';
import {
  productCreateSchema,
  productUpdateSchema,
  stockAdjustSchema,
  stockTransferSchema,
} from '../validations/inventory';
import { idSchema } from '../validations/common';

const router = Router();

router.param('id', (req, _res, next, id) => {
  const result = idSchema.safeParse(id);
  if (!result.success) return next(result.error);
  next();
});

router.get('/low-stock', requirePermission(PERMISSIONS.PRODUCTS_READ), productController.lowStock);
router.get('/barcode/:code', requirePermission(PERMISSIONS.PRODUCTS_READ), productController.byBarcode);
router.get('/stock/levels', requirePermission(PERMISSIONS.INVENTORY_READ), productController.levels);
router.get(
  '/stock/movements',
  requirePermission(PERMISSIONS.INVENTORY_READ),
  productController.movements,
);
router.post(
  '/stock/adjust',
  requirePermission(PERMISSIONS.INVENTORY_WRITE),
  validateBody(stockAdjustSchema),
  productController.adjust,
);
router.post(
  '/stock/transfer',
  requirePermission(PERMISSIONS.INVENTORY_WRITE),
  validateBody(stockTransferSchema),
  productController.transfer,
);

router.get('/', requirePermission(PERMISSIONS.PRODUCTS_READ), productController.list);
router.get('/:id', requirePermission(PERMISSIONS.PRODUCTS_READ), productController.get);
router.post(
  '/',
  requirePermission(PERMISSIONS.PRODUCTS_WRITE),
  validateBody(productCreateSchema),
  productController.create,
);
router.patch(
  '/:id',
  requirePermission(PERMISSIONS.PRODUCTS_WRITE),
  validateBody(productUpdateSchema),
  productController.update,
);
router.delete(
  '/:id',
  requirePermission(PERMISSIONS.PRODUCTS_DELETE),
  productController.remove,
);

export default router;
