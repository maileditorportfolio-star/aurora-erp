import { Router } from 'express';
import { supplierController } from '../controllers/master.controller';
import { PERMISSIONS } from '../config/permissions';
import { registerCrudRoutes } from './crud.routes';
import { supplierCreateSchema, supplierUpdateSchema } from '../validations/inventory';

const router = Router();
registerCrudRoutes(router, supplierController, {
  read: PERMISSIONS.SUPPLIERS_READ,
  write: PERMISSIONS.SUPPLIERS_WRITE,
  remove: PERMISSIONS.SUPPLIERS_DELETE,
  createSchema: supplierCreateSchema,
  updateSchema: supplierUpdateSchema,
  allowRestore: true,
});

export default router;
