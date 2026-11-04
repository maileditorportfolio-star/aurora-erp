import mongoose, { Schema, type HydratedDocument, type Types } from 'mongoose';
import { applyTenantSoftDelete, moneyField, schemaOptions, type SoftDeleteFields } from './helpers';

/* ───────────────────────────────── Account ──────────────────────────────── */

export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

export interface IAccount extends SoftDeleteFields {
  organization: Types.ObjectId;
  code: string;
  name: string;
  type: AccountType;
  subtype?: string;
  parent?: Types.ObjectId | null;
  isGroup: boolean;
  normalBalance: 'debit' | 'credit';
  description?: string;
  isActive: boolean;
  isSystem: boolean;
  balance: number;
  createdAt: Date;
  updatedAt: Date;
}

const accountSchema = new Schema<IAccount>(
  {
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    type: {
      type: String,
      enum: ['asset', 'liability', 'equity', 'income', 'expense'],
      required: true,
      index: true,
    },
    subtype: String,
    parent: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
    isGroup: { type: Boolean, default: false },
    normalBalance: { type: String, enum: ['debit', 'credit'], required: true },
    description: String,
    isActive: { type: Boolean, default: true },
    isSystem: { type: Boolean, default: false },
    balance: moneyField(),
  },
  schemaOptions,
);

accountSchema.index({ organization: 1, code: 1 }, { unique: true });
accountSchema.index({ organization: 1, type: 1, isActive: 1 });
applyTenantSoftDelete(accountSchema);

export const Account = mongoose.model<IAccount>('Account', accountSchema);
export type AccountDocument = HydratedDocument<IAccount>;

/* ─────────────────────────────── JournalEntry ───────────────────────────── */

export interface IJournalLine {
  account: Types.ObjectId;
  description?: string;
  debit: number;
  credit: number;
}

export type JournalSource =
  | 'manual'
  | 'invoice'
  | 'payment'
  | 'bill'
  | 'expense'
  | 'income'
  | 'payroll'
  | 'opening';

export interface IJournalEntry extends SoftDeleteFields {
  organization: Types.ObjectId;
  number: string;
  date: Date;
  description: string;
  referenceType?: string;
  referenceId?: Types.ObjectId;
  referenceNumber?: string;
  lines: IJournalLine[];
  totalDebit: number;
  totalCredit: number;
  status: 'draft' | 'posted' | 'void';
  source: JournalSource;
  createdBy?: Types.ObjectId;
  postedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const journalLineSchema = new Schema<IJournalLine>(
  {
    account: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    description: String,
    debit: { type: Number, default: 0, min: 0 },
    credit: { type: Number, default: 0, min: 0 },
  },
  { _id: true },
);

const journalEntrySchema = new Schema<IJournalEntry>(
  {
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    number: { type: String, required: true },
    date: { type: Date, default: Date.now },
    description: { type: String, required: true },
    referenceType: String,
    referenceId: Schema.Types.ObjectId,
    referenceNumber: String,
    lines: { type: [journalLineSchema], validate: (v: IJournalLine[]) => v.length >= 2 },
    totalDebit: moneyField(),
    totalCredit: moneyField(),
    status: { type: String, enum: ['draft', 'posted', 'void'], default: 'posted', index: true },
    source: {
      type: String,
      enum: ['manual', 'invoice', 'payment', 'bill', 'expense', 'income', 'payroll', 'opening'],
      default: 'manual',
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    postedAt: Date,
  },
  schemaOptions,
);

journalEntrySchema.index({ organization: 1, number: 1 }, { unique: true });
journalEntrySchema.index({ organization: 1, date: -1 });
journalEntrySchema.index({ organization: 1, referenceType: 1, referenceId: 1 });
applyTenantSoftDelete(journalEntrySchema);

export const JournalEntry = mongoose.model<IJournalEntry>('JournalEntry', journalEntrySchema);
export type JournalEntryDocument = HydratedDocument<IJournalEntry>;

/* ──────────────────────────────── Transaction ───────────────────────────── */

export interface ITransaction extends SoftDeleteFields {
  organization: Types.ObjectId;
  number: string;
  type: 'income' | 'expense';
  date: Date;
  description: string;
  account: Types.ObjectId;
  paymentAccount: Types.ObjectId;
  amount: number;
  taxAmount: number;
  total: number;
  reference?: string;
  status: 'posted' | 'void';
  journalEntry?: Types.ObjectId | null;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const transactionSchema = new Schema<ITransaction>(
  {
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    number: { type: String, required: true },
    type: { type: String, enum: ['income', 'expense'], required: true, index: true },
    date: { type: Date, default: Date.now },
    description: { type: String, required: true, trim: true },
    account: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    paymentAccount: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    amount: { type: Number, required: true, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    reference: String,
    status: { type: String, enum: ['posted', 'void'], default: 'posted' },
    journalEntry: { type: Schema.Types.ObjectId, ref: 'JournalEntry', default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  schemaOptions,
);

transactionSchema.index({ organization: 1, number: 1 }, { unique: true });
transactionSchema.index({ organization: 1, type: 1, date: -1 });
applyTenantSoftDelete(transactionSchema);

export const Transaction = mongoose.model<ITransaction>('Transaction', transactionSchema);
export type TransactionDocument = HydratedDocument<ITransaction>;
