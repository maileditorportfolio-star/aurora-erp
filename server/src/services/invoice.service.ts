import { Types } from 'mongoose';
import { Invoice, SalesOrder } from '../models';
import { ApiError } from '../utils/ApiError';
import { postInvoiceJournal, voidJournalByReference } from './accounting.service';
import { issueInvoiceStock } from './sales.service';
import { createNotification } from './notification.service';
import { round2 } from '../utils/money';

export async function issueInvoice(
  invoiceId: Types.ObjectId | string,
  actorId?: Types.ObjectId,
): Promise<InstanceType<typeof Invoice>> {
  const invoice = await Invoice.findOne({ _id: invoiceId });
  if (!invoice) throw ApiError.notFound('Invoice');
  if (invoice.status === 'void') throw ApiError.validation('Void invoices cannot be issued');
  if (invoice.status !== 'draft' && invoice.status !== 'overdue') return invoice;

  let reserved = false;
  if (invoice.salesOrder) {
    const order = await SalesOrder.findById(invoice.salesOrder);
    if (order?.stockReserved) {
      reserved = true;
      order.stockReserved = false;
      await order.save();
    }
  }

  if (!invoice.stockIssued) {
    await issueInvoiceStock(invoice, {
      reserved,
      userId: actorId,
    });
    invoice.stockIssued = true;
  }
  if (!invoice.journalPosted) {
    await postInvoiceJournal(invoice);
    invoice.journalPosted = true;
  }

  if (invoice.status === 'draft') {
    const { updateCustomerBalance } = await import('./sales.service');
    await updateCustomerBalance(invoice.customer, invoice.total);
  }

  invoice.status = 'sent';
  invoice.sentAt = invoice.sentAt ?? new Date();
  invoice.balance = round2(invoice.total - invoice.amountPaid);
  await invoice.save();

  await createNotification({
    organization: invoice.organization,
    type: 'info',
    title: 'Invoice issued',
    message: `${invoice.number} was issued to the customer.`,
    link: `/sales/invoices/${invoice._id}`,
  });
  return invoice;
}

export async function voidInvoice(
  invoiceId: Types.ObjectId | string,
  reason: string,
  actorId?: Types.ObjectId,
): Promise<InstanceType<typeof Invoice>> {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) throw ApiError.notFound('Invoice');
  if (invoice.status === 'void') throw ApiError.validation('Invoice is already void');
  if (invoice.amountPaid > 0) {
    throw ApiError.conflict('Void the received payments before voiding this invoice');
  }
  if (invoice.stockIssued) {
    await issueInvoiceStock(invoice, { reserved: false, reverse: true, userId: actorId });
    invoice.stockIssued = false;
  }
  if (invoice.journalPosted) {
    await voidJournalByReference(invoice.organization, 'invoice', invoice._id);
    invoice.journalPosted = false;
  }
  if (invoice.status !== 'draft') {
    const { updateCustomerBalance } = await import('./sales.service');
    await updateCustomerBalance(invoice.customer, -invoice.total);
  }
  invoice.status = 'void';
  invoice.voidedAt = new Date();
  invoice.voidReason = reason;
  await invoice.save();
  return invoice;
}
