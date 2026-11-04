import { Router } from 'express';
import { purchaseOrderController } from '../controllers/purchase.controller';
import { PERMISSIONS } from '../config/permissions';
import { requirePermission } from '../middlewares/rbac';
import { validateBody } from '../middlewares/validate';
import { purchaseOrderCreateSchema, purchaseOrderUpdateSchema } from '../validations/purchase';
import { idSchema } from '../validations/common';

const router = Router();
router.param('id', (req, _res, next, id) => {
  const result = idSchema.safeParse(id);
  if (!result.success) return next(result.error);
  next();
});

router.get('/', requirePermission(PERMISSIONS.PURCHASE_ORDERS_READ), purchaseOrderController.list);
router.get('/:id', requirePermission(PERMISSIONS.PURCHASE_ORDERS_READ), purchaseOrderController.get);
router.get('/:id/pdf', requirePermission(PERMISSIONS.PURCHASE_ORDERS_READ), purchaseOrderController.pdf);
router.post(
  '/',
  requirePermission(PERMISSIONS.PURCHASE_ORDERS_WRITE),
  validateBody(purchaseOrderCreateSchema),
  purchaseOrderController.create,
);
router.patch(
  '/:id',
  requirePermission(PERMISSIONS.PURCHASE_ORDERS_WRITE),
  validateBody(purchaseOrderUpdateSchema),
  purchaseOrderController.update,
);
router.post(
  '/:id/approve',
  requirePermission(PERMISSIONS.PURCHASE_ORDERS_APPROVE),
  purchaseOrderController.approve,
);
router.delete(
  '/:id',
  requirePermission(PERMISSIONS.PURCHASE_ORDERS_DELETE),
  purchaseOrderController.remove,
);

export default router;
