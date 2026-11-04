import { Router } from 'express';
import { customerController } from '../controllers/master.controller';
import { PERMISSIONS } from '../config/permissions';
import { registerCrudRoutes } from './crud.routes';
import { customerCreateSchema, customerUpdateSchema } from '../validations/sales';

const router = Router();
registerCrudRoutes(router, customerController, {
  read: PERMISSIONS.CUSTOMERS_READ,
  write: PERMISSIONS.CUSTOMERS_WRITE,
  remove: PERMISSIONS.CUSTOMERS_DELETE,
  createSchema: customerCreateSchema,
  updateSchema: customerUpdateSchema,
  allowRestore: true,
});

export default router;
