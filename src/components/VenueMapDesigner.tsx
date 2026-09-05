import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DrawingObject,
  Venue,
  VenueMapAudience,
  VenueMapConfig,
  VenueMapPoint,
  VenueMapPointKind,
  VenueMapRouteAccessibility,
  VenueMapViewer,
} from '../types';
import { VenueMapCanvas } from './VenueMapCanvas';
import {
  addMapDrawing,
  addMapPoint,
  addMapRoute,
  clearMapDrawings,
  duplicateMapPoint,
  mapAudienceLabel,
  MAP_AUDIENCES,
  moveMapPoint,
  pointColor,
  pointKindIcon,
  pointKindLabel,
  projectVenueMap,
  removeMapDrawing,
  removeMapPoint,
  removeMapRoute,
  updateMapBackground,
  updateMapDrawing,
  updateMapPoint,
  updateMapRoute,
  updateMapSize,
} from '../utils/venueMapDesigner';
import { downloadLayoutPng, downloadLayoutPdf } from '../utils/layoutExport';
import { showToast } from './Toast';
import { describeUnknownError } from '../utils/unknownError';
import { uploadImage } from '../services/storage/imageStorage';
import { getPlatformProvider } from '../services/platform';

export interface VenueMapDesignerProps {
  map: VenueMapConfig;
  venues: Venue[];
  onSave: (map: VenueMapConfig) => void;
  onClose?: () => void;
  /** Optional title drawn on the map (e.g. the venue name) and included in exports. */
  mapTitle?: string;
  /** Fired whenever there are unsaved edits (so the shell can guard navigation). */
  onDirtyChange?: (dirty: boolean) => void;
  /** Active tenant used to place cloud-hosted base-map assets in tenant storage. */
  organizationId?: string;
}

const KINDS: VenueMapPointKind[] = ['space', 'parking', 'entry', 'amenity', 'path'];
const isValidLatitude = (value: number | undefined): value is number =>
  value !== undefined && Number.isFinite(value) && value >= -90 && value <= 90;
const isValidLongitude = (value: number | undefined): value is number =>
  value !== undefined && Number.isFinite(value) && value >= -180 && value <= 180;

/**
 * The interactive full-venue map designer. Hybrid: a drag + click-to-place canvas
 * for spatial layout, plus a side panel for precise numeric entry, point metadata,
 * linking space points to venue/lodging, and drawing walkway routes. Supports
 * printing/exporting the resulting "Venue Map" (PNG/PDF).
 */
export function VenueMapDesigner({ map: initialMap, venues, onSave, onClose, mapTitle, onDirtyChange, organizationId }: VenueMapDesignerProps) {
  const [map, setMap] = useState<VenueMapConfig>(initialMap);
  const [dirty, setDirty] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeKind, setActiveKind] = useState<VenueMapPointKind>('space');
  const [routeName, setRouteName] = useState('');
  const [routePointIds, setRoutePointIds] = useState<string[]>([]);
  const [routeAudience, setRouteAudience] = useState<VenueMapAudience>('public');
  const [routeAccessibility, setRouteAccessibility] = useState<VenueMapRouteAccessibility>('unknown');
  const [routeNotes, setRouteNotes] = useState('');
  const [routeEventSpaceIds, setRouteEventSpaceIds] = useState<string[]>([]);
  const [renamingRoute, setRenamingRoute] = useState<string | null>(null);
  const [routeRename, setRouteRename] = useState('');
  const [routeEditAudience, setRouteEditAudience] = useState<VenueMapAudience>('public');
  const [routeEditAccessibility, setRouteEditAccessibility] = useState<VenueMapRouteAccessibility>('unknown');
  const [routeEditNotes, setRouteEditNotes] = useState('');
  const [routeEditEventSpaceIds, setRouteEditEventSpaceIds] = useState<string[]>([]);
  const [routeEditPointIds, setRouteEditPointIds] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [sizeW, setSizeW] = useState(String(initialMap.width || 100));
  const [sizeH, setSizeH] = useState(String(initialMap.height || 80));
  const [undoStack, setUndoStack] = useState<VenueMapConfig[]>([]);
  const [redoStack, setRedoStack] = useState<VenueMapConfig[]>([]);
  const [previewAudience, setPreviewAudience] = useState<VenueMapViewer | null>(null);
  const [previewVenueId, setPreviewVenueId] = useState('');
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [bgUrlInput, setBgUrlInput] = useState(initialMap.backgroundImageUrl || '');
  const [baseMapUploading, setBaseMapUploading] = useState(false);
  const savedMapRef = useRef(JSON.stringify(initialMap));
  const pointDraftBaselineRef = useRef<VenueMapPoint | null>(null);
  const pointDraftBaselineUpdatedAtRef = useRef(initialMap.updatedAt);
  const newPointDraftRef = useRef(false);

  const processBaseMapFile = async (file: File) => {
    const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
    const cloudMode = getPlatformProvider() === 'supabase';
    const maxBytes = (cloudMode ? 3 : 1) * 1024 * 1024;
    if (!allowedTypes.has(file.type)) {
      showToast('Choose a PNG, JPEG, WebP, or GIF image. SVG and HTML files are not accepted.', 'warning');
      return;
    }
    if (file.size <= 0 || file.size > maxBytes) {
      showToast(`Base-map images must be smaller than ${cloudMode ? '3 MB' : '1 MB in offline mode'}. Compress the image and try again.`, 'warning');
      return;
    }
    if (cloudMode && !organizationId) {
      showToast('The active venue could not be identified, so the base map was not uploaded.', 'warning');
      return;
    }

    setBaseMapUploading(true);
    try {
      const imageRef = await uploadImage(file, {
        bucket: 'venue-map-images',
        organizationId,
      });
      if (!imageRef) throw new Error('The image upload returned no file reference.');
      pushUndo(map);
      update(updateMapBackground(map, imageRef, map.backgroundOpacity ?? 0.85));
      setBgUrlInput(imageRef);
      showToast('Base map uploaded. Save the venue map to publish it.', 'success');
    } catch (error) {
      showToast(describeUnknownError(error, 'Could not upload the base map. No map changes were made.'), 'warning');
    } finally {
      setBaseMapUploading(false);
    }
  };

  const handleBaseMapUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) void processBaseMapFile(file);
  };

  const svgRef = useRef<SVGSVGElement | null>(null);
  // Captures the pre-drag snapshot so a drag undo is one step, not per-mousemove.
  const pendingDragRef = useRef<VenueMapConfig | null>(null);
  // Coalesces field-by-field edits (label/kind/GPS/X/Y/venue) into a single undo
  // step per "edit session" of the selected point (cleared on reselect/save).
  const fieldUndoCapturedRef = useRef(false);
  const drawingUndoCapturedRef = useRef(false);

  const selected: VenueMapPoint | undefined = map.points.find((p) => p.id === selectedId);
  const selectedDrawing: DrawingObject | undefined = (map.drawings || []).find(
    (drawing) => drawing.id === selectedDrawingId,
  );

  const update = (next: VenueMapConfig) => {
    setMap(next);
    setDirty(JSON.stringify(next) !== savedMapRef.current);
  };
  const persist = (next: VenueMapConfig) => {
    onSave(next);
    savedMapRef.current = JSON.stringify(next);
    setMap(next);
    setDirty(false);
  };
  // Any edit to a selected point flags unsaved changes so the "Save point"
  // affordance (and its warning) is honest about the draft state. The first edit
  // of a session captures an undo snapshot so a whole edit session is one undo.
  const editSelected = (next: VenueMapConfig) => {
    if (!fieldUndoCapturedRef.current) {
      pushUndo(map);
      fieldUndoCapturedRef.current = true;
    }
    setEditing(true);
    update(next);
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
    setDirty(JSON.stringify(prev) !== savedMapRef.current);
    pendingDragRef.current = null;
    fieldUndoCapturedRef.current = false;
  };
  const redo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((r) => r.slice(0, -1));
    setUndoStack((u) => [...u, map]);
    setMap(next);
    setDirty(JSON.stringify(next) !== savedMapRef.current);
    pendingDragRef.current = null;
    fieldUndoCapturedRef.current = false;
  };

  const handleSelectPoint = (id: string | null) => {
    setSelectedId(id);
    fieldUndoCapturedRef.current = false;
    newPointDraftRef.current = false;
    pointDraftBaselineUpdatedAtRef.current = map.updatedAt;
    pointDraftBaselineRef.current = id
      ? { ...map.points.find((point) => point.id === id)! }
      : null;
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
    const next = addMapPoint(map, {
      label,
      kind,
      x,
      y,
      audience: 'public',
      venueId: kind === 'space' ? '' : undefined,
    });
    setSelectedId(next.points[next.points.length - 1].id);
    pointDraftBaselineRef.current = null;
    pointDraftBaselineUpdatedAtRef.current = map.updatedAt;
    newPointDraftRef.current = true;
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
    const hasLatitude = selected.lat !== undefined;
    const hasLongitude = selected.lng !== undefined;
    if (hasLatitude !== hasLongitude || (hasLatitude && (!isValidLatitude(selected.lat) || !isValidLongitude(selected.lng)))) {
      showToast('Enter both GPS coordinates in range (latitude −90 to 90, longitude −180 to 180), or leave both blank.', 'warning');
      return;
    }
    const label = selected.label.trim() || 'Point';
    const next = updateMapPoint(map, selected.id, {
      label,
      audience: selected.audience || 'public',
      venueId: selected.kind === 'space' ? selected.venueId || undefined : undefined,
      eventSpaceIds: selected.kind === 'space' ? undefined : selected.eventSpaceIds,
    });
    update(next);
    pointDraftBaselineRef.current = { ...next.points.find((point) => point.id === selected.id)! };
    pointDraftBaselineUpdatedAtRef.current = next.updatedAt;
    newPointDraftRef.current = false;
    setEditing(false);
    fieldUndoCapturedRef.current = false;
    showToast('Point changes applied. Save the venue map to publish them.', 'success');
  };

  const cancelPointEdit = () => {
    if (!selected) return;
    if (!editing) {
      setSelectedId(null);
      pointDraftBaselineRef.current = null;
      return;
    }
    if (newPointDraftRef.current) {
      update({
        ...removeMapPoint(map, selected.id),
        updatedAt: pointDraftBaselineUpdatedAtRef.current,
      });
      setRoutePointIds((ids) => ids.filter((id) => id !== selected.id));
    } else if (pointDraftBaselineRef.current) {
      const baseline = pointDraftBaselineRef.current;
      update({
        ...map,
        points: map.points.map((point) => point.id === selected.id ? baseline : point),
        updatedAt: pointDraftBaselineUpdatedAtRef.current,
      });
    }
    setSelectedId(null);
    pointDraftBaselineRef.current = null;
    newPointDraftRef.current = false;
    setEditing(false);
    fieldUndoCapturedRef.current = false;
  };

  const removeSelected = () => {
    if (!selected) return;
    pushUndo(map);
    update(removeMapPoint(map, selected.id));
    setRoutePointIds((ids) => ids.filter((id) => id !== selected.id));
    setSelectedId(null);
    pointDraftBaselineRef.current = null;
    newPointDraftRef.current = false;
    setEditing(false);
    fieldUndoCapturedRef.current = false;
    showToast('Point removed. Save the venue map to publish this change.', 'info');
  };

  /** Duplicate the selected point at a small offset and select the copy. */
  const duplicateSelected = () => {
    if (!selected) return;
    pushUndo(map);
    fieldUndoCapturedRef.current = false;
    const next = duplicateMapPoint(map, selected.id);
    const copy = next.points[next.points.length - 1];
    setSelectedId(copy.id);
    pointDraftBaselineRef.current = null;
    pointDraftBaselineUpdatedAtRef.current = map.updatedAt;
    newPointDraftRef.current = true;
    setEditing(true);
    update(next);
    showToast('Point duplicated.', 'success');
  };

  /** Open a point's GPS location in Google Maps (used in preview mode). */
  const openInMaps = (p: VenueMapPoint) => {
    if (!isValidLatitude(p.lat) || !isValidLongitude(p.lng)) return;
    window.open(`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`, '_blank', 'noopener,noreferrer');
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
      audience: 'public',
    });
    setSelectedId(next.points[next.points.length - 1].id);
    pointDraftBaselineRef.current = null;
    pointDraftBaselineUpdatedAtRef.current = map.updatedAt;
    newPointDraftRef.current = true;
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

  const addZone = () => {
    const width = Math.max(8, map.width * 0.24);
    const height = Math.max(6, map.height * 0.18);
    const drawing: DrawingObject = {
      id: `zone-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'zone',
      x: Math.max(0, (map.width - width) / 2),
      y: Math.max(0, (map.height - height) / 2),
      width,
      height,
      text: 'New map zone',
      fillColor: '#0d9488',
      strokeColor: '#0f766e',
      strokeWidth: 1.2,
      opacity: 0.24,
      audience: 'public',
    };
    pushUndo(map);
    update(addMapDrawing(map, drawing));
    setSelectedDrawingId(drawing.id);
    drawingUndoCapturedRef.current = false;
    showToast('Zone added. Edit its label, position, size, and audience below.', 'info');
  };

  const editDrawing = (patch: Partial<Omit<DrawingObject, 'id'>>) => {
    if (!selectedDrawing) return;
    if (!drawingUndoCapturedRef.current) {
      pushUndo(map);
      drawingUndoCapturedRef.current = true;
    }
    update(updateMapDrawing(map, selectedDrawing.id, patch));
  };

  const commitRoute = () => {
    if (routePointIds.length < 2) {
      showToast('A walkway needs at least 2 current map points.', 'warning');
      return;
    }
    const next = addMapRoute(map, routeName, routePointIds, {
      audience: routeAudience,
      accessibility: routeAccessibility,
      notes: routeNotes,
      eventSpaceIds: routeEventSpaceIds,
    });
    if (next === map) {
      setRoutePointIds((ids) => ids.filter((id) => map.points.some((point) => point.id === id)));
      showToast('Choose at least 2 current map points for this walkway.', 'warning');
      return;
    }
    pushUndo(map);
    update(next);
    setRouteName('');
    setRoutePointIds([]);
    setRouteAudience('public');
    setRouteAccessibility('unknown');
    setRouteNotes('');
    setRouteEventSpaceIds([]);
    showToast('Walkway added. Save the venue map to publish it.', 'success');
  };

  const startRename = (id: string, current: string) => {
    const route = (map.routes || []).find((item) => item.id === id);
    setRenamingRoute(id);
    setRouteRename(current);
    setRouteEditAudience(route?.audience || 'public');
    setRouteEditAccessibility(route?.accessibility || 'unknown');
    setRouteEditNotes(route?.notes || '');
    setRouteEditEventSpaceIds(route?.eventSpaceIds || []);
    setRouteEditPointIds(route?.pointIds || []);
  };
  const commitRename = () => {
    if (renamingRoute && routeEditPointIds.length < 2) {
      showToast('A walkway needs at least 2 current map points.', 'warning');
      return;
    }
    if (renamingRoute) {
      pushUndo(map);
      update(updateMapRoute(map, renamingRoute, {
        name: routeRename,
        audience: routeEditAudience,
        accessibility: routeEditAccessibility,
        notes: routeEditNotes,
        eventSpaceIds: routeEditEventSpaceIds.length ? routeEditEventSpaceIds : undefined,
        pointIds: routeEditPointIds,
      }));
      showToast('Walkway changes applied. Save the venue map to publish them.', 'success');
    }
    setRenamingRoute(null);
    setRouteRename('');
    setRouteEditAudience('public');
    setRouteEditAccessibility('unknown');
    setRouteEditNotes('');
    setRouteEditEventSpaceIds([]);
    setRouteEditPointIds([]);
  };

  const publishMap = () => {
    const invalidPoint = map.points.find((point) => {
      const hasLatitude = point.lat !== undefined;
      const hasLongitude = point.lng !== undefined;
      return hasLatitude !== hasLongitude
        || (hasLatitude && (!isValidLatitude(point.lat) || !isValidLongitude(point.lng)));
    });
    if (invalidPoint) {
      setSelectedId(invalidPoint.id);
      setEditing(true);
      showToast(`Fix the GPS coordinates for “${invalidPoint.label}” before saving.`, 'warning');
      return;
    }
    persist(map);
    showToast('Venue map saved and portal snapshots queued for refresh.', 'success');
  };

  const exportMap = async (kind: 'png' | 'pdf') => {
    const svg = svgRef.current;
    if (!svg) { showToast('Map is not ready to export yet.', 'warning'); return; }
    const base = (mapTitle || 'venue-map').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'venue-map';
    try {
      if (map.backgroundImageUrl && !svg.querySelector('image')) {
        throw new Error('The base map is still loading. Wait a moment, then export again.');
      }
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
            onClick={() => {
              if (previewAudience) setPreviewAudience(null);
              else {
                setPreviewVenueId(venues[0]?.id || '');
                setPreviewAudience('guest');
              }
            }}
            className={`px-3 py-1.5 rounded-lg border text-sm ${previewAudience ? 'bg-teal-700 border-teal-700 text-white' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            title="Preview audience-visible map layers"
          >
            {previewAudience ? '✕ Exit preview' : '👁 Preview audiences'}
          </button>
          <button type="button" onClick={() => void exportMap('png')} className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">🖼️ PNG</button>
          <button type="button" onClick={() => void exportMap('pdf')} className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">📄 PDF</button>
          <button type="button" onClick={() => window.print()} className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 no-print" title="Print Venue Map">🖨️ Print</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {previewAudience ? (
          <div className="lg:col-span-3 space-y-3">
            <div className="rounded-xl border border-teal-300 bg-teal-50/60 p-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-sm font-semibold text-teal-900">👁 Audience preview</span>
                <p className="text-xs text-teal-800 mt-0.5">
                  Staff-only layers are excluded. An individual guest’s map is also scoped to that wedding’s selected spaces and rain backup.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs font-semibold text-teal-900">
                  Viewing as
                  <select
                    value={previewAudience}
                    onChange={(event) => setPreviewAudience(event.target.value as VenueMapViewer)}
                    className="ml-2 rounded-lg border border-teal-300 bg-white px-2 py-1.5 text-xs"
                    aria-label="Preview map audience"
                  >
                    <option value="guest">Guest</option>
                    <option value="couple">Couple</option>
                  </select>
                </label>
                {previewAudience === 'guest' && venues.length > 0 && (
                  <label className="text-xs font-semibold text-teal-900">
                    Wedding space
                    <select
                      value={previewVenueId}
                      onChange={(event) => setPreviewVenueId(event.target.value)}
                      className="ml-2 rounded-lg border border-teal-300 bg-white px-2 py-1.5 text-xs"
                      aria-label="Preview wedding event space"
                    >
                      {venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}
                    </select>
                  </label>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewAudience(null)}
                  className="px-3 py-1.5 rounded-lg bg-teal-700 text-white text-sm font-medium hover:bg-teal-800"
                >
                  Back to editing
                </button>
              </div>
            </div>
            <VenueMapCanvas
              map={projectVenueMap(
                map,
                previewAudience,
                previewAudience === 'guest' ? (previewVenueId ? [previewVenueId] : []) : undefined,
              )}
              editable={false}
              onPointClick={openInMaps}
              isPointInteractive={(point) => isValidLatitude(point.lat) && isValidLongitude(point.lng)}
              pointActionLabel={() => 'Open in maps.'}
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
            <button
              type="button"
              onClick={() => handlePlace(activeKind, map.width / 2, map.height / 2)}
              className="ml-auto rounded-lg border border-teal-300 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800 hover:bg-teal-100"
            >
              ＋ Place {pointKindLabel(activeKind)} at center
            </button>
          </div>
          <div className="mt-2 rounded-xl border border-gray-200 bg-white p-3 no-print spm-studio-chrome">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <label className="flex flex-col text-xs text-gray-600">
                Walkway name
                <input type="text" value={routeName} onChange={(e) => setRouteName(e.target.value)} placeholder="Main Walkway" className="mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm" />
              </label>
              <label className="flex flex-col text-xs text-gray-600">
                Audience
                <select value={routeAudience} onChange={(e) => setRouteAudience(e.target.value as VenueMapAudience)} className="mt-1 px-2 py-1.5 border border-gray-300 rounded text-xs bg-white">
                  {MAP_AUDIENCES.map((audience) => <option key={audience} value={audience}>{mapAudienceLabel(audience)}</option>)}
                </select>
              </label>
              <label className="flex flex-col text-xs text-gray-600">
                Mobility status
                <select value={routeAccessibility} onChange={(e) => setRouteAccessibility(e.target.value as VenueMapRouteAccessibility)} className="mt-1 px-2 py-1.5 border border-gray-300 rounded text-xs bg-white">
                  <option value="unknown">Not verified</option>
                  <option value="step-free">Verified step-free</option>
                  <option value="not-step-free">Not step-free</option>
                </select>
              </label>
              <label className="flex flex-col text-xs text-gray-600">
                Add point ({routePointIds.length} selected)
                <select
                  value=""
                  onChange={(e) => { if (e.target.value) setRoutePointIds((ids) => [...ids, e.target.value]); }}
                  className="mt-1 px-2 py-1.5 border border-gray-300 rounded text-xs bg-white"
                  aria-label="Add point to walkway"
                >
                  <option value="">Select in travel order…</option>
                  {map.points.map((point) => (
                    <option key={point.id} value={point.id} disabled={routePointIds.includes(point.id)}>{point.label}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="mt-2 flex flex-col text-xs text-gray-600">
              Route guidance or caution (optional)
              <input
                type="text"
                value={routeNotes}
                onChange={(event) => setRouteNotes(event.target.value)}
                placeholder="e.g. Use the ramp beside the stone terrace; path may be soft after rain."
                className="mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm"
              />
            </label>
            {venues.length > 0 && (
              <details className="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5">
                <summary className="cursor-pointer text-xs font-medium text-gray-600">
                  Event-space scope: {routeEventSpaceIds.length === 0 ? 'All wedding events' : `${routeEventSpaceIds.length} selected space${routeEventSpaceIds.length === 1 ? '' : 's'}`}
                </summary>
                <div className="mt-2 grid gap-1 sm:grid-cols-2">
                  {venues.map((venue) => (
                    <label key={venue.id} className="flex items-center gap-2 text-xs text-gray-600">
                      <input
                        type="checkbox"
                        checked={routeEventSpaceIds.includes(venue.id)}
                        onChange={(event) => setRouteEventSpaceIds((ids) => event.target.checked ? [...ids, venue.id] : ids.filter((id) => id !== venue.id))}
                      />
                      <span className="truncate">{venue.name}</span>
                    </label>
                  ))}
                </div>
                {routeEventSpaceIds.length > 0 && <button type="button" onClick={() => setRouteEventSpaceIds([])} className="mt-2 text-[11px] text-teal-700 hover:underline">Use for all wedding events</button>}
              </details>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button type="button" onClick={commitRoute} disabled={routePointIds.length < 2} className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40">＋ Add walkway</button>
              <button type="button" onClick={() => setRoutePointIds([])} disabled={routePointIds.length === 0} className="px-2 py-1 rounded text-xs text-gray-500 hover:underline disabled:opacity-40">Clear route</button>
              <span className="text-[11px] text-gray-500">Only mark “step-free” after verifying the full route on site.</span>
            </div>
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
            <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
              The base image is visible to every map audience. Use a public-safe image without staff-only labels or sensitive details.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="venue-base-map-upload"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleBaseMapUpload}
                disabled={baseMapUploading}
                className="sr-only"
                aria-label="Upload base map image file"
              />
              <label
                htmlFor="venue-base-map-upload"
                className={`px-3 py-1.5 rounded-lg bg-[#4A1942] text-white text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5 ${baseMapUploading ? 'cursor-wait opacity-60' : 'cursor-pointer hover:bg-[#3b1435]'}`}
              >
                <span>📤</span> {baseMapUploading ? 'Uploading…' : map.backgroundImageUrl ? 'Change Base Map' : 'Upload Image'}
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
                    const value = bgUrlInput.trim();
                    if (!value) return;
                    try {
                      const parsed = new URL(value);
                      if (parsed.protocol !== 'https:') throw new Error('Base-map URLs must use HTTPS.');
                    } catch (error) {
                      showToast(describeUnknownError(error, 'Enter a valid HTTPS image URL.'), 'warning');
                      return;
                    }
                    pushUndo(map);
                    update(updateMapBackground(map, value, map.backgroundOpacity ?? 0.85));
                    showToast('Base map URL applied to the draft. Confirm export works before publishing.', 'info');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-gray-900 text-white text-xs font-semibold hover:bg-black"
                >
                  Apply
                </button>
              </div>
              <p className="mt-1 text-[10px] text-gray-400">External hosts must allow cross-origin image downloads or PNG/PDF export will stop with an error. Uploading is recommended.</p>
            </div>
          </div>

          {/* Map-native vector zones */}
          <div className="rounded-xl border border-gray-200 p-3 space-y-2.5 bg-gray-50/60">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-800">🎨 Property zones</span>
              <span className="text-xs text-gray-400">
                {(map.drawings || []).length} zone{(map.drawings || []).length === 1 ? '' : 's'}
              </span>
            </div>
            <p className="text-[11px] text-gray-500">
              Add editable vector areas for lawns, parking, buildings, gardens, or restricted operations. Zones stay separate from the base image.
            </p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={addZone}
                className="flex-1 px-3 py-2 rounded-lg bg-teal-700 text-white text-xs font-bold hover:bg-teal-800 shadow-sm"
              >
                ＋ Add editable zone
              </button>
              {(map.drawings || []).length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    pushUndo(map);
                    update(clearMapDrawings(map));
                    setSelectedDrawingId(null);
                    drawingUndoCapturedRef.current = false;
                    showToast('All zones removed. Save the venue map to publish this change.', 'info');
                  }}
                  className="px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50"
                >
                  Clear zones
                </button>
              )}
            </div>
            {(map.drawings || []).length > 0 && (
              <div className="space-y-1 pt-1 border-t border-gray-200/80 max-h-36 overflow-y-auto">
                {(map.drawings || []).map((drawing, index) => (
                  <div key={drawing.id} className={`flex items-center gap-1 rounded border px-1 py-1 text-xs ${selectedDrawingId === drawing.id ? 'border-teal-400 bg-teal-50' : 'border-gray-200 bg-white'}`}>
                    <button
                      type="button"
                      onClick={() => { setSelectedDrawingId(drawing.id); drawingUndoCapturedRef.current = false; }}
                      className="min-w-0 flex-1 truncate px-1 text-left font-medium text-gray-700"
                    >
                      {drawing.text || `Zone ${index + 1}`}
                    </button>
                    <span className="shrink-0 text-[10px] text-gray-400">{mapAudienceLabel(drawing.audience)}</span>
                    <button
                      type="button"
                      onClick={() => {
                        pushUndo(map);
                        update(removeMapDrawing(map, drawing.id));
                        if (selectedDrawingId === drawing.id) setSelectedDrawingId(null);
                      }}
                      className="shrink-0 px-1 text-red-500 hover:text-red-700"
                      aria-label={`Delete zone ${drawing.text || drawing.id}`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            {selectedDrawing && (
              <div className="space-y-2 rounded-lg border border-teal-200 bg-white p-2">
                <label className="block text-xs text-gray-600">Zone label
                  <input
                    type="text"
                    value={selectedDrawing.text || ''}
                    onChange={(event) => editDrawing({ text: event.target.value })}
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-xs"
                  />
                </label>
                <label className="block text-xs text-gray-600">Audience
                  <select
                    value={selectedDrawing.audience || 'public'}
                    onChange={(event) => editDrawing({ audience: event.target.value as VenueMapAudience })}
                    className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs"
                  >
                    {MAP_AUDIENCES.map((audience) => <option key={audience} value={audience}>{mapAudienceLabel(audience)}</option>)}
                  </select>
                </label>
                {venues.length > 0 && (
                  <details className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5">
                    <summary className="cursor-pointer text-[11px] font-medium text-gray-600">
                      Event-space scope: {selectedDrawing.eventSpaceIds?.length ? `${selectedDrawing.eventSpaceIds.length} selected` : 'All wedding events'}
                    </summary>
                    <div className="mt-2 space-y-1">
                      {venues.map((venue) => (
                        <label key={venue.id} className="flex items-center gap-2 text-xs text-gray-600">
                          <input
                            type="checkbox"
                            checked={selectedDrawing.eventSpaceIds?.includes(venue.id) ?? false}
                            onChange={(event) => {
                              const ids = selectedDrawing.eventSpaceIds || [];
                              const nextIds = event.target.checked ? [...ids, venue.id] : ids.filter((id) => id !== venue.id);
                              editDrawing({ eventSpaceIds: nextIds.length ? nextIds : undefined });
                            }}
                          />
                          <span className="truncate">{venue.name}</span>
                        </label>
                      ))}
                    </div>
                  </details>
                )}
                {(selectedDrawing.type === 'zone' || selectedDrawing.type === 'rectangle') && (
                  <div className="grid grid-cols-4 gap-1">
                    {([
                      ['x', 'X', selectedDrawing.x, map.width],
                      ['y', 'Y', selectedDrawing.y, map.height],
                      ['width', 'Width', selectedDrawing.width ?? 1, map.width],
                      ['height', 'Height', selectedDrawing.height ?? 1, map.height],
                    ] as const).map(([field, label, value, max]) => (
                      <label key={field} className="text-[10px] text-gray-500">{label}
                        <input
                          type="number"
                          min={field === 'width' || field === 'height' ? 1 : 0}
                          max={max}
                          step="0.5"
                          value={Math.round(value * 10) / 10}
                          onChange={(event) => {
                            const parsed = Number(event.target.value);
                            if (Number.isFinite(parsed)) editDrawing({ [field]: Math.max(field === 'width' || field === 'height' ? 1 : 0, Math.min(max, parsed)) });
                          }}
                          className="mt-1 w-full rounded border border-gray-300 px-1 py-1 text-xs"
                        />
                      </label>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[10px] text-gray-500">Fill color
                    <input type="color" value={selectedDrawing.fillColor || '#0d9488'} onChange={(event) => editDrawing({ fillColor: event.target.value })} className="mt-1 h-8 w-full rounded border" />
                  </label>
                  <label className="text-[10px] text-gray-500">Border color
                    <input type="color" value={selectedDrawing.strokeColor || '#0f766e'} onChange={(event) => editDrawing({ strokeColor: event.target.value })} className="mt-1 h-8 w-full rounded border" />
                  </label>
                </div>
                <label className="block text-[10px] text-gray-500">Fill opacity {Math.round((selectedDrawing.opacity ?? 0.24) * 100)}%
                  <input type="range" min="5" max="80" value={Math.round((selectedDrawing.opacity ?? 0.24) * 100)} onChange={(event) => editDrawing({ opacity: Number(event.target.value) / 100 })} className="mt-1 w-full" />
                </label>
                <button type="button" onClick={() => { setSelectedDrawingId(null); drawingUndoCapturedRef.current = false; }} className="w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-600">Done editing zone</button>
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
              <label className="block text-xs text-gray-500">Guest guidance / description
                <textarea value={selected.description || ''} onChange={(e) => editSelected(updateMapPoint(map, selected.id, { description: e.target.value || undefined }))} rows={2} className="mt-1 w-full resize-y rounded border border-gray-300 px-2 py-1 text-sm" placeholder="Example: Enter through the stone arch beside the fountain." />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs text-gray-500">Kind
                  <select value={selected.kind} onChange={(e) => editSelected(updateMapPoint(map, selected.id, { kind: e.target.value as VenueMapPointKind }))} className="mt-1 w-full px-2 py-1 border border-gray-300 rounded text-sm bg-white">
                    {KINDS.map((k) => <option key={k} value={k}>{pointKindLabel(k)}</option>)}
                  </select>
                </label>
                <label className="block text-xs text-gray-500">Audience
                  <select value={selected.audience || 'public'} onChange={(e) => editSelected(updateMapPoint(map, selected.id, { audience: e.target.value as VenueMapAudience }))} className="mt-1 w-full px-2 py-1 border border-gray-300 rounded text-sm bg-white">
                    {MAP_AUDIENCES.map((audience) => <option key={audience} value={audience}>{mapAudienceLabel(audience)}</option>)}
                  </select>
                </label>
              </div>
              {selected.kind === 'space' && (
                <label className="block text-xs text-gray-500">Linked event space or lodging
                  <select value={selected.venueId || ''} onChange={(e) => linkVenue(e.target.value)} className="mt-1 w-full px-2 py-1 border border-gray-300 rounded text-sm bg-white">
                    <option value="">(none)</option>
                    {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                  {!selected.venueId && <span className="mt-1 block text-[10px] text-amber-700">Link this pin before publishing it to event-scoped guest maps.</span>}
                </label>
              )}
              {selected.kind !== 'space' && venues.length > 0 && (
                <details className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5">
                  <summary className="cursor-pointer text-xs font-medium text-gray-600">
                    Event-space scope: {selected.eventSpaceIds?.length ? `${selected.eventSpaceIds.length} selected` : 'All wedding events'}
                  </summary>
                  <div className="mt-2 space-y-1">
                    {venues.map((venue) => (
                      <label key={venue.id} className="flex items-center gap-2 text-xs text-gray-600">
                        <input
                          type="checkbox"
                          checked={selected.eventSpaceIds?.includes(venue.id) ?? false}
                          onChange={(event) => {
                            const ids = selected.eventSpaceIds || [];
                            const nextIds = event.target.checked ? [...ids, venue.id] : ids.filter((id) => id !== venue.id);
                            editSelected(updateMapPoint(map, selected.id, { eventSpaceIds: nextIds.length ? nextIds : undefined }));
                          }}
                        />
                        <span className="truncate">{venue.name}</span>
                      </label>
                    ))}
                  </div>
                </details>
              )}
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs text-gray-500">X
                  <input type="number" min={0} max={map.width} step="0.5" value={Math.round(selected.x * 10) / 10} onChange={(e) => editSelected(moveMapPoint(map, selected.id, Number(e.target.value), selected.y))} className="mt-1 w-full px-2 py-1 border border-gray-300 rounded text-sm" />
                </label>
                <label className="block text-xs text-gray-500">Y
                  <input type="number" min={0} max={map.height} step="0.5" value={Math.round(selected.y * 10) / 10} onChange={(e) => editSelected(moveMapPoint(map, selected.id, selected.x, Number(e.target.value)))} className="mt-1 w-full px-2 py-1 border border-gray-300 rounded text-sm" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs text-gray-500">GPS lat
                  <input type="number" min={-90} max={90} step="any" value={selected.lat ?? ''} aria-invalid={selected.lat !== undefined && !isValidLatitude(selected.lat)} onChange={(e) => editSelected(updateMapPoint(map, selected.id, { lat: e.target.value === '' ? undefined : Number(e.target.value) }))} className="mt-1 w-full px-2 py-1 border border-gray-300 rounded text-sm" />
                </label>
                <label className="block text-xs text-gray-500">GPS lng
                  <input type="number" min={-180} max={180} step="any" value={selected.lng ?? ''} aria-invalid={selected.lng !== undefined && !isValidLongitude(selected.lng)} onChange={(e) => editSelected(updateMapPoint(map, selected.id, { lng: e.target.value === '' ? undefined : Number(e.target.value) }))} className="mt-1 w-full px-2 py-1 border border-gray-300 rounded text-sm" />
                </label>
              </div>
              {((selected.lat !== undefined) !== (selected.lng !== undefined) || (selected.lat !== undefined && (!isValidLatitude(selected.lat) || !isValidLongitude(selected.lng)))) && (
                <p className="text-[11px] text-red-600" role="alert">Enter a valid latitude and longitude together, or leave both blank.</p>
              )}
              {selected.venueId && (
                <p className="text-xs text-gray-500">→ {linkedVenueName(selected.venueId)}</p>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <button type="button" onClick={saveSelected} className="flex-1 px-3 py-1.5 rounded-lg bg-[#4A1942] text-white text-sm">Apply point changes</button>
                <button type="button" onClick={duplicateSelected} className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50" title="Duplicate this point">⧉ Copy</button>
                <button type="button" onClick={cancelPointEdit} className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-600">{editing ? 'Cancel edits' : 'Close'}</button>
                <button type="button" onClick={removeSelected} className="px-3 py-1.5 rounded-lg border border-red-200 text-sm text-red-600 hover:bg-red-50">Delete</button>
              </div>
              {editing && <p className="text-[11px] text-amber-600">Point edits are in this local draft. Apply them, then save the venue map to publish.</p>}
            </div>
          )}

          <div className="rounded-xl border border-gray-200 p-3">
            <span className="text-sm font-semibold text-gray-800">Walkway routes</span>
            <p className="mt-1 text-[11px] text-gray-500">Routes are authored paths used for portal wayfinding. Only mark a route step-free after venue verification.</p>
            <div className="mt-2 space-y-2">
              {(map.routes || []).map((route) => (
                <div key={route.id} className="rounded-lg border border-gray-200 bg-white p-2 text-xs">
                  {renamingRoute === route.id ? (
                    <div className="space-y-2">
                      <label className="block text-[11px] text-gray-500">Route name
                        <input
                          type="text"
                          value={routeRename}
                          onChange={(event) => setRouteRename(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Escape') { setRenamingRoute(null); setRouteRename(''); }
                          }}
                          autoFocus
                          className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-xs"
                        />
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="text-[11px] text-gray-500">Audience
                          <select value={routeEditAudience} onChange={(event) => setRouteEditAudience(event.target.value as VenueMapAudience)} className="mt-1 w-full rounded border border-gray-300 bg-white px-1 py-1 text-xs">
                            {MAP_AUDIENCES.map((audience) => <option key={audience} value={audience}>{mapAudienceLabel(audience)}</option>)}
                          </select>
                        </label>
                        <label className="text-[11px] text-gray-500">Mobility status
                          <select value={routeEditAccessibility} onChange={(event) => setRouteEditAccessibility(event.target.value as VenueMapRouteAccessibility)} className="mt-1 w-full rounded border border-gray-300 bg-white px-1 py-1 text-xs">
                            <option value="unknown">Not verified</option>
                            <option value="step-free">Verified step-free</option>
                            <option value="not-step-free">Not step-free</option>
                          </select>
                        </label>
                      </div>
                      {venues.length > 0 && (
                        <details className="rounded border border-gray-200 bg-gray-50 px-2 py-1.5">
                          <summary className="cursor-pointer text-[11px] font-medium text-gray-600">
                            Event-space scope: {routeEditEventSpaceIds.length === 0 ? 'All wedding events' : `${routeEditEventSpaceIds.length} selected`}
                          </summary>
                          <div className="mt-2 space-y-1">
                            {venues.map((venue) => (
                              <label key={venue.id} className="flex items-center gap-2 text-[11px] text-gray-600">
                                <input
                                  type="checkbox"
                                  checked={routeEditEventSpaceIds.includes(venue.id)}
                                  onChange={(event) => setRouteEditEventSpaceIds((ids) => event.target.checked ? [...ids, venue.id] : ids.filter((id) => id !== venue.id))}
                                />
                                <span className="truncate">{venue.name}</span>
                              </label>
                            ))}
                          </div>
                        </details>
                      )}
                      <fieldset className="rounded border border-gray-200 p-2">
                        <legend className="px-1 text-[11px] font-medium text-gray-600">Travel order</legend>
                        <div className="space-y-1">
                          {routeEditPointIds.map((pointId, index) => {
                            const point = map.points.find((item) => item.id === pointId);
                            return (
                              <div key={pointId} className="flex items-center gap-1 rounded bg-gray-50 px-1.5 py-1 text-[11px]">
                                <span className="w-4 text-gray-400">{index + 1}.</span>
                                <span className="min-w-0 flex-1 truncate text-gray-700">{point?.label || 'Missing point'}</span>
                                <button type="button" disabled={index === 0} onClick={() => setRouteEditPointIds((ids) => { const next = [...ids]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; })} className="px-1 text-gray-500 disabled:opacity-30" aria-label={`Move ${point?.label || 'point'} earlier`}>↑</button>
                                <button type="button" disabled={index === routeEditPointIds.length - 1} onClick={() => setRouteEditPointIds((ids) => { const next = [...ids]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; return next; })} className="px-1 text-gray-500 disabled:opacity-30" aria-label={`Move ${point?.label || 'point'} later`}>↓</button>
                                <button type="button" onClick={() => setRouteEditPointIds((ids) => ids.filter((id) => id !== pointId))} className="px-1 text-red-500" aria-label={`Remove ${point?.label || 'point'} from walkway`}>✕</button>
                              </div>
                            );
                          })}
                        </div>
                        <select
                          value=""
                          onChange={(event) => { if (event.target.value) setRouteEditPointIds((ids) => [...ids, event.target.value]); }}
                          className="mt-1.5 w-full rounded border border-gray-300 bg-white px-1 py-1 text-[11px]"
                          aria-label="Add point to edited walkway"
                        >
                          <option value="">Add another point…</option>
                          {map.points.map((point) => <option key={point.id} value={point.id} disabled={routeEditPointIds.includes(point.id)}>{point.label}</option>)}
                        </select>
                        {routeEditPointIds.length < 2 && <p className="mt-1 text-[10px] text-red-600">Add at least two points before applying.</p>}
                      </fieldset>
                      <label className="block text-[11px] text-gray-500">Route guidance or cautions
                        <textarea value={routeEditNotes} onChange={(event) => setRouteEditNotes(event.target.value)} rows={2} className="mt-1 w-full resize-y rounded border border-gray-300 px-2 py-1 text-xs" />
                      </label>
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => { setRenamingRoute(null); setRouteRename(''); }} className="rounded border border-gray-300 px-2 py-1 text-gray-600">Cancel</button>
                        <button type="button" disabled={routeEditPointIds.length < 2} onClick={commitRename} className="rounded bg-teal-700 px-2 py-1 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Apply route changes</button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <span className="min-w-0 truncate font-semibold text-gray-700">🚶 {route.name}</span>
                        <span className="flex shrink-0 items-center gap-1.5">
                          <button type="button" onClick={() => startRename(route.id, route.name)} className="text-teal-700 hover:underline" aria-label={`Edit ${route.name}`}>Edit</button>
                          <button type="button" onClick={() => { pushUndo(map); update(removeMapRoute(map, route.id)); showToast('Walkway removed. Save the venue map to publish this change.', 'info'); }} className="text-red-500 hover:text-red-700" aria-label={`Delete ${route.name}`}>Delete</button>
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">{mapAudienceLabel(route.audience)}</span>
                        <span className={`rounded px-1.5 py-0.5 text-[10px] ${route.accessibility === 'step-free' ? 'bg-blue-100 text-blue-800' : route.accessibility === 'not-step-free' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-500'}`}>
                          {route.accessibility === 'step-free' ? '♿ Verified step-free' : route.accessibility === 'not-step-free' ? 'Not step-free' : 'Mobility not verified'}
                        </span>
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">{route.pointIds.length} points</span>
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">{route.eventSpaceIds?.length ? `${route.eventSpaceIds.length} event space${route.eventSpaceIds.length === 1 ? '' : 's'}` : 'All events'}</span>
                      </div>
                      {route.notes && <p className="text-[11px] leading-snug text-gray-500">{route.notes}</p>}
                      <button
                        type="button"
                        onClick={() => { pushUndo(map); update(updateMapRoute(map, route.id, { pointIds: [...route.pointIds].reverse() })); }}
                        className="text-[10px] text-gray-500 hover:text-gray-700 hover:underline"
                      >
                        Reverse route order
                      </button>
                    </div>
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

      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className={`mr-auto text-xs font-medium ${dirty ? 'text-amber-700' : 'text-emerald-700'}`} role="status">
          {dirty ? '● Local draft has unpublished changes' : '✓ Venue map is saved'}
        </span>
        {onClose && <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600">Close</button>}
        <button type="button" disabled={baseMapUploading} onClick={publishMap} className="px-4 py-2 rounded-lg bg-[#4A1942] text-white text-sm disabled:cursor-not-allowed disabled:opacity-50">💾 Save Venue Map</button>
      </div>

    </div>
  );
}
