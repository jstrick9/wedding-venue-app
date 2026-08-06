// @ts-nocheck
import { useState } from 'react';
import { FloorPlanCanvas } from './FloorPlanCanvas';
import { Venue, CoupleSpaceLayout } from '../types';

interface Props {
  venue: Venue;
  layout: CoupleSpaceLayout;
}

/**
 * Read-only preview of a couple's drawn layout for one space. Used by the venue
 * in the layout approval queue so it can see the actual drawing before deciding.
 */
export function CoupleLayoutPreview({ venue, layout }: Props) {
  const [zoom, setZoom] = useState(0.7);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden mt-2">
      <div className="px-2 py-1 bg-gray-50 text-[11px] font-semibold text-gray-600 flex items-center justify-between">
        <span>Drawn layout — {venue.name}</span>
        <span className="text-gray-400">
          {layout.tables.length} table(s) · {layout.fixtures.length} fixture(s) · {layout.decor.length} decor
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
