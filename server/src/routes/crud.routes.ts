import type { Router } from 'express';
import type { ZodType } from 'zod';
import type { Permission } from '../config/permissions';
import { requirePermission } from '../middlewares/rbac';
import { validateBody, validateParams } from '../middlewares/validate';
import { idSchema } from '../validations/common';
import type { createCrudController } from '../controllers/crud.controller';

export interface CrudRouteOptions {
  read: Permission;
  write: Permission;
  remove: Permission;
  createSchema: ZodType;
  updateSchema: ZodType;
  allowRestore?: boolean;
}

type CrudController = ReturnType<typeof createCrudController>;

export function registerCrudRoutes(
  router: Router,
  controller: CrudController,
  permissions: CrudRouteOptions,
): void {
  router.param('id', (req, _res, next, id) => {
    const result = idSchema.safeParse(id);
    if (!result.success) return next(result.error);
    next();
  });

  router.get('/', requirePermission(permissions.read), controller.list);
  router.get('/:id', requirePermission(permissions.read), controller.get);
  router.post(
    '/',
    requirePermission(permissions.write),
    validateBody(permissions.createSchema),
    controller.create,
  );
  router.patch(
    '/:id',
    requirePermission(permissions.write),
    validateParams(idSchema),
    validateBody(permissions.updateSchema),
    controller.update,
  );
  router.delete(
    '/:id',
    requirePermission(permissions.remove),
    validateParams(idSchema),
    controller.remove,
  );
  if (permissions.allowRestore) {
    router.post(
      '/:id/restore',
      requirePermission(permissions.remove),
      validateParams(idSchema),
      controller.restore,
    );
  }
}
