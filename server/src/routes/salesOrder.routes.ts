import { Router } from 'express';
import { salesOrderController } from '../controllers/salesOrder.controller';
import { PERMISSIONS } from '../config/permissions';
import { requirePermission } from '../middlewares/rbac';
import { validateBody } from '../middlewares/validate';
import { salesOrderCreateSchema, salesOrderUpdateSchema } from '../validations/sales';
import { idSchema } from '../validations/common';

const router = Router();
router.param('id', (req, _res, next, id) => {
  const result = idSchema.safeParse(id);
  if (!result.success) return next(result.error);
  next();
});

router.get('/', requirePermission(PERMISSIONS.SALES_ORDERS_READ), salesOrderController.list);
router.get('/:id', requirePermission(PERMISSIONS.SALES_ORDERS_READ), salesOrderController.get);
router.post(
  '/',
  requirePermission(PERMISSIONS.SALES_ORDERS_WRITE),
  validateBody(salesOrderCreateSchema),
  salesOrderController.create,
);
router.patch(
  '/:id',
  requirePermission(PERMISSIONS.SALES_ORDERS_WRITE),
  validateBody(salesOrderUpdateSchema),
  salesOrderController.update,
);
router.post(
  '/:id/confirm',
  requirePermission(PERMISSIONS.SALES_ORDERS_APPROVE),
  salesOrderController.confirm,
);
router.post(
  '/:id/advance',
  requirePermission(PERMISSIONS.SALES_ORDERS_WRITE),
  salesOrderController.advance,
);
router.post(
  '/:id/cancel',
  requirePermission(PERMISSIONS.SALES_ORDERS_WRITE),
  salesOrderController.cancel,
);
router.delete(
  '/:id',
  requirePermission(PERMISSIONS.SALES_ORDERS_DELETE),
  salesOrderController.remove,
);

export default router;
