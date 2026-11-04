import { Router } from 'express';
import * as auth from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth';
import { authLimiter } from '../middlewares/rateLimit';
import { validateBody } from '../middlewares/validate';
import {
  changePasswordSchema,
  loginSchema,
  profileUpdateSchema,
  refreshSchema,
  registerSchema,
  switchOrganizationSchema,
} from '../validations/auth';

const router = Router();

router.get('/config', auth.appConfig);
router.post('/register', authLimiter, validateBody(registerSchema), auth.register);
router.post('/login', authLimiter, validateBody(loginSchema), auth.loginHandler);
router.post('/refresh', validateBody(refreshSchema), auth.refresh);
router.post('/logout', auth.logout);
router.get('/me', authenticate, auth.me);
router.patch('/profile', authenticate, validateBody(profileUpdateSchema), auth.updateProfile);
router.post(
  '/change-password',
  authenticate,
  validateBody(changePasswordSchema),
  auth.changePasswordHandler,
);
router.post('/logout-all', authenticate, auth.logoutAll);
router.post(
  '/switch-organization',
  authenticate,
  validateBody(switchOrganizationSchema),
  auth.switchOrg,
);
router.get('/permissions', authenticate, auth.permissionsCatalog);

export default router;
