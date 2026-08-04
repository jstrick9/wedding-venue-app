import { useMemo } from 'react';
import type { Guest, PlacedTable, TableSpec, Venue } from '../types';
import { computeEventDashboard, type EventDashboard } from '../utils/eventDashboard';
import { computeVendorBudget, type VendorBudget } from '../utils/vendorBudget';
import type { Vendor, VendorPayment } from '../types/vendor';
import { getConfig } from '../config';
import { STORAGE_KEYS } from '../constants/storageKeys';

const money = (n: number) =>
  n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });

function readVendors(): Vendor[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.VENDORS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function readPayments(): VendorPayment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.VENDOR_PAYMENTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

interface EventOverviewProps {
  guests: Guest[];
  tables: PlacedTable[];
  tableSpecs: TableSpec[];
  venue: Venue;
  eventName: string;
  venueName: string;
  onOpenGuests: () => void;
  onOpenTemplates: () => void;
  onOpenVendors?: () => void;
  onClose: () => void;
  /** When false, the "Manage Guests" action is hidden (user lacks canManageGuests). */
  canManageGuests?: boolean;
}

function Stat({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  tone?: 'default' | 'good' | 'warn' | 'bad';
}) {
  const colors =
    tone === 'good'
      ? 'text-green-600'
      : tone === 'warn'
        ? 'text-amber-600'
        : tone === 'bad'
          ? 'text-red-600'
          : 'text-gray-800';
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 text-center">
      <div className={`text-2xl font-bold ${colors}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-gray-500 mt-1">{label}</div>
    </div>
  );
}

/**
 * Event Overview — a compact "intelligence" dashboard for the current event:
 * RSVP status, seating coverage, and capacity reconciliation. Gives a venue
 * owner/coordinator a one-screen pulse on the wedding they're planning.
 */
export function EventOverview({
  guests,
  tables,
  tableSpecs,
  venue,
  eventName,
  venueName,
  onOpenGuests,
  onOpenTemplates,
  onOpenVendors,
  onClose,
  canManageGuests = true,
}: EventOverviewProps) {
  const config = getConfig();
  const dash: EventDashboard = useMemo(
    () => computeEventDashboard(guests, [], tables, tableSpecs),
    [guests, tables, tableSpecs],
  );
  const budget: VendorBudget = useMemo(
    () => computeVendorBudget(readVendors(), readPayments()),
    [],
  );

  const healthMeta =
    dash.health === 'ready'
      ? { label: 'On Track', cls: 'bg-green-100 text-green-800' }
      : dash.health === 'attention'
        ? { label: 'Needs Attention', cls: 'bg-amber-100 text-amber-800' }
        : { label: 'Over Capacity', cls: 'bg-red-100 text-red-800' };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 sm:p-4" style={{ zIndex: 10000 }}>
      <div className="bg-gray-50 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="p-4 text-white rounded-t-2xl flex items-start justify-between" style={{ backgroundColor: config.primaryColor }}>
          <div>
            <h2 className="text-lg font-bold">📊 Event Overview</h2>
            <p className="text-sm text-white/75">{eventName || 'Untitled Event'} — {venueName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close overview"
            className="rounded-full p-1.5 hover:bg-white/20"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium ${healthMeta.cls}`}>
              {dash.overCapacity ? '⚠️' : dash.health === 'ready' ? '✅' : '📌'} {healthMeta.label}
            </span>
            <span className="text-xs text-gray-500">Venue capacity: {venue.capacity}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat label="Guests" value={dash.totalGuests} />
            <Stat label="Confirmed" value={dash.confirmed} tone="good" />
            <Stat label="Pending" value={dash.pending} tone="warn" />
            <Stat label="Declined" value={dash.declined} tone={dash.declined > 0 ? 'warn' : 'default'} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Stat label="Seated" value={dash.seated} />
            <Stat label="Unseated" value={dash.unseated} tone={dash.unseated > 0 ? 'warn' : 'default'} />
            <Stat
              label="Table Seats"
              value={dash.totalSeats}
              tone={dash.overCapacity ? 'bad' : 'default'}
            />
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="font-medium text-gray-700">Response rate</span>
              <span className="font-bold">{dash.responseRate}%</span>
            </div>
            <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${dash.responseRate}%`,
                  backgroundColor: dash.responseRate >= 60 ? '#22c55e' : '#f59e0b',
                }}
              />
            </div>
            <div className="mt-1 text-right text-xs text-gray-500">
              Seating utilization: <strong>{dash.seatingUtilization}%</strong> of confirmed guests vs table seats
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-gray-700">Vendor budget</div>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                budget.health === 'ready' ? 'bg-green-100 text-green-800' : budget.health === 'warning' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {budget.vendorCount === 0 ? 'No vendors' : budget.overduePayments > 0 ? `${budget.overduePayments} overdue` : budget.outstanding === 0 ? 'Paid in full' : 'Balance due'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="Contract" value={money(budget.totalContract)} />
              <Stat label="Paid" value={money(budget.totalPaid)} tone="good" />
              <Stat
                label="Balance"
                value={money(budget.outstanding)}
                tone={budget.outstanding > 0 ? 'warn' : 'default'}
              />
            </div>
            {budget.vendorCount > 0 && (
              <div className="mt-2 text-xs text-gray-500">
                <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${100 - budget.balancePct}%`,
                      backgroundColor: budget.outstanding === 0 ? '#22c55e' : '#f59e0b',
                    }}
                  />
                </div>
                <div className="mt-1 text-right">{budget.balancePct}% of budget outstanding</div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-sm font-semibold text-gray-700 mb-2">Notes</div>
            <ul className="space-y-1 text-sm text-gray-600">
              {[...dash.messages, ...budget.messages].map((m, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span>•</span>
                  <span>{m}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap gap-2">
            {canManageGuests && (
              <button
                type="button"
                onClick={onOpenGuests}
                className="px-4 py-2 rounded-lg text-white text-sm font-medium"
                style={{ backgroundColor: config.primaryColor }}
              >
                Manage Guests
              </button>
            )}
            <button
              type="button"
              onClick={onOpenTemplates}
              className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Load a Template
            </button>
            {onOpenVendors && (
              <button
                type="button"
                onClick={onOpenVendors}
                className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Manage Vendors
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
