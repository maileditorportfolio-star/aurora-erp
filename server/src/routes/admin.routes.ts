import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { requireSuperAdmin } from '../middlewares/rbac';
import { platformScope } from '../middlewares/tenant';
import { validateBody, validateParams } from '../middlewares/validate';
import { adminOrganizationUpdateSchema, createOrganizationSchema } from '../validations/auth';
import { idSchema } from '../validations/common';

const router = Router();

router.use(requireSuperAdmin);
router.use(platformScope);

router.get('/stats', adminController.platformStats);
router.get('/license', adminController.license);
router.get('/organizations', adminController.organizations);
router.post(
  '/organizations',
  validateBody(createOrganizationSchema),
  adminController.createOrganization,
);
router.patch(
  '/organizations/:id',
  validateParams(idSchema),
  validateBody(adminOrganizationUpdateSchema),
  adminController.updateOrganization,
);
router.get('/users', adminController.users);
router.patch('/users/:id/super-admin', validateParams(idSchema), adminController.toggleSuperAdmin);
router.get('/audits', adminController.audits);
router.get('/audits/stats', adminController.auditStats);

export default router;
