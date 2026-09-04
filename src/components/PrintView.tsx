import { useState } from 'react';
import { Venue, PlacedTable, PlacedFixture, Guest } from '../types';
import { getTableSpecs, getFixtureTypes, getLinenColors } from '../hooks/useLayoutState';
import { getConfig } from '../config';
import SafeImage from './SafeImage';
import { downloadLayoutPng, downloadLayoutPdf } from '../utils/layoutExport';
import { showToast } from './Toast';
import { describeUnknownError } from '../utils/unknownError';

export interface PrintViewProps {
  venue: Venue;
  tables: PlacedTable[];
  fixtures: PlacedFixture[];
  guests: Guest[];
  layoutName: string;
  onClose: () => void;
  /** The live floor-plan <svg> (used for high-fidelity PNG/PDF export). */
  exportSvgRef?: React.RefObject<SVGSVGElement | null>;
}

export function PrintView({
  venue,
  tables,
  fixtures,
  guests,
  layoutName,
  onClose,
  exportSvgRef,
}: PrintViewProps) {
  const tableSpecs = getTableSpecs();
  const fixtureTypes = getFixtureTypes();
  const config = getConfig();
  const [exporting, setExporting] = useState<'png' | 'pdf' | null>(null);
  const [showDietaryNotes, setShowDietaryNotes] = useState(true);
  const [showLinenColorKey, setShowLinenColorKey] = useState(true);
  const [showRoomSetupChecklist, setShowRoomSetupChecklist] = useState(true);

  const handlePrint = () => {
    window.print();
  };

  const runExport = async (kind: 'png' | 'pdf') => {
    const svg = exportSvgRef?.current;
    if (!svg) {
      showToast('Floor plan is not ready to export yet.', 'warning');
      return;
    }
    setExporting(kind);
    try {
      const base = (layoutName || 'layout').trim().replace(/[^a-z0-9-_]+/gi, '-') || 'layout';
      if (kind === 'png') {
        await downloadLayoutPng(svg, base);
      } else {
        await downloadLayoutPdf(svg, base);
      }
      showToast(`Exported ${kind.toUpperCase()} successfully.`, 'success');
    } catch (err) {
      showToast(describeUnknownError(err, 'Could not export the floor plan. Try again.'), 'warning');
    } finally {
      setExporting(null);
    }
  };

  // Single source of truth for a table's capacity, consistent with the guest
  // panel / canvas counter: seating rows use chairCount×rowCount; otherwise
  // customCapacity overrides the spec capacity.
  const tableCapacity = (table: PlacedTable) => {
    const spec = tableSpecs.find((s) => s.id === table.specId);
    if (!spec) return 0;
    if (spec.isSeatingType) {
      const perRow = table.chairCount ?? table.customCapacity ?? spec.capacity ?? 0;
      const rowCount = Math.max(1, spec.seatingRowCount || 1);
      return perRow * rowCount;
    }
    return table.customCapacity ?? spec.capacity ?? 0;
  };

  const getTotalCapacity = () => {
    return tables.reduce((sum, table) => sum + tableCapacity(table), 0);
  };

  // Compact dietary/meal/accessibility notes for a printable guest row.
  const guestNotes = (g: Guest): string => {
    if (!showDietaryNotes) return '';
    const parts: string[] = [];
    if (g.mealChoice && g.mealChoice !== 'standard') parts.push(`Meal: ${g.mealChoice}`);
    if (g.dietaryRestrictions) parts.push(g.dietaryRestrictions);
    if (g.accessibility) parts.push('Accessibility');
    return parts.length ? ` — ${parts.join('; ')}` : '';
  };

  const getSeatedGuests = () => {
    return guests.filter((g) => tables.some((t) => t.guests.includes(g.id))).length;
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-white overflow-auto spm-print-view">
      <div className="print:hidden no-print sticky top-0 z-10 bg-white border-b px-6 py-4 flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="text-lg font-semibold text-gray-900">Print Preview</div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => void runExport('png')}
              disabled={exporting !== null}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {exporting === 'png' ? 'Exporting…' : '🖼️ PNG'}
            </button>
            <button
              type="button"
              onClick={() => void runExport('pdf')}
              disabled={exporting !== null}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {exporting === 'pdf' ? 'Exporting…' : '📄 PDF'}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 rounded-lg bg-[#4A1942] text-white hover:bg-[#5b2352]"
            >
              🖨️ Print
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 flex-wrap">
          <span className="font-semibold text-gray-600">Print sheet options:</span>
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showDietaryNotes}
              onChange={(e) => setShowDietaryNotes(e.target.checked)}
              className="rounded accent-[#4A1942]"
            />
            <span>Dietary &amp; Meal notes</span>
          </label>
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showLinenColorKey}
              onChange={(e) => setShowLinenColorKey(e.target.checked)}
              className="rounded accent-[#4A1942]"
            />
            <span>Linen color key</span>
          </label>
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showRoomSetupChecklist}
              onChange={(e) => setShowRoomSetupChecklist(e.target.checked)}
              className="rounded accent-[#4A1942]"
            />
            <span>Room setup checklist</span>
          </label>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center gap-4 border-b pb-6 mb-6">
          {config.logoUrl && (
            <SafeImage
              src={config.logoUrl}
              alt={config.venueName}
              className="h-16 w-auto object-contain"
              fallback={null}
            />
          )}

          <div>
            <h1 className="text-3xl font-bold text-gray-900">{config.venueName}</h1>
            <h2 className="text-xl text-gray-700 mt-1">{layoutName || 'Event Layout'}</h2>
            <p className="text-sm text-gray-500 mt-2">
              {venue.name} • {venue.width}' × {venue.height}'
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="rounded-lg border bg-gray-50 p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{tables.length}</div>
            <div className="text-sm text-gray-600">Tables</div>
          </div>
          <div className="rounded-lg border bg-gray-50 p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{getTotalCapacity()}</div>
            <div className="text-sm text-gray-600">Total Capacity</div>
          </div>
          <div className="rounded-lg border bg-gray-50 p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{guests.length}</div>
            <div className="text-sm text-gray-600">Total Guests</div>
          </div>
          <div className="rounded-lg border bg-gray-50 p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{getSeatedGuests()}</div>
            <div className="text-sm text-gray-600">Seated</div>
          </div>
        </div>

        {showLinenColorKey && (
          <div className="mb-8 rounded-lg border bg-gray-50 p-4">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Linen Color Key</h3>
            {(() => {
              const linenColors = getLinenColors();
              const usedColorIds = Array.from(new Set(tables.map((t) => t.linenColor || 'white')));
              return (
                <div className="flex flex-wrap gap-4 text-xs">
                  {usedColorIds.map((cid) => {
                    const colorObj = linenColors.find((c) => c.id === cid) || { name: cid, hex: '#ffffff' };
                    const count = tables.filter((t) => (t.linenColor || 'white') === cid).length;
                    return (
                      <div key={cid} className="flex items-center gap-1.5">
                        <span
                          className="w-4 h-4 rounded border border-gray-300 inline-block shrink-0"
                          style={{ backgroundColor: colorObj.hex }}
                        />
                        <span className="font-medium text-gray-800 capitalize">{colorObj.name}</span>
                        <span className="text-gray-500">({count} table{count === 1 ? '' : 's'})</span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        <div className="mb-10">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Floor Plan</h3>

          <div className="border rounded-xl overflow-hidden bg-white">
            <svg
              viewBox={`0 0 ${venue.width + 20} ${venue.height + 20}`}
              className="w-full h-auto"
            >
              <rect
                x={10}
                y={10}
                width={venue.width}
                height={venue.height}
                fill={venue.color || '#FFFFFF'}
                stroke={venue.borderColor || '#4A1942'}
                strokeWidth={0.5}
              />

              {tables.map((table) => {
                const spec = tableSpecs.find((s) => s.id === table.specId);
                const x = 10 + Number(table.x || 0);
                const y = 10 + Number(table.y || 0);

                if (!spec) {
                  return (
                    <g key={table.id}>
                      <rect
                        x={x}
                        y={y}
                        width={6}
                        height={6}
                        fill="#fef2f2"
                        stroke="#dc2626"
                        strokeWidth={0.5}
                      />
                      <text
                        x={x + 3}
                        y={y + 4}
                        textAnchor="middle"
                        fontSize={1.5}
                        fill="#991b1b"
                      >
                        Missing table spec
                      </text>
                    </g>
                  );
                }

                return (
                  <g key={table.id}>
                    {spec.shape === 'circle' ? (
                      <circle
                        cx={x + spec.width / 2}
                        cy={y + spec.height / 2}
                        r={Math.max(1, spec.width / 2)}
                        fill="#f8fafc"
                        stroke="#4A1942"
                        strokeWidth={0.3}
                      />
                    ) : (
                      <rect
                        x={x}
                        y={y}
                        width={Math.max(1, spec.width)}
                        height={Math.max(1, spec.height)}
                        fill="#f8fafc"
                        stroke="#4A1942"
                        strokeWidth={0.3}
                        rx={0.5}
                      />
                    )}
                    <text
                      x={x + spec.width / 2}
                      y={y + spec.height / 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={1.8}
                      fill="#1f2937"
                    >
                      {table.label}
                    </text>
                  </g>
                );
              })}

              {fixtures.map((fixture) => {
                const spec = fixtureTypes.find((s) => s.id === fixture.specId);
                if (fixture.isExterior) return null;

                const x = 10 + Number(fixture.x || 0);
                const y = 10 + Number(fixture.y || 0);

                if (!spec) {
                  return (
                    <g key={fixture.id}>
                      <rect
                        x={x}
                        y={y}
                        width={6}
                        height={6}
                        fill="#fef2f2"
                        stroke="#dc2626"
                        strokeWidth={0.5}
                      />
                      <text
                        x={x + 3}
                        y={y + 4}
                        textAnchor="middle"
                        fontSize={1.5}
                        fill="#991b1b"
                      >
                        Missing fixture
                      </text>
                    </g>
                  );
                }

                return (
                  <g key={fixture.id}>
                    <rect
                      x={x}
                      y={y}
                      width={Math.max(1, spec.width)}
                      height={Math.max(1, spec.height)}
                      fill="#eef2ff"
                      stroke="#4A1942"
                      strokeWidth={0.3}
                      rx={0.5}
                    />
                    <text
                      x={x + spec.width / 2}
                      y={y + spec.height / 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={2}
                    >
                      {spec.icon || '■'}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        <div className="mb-10">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Seating Chart</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tables.map((table) => {
              const spec = tableSpecs.find((s) => s.id === table.specId);
              const tableGuests = guests.filter((g) => table.guests.includes(g.id));

              return (
                <div key={table.id} className="rounded-lg border p-4 bg-white">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="font-semibold text-gray-900">{table.label}</h4>
                      <p className="text-sm text-gray-500">
                        {spec?.name || 'Unknown Table'} • {tableGuests.length}/
                        {tableCapacity(table)} seats
                      </p>
                    </div>
                  </div>

                  {tableGuests.length > 0 ? (
                    <ul className="mt-3 space-y-1 text-sm text-gray-700">
                      {tableGuests.map((guest) => (
                        <li key={guest.id}>• {guest.name}{guestNotes(guest)}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-gray-400">No guests assigned</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {guests.filter((g) => !g.tableId).length > 0 && (
          <div className="mb-10">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Unassigned Guests</h3>
            <div className="rounded-lg border p-4 bg-white">
              <ul className="space-y-1 text-sm text-gray-700">
                {guests
                  .filter((g) => !g.tableId)
                  .map((guest) => (
                    <li key={guest.id}>• {guest.name}{guestNotes(guest)}</li>
                  ))}
              </ul>
            </div>
          </div>
        )}

        {showRoomSetupChecklist && (
          <div className="mb-10 page-break">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Room Setup Checklist</h3>
            <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-700">
                <label className="flex items-center gap-2">
                  <span className="w-4 h-4 border border-gray-400 rounded inline-block shrink-0" />
                  <span>Verify table placement &amp; spacing against floor plan</span>
                </label>
                <label className="flex items-center gap-2">
                  <span className="w-4 h-4 border border-gray-400 rounded inline-block shrink-0" />
                  <span>Confirm {tables.length} table linen(s) placed per color key</span>
                </label>
                <label className="flex items-center gap-2">
                  <span className="w-4 h-4 border border-gray-400 rounded inline-block shrink-0" />
                  <span>Set chairs ({getTotalCapacity()} total seats configured)</span>
                </label>
                <label className="flex items-center gap-2">
                  <span className="w-4 h-4 border border-gray-400 rounded inline-block shrink-0" />
                  <span>Check aisle width &amp; emergency exit clearances</span>
                </label>
                <label className="flex items-center gap-2">
                  <span className="w-4 h-4 border border-gray-400 rounded inline-block shrink-0" />
                  <span>Confirm dance floor / DJ / bar fixture placement</span>
                </label>
                <label className="flex items-center gap-2">
                  <span className="w-4 h-4 border border-gray-400 rounded inline-block shrink-0" />
                  <span>Verify power &amp; lighting access for vendors</span>
                </label>
              </div>
              <div className="border-t border-gray-200 pt-4 mt-4 flex items-center justify-between text-xs text-gray-500 flex-wrap gap-2">
                <span>Setup Lead Signature: ___________________________</span>
                <span>Date/Time Verified: _______________</span>
              </div>
            </div>
          </div>
        )}

        <div className="border-t pt-6 text-center text-sm text-gray-500">
          <p>Generated by {config.venueName} Layout Planner</p>
          <p>{new Date().toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );
}