import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller';
import { PERMISSIONS } from '../config/permissions';
import { requirePermission } from '../middlewares/rbac';

const router = Router();
router.get('/', requirePermission(PERMISSIONS.DASHBOARD_READ), dashboardController.overview);
export default router;
