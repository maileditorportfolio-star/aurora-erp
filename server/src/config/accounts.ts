import type { AccountType } from '../models/finance';

export interface DefaultAccount {
  code: string;
  name: string;
  type: AccountType;
  subtype: string;
  normalBalance: 'debit' | 'credit';
}

export const DEFAULT_ACCOUNTS: DefaultAccount[] = [
  { code: '1000', name: 'Cash', type: 'asset', subtype: 'current_asset', normalBalance: 'debit' },
  { code: '1010', name: 'Bank', type: 'asset', subtype: 'current_asset', normalBalance: 'debit' },
  {
    code: '1100',
    name: 'Accounts Receivable',
    type: 'asset',
    subtype: 'receivable',
    normalBalance: 'debit',
  },
  { code: '1200', name: 'Inventory', type: 'asset', subtype: 'inventory', normalBalance: 'debit' },
  {
    code: '1300',
    name: 'Tax Receivable',
    type: 'asset',
    subtype: 'tax',
    normalBalance: 'debit',
  },
  {
    code: '2000',
    name: 'Accounts Payable',
    type: 'liability',
    subtype: 'payable',
    normalBalance: 'credit',
  },
  {
    code: '2100',
    name: 'Accrued Liabilities',
    type: 'liability',
    subtype: 'current_liability',
    normalBalance: 'credit',
  },
  {
    code: '2200',
    name: 'Tax Payable',
    type: 'liability',
    subtype: 'tax',
    normalBalance: 'credit',
  },
  {
    code: '3000',
    name: "Owner's Equity",
    type: 'equity',
    subtype: 'equity',
    normalBalance: 'credit',
  },
  {
    code: '3100',
    name: 'Retained Earnings',
    type: 'equity',
    subtype: 'equity',
    normalBalance: 'credit',
  },
  {
    code: '4000',
    name: 'Sales Revenue',
    type: 'income',
    subtype: 'operating_income',
    normalBalance: 'credit',
  },
  {
    code: '4100',
    name: 'Other Income',
    type: 'income',
    subtype: 'other_income',
    normalBalance: 'credit',
  },
  {
    code: '5000',
    name: 'Cost of Goods Sold',
    type: 'expense',
    subtype: 'cost_of_sales',
    normalBalance: 'debit',
  },
  { code: '5100', name: 'Rent Expense', type: 'expense', subtype: 'operating', normalBalance: 'debit' },
  {
    code: '5200',
    name: 'Salaries & Wages',
    type: 'expense',
    subtype: 'payroll',
    normalBalance: 'debit',
  },
  {
    code: '5300',
    name: 'Utilities Expense',
    type: 'expense',
    subtype: 'operating',
    normalBalance: 'debit',
  },
  {
    code: '5400',
    name: 'Marketing Expense',
    type: 'expense',
    subtype: 'operating',
    normalBalance: 'debit',
  },
  {
    code: '5500',
    name: 'Office Supplies',
    type: 'expense',
    subtype: 'operating',
    normalBalance: 'debit',
  },
  {
    code: '5900',
    name: 'Other Expenses',
    type: 'expense',
    subtype: 'other',
    normalBalance: 'debit',
  },
];

export const ACCOUNT_CODES = {
  CASH: '1000',
  BANK: '1010',
  RECEIVABLE: '1100',
  INVENTORY: '1200',
  TAX_RECEIVABLE: '1300',
  PAYABLE: '2000',
  ACCRUED: '2100',
  TAX_PAYABLE: '2200',
  EQUITY: '3000',
  RETAINED: '3100',
  SALES: '4000',
  OTHER_INCOME: '4100',
  COGS: '5000',
  RENT: '5100',
  SALARIES: '5200',
  UTILITIES: '5300',
  MARKETING: '5400',
  SUPPLIES: '5500',
  OTHER_EXPENSE: '5900',
} as const;
