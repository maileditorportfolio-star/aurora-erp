import type { Request } from 'express';
import { Account, Category, Customer, Employee, JournalEntry, Product, Supplier, Warehouse } from '../models';
import { ApiError } from '../utils/ApiError';
import { nextDocumentNumber, nextEmployeeCode } from '../utils/sequence';
import { createCrudController } from './crud.controller';

function org(req: Request) {
  return req.organizationId as string;
}

export const categoryController = createCrudController({
  model: Category,
  resource: 'Category',
  searchFields: ['name', 'code', 'description'],
  populate: 'parent',
  sortable: ['name', 'createdAt', 'updatedAt'],
  buildFilter: (req) => {
    const filter: Record<string, unknown> = {};
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
    if (req.query.parent) filter.parent = req.query.parent;
    return filter;
  },
  beforeDelete: async (req, id) => {
    const [children, products] = await Promise.all([
      Category.countDocuments({ parent: id, organization: org(req) }),
      Product.countDocuments({ category: id, organization: org(req) }),
    ]);
    if (children) throw ApiError.conflict('Move or delete child categories first');
    if (products) throw ApiError.conflict('This category is used by products and cannot be deleted');
  },
});

export const warehouseController = createCrudController({
  model: Warehouse,
  resource: 'Warehouse',
  searchFields: ['name', 'code', 'manager', 'address.city'],
  sortable: ['name', 'code', 'createdAt'],
  beforeCreate: async (data, req) => {
    if (data.isDefault) {
      await Warehouse.updateMany({ organization: org(req) }, { isDefault: false });
    }
    return data;
  },
  beforeUpdate: async (data, req) => {
    if (data.isDefault) {
      await Warehouse.updateMany({ organization: org(req) }, { isDefault: false });
    }
    return data;
  },
  beforeDelete: async (req, id) => {
    const warehouse = await Warehouse.findOne({ _id: id, organization: org(req) }).lean();
    if (warehouse?.isDefault) throw ApiError.validation('The default warehouse cannot be deleted');
  },
});

export const supplierController = createCrudController({
  model: Supplier,
  resource: 'Vendor',
  searchFields: ['name', 'company', 'email', 'phone', 'code', 'taxId'],
  sortable: ['name', 'balance', 'createdAt'],
  buildFilter: (req) => {
    const filter: Record<string, unknown> = {};
    if (req.query.status) filter.status = req.query.status;
    return filter;
  },
  beforeCreate: async (data, req) => {
    if (!data.code) {
      data.code = await nextDocumentNumber(org(req), 'supplier', 'VEN');
    }
    data.balance = Number(data.openingBalance) || 0;
    return data;
  },
  beforeDelete: async (req, id) => {
    const balance = await Supplier.findOne({ _id: id, organization: org(req) }).select('balance').lean();
    if (balance && balance.balance > 0) {
      throw ApiError.conflict('Vendor has an outstanding balance and cannot be deleted');
    }
  },
});

export const customerController = createCrudController({
  model: Customer,
  resource: 'Customer',
  searchFields: ['name', 'company', 'email', 'phone', 'code', 'taxId'],
  sortable: ['name', 'balance', 'createdAt'],
  buildFilter: (req) => {
    const filter: Record<string, unknown> = {};
    if (req.query.status) filter.status = req.query.status;
    return filter;
  },
  beforeCreate: async (data, req) => {
    if (!data.code) {
      data.code = await nextDocumentNumber(org(req), 'customer', 'CUS');
    }
    return data;
  },
  beforeDelete: async (req, id) => {
    const balance = await Customer.findOne({ _id: id, organization: org(req) }).select('balance').lean();
    if (balance && balance.balance > 0) {
      throw ApiError.conflict('Customer has an outstanding balance and cannot be deleted');
    }
  },
});

export const accountController = createCrudController({
  model: Account,
  resource: 'Account',
  searchFields: ['name', 'code', 'description'],
  populate: 'parent',
  sortable: ['code', 'name', 'type', 'balance'],
  buildFilter: (req) => {
    const filter: Record<string, unknown> = {};
    if (req.query.type) filter.type = req.query.type;
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
    return filter;
  },
  beforeUpdate: (data) => {
    delete data.balance;
    delete data.isSystem;
    return data;
  },
  beforeDelete: async (req, id) => {
    const account = await Account.findOne({ _id: id, organization: org(req) }).lean();
    if (!account) throw ApiError.notFound('Account');
    if (account.isSystem) throw ApiError.validation('System accounts cannot be deleted; deactivate instead');
    const used = await JournalEntry.countDocuments({
      organization: org(req),
      'lines.account': id,
    });
    if (used) throw ApiError.conflict('Account has ledger entries and cannot be deleted');
  },
});

export const employeeController = createCrudController({
  model: Employee,
  resource: 'Employee',
  searchFields: ['firstName', 'lastName', 'email', 'employeeId', 'department', 'designation'],
  populate: 'userId',
  sortable: ['firstName', 'lastName', 'employeeId', 'joinDate', 'createdAt'],
  buildFilter: (req) => {
    const filter: Record<string, unknown> = {};
    if (req.query.department) filter.department = req.query.department;
    if (req.query.status) filter.status = req.query.status;
    return filter;
  },
  beforeCreate: async (data, req) => {
    data.employeeId = await nextEmployeeCode(org(req));
    if (data.userId === '') delete data.userId;
    return data;
  },
  beforeUpdate: (data) => {
    delete data.employeeId;
    if (data.userId === '') data.userId = null;
    return data;
  },
});
