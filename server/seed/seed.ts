/* eslint-disable no-console */
import mongoose from 'mongoose';
import { addDays, subDays, subMonths } from 'date-fns';
import { connectDatabase, disconnectDatabase } from '../src/config/db';
import { logger } from '../src/config/logger';
import {
  Account,
  Attendance,
  Bill,
  Category,
  Customer,
  Employee,
  GoodsReceipt,
  Invoice,
  LeaveRequest,
  Membership,
  Notification,
  Organization,
  Payment,
  Product,
  PurchaseOrder,
  Quotation,
  SalarySlip,
  SalesOrder,
  Supplier,
  Transaction,
  User,
  Warehouse,
  type ProductDocument,
} from '../src/models';
import { bootstrapOrganization } from '../src/services/organization.service';
import { issueInvoice } from '../src/services/invoice.service';
import {
  postBillJournal,
  postIncomeExpenseJournal,
  postPaymentJournal,
  postJournal,
} from '../src/services/accounting.service';
import { updateCustomerBalance, updateInvoicePayment } from '../src/services/sales.service';
import { receiveStock } from '../src/services/inventory.service';
import { nextDocumentNumber } from '../src/utils/sequence';
import { calculateTotals, round2 } from '../src/utils/money';
import { runWithTenant } from '../src/plugins/tenant';
import { ACCOUNT_CODES } from '../src/config/accounts';

const fresh = process.argv.includes('--fresh');
const PASSWORD = process.env.SEED_PASSWORD ?? 'Admin@12345';

function dateInMonths(monthsAgo: number, day = 12): Date {
  const base = subMonths(new Date(), monthsAgo);
  base.setUTCDate(day);
  base.setUTCHours(10, 0, 0, 0);
  return base;
}

function randomBetween(min: number, max: number) {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

async function createUser(
  name: string,
  email: string,
  isSuperAdmin = false,
  jobTitle?: string,
) {
  const existing = await User.findOne({ email });
  if (existing) return existing;
  return User.create({
    name,
    email,
    passwordHash: await import('../src/utils/password').then((mod) => mod.hashPassword(PASSWORD)),
    isSuperAdmin,
    status: 'active',
    jobTitle,
    lastLoginAt: new Date(),
  });
}

async function main() {
  await connectDatabase();

  if (fresh) {
    console.log('Dropping database…');
    await mongoose.connection.dropDatabase();
  }

  const existingOrg = await Organization.findOne({ slug: 'aurora-demo' });
  if (existingOrg && !fresh) {
    console.log('Demo data already exists. Re-run with "npm run seed:fresh" to rebuild.');
    await disconnectDatabase();
    return;
  }

  console.log('Seeding Aurora ERP demo workspace…');

  const superAdmin = await createUser('Ava Sterling', 'admin@aurora.com', true, 'Platform Owner');
  const manager = await createUser('Marcus Reed', 'manager@aurora.com', false, 'Operations Manager');
  const accountant = await createUser('Priya Nair', 'accountant@aurora.com', false, 'Senior Accountant');
  const employeeUser = await createUser('Noah Kim', 'employee@aurora.com', false, 'Sales Associate');
  const viewer = await createUser('Lena Ortiz', 'viewer@aurora.com', false, 'Warehouse Associate');

  const organization = await Organization.create({
    name: 'Aurora Demo Co.',
    legalName: 'Aurora Demo Company LLC',
    slug: 'aurora-demo',
    email: 'hello@aurora-demo.com',
    phone: '+1 (415) 555-0142',
    brandColor: '#4f46e5',
    appName: 'Aurora ERP',
    plan: 'enterprise',
    status: 'active',
    owner: superAdmin._id,
    onboardingCompleted: true,
    settings: {
      currency: 'USD',
      timezone: 'America/Los_Angeles',
      locale: 'en-US',
      dateFormat: 'MMM d, yyyy',
      taxRate: 8.5,
      invoicePrefix: 'INV',
      quotationPrefix: 'QUO',
      salesOrderPrefix: 'SO',
      purchaseOrderPrefix: 'PO',
      fiscalYearStart: 1,
      invoiceDueDays: 30,
      industry: 'Technology & Office Solutions',
      website: 'https://aurora-demo.com',
      address: {
        street: '600 Market Street, Suite 1200',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '94104',
        country: 'United States',
      },
    },
  });

  await bootstrapOrganization(organization._id);

  const memberships: Array<[typeof manager, 'manager' | 'accountant' | 'employee', string]> = [
    [manager, 'manager', 'Operations Manager'],
    [accountant, 'accountant', 'Senior Accountant'],
    [employeeUser, 'employee', 'Sales Associate'],
    [viewer, 'employee', 'Warehouse Associate'],
  ];
  await Membership.create({
    organization: organization._id,
    user: superAdmin._id,
    role: 'org_admin',
    status: 'active',
    title: 'Owner',
    joinedAt: subMonths(new Date(), 14),
  });
  for (const [user, role, title] of memberships) {
    await Membership.create({
      organization: organization._id,
      user: user._id,
      role,
      status: 'active',
      title,
      joinedAt: subMonths(new Date(), 10),
    });
  }

  const organizationId = organization._id;
  await runWithTenant({ organizationId: String(organizationId), isSuperAdmin: true }, async () => {
    /* ───────────────────────── Warehouses & categories ───────────────────── */
    const mainWarehouse = await Warehouse.findOne({ organization: organizationId, isDefault: true });
    if (!mainWarehouse) throw new Error('Default warehouse missing');
    const westWarehouse = await Warehouse.create({
      organization: organizationId,
      name: 'West Coast Distribution',
      code: 'WEST',
      manager: 'Lena Ortiz',
      phone: '+1 (510) 555-0199',
      isDefault: false,
      address: { street: '1880 Harbor Bay Pkwy', city: 'Alameda', state: 'CA', postalCode: '94502', country: 'United States' },
    });

    const categoryNames = [
      ['Laptops & Computers', '#6366f1'],
      ['Monitors & Displays', '#0ea5e9'],
      ['Audio & Video', '#f59e0b'],
      ['Office Furniture', '#10b981'],
      ['Accessories', '#ec4899'],
      ['Office Supplies', '#8b5cf6'],
    ] as const;
    const categories = [];
    for (const [name, color] of categoryNames) {
      const existing = await Category.findOne({ organization: organizationId, name });
      categories.push(
        existing ??
          (await Category.create({
            organization: organizationId,
            name,
            code: name.slice(0, 3).toUpperCase(),
            color,
            description: `${name} product category`,
          })),
      );
    }

    /* ─────────────────────────────── Vendors ─────────────────────────────── */
    const vendorSeeds = [
      ['Northwind Technologies', 'sales@northwind-tech.com', 'NET30'],
      ['Summit Office Supply', 'orders@summitoffice.com', 'NET15'],
      ['Pacific Components Ltd.', 'trade@pacificcomponents.com', 'NET45'],
      ['ErgoWorks Furniture', 'hello@ergoworks.com', 'NET30'],
    ];
    const vendors = [];
    for (const [name, email, terms] of vendorSeeds) {
      const code = await nextDocumentNumber(organizationId, 'supplier', 'VEN');
      vendors.push(
        await Supplier.create({
          organization: organizationId,
          name,
          code,
          company: name,
          email,
          phone: '+1 (800) 555-0' + Math.floor(100 + Math.random() * 899),
          paymentTerms: Number(terms?.replace('NET', '') ?? 30),
          currency: 'USD',
          status: 'active',
          balance: 0,
          address: { city: 'San Francisco', state: 'CA', country: 'United States' },
        }),
      );
    }

    /* ─────────────────────────────── Products ────────────────────────────── */
    const productSeeds: Array<[string, string, number, number, number, number, number]> = [
      ['AeroBook Pro 14"', 'LAP-ABP14', 1299, 1899, 0, 32, 8],
      ['AeroBook Air 13"', 'LAP-ABA13', 899, 1299, 0, 48, 10],
      ['Studio Display 27" 4K', 'MON-SD27', 349, 599, 1, 26, 6],
      ['UltraWide 34" Monitor', 'MON-UW34', 529, 899, 1, 14, 4],
      ['Pulse Wireless Headphones', 'AUD-PWH', 79, 149, 2, 64, 15],
      ['ClearCast Conference Mic', 'AUD-CCM', 129, 229, 2, 9, 5],
      ['ErgoDesk Standing Desk', 'FUR-EDS', 289, 549, 3, 8, 3],
      ['ErgoMesh Task Chair', 'FUR-EMC', 149, 329, 3, 4, 6],
      ['USB-C 11-in-1 Hub', 'ACC-UCH', 39, 89, 4, 120, 25],
      ['Mechanical Keyboard K8', 'ACC-MK8', 59, 119, 4, 7, 10],
      ['A4 Copy Paper (500)', 'SUP-A4P', 4.5, 9.5, 5, 300, 50],
      ['Whiteboard Marker Set', 'SUP-WMS', 6, 14, 5, 42, 20],
    ];

    const products: Array<ProductDocument | null> = [];
    for (const [name, sku, cost, price, categoryIndex, stock, reorder] of productSeeds) {
      const product = await Product.create({
        organization: organizationId,
        name,
        sku,
        barcode: '890' + Math.floor(1000000000 + Math.random() * 8999999999),
        description: `${name} — premium quality, business ready.`,
        category: categories[categoryIndex]!._id,
        supplier: vendors[categoryIndex % vendors.length]!._id,
        warehouse: categoryIndex % 3 === 0 ? westWarehouse._id : mainWarehouse._id,
        type: 'goods',
        unit: 'pcs',
        costPrice: cost,
        sellingPrice: price,
        taxRate: 8.5,
        stock: 0,
        reorderPoint: reorder,
        reorderQty: reorder * 2,
        status: 'active',
      });
      await receiveStock({
        organization: organizationId,
        productId: product._id,
        warehouseId: product.warehouse ?? mainWarehouse._id,
        quantity: stock,
        note: 'Opening stock',
        reference: { type: 'opening' },
        userId: superAdmin._id,
      });
      products.push(await Product.findById(product._id));
    }

    /* ─────────────────────────────── Customers ───────────────────────────── */
    const customerSeeds = [
      ['Brightline Media', 'procurement@brightline.io', 'San Francisco', 'CA'],
      ['Cedar & Co. Architects', 'accounts@cedarco.com', 'Oakland', 'CA'],
      ['Nova Health Group', 'finance@novahealth.org', 'San Jose', 'CA'],
      ['Redwood Logistics', 'ap@redwoodlogistics.com', 'Sacramento', 'CA'],
      ['Lumen Education', 'purchasing@lumenedu.org', 'Berkeley', 'CA'],
      ['Harbor Financial', 'ops@harborfin.com', 'Los Angeles', 'CA'],
      ['Atlas Creative Studio', 'hello@atlascreative.co', 'Portland', 'OR'],
      ['Meridian Legal', 'admin@meridianlegal.com', 'Seattle', 'WA'],
    ];
    const customers = [];
    for (const [name, email, city, state] of customerSeeds) {
      const code = await nextDocumentNumber(organizationId, 'customer', 'CUS');
      customers.push(
        await Customer.create({
          organization: organizationId,
          name,
          code,
          company: name,
          email,
          phone: '+1 (628) 555-0' + Math.floor(100 + Math.random() * 899),
          billingAddress: { street: `${Math.floor(100 + Math.random() * 900)} Main St`, city, state, country: 'United States', postalCode: '9' + Math.floor(1000 + Math.random() * 8999) },
          creditLimit: 25000,
          balance: 0,
          currency: 'USD',
          status: 'active',
          tags: ['west-coast', 'b2b'],
        }),
      );
    }

    /* ────────────────────────────── Quotations ───────────────────────────── */
    const quotationStatuses = ['converted', 'accepted', 'sent', 'draft', 'rejected'] as const;
    for (let index = 0; index < 6; index += 1) {
      const customer = customers[index % customers.length]!;
      const rawItems = [
        { product: products[index % products.length]!._id, description: products[index % products.length]!.name, quantity: 2 + index, unitPrice: products[index % products.length]!.sellingPrice, discountRate: index % 2 === 0 ? 5 : 0, taxRate: 8.5 },
        { product: products[(index + 3) % products.length]!._id, description: products[(index + 3) % products.length]!.name, quantity: 1 + (index % 3), unitPrice: products[(index + 3) % products.length]!.sellingPrice, discountRate: 0, taxRate: 8.5 },
      ];
      const lines = rawItems.map((item) => ({
        ...item,
        unitCost: products.find((product) => String(product!._id) === String(item.product))!.costPrice,
        quantity: item.quantity,
        discount: round2(item.quantity * item.unitPrice * (item.discountRate / 100)),
        tax: round2((item.quantity * item.unitPrice * (1 - item.discountRate / 100)) * 0.085),
      }));
      const totals = calculateTotals(rawItems);
      const date = dateInMonths(8 - index, 8 + index);
      const number = await nextDocumentNumber(organizationId, 'quotation', 'QUO');
      await Quotation.create({
        organization: organizationId,
        number,
        customer: customer._id,
        date,
        validUntil: addDays(date, 30),
        items: lines,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        taxTotal: totals.taxTotal,
        total: totals.total,
        status: quotationStatuses[index % quotationStatuses.length],
        notes: 'Thank you for your business.',
        terms: 'Payment due within 30 days. Prices valid for 30 days.',
        createdBy: manager._id,
      });
    }

    /* ────────────────────────────── Sales orders ──────────────────────────── */
    const orders = [];
    for (let index = 0; index < 5; index += 1) {
      const customer = customers[(index + 1) % customers.length]!;
      const product = products[(index * 2) % products.length]!;
      const quantity = 1 + (index % 3);
      const rawItems = [
        { product: product._id, description: product.name, quantity, unitPrice: product.sellingPrice, discountRate: 0, taxRate: 8.5 },
      ];
      const totals = calculateTotals(rawItems);
      const number = await nextDocumentNumber(organizationId, 'sales_order', 'SO');
      const date = dateInMonths(6 - index, 5 + index);
      const order = await SalesOrder.create({
        organization: organizationId,
        number,
        customer: customer._id,
        date,
        deliveryDate: addDays(date, 7),
        warehouse: product.warehouse,
        items: rawItems.map((item) => ({
          ...item,
          unitCost: product.costPrice,
          discount: 0,
          tax: round2(item.quantity * item.unitPrice * 0.085),
          total: round2(item.quantity * item.unitPrice * 1.085),
        })),
        subtotal: totals.subtotal,
        discountTotal: 0,
        taxTotal: totals.taxTotal,
        total: totals.total,
        status: index < 2 ? 'delivered' : index < 4 ? 'confirmed' : 'pending',
        stockReserved: index < 4,
        createdBy: manager._id,
        approvedBy: index < 4 ? manager._id : undefined,
      });
      if (index < 4) {
        for (const item of order.items) {
          if (!item.product) continue;
          const { reserveStock } = await import('../src/services/inventory.service');
          await reserveStock({
            organization: organizationId,
            productId: item.product,
            warehouseId: order.warehouse,
            quantity: item.quantity,
            reference: { type: 'sales_order', id: order._id, number: order.number },
            userId: manager._id,
          });
        }
      }
      orders.push(order);
    }

    /* ─────────────────────────────── Invoices ─────────────────────────────── */
    const invoiceSeeds: Array<{ orderIndex?: number; monthsAgo: number; paid: number; direct?: boolean }> = [
      { orderIndex: 0, monthsAgo: 5, paid: 1 },
      { orderIndex: 1, monthsAgo: 4, paid: 0.5 },
      { monthsAgo: 3, paid: 1, direct: true },
      { monthsAgo: 2, paid: 0, direct: true },
      { monthsAgo: 1, paid: 0.35, direct: true },
      { monthsAgo: 0, paid: 0, direct: true },
      { monthsAgo: 2, paid: 1, direct: true },
      { monthsAgo: 0, paid: 0, direct: true },
    ];
    const invoices = [];
    for (let index = 0; index < invoiceSeeds.length; index += 1) {
      const seed = invoiceSeeds[index]!;
      const customer = customers[(index + 2) % customers.length]!;
      let items;
      let salesOrder;
      let warehouse;
      if (!seed.direct && seed.orderIndex !== undefined) {
        const order = orders[seed.orderIndex]!;
        items = order.items;
        salesOrder = order._id;
        warehouse = order.warehouse;
      } else {
        const product = products[(index + 4) % products.length]!;
        const quantity = 1 + (index % 4);
        const rawItems = [
          { product: product._id, description: product.name, quantity, unitPrice: product.sellingPrice, discountRate: index % 3 === 0 ? 5 : 0, taxRate: 8.5 },
          { product: products[(index + 6) % products.length]!._id, description: products[(index + 6) % products.length]!.name, quantity: 1, unitPrice: products[(index + 6) % products.length]!.sellingPrice, discountRate: 0, taxRate: 8.5 },
        ];
        items = rawItems.map((item) => ({
          ...item,
          unitCost: 0,
          discount: round2(item.quantity * item.unitPrice * (item.discountRate / 100)),
          tax: round2(item.quantity * item.unitPrice * (1 - item.discountRate / 100) * 0.085),
          total: round2(item.quantity * item.unitPrice * (1 - item.discountRate / 100) * 1.085),
        }));
        warehouse = product.warehouse;
      }
      const totals = calculateTotals(items as never);
      const issueDate = dateInMonths(seed.monthsAgo, 6 + index);
      const number = await nextDocumentNumber(organizationId, 'invoice', 'INV');
      const invoice = await Invoice.create({
        organization: organizationId,
        number,
        customer: customer._id,
        salesOrder,
        issueDate,
        dueDate: addDays(issueDate, 30),
        warehouse,
        items,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        taxTotal: totals.taxTotal,
        total: totals.total,
        amountPaid: 0,
        balance: totals.total,
        status: 'draft',
        notes: 'Wire transfer preferred. Reference the invoice number.',
        terms: 'Payment due within 30 days.',
        createdBy: accountant._id,
      });
      await issueInvoice(invoice._id, accountant._id);
      const paidAmount = round2(totals.total * seed.paid);
      if (paidAmount > 0) {
        const paymentNumber = await nextDocumentNumber(organizationId, 'receipt', 'RCP');
        const payment = await Payment.create({
          organization: organizationId,
          number: paymentNumber,
          type: 'receivable',
          customer: customer._id,
          invoice: invoice._id,
          amount: paidAmount,
          currency: 'USD',
          method: index % 2 === 0 ? 'bank' : 'card',
          reference: `TRX-${1000 + index}`,
          date: addDays(issueDate, 5),
          createdBy: accountant._id,
        });
        await updateInvoicePayment(invoice._id, paidAmount, 1);
        await updateCustomerBalance(customer._id, -paidAmount);
        await postPaymentJournal(payment);
      }
      invoices.push(await Invoice.findById(invoice._id));
    }

    /* ─────────────────────────── Purchase orders & GRN ────────────────────── */
    const purchaseOrders = [];
    for (let index = 0; index < 4; index += 1) {
      const vendor = vendors[index % vendors.length]!;
      const product = products[(index + 2) % products.length]!;
      const quantity = 10 + index * 2;
      const rawItems = [
        { product: product._id, description: product.name, quantity, unitCost: product.costPrice, unitPrice: product.costPrice, discountRate: 0, taxRate: 8.5 },
      ];
      const totals = calculateTotals(rawItems);
      const number = await nextDocumentNumber(organizationId, 'purchase_order', 'PO');
      const purchaseOrder = await PurchaseOrder.create({
        organization: organizationId,
        number,
        supplier: vendor._id,
        date: dateInMonths(4 - index, 3 + index),
        expectedDate: addDays(dateInMonths(4 - index, 3 + index), 10),
        warehouse: mainWarehouse._id,
        items: rawItems.map((item) => ({
          ...item,
          unitPrice: item.unitCost,
          discount: 0,
          tax: round2(item.quantity * item.unitCost * 0.085),
          total: round2(item.quantity * item.unitCost * 1.085),
        })),
        subtotal: totals.subtotal,
        discountTotal: 0,
        taxTotal: totals.taxTotal,
        total: totals.total,
        status: index < 2 ? 'received' : index === 2 ? 'approved' : 'sent',
        createdBy: manager._id,
        approvedBy: manager._id,
      });
      purchaseOrders.push(purchaseOrder);
    }

    for (let index = 0; index < 2; index += 1) {
      const purchaseOrder = purchaseOrders[index]!;
      const number = await nextDocumentNumber(organizationId, 'goods_receipt', 'GRN');
      const items = purchaseOrder.items.map((item) => ({
        product: item.product!,
        description: item.description,
        orderedQty: item.quantity,
        receivedQty: item.quantity,
        acceptedQty: item.quantity,
        rejectedQty: 0,
        unitCost: item.unitPrice,
        total: round2(item.quantity * item.unitPrice),
      }));
      for (const item of items) {
        await receiveStock({
          organization: organizationId,
          productId: item.product,
          warehouseId: purchaseOrder.warehouse!,
          quantity: item.acceptedQty,
          reference: { type: 'goods_receipt', number },
          note: `Goods receipt ${number}`,
          userId: manager._id,
        });
      }
      const receipt = await GoodsReceipt.create({
        organization: organizationId,
        number,
        purchaseOrder: purchaseOrder._id,
        supplier: purchaseOrder.supplier,
        warehouse: purchaseOrder.warehouse!,
        receivedDate: dateInMonths(index === 0 ? 3 : 2, 18),
        items,
        total: items.reduce((sum, item) => sum + item.total, 0),
        status: 'received',
        stockApplied: true,
        createdBy: manager._id,
      });
      purchaseOrder.status = 'received';
      await purchaseOrder.save();

      if (index === 0) {
        const billNumber = await nextDocumentNumber(organizationId, 'bill', 'BILL');
        const billTotals = calculateTotals(
          receipt.items.map((item) => ({
            quantity: item.acceptedQty,
            unitPrice: item.unitCost,
            taxRate: 8.5,
          })),
        );
        const bill = await Bill.create({
          organization: organizationId,
          number: billNumber,
          supplier: purchaseOrder.supplier,
          purchaseOrder: purchaseOrder._id,
          goodsReceipt: receipt._id,
          issueDate: addDays(receipt.receivedDate, 1),
          dueDate: addDays(receipt.receivedDate, 31),
          items: receipt.items.map((item) => ({
            product: item.product,
            description: item.description,
            quantity: item.acceptedQty,
            unitPrice: item.unitCost,
            unitCost: item.unitCost,
            discountRate: 0,
            taxRate: 8.5,
            discount: 0,
            tax: round2(item.acceptedQty * item.unitCost * 0.085),
            total: round2(item.acceptedQty * item.unitCost * 1.085),
          })),
          subtotal: billTotals.subtotal,
          discountTotal: billTotals.discountTotal,
          taxTotal: billTotals.taxTotal,
          total: billTotals.total,
          amountPaid: 0,
          balance: billTotals.total,
          status: 'open',
          createdBy: accountant._id,
        });
        await Supplier.updateOne({ _id: purchaseOrder.supplier }, { $inc: { balance: billTotals.total } });
        await postBillJournal(bill);
      }
    }

    /* ────────────────────────── Expenses & other income ───────────────────── */
    const utilityAccount = await Account.findOne({ organization: organizationId, code: ACCOUNT_CODES.UTILITIES });
    const marketingAccount = await Account.findOne({ organization: organizationId, code: ACCOUNT_CODES.MARKETING });
    const rentAccount = await Account.findOne({ organization: organizationId, code: ACCOUNT_CODES.RENT });
    const otherIncome = await Account.findOne({ organization: organizationId, code: ACCOUNT_CODES.OTHER_INCOME });
    const bankAccount = await Account.findOne({ organization: organizationId, code: ACCOUNT_CODES.BANK });
    if (!utilityAccount || !marketingAccount || !rentAccount || !otherIncome || !bankAccount) {
      throw new Error('Default chart of accounts missing');
    }

    const expenseMonths = 7;
    for (let index = 0; index < expenseMonths; index += 1) {
      const date = dateInMonths(index, 3);
      for (const [account, amount, description] of [
        [rentAccount, 4200, 'Monthly office rent'],
        [utilityAccount, randomBetween(240, 480), 'Utilities — electricity & internet'],
        [marketingAccount, randomBetween(600, 1800), 'Performance marketing'],
      ] as const) {
        const number = await nextDocumentNumber(organizationId, 'expense', 'EXP');
        const transaction = await Transaction.create({
          organization: organizationId,
          number,
          type: 'expense',
          date,
          description,
          account: account._id,
          paymentAccount: bankAccount._id,
          amount,
          taxAmount: 0,
          total: amount,
          status: 'posted',
          createdBy: accountant._id,
        });
        const journal = await postIncomeExpenseJournal(transaction);
        transaction.journalEntry = journal._id;
        await transaction.save();
      }
    }
    const incomeNumber = await nextDocumentNumber(organizationId, 'income', 'INC');
    const incomeTx = await Transaction.create({
      organization: organizationId,
      number: incomeNumber,
      type: 'income',
      date: dateInMonths(1, 20),
      description: 'Consulting services — workspace design',
      account: otherIncome._id,
      paymentAccount: bankAccount._id,
      amount: 3500,
      taxAmount: 0,
      total: 3500,
      status: 'posted',
      createdBy: accountant._id,
    });
    const incomeJournal = await postIncomeExpenseJournal(incomeTx);
    incomeTx.journalEntry = incomeJournal._id;
    await incomeTx.save();

    /* ──────────────────────────────── HR data ─────────────────────────────── */
    const employeeSeeds = [
      [employeeUser, 'Noah', 'Kim', 'Sales', 'Sales Associate', 4200, 1200, 400],
      [null, 'Sofia', 'Bennett', 'Operations', 'Operations Lead', 5200, 1400, 500],
      [null, 'Ethan', 'Wright', 'Finance', 'Financial Analyst', 4800, 1300, 450],
      [null, 'Maya', 'Patel', 'Engineering', 'Solutions Engineer', 6100, 1600, 600],
      [viewer, 'Lena', 'Ortiz', 'Warehouse', 'Warehouse Associate', 3600, 900, 300],
    ] as const;
    const employees = [];
    for (let index = 0; index < employeeSeeds.length; index += 1) {
      const [user, firstName, lastName, department, designation, basic, housing, transport] = employeeSeeds[index]!;
      const code = `EMP-${String(index + 1).padStart(4, '0')}`;
      employees.push(
        await Employee.create({
          organization: organizationId,
          employeeId: code,
          firstName,
          lastName,
          email: user?.email ?? `${firstName.toLowerCase()}.${lastName.toLowerCase()}@aurora-demo.com`,
          phone: '+1 (650) 555-0' + Math.floor(100 + Math.random() * 899),
          department,
          designation,
          joinDate: subMonths(new Date(), 14 - index),
          employmentType: 'full_time',
          status: 'active',
          salary: {
            basic,
            housingAllowance: housing,
            transportAllowance: transport,
            otherAllowances: 200,
            taxRate: 12,
            pensionRate: 5,
            otherDeductions: 0,
          },
          bank: { bankName: 'Chase', accountName: `${firstName} ${lastName}`, accountNumber: '****' + (1000 + index) },
          userId: user?._id,
          address: { city: 'San Francisco', state: 'CA', country: 'United States' },
        }),
      );
    }

    for (let day = 0; day < 18; day += 1) {
      const date = subDays(new Date(), day);
      if (date.getUTCDay() === 0 || date.getUTCDay() === 6) continue;
      for (let index = 0; index < employees.length; index += 1) {
        const employee = employees[index]!;
        const late = day % 7 === 0 && index === 1;
        await Attendance.create({
          organization: organizationId,
          employee: employee._id,
          date: date,
          clockIn: late ? '09:24' : '08:5' + (index % 6),
          clockOut: '17:3' + (index % 6),
          status: late ? 'late' : 'present',
          hours: late ? 8.2 : 8.5,
          overtimeHours: index === 3 && day % 5 === 0 ? 1.5 : 0,
          createdBy: manager._id,
        });
      }
    }

    const leaveSeeds = [
      [employees[0]!, 'annual', 12, 14, 'Family trip', 'approved'],
      [employees[2]!, 'sick', 2, 2, 'Medical appointment', 'pending'],
      [employees[4]!, 'annual', 20, 22, 'Personal time', 'pending'],
    ] as const;
    for (const [employee, type, start, end, reason, status] of leaveSeeds) {
      const startDate = subDays(new Date(), start);
      await LeaveRequest.create({
        organization: organizationId,
        employee: employee._id,
        type,
        startDate,
        endDate: subDays(new Date(), end),
        days: Math.max(1, start - end + 1),
        reason,
        status,
        approvedBy: status === 'approved' ? manager._id : undefined,
        approvedAt: status === 'approved' ? new Date() : undefined,
      });
    }

    const lastMonth = subMonths(new Date(), 1);
    const period = `${lastMonth.getUTCFullYear()}-${String(lastMonth.getUTCMonth() + 1).padStart(2, '0')}`;
    let payrollGross = 0;
    for (const employee of employees) {
      const { basic, housingAllowance, transportAllowance, otherAllowances, taxRate, pensionRate, otherDeductions } = employee.salary;
      const gross = round2(basic + housingAllowance + transportAllowance + otherAllowances);
      const tax = round2(gross * (taxRate / 100));
      const pension = round2(basic * (pensionRate / 100));
      const deductions = round2(tax + pension + otherDeductions);
      payrollGross = round2(payrollGross + gross);
      await SalarySlip.create({
        organization: organizationId,
        employee: employee._id,
        period,
        month: lastMonth.getUTCMonth() + 1,
        year: lastMonth.getUTCFullYear(),
        basic,
        allowances: { housing: housingAllowance, transport: transportAllowance, other: otherAllowances, total: round2(housingAllowance + transportAllowance + otherAllowances) },
        deductions: { tax, pension, other: otherDeductions, total: deductions },
        gross,
        net: round2(gross - deductions),
        status: 'paid',
        paidAt: dateInMonths(1, 28),
        paymentMethod: 'bank',
        journalPosted: true,
        generatedBy: accountant._id,
      });
    }
    const salariesAccount = await Account.findOne({ organization: organizationId, code: ACCOUNT_CODES.SALARIES });
    const taxPayableAccount = await Account.findOne({ organization: organizationId, code: ACCOUNT_CODES.TAX_PAYABLE });
    if (salariesAccount && taxPayableAccount) {
      await postJournal({
        organization: organizationId,
        date: dateInMonths(1, 28),
        description: `Payroll ${period}`,
        source: 'payroll',
        referenceNumber: period,
        lines: [
          { account: salariesAccount._id, debit: payrollGross, description: 'Salaries & wages' },
          { account: bankAccount._id, credit: round2(payrollGross * 0.92), description: 'Net pay' },
          { account: taxPayableAccount._id, credit: round2(payrollGross * 0.08), description: 'Payroll deductions' },
        ],
        createdBy: accountant._id,
      });
    }

    /* ─────────────────────────────── Bills payable ────────────────────────── */
    const secondBillNumber = await nextDocumentNumber(organizationId, 'bill', 'BILL');
    const secondVendor = vendors[1]!;
    const secondBillItems = [
      { product: products[10]!._id, description: products[10]!.name, quantity: 40, unitPrice: products[10]!.costPrice, unitCost: products[10]!.costPrice, discountRate: 0, taxRate: 8.5, discount: 0, tax: round2(40 * products[10]!.costPrice * 0.085), total: round2(40 * products[10]!.costPrice * 1.085) },
    ];
    const secondTotals = calculateTotals([{ quantity: 40, unitPrice: products[10]!.costPrice, taxRate: 8.5 }]);
    const secondBill = await Bill.create({
      organization: organizationId,
      number: secondBillNumber,
      supplier: secondVendor._id,
      issueDate: subDays(new Date(), 25),
      dueDate: addDays(subDays(new Date(), 25), 15),
      items: secondBillItems,
      subtotal: secondTotals.subtotal,
      discountTotal: 0,
      taxTotal: secondTotals.taxTotal,
      total: secondTotals.total,
      amountPaid: 0,
      balance: secondTotals.total,
      status: 'overdue',
      notes: 'Office supplies restock',
      createdBy: accountant._id,
    });
    await Supplier.updateOne({ _id: secondVendor._id }, { $inc: { balance: secondTotals.total } });
    await postBillJournal(secondBill);

    const paymentNumber = await nextDocumentNumber(organizationId, 'vendor_payment', 'PAY');
    const vendorPayment = await Payment.create({
      organization: organizationId,
      number: paymentNumber,
      type: 'payable',
      supplier: secondVendor._id,
      bill: secondBill._id,
      amount: round2(secondTotals.total * 0.4),
      currency: 'USD',
      method: 'bank',
      reference: 'ACH-2231',
      date: subDays(new Date(), 12),
      createdBy: accountant._id,
    });
    await postPaymentJournal(vendorPayment);
    secondBill.amountPaid = round2(secondTotals.total * 0.4);
    secondBill.balance = round2(secondTotals.total - secondBill.amountPaid);
    secondBill.status = 'partial';
    await secondBill.save();
    await Supplier.updateOne({ _id: secondVendor._id }, { $inc: { balance: -secondBill.amountPaid } });

    await Notification.create({
      organization: organizationId,
      type: 'info',
      title: 'Demo workspace ready',
      message: 'Sample products, invoices, vendors and payroll have been loaded. Explore each module.',
      link: '/dashboard',
    });

    console.log('Seed complete.');
    console.log(`  Workspace: ${organization.name} (${organization.slug})`);
    console.log('  Users (password: ' + PASSWORD + ')');
    for (const email of [
      'admin@aurora.com',
      'manager@aurora.com',
      'accountant@aurora.com',
      'employee@aurora.com',
      'viewer@aurora.com',
    ]) {
      console.log(`   • ${email}`);
    }
  });

  await disconnectDatabase();
  logger.info('Database seeded successfully');
}

main().catch(async (error) => {
  console.error(error);
  await disconnectDatabase();
  process.exit(1);
});
