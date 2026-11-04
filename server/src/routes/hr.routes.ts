import { Router } from 'express';
import { employeeController } from '../controllers/master.controller';
import { attendanceController } from '../controllers/attendance.controller';
import { leaveController } from '../controllers/leave.controller';
import { payrollController } from '../controllers/payroll.controller';
import { PERMISSIONS } from '../config/permissions';
import { registerCrudRoutes } from './crud.routes';
import { requirePermission } from '../middlewares/rbac';
import { validateBody } from '../middlewares/validate';
import {
  attendanceCreateSchema,
  attendanceUpdateSchema,
  employeeCreateSchema,
  employeeUpdateSchema,
  leaveCreateSchema,
  leaveDecisionSchema,
  leaveUpdateSchema,
  payrollStatusSchema,
} from '../validations/hr';
import { idSchema } from '../validations/common';

export const employeeRouter = Router();
registerCrudRoutes(employeeRouter, employeeController, {
  read: PERMISSIONS.EMPLOYEES_READ,
  write: PERMISSIONS.EMPLOYEES_WRITE,
  remove: PERMISSIONS.EMPLOYEES_DELETE,
  createSchema: employeeCreateSchema,
  updateSchema: employeeUpdateSchema,
  allowRestore: true,
});

function idParam(router: Router) {
  router.param('id', (req, _res, next, id) => {
    const result = idSchema.safeParse(id);
    if (!result.success) return next(result.error);
    next();
  });
}

export const attendanceRouter = Router();
idParam(attendanceRouter);
attendanceRouter.get('/summary', requirePermission(PERMISSIONS.ATTENDANCE_READ), attendanceController.summary);
attendanceRouter.get('/mine', requirePermission(PERMISSIONS.ATTENDANCE_READ), attendanceController.mine);
attendanceRouter.get('/', requirePermission(PERMISSIONS.ATTENDANCE_READ), attendanceController.list);
attendanceRouter.post(
  '/',
  requirePermission(PERMISSIONS.ATTENDANCE_WRITE),
  validateBody(attendanceCreateSchema),
  attendanceController.create,
);
attendanceRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.ATTENDANCE_WRITE),
  validateBody(attendanceUpdateSchema),
  attendanceController.update,
);
attendanceRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.ATTENDANCE_WRITE),
  attendanceController.remove,
);

export const leaveRouter = Router();
idParam(leaveRouter);
leaveRouter.get('/mine', requirePermission(PERMISSIONS.LEAVES_READ), leaveController.mine);
leaveRouter.get('/', requirePermission(PERMISSIONS.LEAVES_READ), leaveController.list);
leaveRouter.post(
  '/',
  requirePermission(PERMISSIONS.LEAVES_WRITE),
  validateBody(leaveCreateSchema),
  leaveController.create,
);
leaveRouter.patch(
  '/:id/decision',
  requirePermission(PERMISSIONS.LEAVES_APPROVE),
  validateBody(leaveDecisionSchema),
  leaveController.decide,
);
leaveRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.LEAVES_WRITE),
  validateBody(leaveUpdateSchema),
  leaveController.update,
);
leaveRouter.delete('/:id', requirePermission(PERMISSIONS.LEAVES_WRITE), leaveController.remove);

export const payrollRouter = Router();
idParam(payrollRouter);
payrollRouter.get('/mine', requirePermission(PERMISSIONS.PAYROLL_READ), payrollController.mine);
payrollRouter.get('/', requirePermission(PERMISSIONS.PAYROLL_READ), payrollController.list);
payrollRouter.get('/:id', requirePermission(PERMISSIONS.PAYROLL_READ), payrollController.get);
payrollRouter.post(
  '/generate',
  requirePermission(PERMISSIONS.PAYROLL_WRITE),
  payrollController.generate,
);
payrollRouter.patch(
  '/:id/status',
  requirePermission(PERMISSIONS.PAYROLL_APPROVE),
  validateBody(payrollStatusSchema),
  payrollController.updateStatus,
);
payrollRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.PAYROLL_WRITE),
  payrollController.remove,
);
