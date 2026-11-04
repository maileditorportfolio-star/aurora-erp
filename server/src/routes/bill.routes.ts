import { Router } from 'express';
import { billController } from '../controllers/bill.controller';
import { PERMISSIONS } from '../config/permissions';
import { requirePermission } from '../middlewares/rbac';
import { validateBody } from '../middlewares/validate';
import { billCreateSchema, billUpdateSchema } from '../validations/purchase';
import { idSchema } from '../validations/common';

const router = Router();
router.param('id', (req, _res, next, id) => {
  const result = idSchema.safeParse(id);
  if (!result.success) return next(result.error);
  next();
});

router.get('/', requirePermission(PERMISSIONS.BILLS_READ), billController.list);
router.get('/:id', requirePermission(PERMISSIONS.BILLS_READ), billController.get);
router.get('/:id/pdf', requirePermission(PERMISSIONS.BILLS_READ), billController.pdf);
router.post(
  '/',
  requirePermission(PERMISSIONS.BILLS_WRITE),
  validateBody(billCreateSchema),
  billController.create,
);
router.patch(
  '/:id',
  requirePermission(PERMISSIONS.BILLS_WRITE),
  validateBody(billUpdateSchema),
  billController.update,
);
router.post('/:id/void', requirePermission(PERMISSIONS.BILLS_WRITE), billController.void);
router.delete('/:id', requirePermission(PERMISSIONS.BILLS_DELETE), billController.remove);

export default router;
