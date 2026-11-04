import { Types } from 'mongoose';
import { ACCOUNT_CODES } from '../config/accounts';
import { Account, JournalEntry } from '../models';
import { ApiError } from '../utils/ApiError';
import { round2, sum } from '../utils/money';
import { nextDocumentNumber } from '../utils/sequence';

export interface JournalLineInput {
  account: Types.ObjectId | string;
  description?: string;
  debit?: number;
  credit?: number;
}

interface PostJournalInput {
  organization: Types.ObjectId;
  date?: Date;
  description: string;
  referenceType?: string;
  referenceId?: Types.ObjectId;
  referenceNumber?: string;
  source?: 'manual' | 'invoice' | 'payment' | 'bill' | 'expense' | 'income' | 'payroll' | 'opening';
  lines: JournalLineInput[];
  createdBy?: Types.ObjectId;
}

export async function accountByCode(organization: Types.ObjectId, code: string) {
  const account = await Account.findOne({ organization, code }).lean();
  if (!account) throw ApiError.validation(`Chart of accounts is missing account ${code}`);
  return account;
}

export async function postJournal(input: PostJournalInput) {
  const lines = input.lines
    .map((line) => ({
      account: new Types.ObjectId(String(line.account)),
      description: line.description,
      debit: round2(Math.max(0, Number(line.debit) || 0)),
      credit: round2(Math.max(0, Number(line.credit) || 0)),
    }))
    .filter((line) => line.debit > 0 || line.credit > 0);

  if (lines.length < 2) throw ApiError.validation('A journal entry needs at least two lines');

  const totalDebit = sum(lines.map((line) => line.debit));
  const totalCredit = sum(lines.map((line) => line.credit));
  if (totalDebit !== totalCredit) {
    throw ApiError.validation(
      `Journal entry is not balanced (debit ${totalDebit}, credit ${totalCredit})`,
    );
  }
  if (totalDebit <= 0) throw ApiError.validation('Journal entry amount must be greater than zero');

  const number = await nextDocumentNumber(input.organization, 'journal', 'JE');
  const entry = await JournalEntry.create({
    organization: input.organization,
    number,
    date: input.date ?? new Date(),
    description: input.description,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    referenceNumber: input.referenceNumber,
    lines,
    totalDebit,
    totalCredit,
    status: 'posted',
    source: input.source ?? 'manual',
    createdBy: input.createdBy,
    postedAt: new Date(),
  });

  await applyEntryBalances(input.organization, entry.lines, 1);
  return entry;
}

async function applyEntryBalances(
  organization: Types.ObjectId,
  lines: Array<{ account: Types.ObjectId; debit: number; credit: number }>,
  multiplier: 1 | -1,
) {
  const accountIds = lines.map((line) => String(line.account));
  const accounts = await Account.find({ organization }).lean();
  const byId = new Map(accounts.filter((a) => accountIds.includes(String(a._id))).map((account) => [String(account._id), account]));

  const updates = lines.map((line) => {
    const account = byId.get(String(line.account));
    const delta =
      account?.normalBalance === 'credit'
        ? round2((line.credit - line.debit) * multiplier)
        : round2((line.debit - line.credit) * multiplier);
    return { updateOne: { filter: { _id: line.account }, update: { $inc: { balance: delta } } } };
  });
  if (updates.length) await Account.bulkWrite(updates);
}

export async function voidJournalByReference(
  organization: Types.ObjectId,
  referenceType: string,
  referenceId: Types.ObjectId,
) {
  const entries = await JournalEntry.find({
    organization,
    referenceType,
    referenceId,
    status: 'posted',
  });
  for (const entry of entries) {
    entry.status = 'void';
    await entry.save();
    await applyEntryBalances(organization, entry.lines, -1);
  }
  return entries.length;
}

export async function voidJournalEntry(entryId: Types.ObjectId | string) {
  const entry = await JournalEntry.findById(entryId);
  if (!entry) throw ApiError.notFound('Journal entry');
  if (entry.status === 'void') throw ApiError.validation('Journal entry is already void');
  if (entry.status === 'posted') {
    await applyEntryBalances(entry.organization, entry.lines, -1);
  }
  entry.status = 'void';
  await entry.save();
  return entry;
}

export async function postInvoiceJournal(invoice: {
  organization: Types.ObjectId;
  _id: Types.ObjectId;
  number: string;
  issueDate: Date;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  createdBy?: Types.ObjectId;
}) {
  const receivable = await accountByCode(invoice.organization, ACCOUNT_CODES.RECEIVABLE);
  const sales = await accountByCode(invoice.organization, ACCOUNT_CODES.SALES);
  const lines: JournalLineInput[] = [
    {
      account: receivable._id,
      description: `Invoice ${invoice.number}`,
      debit: invoice.total,
    },
    {
      account: sales._id,
      description: `Revenue ${invoice.number}`,
      credit: round2(invoice.subtotal - invoice.discountTotal),
    },
  ];
  if (invoice.taxTotal > 0) {
    const taxPayable = await accountByCode(invoice.organization, ACCOUNT_CODES.TAX_PAYABLE);
    lines.push({
      account: taxPayable._id,
      description: `Sales tax ${invoice.number}`,
      credit: invoice.taxTotal,
    });
  }
  return postJournal({
    organization: invoice.organization,
    date: invoice.issueDate,
    description: `Sales invoice ${invoice.number}`,
    referenceType: 'invoice',
    referenceId: invoice._id,
    referenceNumber: invoice.number,
    source: 'invoice',
    lines,
    createdBy: invoice.createdBy,
  });
}

export async function postBillJournal(bill: {
  organization: Types.ObjectId;
  _id: Types.ObjectId;
  number: string;
  issueDate: Date;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  createdBy?: Types.ObjectId;
}) {
  const inventory = await accountByCode(bill.organization, ACCOUNT_CODES.INVENTORY);
  const payable = await accountByCode(bill.organization, ACCOUNT_CODES.PAYABLE);
  const lines: JournalLineInput[] = [
    {
      account: inventory._id,
      description: `Purchase ${bill.number}`,
      debit: round2(bill.subtotal - bill.discountTotal),
    },
    {
      account: payable._id,
      description: `Bill ${bill.number}`,
      credit: bill.total,
    },
  ];
  if (bill.taxTotal > 0) {
    const taxReceivable = await accountByCode(bill.organization, ACCOUNT_CODES.TAX_RECEIVABLE);
    lines.push({
      account: taxReceivable._id,
      description: `Purchase tax ${bill.number}`,
      debit: bill.taxTotal,
    });
  }
  return postJournal({
    organization: bill.organization,
    date: bill.issueDate,
    description: `Vendor bill ${bill.number}`,
    referenceType: 'bill',
    referenceId: bill._id,
    referenceNumber: bill.number,
    source: 'bill',
    lines,
    createdBy: bill.createdBy,
  });
}

export async function postPaymentJournal(payment: {
  organization: Types.ObjectId;
  _id: Types.ObjectId;
  number: string;
  type: 'receivable' | 'payable';
  amount: number;
  method: string;
  date: Date;
  invoice?: Types.ObjectId | null;
  bill?: Types.ObjectId | null;
  createdBy?: Types.ObjectId;
}) {
  const cash = await accountByCode(payment.organization, ACCOUNT_CODES.CASH);
  const bank = await accountByCode(payment.organization, ACCOUNT_CODES.BANK);
  const assetAccount = payment.method === 'cash' ? cash : bank;
  const lines: JournalLineInput[] =
    payment.type === 'receivable'
      ? [
          {
            account: assetAccount._id,
            description: `Receipt ${payment.number}`,
            debit: payment.amount,
          },
          {
            account: (await accountByCode(payment.organization, ACCOUNT_CODES.RECEIVABLE))._id,
            description: `Receipt ${payment.number}`,
            credit: payment.amount,
          },
        ]
      : [
          {
            account: (await accountByCode(payment.organization, ACCOUNT_CODES.PAYABLE))._id,
            description: `Payment ${payment.number}`,
            debit: payment.amount,
          },
          {
            account: assetAccount._id,
            description: `Payment ${payment.number}`,
            credit: payment.amount,
          },
        ];

  return postJournal({
    organization: payment.organization,
    date: payment.date,
    description: `${payment.type === 'receivable' ? 'Customer receipt' : 'Vendor payment'} ${payment.number}`,
    referenceType: 'payment',
    referenceId: payment._id,
    referenceNumber: payment.number,
    source: 'payment',
    lines,
    createdBy: payment.createdBy,
  });
}

export async function postIncomeExpenseJournal(transaction: {
  organization: Types.ObjectId;
  _id: Types.ObjectId;
  number: string;
  type: 'income' | 'expense';
  date: Date;
  description: string;
  account: Types.ObjectId;
  paymentAccount: Types.ObjectId;
  amount: number;
  taxAmount: number;
  total: number;
  createdBy?: Types.ObjectId;
}) {
  const lines: JournalLineInput[] = [];
  if (transaction.type === 'income') {
    lines.push({
      account: transaction.paymentAccount,
      description: transaction.description,
      debit: transaction.total,
    });
    lines.push({
      account: transaction.account,
      description: transaction.description,
      credit: transaction.amount,
    });
    if (transaction.taxAmount > 0) {
      lines.push({
        account: (await accountByCode(transaction.organization, ACCOUNT_CODES.TAX_PAYABLE))._id,
        description: 'Tax on income',
        credit: transaction.taxAmount,
      });
    }
  } else {
    lines.push({
      account: transaction.account,
      description: transaction.description,
      debit: transaction.amount,
    });
    if (transaction.taxAmount > 0) {
      lines.push({
        account: (await accountByCode(transaction.organization, ACCOUNT_CODES.TAX_RECEIVABLE))._id,
        description: 'Tax on expense',
        debit: transaction.taxAmount,
      });
    }
    lines.push({
      account: transaction.paymentAccount,
      description: transaction.description,
      credit: transaction.total,
    });
  }

  return postJournal({
    organization: transaction.organization,
    date: transaction.date,
    description: `${transaction.type === 'income' ? 'Income' : 'Expense'} ${transaction.number}`,
    referenceType: 'transaction',
    referenceId: transaction._id,
    referenceNumber: transaction.number,
    source: transaction.type,
    lines,
    createdBy: transaction.createdBy,
  });
}
