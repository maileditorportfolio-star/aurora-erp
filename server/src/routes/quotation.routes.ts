import { Router } from 'express';
import { quotationController } from '../controllers/quotation.controller';
import { PERMISSIONS } from '../config/permissions';
import { requirePermission } from '../middlewares/rbac';
import { validateBody } from '../middlewares/validate';
import { quotationCreateSchema, quotationUpdateSchema } from '../validations/sales';
import { idSchema } from '../validations/common';

const router = Router();
router.param('id', (req, _res, next, id) => {
  const result = idSchema.safeParse(id);
  if (!result.success) return next(result.error);
  next();
});

router.get('/', requirePermission(PERMISSIONS.QUOTATIONS_READ), quotationController.list);
router.get('/:id', requirePermission(PERMISSIONS.QUOTATIONS_READ), quotationController.get);
router.get('/:id/pdf', requirePermission(PERMISSIONS.QUOTATIONS_READ), quotationController.pdf);
router.post(
  '/',
  requirePermission(PERMISSIONS.QUOTATIONS_WRITE),
  validateBody(quotationCreateSchema),
  quotationController.create,
);
router.patch(
  '/:id',
  requirePermission(PERMISSIONS.QUOTATIONS_WRITE),
  validateBody(quotationUpdateSchema),
  quotationController.update,
);
router.post(
  '/:id/convert',
  requirePermission(PERMISSIONS.SALES_ORDERS_WRITE),
  quotationController.convert,
);
router.delete(
  '/:id',
  requirePermission(PERMISSIONS.QUOTATIONS_DELETE),
  quotationController.remove,
);

export default router;
