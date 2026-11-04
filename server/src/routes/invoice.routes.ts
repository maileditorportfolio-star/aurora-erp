import { Router } from 'express';
import { invoiceController } from '../controllers/invoice.controller';
import { PERMISSIONS } from '../config/permissions';
import { requirePermission } from '../middlewares/rbac';
import { validateBody } from '../middlewares/validate';
import { invoiceCreateSchema, invoiceUpdateSchema } from '../validations/sales';
import { idSchema } from '../validations/common';

const router = Router();
router.param('id', (req, _res, next, id) => {
  const result = idSchema.safeParse(id);
  if (!result.success) return next(result.error);
  next();
});

router.get('/', requirePermission(PERMISSIONS.INVOICES_READ), invoiceController.list);
router.get('/:id', requirePermission(PERMISSIONS.INVOICES_READ), invoiceController.get);
router.get('/:id/pdf', requirePermission(PERMISSIONS.INVOICES_READ), invoiceController.pdf);
router.post(
  '/',
  requirePermission(PERMISSIONS.INVOICES_WRITE),
  validateBody(invoiceCreateSchema),
  invoiceController.create,
);
router.patch(
  '/:id',
  requirePermission(PERMISSIONS.INVOICES_WRITE),
  validateBody(invoiceUpdateSchema),
  invoiceController.update,
);
router.post(
  '/:id/issue',
  requirePermission(PERMISSIONS.INVOICES_WRITE),
  invoiceController.issue,
);
router.post(
  '/:id/void',
  requirePermission(PERMISSIONS.INVOICES_VOID),
  invoiceController.void,
);
router.delete(
  '/:id',
  requirePermission(PERMISSIONS.INVOICES_DELETE),
  invoiceController.remove,
);

export default router;
