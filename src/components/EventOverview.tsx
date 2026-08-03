import { useMemo } from 'react';
import type { Guest, PlacedTable, TableSpec, Venue } from '../types';
import { computeEventDashboard, type EventDashboard } from '../utils/eventDashboard';
import { getConfig } from '../config';

interface EventOverviewProps {
  guests: Guest[];
  tables: PlacedTable[];
  tableSpecs: TableSpec[];
  venue: Venue;
  eventName: string;
  venueName: string;
  onOpenGuests: () => void;
  onOpenTemplates: () => void;
  onClose: () => void;
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
  onClose,
}: EventOverviewProps) {
  const config = getConfig();
  const dash: EventDashboard = useMemo(
    () => computeEventDashboard(guests, [], tables, tableSpecs),
    [guests, tables, tableSpecs],
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
            <div className="text-sm font-semibold text-gray-700 mb-2">Notes</div>
            <ul className="space-y-1 text-sm text-gray-600">
              {dash.messages.map((m, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span>•</span>
                  <span>{m}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onOpenGuests}
              className="px-4 py-2 rounded-lg text-white text-sm font-medium"
              style={{ backgroundColor: config.primaryColor }}
            >
              Manage Guests
            </button>
            <button
              type="button"
              onClick={onOpenTemplates}
              className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Load a Template
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
