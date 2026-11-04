import { Router } from 'express';
import { organizationController } from '../controllers/organization.controller';
import { teamController } from '../controllers/team.controller';
import { notificationController } from '../controllers/notification.controller';
import { auditController } from '../controllers/audit.controller';
import { PERMISSIONS } from '../config/permissions';
import { requirePermission } from '../middlewares/rbac';
import { validateBody } from '../middlewares/validate';
import { inviteMemberSchema, organizationUpdateSchema, updateMemberSchema } from '../validations/auth';
import { idSchema } from '../validations/common';

export const organizationRouter = Router();
organizationRouter.get('/', requirePermission(PERMISSIONS.ORGANIZATION_READ), organizationController.current);
organizationRouter.patch(
  '/',
  requirePermission(PERMISSIONS.ORGANIZATION_WRITE),
  validateBody(organizationUpdateSchema),
  organizationController.update,
);
organizationRouter.get('/stats', requirePermission(PERMISSIONS.ORGANIZATION_READ), organizationController.stats);
organizationRouter.get('/roles', requirePermission(PERMISSIONS.ORGANIZATION_READ), organizationController.roles);

export const teamRouter = Router();
teamRouter.param('id', (req, _res, next, id) => {
  const result = idSchema.safeParse(id);
  if (!result.success) return next(result.error);
  next();
});
teamRouter.get('/', requirePermission(PERMISSIONS.TEAM_READ), teamController.list);
teamRouter.get('/permissions', requirePermission(PERMISSIONS.TEAM_READ), teamController.permissions);
teamRouter.post(
  '/invite',
  requirePermission(PERMISSIONS.TEAM_WRITE),
  validateBody(inviteMemberSchema),
  teamController.invite,
);
teamRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.TEAM_WRITE),
  validateBody(updateMemberSchema),
  teamController.update,
);
teamRouter.delete('/:id', requirePermission(PERMISSIONS.TEAM_DELETE), teamController.remove);

export const notificationRouter = Router();
notificationRouter.get(
  '/',
  requirePermission(PERMISSIONS.NOTIFICATIONS_READ),
  notificationController.list,
);
notificationRouter.get(
  '/unread-count',
  requirePermission(PERMISSIONS.NOTIFICATIONS_READ),
  notificationController.unreadCount,
);
notificationRouter.patch(
  '/read-all',
  requirePermission(PERMISSIONS.NOTIFICATIONS_READ),
  notificationController.markAllRead,
);
notificationRouter.patch(
  '/:id/read',
  requirePermission(PERMISSIONS.NOTIFICATIONS_READ),
  notificationController.markRead,
);
notificationRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.NOTIFICATIONS_READ),
  notificationController.remove,
);

export const auditRouter = Router();
auditRouter.get('/', requirePermission(PERMISSIONS.AUDIT_READ), auditController.list);
