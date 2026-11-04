import { Router } from 'express';
import { accountController } from '../controllers/master.controller';
import { transactionController } from '../controllers/transaction.controller';
import { journalController } from '../controllers/journal.controller';
import { reportController } from '../controllers/report.controller';
import { PERMISSIONS } from '../config/permissions';
import { registerCrudRoutes } from './crud.routes';
import { requirePermission } from '../middlewares/rbac';
import { validateBody } from '../middlewares/validate';
import {
  accountCreateSchema,
  accountUpdateSchema,
  journalCreateSchema,
  transactionCreateSchema,
} from '../validations/finance';
import { idSchema } from '../validations/common';

export const accountRouter = Router();
registerCrudRoutes(accountRouter, accountController, {
  read: PERMISSIONS.ACCOUNTS_READ,
  write: PERMISSIONS.ACCOUNTS_WRITE,
  remove: PERMISSIONS.ACCOUNTS_DELETE,
  createSchema: accountCreateSchema,
  updateSchema: accountUpdateSchema,
  allowRestore: true,
});

export const transactionRouter = Router();
transactionRouter.param('id', (req, _res, next, id) => {
  const result = idSchema.safeParse(id);
  if (!result.success) return next(result.error);
  next();
});
transactionRouter.get('/', requirePermission(PERMISSIONS.TRANSACTIONS_READ), transactionController.list);
transactionRouter.get('/:id', requirePermission(PERMISSIONS.TRANSACTIONS_READ), transactionController.get);
transactionRouter.post(
  '/',
  requirePermission(PERMISSIONS.TRANSACTIONS_WRITE),
  validateBody(transactionCreateSchema),
  transactionController.create,
);
transactionRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.TRANSACTIONS_WRITE),
  transactionController.update,
);
transactionRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.TRANSACTIONS_DELETE),
  transactionController.remove,
);

export const journalRouter = Router();
journalRouter.param('id', (req, _res, next, id) => {
  const result = idSchema.safeParse(id);
  if (!result.success) return next(result.error);
  next();
});
journalRouter.get('/', requirePermission(PERMISSIONS.JOURNAL_READ), journalController.list);
journalRouter.get('/:id', requirePermission(PERMISSIONS.JOURNAL_READ), journalController.get);
journalRouter.post(
  '/',
  requirePermission(PERMISSIONS.JOURNAL_WRITE),
  validateBody(journalCreateSchema),
  journalController.create,
);
journalRouter.post('/:id/void', requirePermission(PERMISSIONS.JOURNAL_WRITE), journalController.void);
journalRouter.delete('/:id', requirePermission(PERMISSIONS.JOURNAL_WRITE), journalController.remove);

export const reportRouter = Router();
reportRouter.get('/profit-loss', requirePermission(PERMISSIONS.REPORTS_READ), reportController.profitLoss);
reportRouter.get('/trial-balance', requirePermission(PERMISSIONS.REPORTS_READ), reportController.trialBalance);
reportRouter.get('/balance-sheet', requirePermission(PERMISSIONS.REPORTS_READ), reportController.balanceSheet);
reportRouter.get('/cashflow', requirePermission(PERMISSIONS.REPORTS_READ), reportController.cashflow);
reportRouter.get('/summary', requirePermission(PERMISSIONS.REPORTS_READ), reportController.summary);
reportRouter.get(
  '/receivables-aging',
  requirePermission(PERMISSIONS.REPORTS_READ),
  reportController.receivablesAging,
);
reportRouter.get(
  '/payables-aging',
  requirePermission(PERMISSIONS.REPORTS_READ),
  reportController.payablesAging,
);
