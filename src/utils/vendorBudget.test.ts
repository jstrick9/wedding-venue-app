import { describe, expect, it } from 'vitest';
import { computeVendorBudget } from './vendorBudget';

const vendor = (id: string, contractAmount: number, extra: Record<string, unknown> = {}) =>
  ({ id, name: id, contractAmount, ...extra }) as any;

describe('computeVendorBudget', () => {
  it('computes totals, paid, outstanding, and balance percent', () => {
    const vendors = [vendor('v1', 1000, { depositPaid: true, depositAmount: 200 })];
    const payments = [
      { id: 'p1', vendorId: 'v1', amount: 300, isPaid: true },
      { id: 'p2', vendorId: 'v1', amount: 500, isPaid: false },
    ] as any;

    const b = computeVendorBudget(vendors, payments);
    expect(b.totalContract).toBe(1000);
    expect(b.totalPaid).toBe(500); // 300 payment + 200 deposit
    expect(b.outstanding).toBe(500);
    expect(b.balancePct).toBe(50);
    expect(b.vendorCount).toBe(1);
  });

  it('flags overdue payments', () => {
    const vendors = [vendor('v1', 1000)];
    const payments = [
      { id: 'p1', vendorId: 'v1', amount: 1000, isPaid: false, dueDate: '2020-01-01' },
    ] as any;
    const b = computeVendorBudget(vendors, payments);
    expect(b.overduePayments).toBe(1);
    expect(b.health).toBe('warning');
    expect(b.messages.some((m) => m.includes('past due'))).toBe(true);
  });

  it('handles empty vendor list gracefully', () => {
    const b = computeVendorBudget([], []);
    expect(b.vendorCount).toBe(0);
    expect(b.totalContract).toBe(0);
    expect(b.balancePct).toBe(0);
    expect(b.health).toBe('ready');
    expect(b.messages.some((m) => m.includes('No vendors'))).toBe(true);
  });

  it('is fully paid when outstanding is zero', () => {
    const vendors = [vendor('v1', 1000, { depositPaid: true, depositAmount: 1000 })];
    const b = computeVendorBudget(vendors, []);
    expect(b.outstanding).toBe(0);
    expect(b.health).toBe('ready');
  });
});
