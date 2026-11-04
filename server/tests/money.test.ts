import { describe, expect, it } from 'vitest';
import { calculateTotals, round2, sum } from '../src/utils/money';

describe('money', () => {
  it('rounds to two decimals', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.345)).toBe(2.35);
  });

  it('sums values with rounding', () => {
    expect(sum([0.1, 0.2, 0.3])).toBe(0.6);
  });

  it('calculates line and document totals', () => {
    const result = calculateTotals([
      { quantity: 2, unitPrice: 10, discountRate: 10, taxRate: 8.5 },
      { quantity: 1, unitPrice: 5, discountRate: 0, taxRate: 8.5 },
    ]);

    expect(result.lines).toHaveLength(2);
    expect(result.subtotal).toBe(25);
    expect(result.discountTotal).toBe(2);
    expect(result.taxTotal).toBe(1.96);
    expect(result.total).toBe(24.96);
    expect(result.lines[0]?.total).toBe(19.53);
  });

  it('clamps discount rate to 0-100', () => {
    const result = calculateTotals([{ quantity: 1, unitPrice: 100, discountRate: 150, taxRate: 0 }]);
    expect(result.discountTotal).toBe(100);
    expect(result.total).toBe(0);
  });
});