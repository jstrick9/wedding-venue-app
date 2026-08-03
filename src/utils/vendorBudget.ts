import type { Vendor, VendorPayment } from '../types/vendor';

/**
 * Pure "event intelligence" metric for the vendor budget: contract totals,
 * amounts paid, and outstanding balances, plus an at-a-glance health grade.
 * Free of React so it can be unit-tested and reused by any consumer.
 */

export interface VendorBudget {
  vendorCount: number;
  totalContract: number;
  totalPaid: number;
  outstanding: number;
  /** outstanding / totalContract, 0 when total is 0 */
  balancePct: number;
  /** Number of vendors with an outstanding (unpaid) balance. */
  vendorsWithBalance: number;
  /** Count of scheduled-but-unpaid payments with a due date in the past. */
  overduePayments: number;
  health: 'ready' | 'attention' | 'warning';
  messages: string[];
}

const money = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export function computeVendorBudget(
  vendors: Vendor[],
  payments: VendorPayment[],
): VendorBudget {
  const totalContract = vendors.reduce((sum, v) => sum + money(v.contractAmount), 0);
  const totalPaid = payments
    .filter((p) => p.isPaid)
    .reduce((sum, p) => sum + money(p.amount), 0);
  // Deposits recorded on the vendor record also count as paid.
  const depositPaidTotal = vendors
    .filter((v) => v.depositPaid)
    .reduce((sum, v) => sum + money(v.depositAmount), 0);

  const paid = totalPaid + depositPaidTotal;
  const outstanding = Math.max(0, totalContract - paid);
  const balancePct = totalContract === 0 ? 0 : Math.round((outstanding / totalContract) * 100);

  const vendorsWithBalance = vendors.filter((v) => {
    const contract = money(v.contractAmount);
    if (contract === 0) return false;
    const vendorPayments = payments.filter((p) => p.vendorId === v.id && p.isPaid);
    const paidAmt = vendorPayments.reduce((s, p) => s + money(p.amount), 0) +
      (v.depositPaid ? money(v.depositAmount) : 0);
    return paidAmt < contract;
  }).length;

  const now = Date.now();
  const overduePayments = payments.filter(
    (p) => !p.isPaid && p.dueDate && new Date(p.dueDate).getTime() < now,
  ).length;

  const messages: string[] = [];
  if (vendors.length === 0) {
    messages.push('No vendors added yet — add vendors to track your budget.');
  } else if (outstanding === 0) {
    messages.push('All vendor contracts are paid in full. 🎉');
  } else if (overduePayments > 0) {
    messages.push(`${overduePayments} payment${overduePayments === 1 ? ' is' : 's are'} past due.`);
  } else {
    messages.push(`${vendors.length} vendor${vendors.length === 1 ? '' : 's'} · ${money(outstanding) === 0 ? 'fully paid' : `${vendorsWithBalance} with a balance due`}.`);
  }

  const health: VendorBudget['health'] = overduePayments > 0
    ? 'warning'
    : totalContract > 0 && outstanding > 0
      ? 'attention'
      : 'ready';

  return {
    vendorCount: vendors.length,
    totalContract,
    totalPaid: paid,
    outstanding,
    balancePct,
    vendorsWithBalance,
    overduePayments,
    health,
    messages,
  };
}
