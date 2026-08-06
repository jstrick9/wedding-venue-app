// @ts-nocheck
import { useMemo, useState } from 'react';
import { FloorPlanCanvas } from './FloorPlanCanvas';
import { getTableSpecs } from '../hooks/useLayoutState';
import { Venue, CoupleSpaceLayout } from '../types';

interface Props {
  venue: Venue;
  layout: CoupleSpaceLayout;
  /** Expected guest count for this event, to surface a capacity shortfall. */
  guestCount?: number;
}

/**
 * Read-only preview of a couple's drawn layout for one space. Used by the venue
 * in the layout approval queue so it can see the actual drawing before deciding.
 */
export function CoupleLayoutPreview({ venue, layout, guestCount }: Props) {
  const [zoom, setZoom] = useState(0.7);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  const tableSpecs = useMemo(() => getTableSpecs(), []);
  const seatingCapacity = layout.tables.reduce((sum, t) => {
    const spec = tableSpecs.find((s) => s.id === t.specId);
    if (!spec) return sum;
    return sum + (t.customCapacity ?? spec.capacity ?? 0);
  }, 0);
  const capacityShort = guestCount != null && seatingCapacity < guestCount;

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden mt-2">
      <div className="px-2 py-1 bg-gray-50 text-[11px] font-semibold text-gray-600 flex items-center justify-between gap-2 flex-wrap">
        <span>Drawn layout — {venue.name}</span>
        <span className="flex items-center gap-2">
          {guestCount != null && (
            <span
              className={`rounded-full px-2 py-0.5 ${
                capacityShort ? 'bg-amber-100 text-amber-800' : 'bg-gray-200 text-gray-700'
              }`}
              title={capacityShort ? `This space seats ${seatingCapacity} but the couple expects ${guestCount} guests.` : undefined}
            >
              {capacityShort ? '⚠️' : '🪑'} Seats {seatingCapacity} / {guestCount} guests
            </span>
          )}
          <span className="text-gray-400">
            {layout.tables.length} table(s) · {layout.fixtures.length} fixture(s) · {layout.decor.length} decor
          </span>
        </span>
      </div>
      <div className="bg-gray-50">
        <FloorPlanCanvas
          venue={venue}
          tables={layout.tables}
          fixtures={layout.fixtures}
          decor={layout.decor}
          guests={[]}
          selectedId={null}
          zoom={zoom}
          showGrid={false}
          gridSize={2}
          onSelect={() => {}}
          onDoubleClick={() => {}}
          onMove={() => {}}
          onDrop={() => {}}
          onClickToPlace={() => {}}
          isDragging={false}
          isAdmin
          onViewImage={() => {}}
          panOffset={panOffset}
          onPanChange={setPanOffset}
          onZoomChange={setZoom}
        />
      </div>
    </div>
  );
}
