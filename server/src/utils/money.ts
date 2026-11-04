export function round2(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function toNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function sum(values: number[]): number {
  return round2(values.reduce((total, value) => total + toNumber(value), 0));
}

export interface LineInput {
  quantity: number;
  unitPrice: number;
  discountRate?: number;
  taxRate?: number;
}

export interface CalculatedLine {
  quantity: number;
  unitPrice: number;
  discountRate: number;
  taxRate: number;
  discount: number;
  tax: number;
  total: number;
}

export interface DocumentTotals {
  lines: CalculatedLine[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
}

/**
 * Calculates line and document totals on the server. Clients never supply
 * authoritative totals — they are always recalculated here.
 */
export function calculateTotals(lines: LineInput[]): DocumentTotals {
  const calculated = lines.map((line) => {
    const quantity = round2(toNumber(line.quantity));
    const unitPrice = round2(toNumber(line.unitPrice));
    const discountRate = Math.min(100, Math.max(0, toNumber(line.discountRate)));
    const taxRate = Math.max(0, toNumber(line.taxRate));
    const gross = round2(quantity * unitPrice);
    const discount = round2(gross * (discountRate / 100));
    const taxable = round2(gross - discount);
    const tax = round2(taxable * (taxRate / 100));
    return {
      quantity,
      unitPrice,
      discountRate,
      taxRate,
      discount,
      tax,
      total: round2(taxable + tax),
    };
  });

  return {
    lines: calculated,
    subtotal: sum(calculated.map((line) => line.quantity * line.unitPrice)),
    discountTotal: sum(calculated.map((line) => line.discount)),
    taxTotal: sum(calculated.map((line) => line.tax)),
    total: sum(calculated.map((line) => line.total)),
  };
}

export function formatMoney(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(round2(value));
}
