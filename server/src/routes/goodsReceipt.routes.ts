import { Router } from 'express';
import { goodsReceiptController } from '../controllers/purchase.controller';
import { PERMISSIONS } from '../config/permissions';
import { requirePermission } from '../middlewares/rbac';
import { validateBody } from '../middlewares/validate';
import { goodsReceiptCreateSchema, goodsReceiptUpdateSchema } from '../validations/purchase';
import { idSchema } from '../validations/common';

const router = Router();
router.param('id', (req, _res, next, id) => {
  const result = idSchema.safeParse(id);
  if (!result.success) return next(result.error);
  next();
});

router.get('/', requirePermission(PERMISSIONS.GOODS_RECEIPTS_READ), goodsReceiptController.list);
router.get('/:id', requirePermission(PERMISSIONS.GOODS_RECEIPTS_READ), goodsReceiptController.get);
router.post(
  '/',
  requirePermission(PERMISSIONS.GOODS_RECEIPTS_WRITE),
  validateBody(goodsReceiptCreateSchema),
  goodsReceiptController.create,
);
router.patch(
  '/:id',
  requirePermission(PERMISSIONS.GOODS_RECEIPTS_WRITE),
  validateBody(goodsReceiptUpdateSchema),
  goodsReceiptController.update,
);
router.post(
  '/:id/receive',
  requirePermission(PERMISSIONS.GOODS_RECEIPTS_WRITE),
  goodsReceiptController.receive,
);
router.delete(
  '/:id',
  requirePermission(PERMISSIONS.GOODS_RECEIPTS_DELETE),
  goodsReceiptController.remove,
);

export default router;
