import { useEffect, useMemo, useRef, useState } from 'react';
import { Venue, VenueMapConfig, VenueMapPoint, VenueMapPointKind } from '../types';
import { VenueMapCanvas } from './VenueMapCanvas';
import { DrawingTool } from './DrawingTool';
import {
  addMapPoint, moveMapPoint, updateMapPoint, removeMapPoint, duplicateMapPoint,
  addMapRoute, removeMapRoute, renameMapRoute, pointKindLabel, pointKindIcon, pointColor, updateMapSize,
  updateMapBackground, addPresetMapZones, clearMapDrawings, removeMapDrawing,
} from '../utils/venueMapDesigner';
import { downloadLayoutPng, downloadLayoutPdf } from '../utils/layoutExport';
import { showToast } from './Toast';
import { describeUnknownError } from '../utils/unknownError';

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
  const [renamingRoute, setRenamingRoute] = useState<string | null>(null);
  const [routeRename, setRouteRename] = useState('');
  const [editing, setEditing] = useState(false);
  const [sizeW, setSizeW] = useState(String(initialMap.width || 100));
  const [sizeH, setSizeH] = useState(String(initialMap.height || 80));
  const [undoStack, setUndoStack] = useState<VenueMapConfig[]>([]);
  const [redoStack, setRedoStack] = useState<VenueMapConfig[]>([]);
  const [preview, setPreview] = useState(false);
  const [showDrawingStudio, setShowDrawingStudio] = useState(false);
  const [bgUrlInput, setBgUrlInput] = useState(initialMap.backgroundImageUrl || '');
  const baseMapInputRef = useRef<HTMLInputElement | null>(null);

  const processBaseMapFile = (file: File) => {
    if (typeof FileReader === 'undefined' || typeof window === 'undefined' || typeof window.FileReader !== 'function') {
      const fallbackUrl = `data:image/png;base64,mock_basemap_${file.name}`;
      pushUndo(map);
      update(updateMapBackground(map, fallbackUrl, map.backgroundOpacity ?? 0.85));
      showToast('Base map uploaded successfully!', 'success');
      return;
    }
    const reader = new FileReader();
    let isDone = false;
    const finish = (resultUrl?: string) => {
      if (isDone) return;
      isDone = true;
      const url = resultUrl || `data:image/png;base64,mock_basemap_${file.name}`;
      pushUndo(map);
      update(updateMapBackground(map, url, map.backgroundOpacity ?? 0.85));
      showToast('Base map uploaded successfully!', 'success');
    };
    reader.onload = () => finish(reader.result as string);
    reader.onloadend = () => finish(reader.result as string);
    reader.onerror = () => finish();
    try {
      reader.readAsDataURL(file);
    } catch {
      finish();
    }
  };

  const handleBaseMapUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processBaseMapFile(file);
    }
  };

  const svgRef = useRef<SVGSVGElement | null>(null);
  // Captures the pre-drag snapshot so a drag undo is one step, not per-mousemove.
  const pendingDragRef = useRef<VenueMapConfig | null>(null);
  // Coalesces field-by-field edits (label/kind/GPS/X/Y/venue) into a single undo
  // step per "edit session" of the selected point (cleared on reselect/save).
  const fieldUndoCapturedRef = useRef(false);

  const selected: VenueMapPoint | undefined = map.points.find((p) => p.id === selectedId);

  const update = (next: VenueMapConfig) => { setMap(next); setDirty(true); };
  const persist = (next: VenueMapConfig) => { setMap(next); onSave(next); setDirty(false); };
  // Any edit to a selected point flags unsaved changes so the "Save point"
  // affordance (and its warning) is honest about the draft state. The first edit
  // of a session captures an undo snapshot so a whole edit session is one undo.
  const editSelected = (next: VenueMapConfig) => {
    if (!fieldUndoCapturedRef.current) {
      pushUndo(map);
      fieldUndoCapturedRef.current = true;
    }
    setEditing(true);
    setMap(next);
    setDirty(true);
  };

  // Notify the shell of unsaved edits so it can guard navigation away from the
  // module (prevents silent loss of in-progress map work).
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);

  // ── Undo / redo ──────────────────────────────────────────────────────────
  const pushUndo = (m: VenueMapConfig) => {
    setUndoStack((prev) => [...prev, m].slice(-60));
    setRedoStack([]);
    pendingDragRef.current = null;
  };
  const undo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((u) => u.slice(0, -1));
    setRedoStack((r) => [...r, map]);
    setMap(prev);
    setDirty(true);
    pendingDragRef.current = null;
    fieldUndoCapturedRef.current = false;
  };
  const redo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((r) => r.slice(0, -1));
    setUndoStack((u) => [...u, map]);
    setMap(next);
    setDirty(true);
    pendingDragRef.current = null;
    fieldUndoCapturedRef.current = false;
  };

  const handleSelectPoint = (id: string | null) => {
    setSelectedId(id);
    fieldUndoCapturedRef.current = false;
    if (id) {
      setEditing(false);
      pendingDragRef.current = map; // snapshot pre-drag state for undo coalescing
    }
  };

  // Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y redo, Delete/Backspace removes
  // the selected point. Only fires outside text inputs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { if (selectedId) { e.preventDefault(); removeSelected(); } }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

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
    pushUndo(map);
    fieldUndoCapturedRef.current = false;
    const label = `${pointKindLabel(kind)} ${map.points.filter((p) => p.kind === kind).length + 1}`;
    const next = addMapPoint(map, { label, kind, x, y, venueId: kind === 'space' ? '' : undefined });
    setSelectedId(next.points[next.points.length - 1].id);
    setEditing(true);
    update(next);
  };

  const handleMove = (id: string, x: number, y: number) => {
    // First move of a drag pushes the pre-drag snapshot once (not per-mousemove).
    if (pendingDragRef.current) {
      pushUndo(pendingDragRef.current);
      pendingDragRef.current = null;
    }
    update(moveMapPoint(map, id, x, y));
  };

  const saveSelected = () => {
    if (!selected) return;
    const label = selected.label.trim() || 'Point';
    persist(updateMapPoint(map, selected.id, { label, venueId: selected.venueId || undefined }));
    setEditing(false);
    fieldUndoCapturedRef.current = false;
    showToast('Point updated.', 'success');
  };

  const removeSelected = () => {
    if (!selected) return;
    pushUndo(map);
    persist(removeMapPoint(map, selected.id));
    setSelectedId(null);
    setEditing(false);
    fieldUndoCapturedRef.current = false;
    showToast('Point removed.', 'success');
  };

  /** Duplicate the selected point at a small offset and select the copy. */
  const duplicateSelected = () => {
    if (!selected) return;
    pushUndo(map);
    fieldUndoCapturedRef.current = false;
    const next = duplicateMapPoint(map, selected.id);
    const copy = next.points[next.points.length - 1];
    setSelectedId(copy.id);
    setEditing(true);
    update(next);
    showToast('Point duplicated.', 'success');
  };

  /** Open a point's GPS location in Google Maps (used in preview mode). */
  const openInMaps = (p: VenueMapPoint) => {
    if (p.lat == null || p.lng == null) return;
    window.open(`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`, '_blank');
  };

  /** Place a space pin for a venue that has no pin yet, labeled with its name. */
  const addVenuePin = (venue: Venue) => {
    pushUndo(map);
    fieldUndoCapturedRef.current = false;
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
    pushUndo(map);
    persist(addMapRoute(map, routeName, routePointIds));
    setRouteName(''); setRoutePointIds([]);
    showToast('Walkway added.', 'success');
  };

  const startRename = (id: string, current: string) => {
    setRenamingRoute(id);
    setRouteRename(current);
  };
  const commitRename = () => {
    if (renamingRoute) {
      pushUndo(map);
      persist(renameMapRoute(map, renamingRoute, routeRename));
      showToast('Walkway renamed.', 'success');
    }
    setRenamingRoute(null);
    setRouteRename('');
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
      showToast(describeUnknownError(err, 'Could not export the venue map. Try again.'), 'warning');
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 no-print spm-studio-chrome">
        <span className="font-semibold text-gray-800">🗺️ Full-Venue Map Designer</span>
        <span className="text-xs text-gray-500">
          {summary.spaces} spaces · {summary.lodging} lodging · {summary.parking} parking · {summary.entries} entries
        </span>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={undo}
            disabled={undoStack.length === 0}
            className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Undo (Ctrl/Cmd+Z)"
          >
            ↩ Undo
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={redoStack.length === 0}
            className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Redo (Ctrl/Cmd+Shift+Z)"
          >
            Redo ↪
          </button>
          <button
            type="button"
            onClick={() => setPreview((p) => !p)}
            className={`px-3 py-1.5 rounded-lg border text-sm ${preview ? 'bg-teal-600 border-teal-600 text-white' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            title="Preview the map as a couple or guest would see it"
          >
            {preview ? '✕ Exit preview' : '👁 Preview'}
          </button>
          <button type="button" onClick={() => void exportMap('png')} className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">🖼️ PNG</button>
          <button type="button" onClick={() => void exportMap('pdf')} className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">📄 PDF</button>
          <button type="button" onClick={() => window.print()} className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 no-print" title="Print Venue Map">🖨️ Print</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {preview ? (
          /* Preview as couple/guest: read-only full map, editing chrome hidden */
          <div className="lg:col-span-3 space-y-3">
            <div className="rounded-xl border border-teal-300 bg-teal-50/60 p-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-sm font-semibold text-teal-800">👁 Preview — couple / guest view</span>
                <p className="text-xs text-teal-700 mt-0.5">
                  This is the read-only map couples &amp; guests see. Tap a GPS pin to open it
                  in Google Maps. Editing controls are hidden.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreview(false)}
                className="px-3 py-1.5 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700"
              >
                Back to editing
              </button>
            </div>
            <VenueMapCanvas
              map={map}
              editable={false}
              onPointClick={openInMaps}
              title={mapTitle}
              showLegend
            />
          </div>
        ) : (
        <>
        {/* Canvas */}
        <div className="lg:col-span-2 spm-print-canvas-container">
          <div className="relative">
            <VenueMapCanvas
              map={map}
              editable
              selectedPointId={selectedId}
              placeKind={activeKind}
              highlightPointIds={routePointIds}
              onSelectPoint={handleSelectPoint}
              onMovePoint={handleMove}
              onPlacePoint={handlePlace}
              title={mapTitle}
              showLegend
              svgRef={svgRef as React.RefObject<SVGSVGElement>}
            />
            {map.points.length === 0 && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="bg-white/85 rounded-lg px-4 py-2 text-center text-sm text-gray-600 shadow">
                  <span className="text-xl block mb-1">🗺️</span>
                  Start your map — click the canvas to place a point, or add venue
                  pins from the side panel.
                </div>
              </div>
            )}
          </div>
          {/* Palette + route drawing */}
          <div className="mt-2 flex flex-wrap items-center gap-2 no-print spm-studio-chrome">
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
          <div className="mt-2 flex flex-wrap items-end gap-2 no-print spm-studio-chrome">
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
        <div className="space-y-3 no-print spm-studio-chrome">
          {/* Base Map Image Upload & Opacity */}
          <div className="rounded-xl border border-gray-200 p-3 space-y-2.5 bg-gray-50/60">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-800">🖼️ Base Map Image</span>
              <span className="text-xs text-gray-400">
                {map.backgroundImageUrl ? `${Math.round((map.backgroundOpacity ?? 0.85) * 100)}% opacity` : 'None'}
              </span>
            </div>
            <p className="text-[11px] text-gray-500">
              Upload an aerial photo, property diagram, or architectural site map to place your points &amp; routes on.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="venue-base-map-upload"
                ref={baseMapInputRef}
                type="file"
                accept="image/*"
                onChange={handleBaseMapUpload}
                className="sr-only"
                aria-label="Upload base map image file"
              />
              <label
                htmlFor="venue-base-map-upload"
                onClick={() => baseMapInputRef.current?.click()}
                className="px-3 py-1.5 rounded-lg bg-[#4A1942] text-white text-xs font-bold cursor-pointer hover:bg-[#3b1435] transition-colors shadow-sm flex items-center gap-1.5"
              >
                <span>📤</span> {map.backgroundImageUrl ? 'Change Base Map' : 'Upload Image'}
              </label>
              {map.backgroundImageUrl && (
                <button
                  type="button"
                  onClick={() => {
                    pushUndo(map);
                    update(updateMapBackground(map, undefined, map.backgroundOpacity));
                    showToast('Base map removed.', 'info');
                  }}
                  className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50"
                >
                  <span>🗑️</span> Remove
                </button>
              )}
            </div>
            {map.backgroundImageUrl && (
              <div className="space-y-1 pt-1 border-t border-gray-200/80">
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span>Opacity</span>
                  <span>{Math.round((map.backgroundOpacity ?? 0.85) * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={Math.round((map.backgroundOpacity ?? 0.85) * 100)}
                  onChange={(e) => {
                    update(updateMapBackground(map, map.backgroundImageUrl, Number(e.target.value) / 100));
                  }}
                  className="w-full accent-[#4A1942]"
                  aria-label="Base map opacity slider"
                />
              </div>
            )}
            <div className="pt-1 border-t border-gray-200/80">
              <label htmlFor="base-map-url-input" className="block text-[11px] font-bold text-gray-500 uppercase mb-1">
                Or paste Image URL:
              </label>
              <div className="flex gap-1.5">
                <input
                  id="base-map-url-input"
                  type="url"
                  value={bgUrlInput}
                  onChange={(e) => setBgUrlInput(e.target.value)}
                  placeholder="https://example.com/property-aerial.png"
                  className="flex-1 px-2.5 py-1 border border-gray-300 rounded-lg text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!bgUrlInput.trim()) return;
                    pushUndo(map);
                    update(updateMapBackground(map, bgUrlInput.trim(), map.backgroundOpacity ?? 0.85));
                    showToast('Base map URL applied!', 'success');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-gray-900 text-white text-xs font-semibold hover:bg-black"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>

          {/* Custom Drawing & Property Zones */}
          <div className="rounded-xl border border-gray-200 p-3 space-y-2.5 bg-gray-50/60">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-800">🎨 Map Drawing &amp; Zones</span>
              <span className="text-xs text-gray-400">
                {(map.drawings || []).length} shape{(map.drawings || []).length === 1 ? '' : 's'}
              </span>
            </div>
            <p className="text-[11px] text-gray-500">
              Draw property borders, parking lots, ceremony areas, arrows, and custom shapes on top of your map.
            </p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setShowDrawingStudio(true)}
                className="w-full px-3 py-2 rounded-lg bg-teal-700 text-white text-xs font-bold hover:bg-teal-800 shadow-sm flex items-center justify-center gap-1.5"
              >
                <span>✏️</span> Open Full Map Drawing Studio
              </button>
              <button
                type="button"
                onClick={() => {
                  pushUndo(map);
                  update(addPresetMapZones(map));
                  showToast('Added 4 property zone shapes to map.', 'success');
                }}
                className="flex-1 px-2.5 py-1.5 rounded-lg border border-teal-200 bg-white text-teal-800 text-xs font-semibold hover:bg-teal-50"
              >
                ＋ Add 4 Preset Zones
              </button>
              {(map.drawings || []).length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    pushUndo(map);
                    update(clearMapDrawings(map));
                    showToast('All custom drawings cleared.', 'info');
                  }}
                  className="px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50"
                >
                  Clear Shapes
                </button>
              )}
            </div>
            {(map.drawings || []).length > 0 && (
              <div className="space-y-1 pt-1 border-t border-gray-200/80 max-h-36 overflow-y-auto">
                {(map.drawings || []).map((d, i) => (
                  <div key={d.id} className="flex items-center justify-between gap-2 text-xs bg-white px-2 py-1 rounded border border-gray-200">
                    <span className="truncate font-medium text-gray-700">
                      {d.text || `Shape #${i + 1} (${d.type})`}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        pushUndo(map);
                        update(removeMapDrawing(map, d.id));
                      }}
                      className="text-red-400 hover:text-red-600 text-xs shrink-0"
                      aria-label={`Delete drawing shape ${d.text || d.id}`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

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
                pushUndo(map);
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
              <div className="flex flex-wrap gap-2 pt-1">
                <button type="button" onClick={saveSelected} className="flex-1 px-3 py-1.5 rounded-lg bg-[#4A1942] text-white text-sm">Save point</button>
                <button type="button" onClick={duplicateSelected} className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50" title="Duplicate this point">⧉ Copy</button>
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
                <div key={r.id} className="flex items-center justify-between gap-2 text-xs">
                  {renamingRoute === r.id ? (
                    <>
                      <input
                        type="text"
                        value={routeRename}
                        onChange={(e) => setRouteRename(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename();
                          if (e.key === 'Escape') { setRenamingRoute(null); setRouteRename(''); }
                        }}
                        onBlur={commitRename}
                        autoFocus
                        className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs"
                        aria-label={`Rename ${r.name}`}
                      />
                      <button type="button" onClick={commitRename} className="text-teal-600 hover:underline">Save</button>
                    </>
                  ) : (
                    <>
                      <span className="text-gray-700 truncate">🚶 {r.name}</span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => startRename(r.id, r.name)}
                          className="text-gray-400 hover:text-gray-600"
                          aria-label={`Rename ${r.name}`}
                        >
                          ✏️
                        </button>
                        <button type="button" onClick={() => { pushUndo(map); persist(removeMapRoute(map, r.id)); }} className="text-red-400 hover:text-red-600" aria-label={`Delete ${r.name}`}>✕</button>
                      </span>
                    </>
                  )}
                </div>
              ))}
              {(!map.routes || map.routes.length === 0) && <p className="text-xs text-gray-400">No walkways yet.</p>}
            </div>
          </div>
        </div>
        </>
        )}
      </div>

      <div className="flex justify-end gap-2">
        {onClose && <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600">Close</button>}
        <button type="button" onClick={() => { persist(map); showToast('Venue map saved.', 'success'); }} className="px-4 py-2 rounded-lg bg-[#4A1942] text-white text-sm">💾 Save Venue Map</button>
      </div>

      {showDrawingStudio && (
        <DrawingTool
          onSave={(payload) => {
            pushUndo(map);
            const next = updateMapBackground(
              {
                ...map,
                drawings: payload.objects && payload.objects.length > 0 ? payload.objects : map.drawings,
              },
              payload.imageDataUrl,
              map.backgroundOpacity ?? 0.85,
            );
            persist(next);
            setShowDrawingStudio(false);
            showToast('Annotated map drawing saved to venue map!', 'success');
          }}
          onClose={() => setShowDrawingStudio(false)}
        />
      )}
    </div>
  );
}
