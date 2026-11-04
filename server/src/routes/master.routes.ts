import { Router } from 'express';
import { categoryController, warehouseController } from '../controllers/master.controller';
import { PERMISSIONS } from '../config/permissions';
import { registerCrudRoutes } from './crud.routes';
import { categoryCreateSchema, categoryUpdateSchema } from '../validations/inventory';
import { warehouseCreateSchema, warehouseUpdateSchema } from '../validations/inventory';

export const categoryRouter = Router();
registerCrudRoutes(categoryRouter, categoryController, {
  read: PERMISSIONS.CATEGORIES_READ,
  write: PERMISSIONS.CATEGORIES_WRITE,
  remove: PERMISSIONS.CATEGORIES_DELETE,
  createSchema: categoryCreateSchema,
  updateSchema: categoryUpdateSchema,
  allowRestore: true,
});

export const warehouseRouter = Router();
registerCrudRoutes(warehouseRouter, warehouseController, {
  read: PERMISSIONS.WAREHOUSES_READ,
  write: PERMISSIONS.WAREHOUSES_WRITE,
  remove: PERMISSIONS.WAREHOUSES_DELETE,
  createSchema: warehouseCreateSchema,
  updateSchema: warehouseUpdateSchema,
  allowRestore: true,
});
