import { Router } from 'express';
import { paymentController } from '../controllers/payment.controller';
import { PERMISSIONS } from '../config/permissions';
import { requirePermission } from '../middlewares/rbac';
import { validateBody } from '../middlewares/validate';
import { paymentCreateSchema } from '../validations/sales';
import { idSchema } from '../validations/common';

const router = Router();
router.param('id', (req, _res, next, id) => {
  const result = idSchema.safeParse(id);
  if (!result.success) return next(result.error);
  next();
});

router.get('/', requirePermission(PERMISSIONS.PAYMENTS_READ), paymentController.list);
router.get('/:id', requirePermission(PERMISSIONS.PAYMENTS_READ), paymentController.get);
router.post(
  '/',
  requirePermission(PERMISSIONS.PAYMENTS_WRITE),
  validateBody(paymentCreateSchema),
  paymentController.create,
);
router.delete(
  '/:id',
  requirePermission(PERMISSIONS.PAYMENTS_DELETE),
  paymentController.remove,
);

export default router;
