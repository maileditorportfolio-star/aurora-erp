import { Router } from 'express';
import authRoutes from './auth.routes';
import publicRoutes from './public.routes';
import dashboardRoutes from './dashboard.routes';
import productRoutes from './product.routes';
import customerRoutes from './customer.routes';
import quotationRoutes from './quotation.routes';
import salesOrderRoutes from './salesOrder.routes';
import invoiceRoutes from './invoice.routes';
import paymentRoutes from './payment.routes';
import supplierRoutes from './supplier.routes';
import purchaseOrderRoutes from './purchaseOrder.routes';
import goodsReceiptRoutes from './goodsReceipt.routes';
import billRoutes from './bill.routes';
import adminRoutes from './admin.routes';
import { categoryRouter, warehouseRouter } from './master.routes';
import { accountRouter, journalRouter, reportRouter, transactionRouter } from './finance.routes';
import { attendanceRouter, employeeRouter, leaveRouter, payrollRouter } from './hr.routes';
import {
  auditRouter,
  notificationRouter,
  organizationRouter,
  teamRouter,
} from './organization.routes';
import { authenticate } from '../middlewares/auth';
import { requireOrganization, tenantContext } from '../middlewares/tenant';
import { requireSuperAdmin } from '../middlewares/rbac';

const router = Router();

router.use('/public', publicRoutes);
router.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', uptime: process.uptime() } });
});

router.use('/auth', authRoutes);

// Everything below requires a valid access token.
router.use(authenticate);
router.use(tenantContext);

// Platform console is cross-tenant and guarded by super admin checks.
router.use('/admin', requireSuperAdmin, adminRoutes);

// All remaining resources require an active organization context.
router.use(requireOrganization);

router.use('/dashboard', dashboardRoutes);
router.use('/products', productRoutes);
router.use('/categories', categoryRouter);
router.use('/warehouses', warehouseRouter);
router.use('/suppliers', supplierRoutes);
router.use('/customers', customerRoutes);
router.use('/quotations', quotationRoutes);
router.use('/sales-orders', salesOrderRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/payments', paymentRoutes);
router.use('/purchase-orders', purchaseOrderRoutes);
router.use('/goods-receipts', goodsReceiptRoutes);
router.use('/bills', billRoutes);
router.use('/accounts', accountRouter);
router.use('/transactions', transactionRouter);
router.use('/journal-entries', journalRouter);
router.use('/reports', reportRouter);
router.use('/employees', employeeRouter);
router.use('/attendance', attendanceRouter);
router.use('/leaves', leaveRouter);
router.use('/payroll', payrollRouter);
router.use('/organization', organizationRouter);
router.use('/team', teamRouter);
router.use('/notifications', notificationRouter);
router.use('/audit-logs', auditRouter);

export default router;
