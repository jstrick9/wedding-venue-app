import { useEffect, useMemo, useRef, useState } from 'react';
import { Venue, VenueMapConfig, VenueMapPoint, VenueMapPointKind } from '../types';
import { VenueMapCanvas } from './VenueMapCanvas';
import {
  addMapPoint, moveMapPoint, updateMapPoint, removeMapPoint,
  addMapRoute, removeMapRoute, pointKindLabel, pointKindIcon, pointColor, updateMapSize,
} from '../utils/venueMapDesigner';
import { downloadLayoutPng, downloadLayoutPdf } from '../utils/layoutExport';
import { showToast } from './Toast';

export interface VenueMapDesignerProps {
  map: VenueMapConfig;
  venues: Venue[];
  onSave: (map: VenueMapConfig) => void;
  onClose?: () => void;
  /** Optional title drawn on the map (e.g. the venue name) and included in exports. */
  mapTitle?: string;
  /** Fired whenever there are unsaved edits (so the shell can guard navigation). */
  onDirtyChange?: (dirty: boolean) => void;
}

const KINDS: VenueMapPointKind[] = ['space', 'parking', 'entry', 'amenity', 'path'];

/**
 * The interactive full-venue map designer. Hybrid: a drag + click-to-place canvas
 * for spatial layout, plus a side panel for precise numeric entry, point metadata,
 * linking space points to venue/lodging, and drawing walkway routes. Supports
 * printing/exporting the resulting "Venue Map" (PNG/PDF).
 */
export function VenueMapDesigner({ map: initialMap, venues, onSave, onClose, mapTitle, onDirtyChange }: VenueMapDesignerProps) {
  const [map, setMap] = useState<VenueMapConfig>(initialMap);
  const [dirty, setDirty] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeKind, setActiveKind] = useState<VenueMapPointKind>('space');
  const [routeName, setRouteName] = useState('');
  const [routePointIds, setRoutePointIds] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [sizeW, setSizeW] = useState(String(initialMap.width || 100));
  const [sizeH, setSizeH] = useState(String(initialMap.height || 80));
  const svgRef = useRef<SVGSVGElement | null>(null);

  const selected: VenueMapPoint | undefined = map.points.find((p) => p.id === selectedId);

  const update = (next: VenueMapConfig) => { setMap(next); setDirty(true); };
  const persist = (next: VenueMapConfig) => { setMap(next); onSave(next); setDirty(false); };
  // Any edit to a selected point flags unsaved changes so the "Save point"
  // affordance (and its warning) is honest about the draft state.
  const editSelected = (next: VenueMapConfig) => { setEditing(true); setMap(next); setDirty(true); };

  // Notify the shell of unsaved edits so it can guard navigation away from the
  // module (prevents silent loss of in-progress map work).
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);

  const linkedVenueName = (venueId?: string) =>
    venues.find((v) => v.id === venueId)?.name || venueId || '—';

  // Suggested size summary (spaces, lodging, parking, entries).
  const summary = useMemo(() => {
    const count = (k: VenueMapPointKind) => map.points.filter((p) => p.kind === k).length;
    return {
      spaces: count('space'),
      lodging: map.points.filter((p) => p.kind === 'space' && venues.find((v) => v.id === p.venueId)?.category === 'lodging').length,
      parking: count('parking'),
      entries: count('entry'),
    };
  }, [map, venues]);

  // Venues (event spaces + lodging) that have no pin linked to them. These won't
  // surface on the couple/guest map, so the venue admin should pin them.
  const missingVenues = venues.filter(
    (v) => !map.points.some((p) => p.kind === 'space' && p.venueId === v.id),
  );

  const handlePlace = (kind: VenueMapPointKind, x: number, y: number) => {
    const label = `${pointKindLabel(kind)} ${map.points.filter((p) => p.kind === kind).length + 1}`;
    const next = addMapPoint(map, { label, kind, x, y, venueId: kind === 'space' ? '' : undefined });
    setSelectedId(next.points[next.points.length - 1].id);
    setEditing(true);
    update(next);
  };

  const handleMove = (id: string, x: number, y: number) => update(moveMapPoint(map, id, x, y));

  const saveSelected = () => {
    if (!selected) return;
    const label = selected.label.trim() || 'Point';
    persist(updateMapPoint(map, selected.id, { label, venueId: selected.venueId || undefined }));
    setEditing(false);
    showToast('Point updated.', 'success');
  };

  const removeSelected = () => {
    if (!selected) return;
    persist(removeMapPoint(map, selected.id));
    setSelectedId(null);
    setEditing(false);
    showToast('Point removed.', 'success');
  };

  /** Place a space pin for a venue that has no pin yet, labeled with its name. */
  const addVenuePin = (venue: Venue) => {
    const offset = map.points.length % 5;
    const row = Math.floor(map.points.length / 5) % 3;
    const next = addMapPoint(map, {
      label: venue.name,
      kind: 'space',
      x: Math.round(map.width * 0.5 + offset * 10 - 20),
      y: Math.round(map.height * 0.5 + row * 10),
      venueId: venue.id,
    });
    setSelectedId(next.points[next.points.length - 1].id);
    setEditing(true);
    update(next);
    showToast(`${venue.name} pin added — drag it into place.`, 'info');
  };

  /** Link the selected point to a venue; auto-suggest the venue name as the label. */
  const linkVenue = (venueId: string) => {
    if (!selected) return;
    const venue = venues.find((v) => v.id === venueId);
    const genericLabel = !selected.label.trim() ||
      new RegExp(`^${pointKindLabel(selected.kind)}( \\d+)?$`).test(selected.label.trim());
    editSelected(updateMapPoint(map, selected.id, {
      venueId: venueId || undefined,
      ...(venue && genericLabel ? { label: venue.name } : {}),
    }));
  };

  const commitRoute = () => {
    if (routePointIds.length < 2) { showToast('A walkway needs at least 2 points.', 'warning'); return; }
    persist(addMapRoute(map, routeName, routePointIds));
    setRouteName(''); setRoutePointIds([]);
    showToast('Walkway added.', 'success');
  };

  const exportMap = async (kind: 'png' | 'pdf') => {
    const svg = svgRef.current;
    if (!svg) { showToast('Map is not ready to export yet.', 'warning'); return; }
    const base = 'venue-map';
    try {
      if (kind === 'png') await downloadLayoutPng(svg, base);
      else await downloadLayoutPdf(svg, base);
      showToast(`Venue Map exported (${kind.toUpperCase()}).`, 'success');
    } catch (err) {
      showToast(`Export failed: ${err instanceof Error ? err.message : 'unknown'}`, 'warning');
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-gray-800">🗺️ Full-Venue Map Designer</span>
        <span className="text-xs text-gray-500">
          {summary.spaces} spaces · {summary.lodging} lodging · {summary.parking} parking · {summary.entries} entries
        </span>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={() => void exportMap('png')} className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">🖼️ PNG</button>
          <button type="button" onClick={() => void exportMap('pdf')} className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">📄 PDF</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Canvas */}
        <div className="lg:col-span-2">
          <VenueMapCanvas
            map={map}
            editable
            selectedPointId={selectedId}
            placeKind={activeKind}
            highlightPointIds={routePointIds}
            onSelectPoint={(id) => { setSelectedId(id); if (id) setEditing(false); }}
            onMovePoint={handleMove}
            onPlacePoint={handlePlace}
            title={mapTitle}
            showLegend
            svgRef={svgRef as React.RefObject<SVGSVGElement>}
          />
          {/* Palette + route drawing */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">Click canvas to place:</span>
            {KINDS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setActiveKind(k)}
                className={`px-2.5 py-1 rounded-full text-xs border ${activeKind === k ? 'bg-[#4A1942] text-white border-[#4A1942]' : 'bg-white text-gray-600 border-gray-300'}`}
              >
                {pointKindIcon(k)} {pointKindLabel(k)}
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <label className="flex flex-col text-xs text-gray-500">
              Route name
              <input type="text" value={routeName} onChange={(e) => setRouteName(e.target.value)} placeholder="Main Walkway" className="mt-1 px-2 py-1 border border-gray-300 rounded text-sm w-40" />
            </label>
            <div className="flex flex-col">
              <span className="text-xs text-gray-500">Points in route ({routePointIds.length})</span>
              <button type="button" onClick={commitRoute} className="mt-1 px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs">＋ Add walkway</button>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-gray-500">Add point to route</span>
              <select
                value=""
                onChange={(e) => { if (e.target.value) setRoutePointIds((p) => [...p, e.target.value]); }}
                className="mt-1 px-2 py-1 border border-gray-300 rounded text-xs"
              >
                <option value="">Select…</option>
                {map.points.map((p) => (
                  <option key={p.id} value={p.id} disabled={routePointIds.includes(p.id)}>{p.label}</option>
                ))}
              </select>
            </div>
            <button type="button" onClick={() => setRoutePointIds([])} className="px-2 py-1 rounded text-xs text-gray-500 hover:underline">Clear route</button>
          </div>
          {routePointIds.length > 0 && (
            <div className="mt-2 rounded-lg border border-gray-200 p-2">
              <span className="text-[11px] text-gray-500 font-medium">Route points (in order):</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {routePointIds.map((id, i) => {
                  const pt = map.points.find((p) => p.id === id);
                  return (
                    <span key={id} className="inline-flex items-center gap-1 rounded-full bg-[#4A1942]/10 text-[#4A1942] px-2 py-0.5 text-[11px]">
                      <span className="text-gray-400">{i + 1}.</span> {pt?.label || '?'}
                      <button
                        type="button"
                        onClick={() => setRoutePointIds((prev) => prev.filter((x) => x !== id))}
                        className="text-[#4A1942]/60 hover:text-[#4A1942]"
                        aria-label={`Remove ${pt?.label || 'point'} from route`}
                      >
                        ✕
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Side panel */}
        <div className="space-y-3">
          {/* Map size */}
          <div className="rounded-xl border border-gray-200 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-800">📐 Map size</span>
              <span className="text-xs text-gray-400">{Math.round(map.width)}×{Math.round(map.height)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs text-gray-500">Width
                <input
                  type="number"
                  value={sizeW}
                  min={20}
                  max={500}
                  onChange={(e) => setSizeW(e.target.value)}
                  className="mt-1 w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  aria-label="Map width"
                />
              </label>
              <label className="block text-xs text-gray-500">Height
                <input
                  type="number"
                  value={sizeH}
                  min={20}
                  max={500}
                  onChange={(e) => setSizeH(e.target.value)}
                  className="mt-1 w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  aria-label="Map height"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={() => {
                const next = updateMapSize(map, Number(sizeW), Number(sizeH));
                setSizeW(String(next.width));
                setSizeH(String(next.height));
                update(next);
                showToast(`Map resized to ${next.width}×${next.height}.`, 'success');
              }}
              className="w-full px-3 py-1.5 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700"
            >
              Apply size
            </button>
            <p className="text-[11px] text-gray-400">Points are clamped if the map shrinks beneath them.</p>
          </div>

          {/* Venue coverage */}
          <div className="rounded-xl border border-gray-200 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-800">🗂️ Map coverage</span>
              <span className="text-xs text-gray-400">
                {venues.length - missingVenues.length}/{venues.length} pinned
              </span>
            </div>
            <p className="text-[11px] text-gray-500">
              Any venue without a pin won't appear on the couple or guest map. Add a
              pin for each space &amp; lodging, then drag it into place.
            </p>
            {missingVenues.length === 0 ? (
              <p className="text-xs text-emerald-600">✓ Every venue has a map pin.</p>
            ) : (
              <ul className="space-y-1">
                {missingVenues.slice(0, 8).map((v) => (
                  <li key={v.id} className="flex items-center justify-between text-xs text-gray-700">
                    <span>
                      {v.category === 'lodging' ? '🛏️' : '🏛️'} {v.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => addVenuePin(v)}
                      className="text-teal-700 hover:underline"
                    >
                      + Add pin
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {missingVenues.length > 8 && (
              <p className="text-[11px] text-gray-400">…and {missingVenues.length - 8} more.</p>
            )}
          </div>

          {!selected ? (
            <div className="rounded-xl border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">
              Click a point on the map (or place a new one) to edit its details.
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-800">
                  {pointKindIcon(selected.kind)} {pointKindLabel(selected.kind)}
                </span>
                <span className="text-xs text-gray-400" style={{ color: pointColor(selected.kind) }}>● {selected.id.slice(0, 6)}</span>
              </div>
              <label className="block text-xs text-gray-500">Label
                <input type="text" value={selected.label} onChange={(e) => editSelected(updateMapPoint(map, selected.id, { label: e.target.value }))} className="mt-1 w-full px-2 py-1 border border-gray-300 rounded text-sm" />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs text-gray-500">Kind
                  <select value={selected.kind} onChange={(e) => editSelected(updateMapPoint(map, selected.id, { kind: e.target.value as VenueMapPointKind }))} className="mt-1 w-full px-2 py-1 border border-gray-300 rounded text-sm bg-white">
                    {KINDS.map((k) => <option key={k} value={k}>{pointKindLabel(k)}</option>)}
                  </select>
                </label>
                <label className="block text-xs text-gray-500">Linked venue
                  <select value={selected.venueId || ''} onChange={(e) => linkVenue(e.target.value)} className="mt-1 w-full px-2 py-1 border border-gray-300 rounded text-sm bg-white">
                    <option value="">(none)</option>
                    {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs text-gray-500">X
                  <input type="number" value={Math.round(selected.x * 10) / 10} onChange={(e) => editSelected(moveMapPoint(map, selected.id, Number(e.target.value), selected.y))} className="mt-1 w-full px-2 py-1 border border-gray-300 rounded text-sm" />
                </label>
                <label className="block text-xs text-gray-500">Y
                  <input type="number" value={Math.round(selected.y * 10) / 10} onChange={(e) => editSelected(moveMapPoint(map, selected.id, selected.x, Number(e.target.value)))} className="mt-1 w-full px-2 py-1 border border-gray-300 rounded text-sm" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs text-gray-500">GPS lat
                  <input type="number" value={selected.lat ?? ''} onChange={(e) => editSelected(updateMapPoint(map, selected.id, { lat: e.target.value === '' ? undefined : Number(e.target.value) }))} className="mt-1 w-full px-2 py-1 border border-gray-300 rounded text-sm" />
                </label>
                <label className="block text-xs text-gray-500">GPS lng
                  <input type="number" value={selected.lng ?? ''} onChange={(e) => editSelected(updateMapPoint(map, selected.id, { lng: e.target.value === '' ? undefined : Number(e.target.value) }))} className="mt-1 w-full px-2 py-1 border border-gray-300 rounded text-sm" />
                </label>
              </div>
              {selected.venueId && (
                <p className="text-xs text-gray-500">→ {linkedVenueName(selected.venueId)}</p>
              )}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={saveSelected} className="flex-1 px-3 py-1.5 rounded-lg bg-[#4A1942] text-white text-sm">Save point</button>
                <button type="button" onClick={() => { setEditing(false); setSelectedId(null); }} className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-600">Cancel</button>
                <button type="button" onClick={removeSelected} className="px-3 py-1.5 rounded-lg border border-red-200 text-sm text-red-600 hover:bg-red-50">Delete</button>
              </div>
              {editing && <p className="text-[11px] text-amber-600">Unsaved changes — press “Save point”.</p>}
            </div>
          )}

          <div className="rounded-xl border border-gray-200 p-3">
            <span className="text-sm font-semibold text-gray-800">Walkway routes</span>
            <div className="mt-2 space-y-1">
              {(map.routes || []).map((r) => (
                <div key={r.id} className="flex items-center justify-between text-xs">
                  <span className="text-gray-700">🚶 {r.name}</span>
                  <button type="button" onClick={() => { persist(removeMapRoute(map, r.id)); }} className="text-red-400 hover:text-red-600" aria-label={`Delete ${r.name}`}>✕</button>
                </div>
              ))}
              {(!map.routes || map.routes.length === 0) && <p className="text-xs text-gray-400">No walkways yet.</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        {onClose && <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600">Close</button>}
        <button type="button" onClick={() => { persist(map); showToast('Venue map saved.', 'success'); }} className="px-4 py-2 rounded-lg bg-[#4A1942] text-white text-sm">💾 Save Venue Map</button>
      </div>
    </div>
  );
}
