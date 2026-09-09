import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DrawingObject,
  RainContingency,
  Venue,
  VenueMapAudience,
  VenueMapConfig,
  VenueMapPoint,
  VenueMapPointKind,
  VenueMapRoute,
  VenueMapRouteAccessibility,
  VenueMapRoutePriority,
  VenueMapViewer,
} from '../types';
import { VenueMapCanvas } from './VenueMapCanvas';
import { ConfirmDialog } from './ConfirmDialog';
import {
  addMapDrawing,
  addMapPoint,
  addMapRoute,
  clearMapDrawings,
  constrainMapDrawing,
  duplicateMapPoint,
  isRainContingencyBackup,
  isRainContingencySource,
  mapAudienceLabel,
  MAP_AUDIENCES,
  MAP_ROUTE_PRIORITIES,
  VENUE_MAP_MAX_DRAWINGS,
  VENUE_MAP_MAX_POINTS,
  VENUE_MAP_MAX_RAIN_CONTINGENCIES,
  VENUE_MAP_MAX_ROUTES,
  VENUE_MAP_MAX_ROUTE_POINTS,
  moveMapPoint,
  pointColor,
  pointKindIcon,
  pointKindLabel,
  partitionVenueMapDrawingIntegrity,
  partitionVenueMapDuplicateIdentities,
  partitionVenueMapRainContingencyCollisions,
  partitionVenueMapRouteReferenceIntegrity,
  projectVenueMap,
  rainContingencyCollisionIssues,
  rainContingencyValidationIssue,
  routePriorityLabel,
  removeMapDrawing,
  removeMapPoint,
  removeMapRoute,
  updateMapBackground,
  updateMapDrawing,
  updateMapPoint,
  updateMapRoute,
  unavailableVenueMapEventScopeIds,
  updateMapSize,
  venueMapComplexityIssues,
  venueMapDrawingIntegrityIssue,
  venueMapEventScopeRecoveryLabel,
  venueMapPointCoordinateIssue,
  venueMapRoutePriorityIssue,
  venueMapRouteReferenceIssues,
  venueMapSpacePointLinkIssue,
  type VenueMapDuplicateIdentityGroup,
  type VenueMapIdentityObject,
} from '../utils/venueMapDesigner';
import { downloadLayoutPng, downloadLayoutPdf } from '../utils/layoutExport';
import { showToast } from './Toast';
import { describeUnknownError } from '../utils/unknownError';
import { uploadImage } from '../services/storage/imageStorage';
import { getPlatformProvider } from '../services/platform';
import {
  analyzeVenueMapConfig,
  emptyVenueMapConfig,
  getQuarantinedVenueMapForRecovery,
  getVenueMapStructuralRecoveryArtifacts,
  normalizeVenueMapConfig,
  venueMapRecoverySourceIsRedacted,
  VENUE_MAP_FRAME_MAX,
  VENUE_MAP_FRAME_MIN,
  type VenueMapStructuralRecoveryArtifact,
} from '../services/wayfinding/venueWayfindingService';
import { isManagedVenueMapImageRef } from '../utils/venueMapImageRef';

export type VenueMapDesignerSaveResult =
  | { status: 'saved'; updatedAt?: string | null }
  | { status: 'conflict' }
  | { status: 'error' };

export interface VenueMapDesignerProps {
  map: VenueMapConfig;
  venues: Venue[];
  onSave: (
    map: VenueMapConfig,
    expectedUpdatedAt: string | null | undefined,
  ) => void | VenueMapDesignerSaveResult | Promise<void | VenueMapDesignerSaveResult>;
  onClose?: () => void;
  /** Optional title drawn on the map (e.g. the venue name) and included in exports. */
  mapTitle?: string;
  /** Fired whenever there are unsaved edits (so the shell can guard navigation). */
  onDirtyChange?: (dirty: boolean) => void;
  /** Active tenant used to place cloud-hosted base-map assets in tenant storage. */
  organizationId?: string;
  /** org_data.updated_at observed when this editor instance loaded (`null` = absent row). */
  baseUpdatedAt?: string | null;
  /** Replaces the shell's submitted conflict snapshot with the latest mounted draft. */
  onConflictDraftChange?: (map: VenueMapConfig, hasUnappliedEdits: boolean) => void;
  /** Admin-only rejected canonical occurrences; never included in a published map. */
  structuralRecoveryArtifacts?: VenueMapStructuralRecoveryArtifact[];
}

const KINDS: VenueMapPointKind[] = ['space', 'parking', 'entry', 'amenity', 'path'];
const isValidLatitude = (value: number | undefined): value is number =>
  value !== undefined && Number.isFinite(value) && value >= -90 && value <= 90;
const isValidLongitude = (value: number | undefined): value is number =>
  value !== undefined && Number.isFinite(value) && value >= -180 && value <= 180;

interface VenueMapInitialRecoveryPartition {
  map: VenueMapConfig;
  duplicateGroups: VenueMapDuplicateIdentityGroup[];
  duplicateDependentRoutes: VenueMapRoute[];
  routeReferenceQuarantine: VenueMapRoute[];
  rainContingencyQuarantine: RainContingency[];
  drawingIntegrityQuarantine: DrawingObject[];
}

interface EventScopeEditorProps {
  eventSpaceIds?: string[];
  venues: Venue[];
  subjectLabel: string;
  onChange: (ids: string[] | undefined) => void;
  compact?: boolean;
}

function EventScopeEditor({
  eventSpaceIds,
  venues,
  subjectLabel,
  onChange,
  compact = false,
}: EventScopeEditorProps) {
  const ids = eventSpaceIds || [];
  const unavailableIds = unavailableVenueMapEventScopeIds(ids, venues);
  if (venues.length === 0 && ids.length === 0) return null;

  const unavailableSet = new Set(unavailableIds);
  const updateVenue = (venueId: string, checked: boolean) => {
    const next = checked
      ? [...new Set([...ids, venueId])]
      : ids.filter((id) => id !== venueId);
    onChange(next.length ? next : undefined);
  };

  return (
    <details className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5">
      <summary className={`cursor-pointer font-medium text-gray-600 ${compact ? 'text-[11px]' : 'text-xs'}`}>
        Event-space scope: {ids.length === 0
          ? 'All wedding events'
          : `${ids.length} selected space${ids.length === 1 ? '' : 's'}`}
      </summary>
      <div className="mt-2 space-y-1">
        {venues.map((venue) => (
          <label key={venue.id} className={`flex min-h-8 items-center gap-2 text-gray-600 ${compact ? 'text-[11px]' : 'text-xs'}`}>
            <input
              type="checkbox"
              checked={ids.includes(venue.id)}
              onChange={(event) => updateVenue(venue.id, event.target.checked)}
            />
            <span className="truncate">{venue.name}</span>
          </label>
        ))}
        {venues.length === 0 && (
          <p className="text-[11px] text-gray-500">No current venue spaces are available for this scope.</p>
        )}
      </div>
      {unavailableIds.length > 0 && (
        <div className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-[11px] text-red-800" role="alert">
          <p className="font-semibold">Unavailable saved scope:</p>
          <ul className="mt-1 list-disc pl-4">
            {unavailableIds.map((id) => (
              <li key={id}>{venueMapEventScopeRecoveryLabel(id)}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => {
              const next = ids.filter((id) => !unavailableSet.has(id));
              onChange(next.length ? next : undefined);
            }}
            aria-label={`Remove unavailable scopes from ${subjectLabel}`}
            className="mt-2 min-h-8 rounded border border-red-300 bg-white px-2 py-1 font-semibold hover:bg-red-100"
          >
            Remove unavailable scopes
          </button>
        </div>
      )}
      {ids.length > 0 && (
        <button
          type="button"
          onClick={() => onChange(undefined)}
          aria-label={`Use ${subjectLabel} for all wedding events`}
          className="mt-2 min-h-8 rounded px-2 py-1 text-[11px] font-semibold text-teal-700 hover:bg-teal-50 hover:underline"
        >
          Use for all wedding events
        </button>
      )}
    </details>
  );
}

function structuralRecoveryFamilyLabel(
  family: VenueMapStructuralRecoveryArtifact['family'],
): string {
  if (family === 'map') return 'Venue Map document';
  if (family === 'point') return 'map point';
  if (family === 'route') return 'walkway';
  if (family === 'drawing') return 'map shape';
  return 'rain plan';
}

function duplicateIdentityFamilyLabel(family: VenueMapDuplicateIdentityGroup['family']): string {
  if (family === 'point') return 'map point';
  if (family === 'route') return 'walkway';
  return 'map shape';
}

function duplicateIdentityObjectLabel(
  family: VenueMapDuplicateIdentityGroup['family'],
  object: VenueMapIdentityObject,
  index: number,
): string {
  if (family === 'point') {
    const point = object as VenueMapPoint;
    return `${point.label} at ${Math.round(point.x)}, ${Math.round(point.y)}`;
  }
  if (family === 'route') {
    const route = object as VenueMapRoute;
    return `${route.name} (${route.pointIds.length} points)`;
  }
  const drawing = object as DrawingObject;
  return drawing.text || `Shape occurrence ${index + 1}`;
}

function recoveredIdentityId(originalId: string, usedIds: Set<string>): string {
  const base = originalId.slice(0, 150) || 'map-object';
  let sequence = 1;
  let candidate = `${base}-recovered-${sequence}`;
  while (usedIds.has(candidate)) {
    sequence += 1;
    candidate = `${base}-recovered-${sequence}`;
  }
  return candidate;
}

/**
 * The interactive full-venue map designer. Hybrid: a drag + click-to-place canvas
 * for spatial layout, plus a side panel for precise numeric entry, point metadata,
 * linking space points to venue/lodging, and drawing walkway routes. Supports
 * printing/exporting the resulting "Venue Map" (PNG/PDF).
 */
export function VenueMapDesigner({
  map: initialMap,
  venues,
  onSave,
  onClose,
  mapTitle,
  onDirtyChange,
  organizationId,
  baseUpdatedAt,
  onConflictDraftChange,
  structuralRecoveryArtifacts: suppliedStructuralRecoveryArtifacts,
}: VenueMapDesignerProps) {
  const initialStructuralAnalysisRef = useRef<{
    map: VenueMapConfig;
    artifacts: VenueMapStructuralRecoveryArtifact[];
    quarantinedMap?: unknown;
    quarantinedMapRedacted: boolean;
  } | null>(null);
  if (initialStructuralAnalysisRef.current === null) {
    const analysis = analyzeVenueMapConfig(initialMap, { preserveDuplicateIds: true });
    const normalizedMap = analysis.map || initialMap;
    const suppliedArtifacts = suppliedStructuralRecoveryArtifacts
      || getVenueMapStructuralRecoveryArtifacts(normalizedMap);
    const artifacts = [...analysis.structuralRecoveryArtifacts];
    for (const artifact of suppliedArtifacts) {
      if (!artifacts.some((candidate) => candidate.key === artifact.key)) artifacts.push(artifact);
    }
    initialStructuralAnalysisRef.current = {
      map: normalizedMap,
      artifacts,
      quarantinedMap: analysis.quarantinedMap
        ?? getQuarantinedVenueMapForRecovery(normalizedMap),
      quarantinedMapRedacted: analysis.quarantinedMap === undefined
        && venueMapRecoverySourceIsRedacted(normalizedMap),
    };
  }
  const initialStructuralAnalysis = initialStructuralAnalysisRef.current;
  const recoverySourceMap = initialStructuralAnalysis.map;
  const initialRecoveryPartitionRef = useRef<VenueMapInitialRecoveryPartition | null>(null);
  if (initialRecoveryPartitionRef.current === null) {
    const identityPartition = partitionVenueMapDuplicateIdentities(recoverySourceMap);
    const routeReferencePartition = partitionVenueMapRouteReferenceIntegrity(identityPartition.map);
    const rainContingencyPartition = partitionVenueMapRainContingencyCollisions(
      routeReferencePartition.map,
    );
    const drawingIntegrityPartition = partitionVenueMapDrawingIntegrity(
      rainContingencyPartition.map,
    );
    initialRecoveryPartitionRef.current = {
      map: drawingIntegrityPartition.map,
      duplicateGroups: identityPartition.duplicateGroups,
      duplicateDependentRoutes: identityPartition.dependentRoutes,
      routeReferenceQuarantine: routeReferencePartition.quarantinedRoutes,
      rainContingencyQuarantine: rainContingencyPartition.quarantinedContingencies,
      drawingIntegrityQuarantine: drawingIntegrityPartition.quarantinedDrawings,
    };
  }
  const initialRecoveryPartition = initialRecoveryPartitionRef.current;
  const [map, setMap] = useState<VenueMapConfig>(initialRecoveryPartition.map);
  const [duplicateIdentityGroups, setDuplicateIdentityGroups] = useState<
    VenueMapDuplicateIdentityGroup[]
  >(initialRecoveryPartition.duplicateGroups);
  const [duplicateDependentRoutes, setDuplicateDependentRoutes] = useState<VenueMapRoute[]>(
    initialRecoveryPartition.duplicateDependentRoutes,
  );
  const [routeReferenceQuarantine, setRouteReferenceQuarantine] = useState<VenueMapRoute[]>(
    initialRecoveryPartition.routeReferenceQuarantine,
  );
  const [rainContingencyQuarantine, setRainContingencyQuarantine] = useState<
    RainContingency[]
  >(initialRecoveryPartition.rainContingencyQuarantine);
  const [drawingIntegrityQuarantine, setDrawingIntegrityQuarantine] = useState<
    DrawingObject[]
  >(initialRecoveryPartition.drawingIntegrityQuarantine);
  const [structuralRecoveryArtifacts, setStructuralRecoveryArtifacts] = useState<
    VenueMapStructuralRecoveryArtifact[]
  >(initialStructuralAnalysis.artifacts);
  const quarantinedMapRecoveryRef = useRef<unknown>(initialStructuralAnalysis.quarantinedMap);
  const quarantinedMapRecoveryRedactedRef = useRef(initialStructuralAnalysis.quarantinedMapRedacted);
  const [routeRecoveryAddPoint, setRouteRecoveryAddPoint] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeKind, setActiveKind] = useState<VenueMapPointKind>('space');
  const [routeName, setRouteName] = useState('');
  const [routePointIds, setRoutePointIds] = useState<string[]>([]);
  const [routeAudience, setRouteAudience] = useState<VenueMapAudience>('public');
  const [routeAccessibility, setRouteAccessibility] = useState<VenueMapRouteAccessibility>('unknown');
  const [routePriority, setRoutePriority] = useState<VenueMapRoutePriority>('standard');
  const [routeNotes, setRouteNotes] = useState('');
  const [routeEventSpaceIds, setRouteEventSpaceIds] = useState<string[]>([]);
  const [renamingRoute, setRenamingRoute] = useState<string | null>(null);
  const [routeRename, setRouteRename] = useState('');
  const [routeEditAudience, setRouteEditAudience] = useState<VenueMapAudience>('public');
  const [routeEditAccessibility, setRouteEditAccessibility] = useState<VenueMapRouteAccessibility>('unknown');
  const [routeEditPriority, setRouteEditPriority] = useState<VenueMapRoutePriority>('standard');
  const [routeEditNotes, setRouteEditNotes] = useState('');
  const [routeEditEventSpaceIds, setRouteEditEventSpaceIds] = useState<string[]>([]);
  const [routeEditPointIds, setRouteEditPointIds] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [sizeW, setSizeW] = useState(String(recoverySourceMap.width || 100));
  const [sizeH, setSizeH] = useState(String(recoverySourceMap.height || 80));
  const [undoStack, setUndoStack] = useState<VenueMapConfig[]>([]);
  const [redoStack, setRedoStack] = useState<VenueMapConfig[]>([]);
  const [previewAudience, setPreviewAudience] = useState<VenueMapViewer | null>(null);
  const [previewVenueId, setPreviewVenueId] = useState('');
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [confirmClearZones, setConfirmClearZones] = useState(false);
  const [confirmResetMalformedMap, setConfirmResetMalformedMap] = useState(false);
  const [complexityRecoveryDownloaded, setComplexityRecoveryDownloaded] = useState(false);
  const [bgUrlInput, setBgUrlInput] = useState(recoverySourceMap.backgroundImageUrl || '');
  const [baseMapUploading, setBaseMapUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const savedMapRef = useRef(JSON.stringify(recoverySourceMap));
  // Deliberately retain the revision from this editor instance. A realtime pull
  // may update the prop while this draft remains open; adopting that newer
  // revision would let a stale draft silently pass the server CAS.
  const baseUpdatedAtRef = useRef<string | null | undefined>(baseUpdatedAt);
  // Async image uploads must merge onto the newest in-memory draft rather than
  // the render snapshot from which the upload began. Keep this ref synchronized
  // at every state transition so edits made while I/O is pending cannot be lost.
  const mapRef = useRef(initialRecoveryPartition.map);
  const mountedRef = useRef(true);
  const pointDraftBaselineRef = useRef<VenueMapPoint | null>(null);
  const pointDraftBaselineUpdatedAtRef = useRef(recoverySourceMap.updatedAt);
  const newPointDraftRef = useRef(false);
  const cloudMode = getPlatformProvider() === 'supabase';
  const unmanagedCloudBaseMap = cloudMode
    && Boolean(map.backgroundImageUrl)
    && (!organizationId || !isManagedVenueMapImageRef(map.backgroundImageUrl, organizationId));

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  const processBaseMapFile = async (file: File) => {
    const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
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
      if (cloudMode && !isManagedVenueMapImageRef(imageRef, organizationId)) {
        throw new Error('The uploaded image was not stored in this venue’s private map folder.');
      }
      if (!mountedRef.current) return;
      const latestMap = mapRef.current;
      pushUndo(latestMap);
      update(updateMapBackground(
        latestMap,
        imageRef,
        latestMap.backgroundOpacity ?? 0.85,
      ));
      setBgUrlInput(imageRef);
      showToast('Base map uploaded. Save the venue map to publish it.', 'success');
    } catch (error) {
      if (mountedRef.current) {
        showToast(describeUnknownError(error, 'Could not upload the base map. No map changes were made.'), 'warning');
      }
    } finally {
      if (mountedRef.current) setBaseMapUploading(false);
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
  const selectedSpaceLinkIssue = selected
    ? venueMapSpacePointLinkIssue(selected, venues)
    : null;
  const routeBeingEdited = renamingRoute
    ? (map.routes || []).find((route) => route.id === renamingRoute)
    : undefined;
  const sizeDraftValid = (() => {
    const width = Number(sizeW);
    const height = Number(sizeH);
    return sizeW.trim().length > 0
      && sizeH.trim().length > 0
      && Number.isFinite(width)
      && Number.isFinite(height)
      && width >= VENUE_MAP_FRAME_MIN
      && width <= VENUE_MAP_FRAME_MAX
      && height >= VENUE_MAP_FRAME_MIN
      && height <= VENUE_MAP_FRAME_MAX;
  })();
  const sizeDraftDirty = (() => {
    const width = Number(sizeW);
    const height = Number(sizeH);
    return !sizeW.trim()
      || !sizeH.trim()
      || !Number.isFinite(width)
      || !Number.isFinite(height)
      || width !== map.width
      || height !== map.height;
  })();
  const backgroundUrlDraftDirty = bgUrlInput.trim() !== (map.backgroundImageUrl || '');
  const newRouteDraftDirty = routeName.trim().length > 0
    || routePointIds.length > 0
    || routeAudience !== 'public'
    || routeAccessibility !== 'unknown'
    || routePriority !== 'standard'
    || routeNotes.trim().length > 0
    || routeEventSpaceIds.length > 0;
  const routeEditDraftDirty = Boolean(renamingRoute && (
    !routeBeingEdited
    || routeRename !== routeBeingEdited.name
    || routeEditAudience !== (routeBeingEdited.audience || 'public')
    || routeEditAccessibility !== (routeBeingEdited.accessibility || 'unknown')
    || routeEditPriority !== (routeBeingEdited.priority || 'standard')
    || routeEditNotes !== (routeBeingEdited.notes || '')
    || JSON.stringify(routeEditEventSpaceIds) !== JSON.stringify(routeBeingEdited.eventSpaceIds || [])
    || JSON.stringify(routeEditPointIds) !== JSON.stringify(routeBeingEdited.pointIds)
  ));
  const stagedDraftDirty = editing
    || sizeDraftDirty
    || backgroundUrlDraftDirty
    || newRouteDraftDirty
    || routeEditDraftDirty;
  const stagedDraftDirtyRef = useRef(stagedDraftDirty);
  stagedDraftDirtyRef.current = stagedDraftDirty;

  const update = (next: VenueMapConfig) => {
    mapRef.current = next;
    setMap(next);
    setDirty(JSON.stringify(next) !== savedMapRef.current);
  };

  const updateStructuralRecoveryCandidate = (
    key: string,
    patch: Record<string, unknown>,
  ) => {
    setStructuralRecoveryArtifacts((artifacts) => artifacts.map((artifact) =>
      artifact.key === key
        ? {
            ...artifact,
            candidate: { ...artifact.candidate, ...patch },
          } as VenueMapStructuralRecoveryArtifact
        : artifact,
    ));
    setDirty(true);
  };

  const usedStructuralFamilyIds = (
    family: VenueMapStructuralRecoveryArtifact['family'],
  ): Set<string> => new Set([
    ...(family === 'map'
      ? []
      : family === 'point'
        ? map.points.map((point) => point.id)
      : family === 'route'
        ? (map.routes || []).map((route) => route.id)
        : family === 'drawing'
          ? (map.drawings || []).map((drawing) => drawing.id)
          : (map.rainContingencies || []).map((contingency) => contingency.id)),
    ...structuralRecoveryArtifacts
      .filter((artifact) => artifact.family === family)
      .flatMap((artifact) => typeof artifact.candidate.id === 'string'
        ? [artifact.candidate.id.trim()]
        : []),
  ]);

  const generateStructuralRecoveryId = (artifact: VenueMapStructuralRecoveryArtifact) => {
    const usedIds = usedStructuralFamilyIds(artifact.family);
    const base = artifact.family === 'rainContingency'
      ? 'rain-plan'
      : artifact.family === 'drawing'
        ? 'map-shape'
        : artifact.family === 'route' ? 'walkway' : 'map-point';
    updateStructuralRecoveryCandidate(artifact.key, {
      id: recoveredIdentityId(base, usedIds),
    });
  };

  const removeStructuralRecoveryArtifact = (key: string) => {
    setStructuralRecoveryArtifacts((artifacts) => artifacts.filter((artifact) => artifact.key !== key));
    setUndoStack([]);
    setRedoStack([]);
    update({ ...map, updatedAt: new Date().toISOString() });
    showToast('Malformed saved occurrence explicitly removed from the working draft.', 'info');
  };

  const acceptRecoveredMapFrame = (key: string) => {
    if (
      !Number.isFinite(map.width)
      || !Number.isFinite(map.height)
      || map.width < VENUE_MAP_FRAME_MIN
      || map.width > VENUE_MAP_FRAME_MAX
      || map.height < VENUE_MAP_FRAME_MIN
      || map.height > VENUE_MAP_FRAME_MAX
    ) {
      showToast(
        `Set both map dimensions from ${VENUE_MAP_FRAME_MIN} to ${VENUE_MAP_FRAME_MAX} before accepting this frame.`,
        'warning',
      );
      return;
    }
    setStructuralRecoveryArtifacts((artifacts) =>
      artifacts.filter((artifact) => artifact.key !== key),
    );
    setUndoStack([]);
    setRedoStack([]);
    update({ ...map, updatedAt: new Date().toISOString() });
    showToast(
      `Accepted the ${map.width} × ${map.height} map frame. Save and publish to share it.`,
      'success',
    );
  };

  const downloadComplexityRecovery = () => {
    const quarantinedMap = quarantinedMapRecoveryRef.current;
    if (quarantinedMap === undefined) {
      showToast('The original oversized map is not available in this session. Reload it from the server before resetting.', 'warning');
      return;
    }
    try {
      const content = JSON.stringify(quarantinedMap, null, 2);
      const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `venue-map-recovery${quarantinedMapRecoveryRedactedRef.current ? '-redacted' : ''}-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setComplexityRecoveryDownloaded(true);
      showToast(
        quarantinedMapRecoveryRedactedRef.current
          ? 'Downloaded the secret-redacted oversized Venue Map recovery file.'
          : 'Downloaded the original oversized Venue Map recovery file.',
        'success',
      );
    } catch (error) {
      showToast(describeUnknownError(error, 'The oversized Venue Map recovery file could not be downloaded.'), 'warning');
    }
  };

  const resetMalformedVenueMap = () => {
    const next = emptyVenueMapConfig();
    quarantinedMapRecoveryRef.current = undefined;
    quarantinedMapRecoveryRedactedRef.current = false;
    setComplexityRecoveryDownloaded(false);
    setStructuralRecoveryArtifacts([]);
    setDuplicateIdentityGroups([]);
    setDuplicateDependentRoutes([]);
    setRouteReferenceQuarantine([]);
    setRainContingencyQuarantine([]);
    setDrawingIntegrityQuarantine([]);
    setRouteRecoveryAddPoint({});
    setSelectedId(null);
    setSelectedDrawingId(null);
    setEditing(false);
    setRenamingRoute(null);
    setRouteName('');
    setRoutePointIds([]);
    setRouteAudience('public');
    setRouteAccessibility('unknown');
    setRoutePriority('standard');
    setRouteNotes('');
    setRouteEventSpaceIds([]);
    setSizeW(String(next.width));
    setSizeH(String(next.height));
    setBgUrlInput('');
    setPreviewAudience(null);
    setUndoStack([]);
    setRedoStack([]);
    update(next);
    setConfirmResetMalformedMap(false);
    showToast('Started a new empty Venue Map. Save and publish to replace the recovered map.', 'info');
  };

  const reconstructStructuralRecoveryArtifact = (
    artifact: VenueMapStructuralRecoveryArtifact,
  ) => {
    if (artifact.collectionMalformed || artifact.family === 'map') return;
    const id = typeof artifact.candidate.id === 'string'
      ? artifact.candidate.id.trim()
      : '';
    if (!id || id.length > 200) {
      showToast('Enter or generate a valid ID before reconstructing this occurrence.', 'warning');
      return;
    }
    const canonicalIdUsed = artifact.family === 'point'
      ? map.points.some((point) => point.id === id)
      : artifact.family === 'route'
        ? (map.routes || []).some((route) => route.id === id)
        : artifact.family === 'drawing'
          ? (map.drawings || []).some((drawing) => drawing.id === id)
          : (map.rainContingencies || []).some((contingency) => contingency.id === id);
    const recoveryIdUsed = structuralRecoveryArtifacts.some((candidate) =>
      candidate.key !== artifact.key
        && candidate.family === artifact.family
        && candidate.candidate.id?.trim() === id,
    );
    if (canonicalIdUsed || recoveryIdUsed) {
      showToast(`ID “${id}” is already used by another ${structuralRecoveryFamilyLabel(artifact.family)}.`, 'warning');
      return;
    }

    let candidateMap = { ...map };
    if (artifact.family === 'point') {
      const candidate = artifact.candidate;
      if (!candidate.kind || !KINDS.includes(candidate.kind)) {
        showToast('Choose a supported map-point type before reconstruction.', 'warning');
        return;
      }
      const pointX = Number.isFinite(candidate.x) ? candidate.x! : map.width / 2;
      const pointY = Number.isFinite(candidate.y) ? candidate.y! : map.height / 2;
      const coordinateIssue = venueMapPointCoordinateIssue(
        { x: pointX, y: pointY },
        map,
      );
      if (coordinateIssue) {
        showToast(`Choose a point position inside the current map frame: ${coordinateIssue}`, 'warning');
        return;
      }
      const point: VenueMapPoint = {
        id,
        label: candidate.label?.trim() || 'Recovered map point',
        description: candidate.description,
        x: pointX,
        y: pointY,
        kind: candidate.kind,
        audience: candidate.audience || 'staff',
        eventSpaceIds: candidate.eventSpaceIds,
        venueId: candidate.venueId,
        lat: candidate.lat,
        lng: candidate.lng,
      };
      candidateMap = { ...candidateMap, points: [...candidateMap.points, point] };
    } else if (artifact.family === 'route') {
      const candidate = artifact.candidate;
      const route: VenueMapRoute = {
        id,
        name: candidate.name?.trim() || 'Recovered walkway',
        pointIds: Array.isArray(candidate.pointIds) ? candidate.pointIds : [],
        audience: candidate.audience || 'staff',
        eventSpaceIds: candidate.eventSpaceIds,
        accessibility: candidate.accessibility || 'unknown',
        priority: candidate.priority || 'standard',
        notes: candidate.notes,
      };
      if (
        venueMapRoutePriorityIssue(route)
        || route.pointIds.length < 2
        || venueMapRouteReferenceIssues(route, candidateMap.points).length > 0
      ) {
        setRouteReferenceQuarantine((routes) => [...routes, route]);
      } else {
        candidateMap = { ...candidateMap, routes: [...(candidateMap.routes || []), route] };
      }
    } else if (artifact.family === 'drawing') {
      const candidate = artifact.candidate;
      if (!candidate.type || !['zone', 'rectangle', 'circle', 'line'].includes(candidate.type)) {
        showToast('Choose a supported shape type before reconstruction.', 'warning');
        return;
      }
      const drawing = {
        ...candidate,
        id,
        type: candidate.type,
        x: Number.isFinite(candidate.x) ? candidate.x! : map.width / 2,
        y: Number.isFinite(candidate.y) ? candidate.y! : map.height / 2,
        audience: candidate.audience || 'staff',
      } as DrawingObject;
      const drawingPartition = partitionVenueMapDrawingIntegrity({
        ...candidateMap,
        drawings: [...(candidateMap.drawings || []), drawing],
      });
      candidateMap = drawingPartition.map;
      if (drawingPartition.quarantinedDrawings.length > 0) {
        setDrawingIntegrityQuarantine((drawings) => [
          ...drawings,
          ...drawingPartition.quarantinedDrawings,
        ]);
      }
    } else {
      const candidate = artifact.candidate;
      const contingency = {
        id,
        outdoorVenueId: candidate.outdoorVenueId?.trim() || '',
        indoorVenueId: candidate.indoorVenueId?.trim() || '',
        note: candidate.note,
      };
      const issue = rainContingencyValidationIssue(contingency, venues);
      if (issue) {
        showToast(`Repair the rain plan before reconstruction: ${issue}`, 'warning');
        return;
      }
      if ((candidateMap.rainContingencies || []).some((existing) =>
        existing.outdoorVenueId === contingency.outdoorVenueId)) {
        showToast('That outdoor source already has a rain plan.', 'warning');
        return;
      }
      candidateMap = {
        ...candidateMap,
        rainContingencies: [...(candidateMap.rainContingencies || []), contingency],
      };
    }

    const complexityIssues = venueMapComplexityIssues(candidateMap);
    if (complexityIssues.length > 0) {
      showToast(`This recovery would exceed the Venue Map budget. ${complexityIssues[0]}`, 'warning');
      return;
    }
    setStructuralRecoveryArtifacts((artifacts) =>
      artifacts.filter((candidate) => candidate.key !== artifact.key),
    );
    setUndoStack([]);
    setRedoStack([]);
    update({ ...candidateMap, updatedAt: new Date().toISOString() });
    showToast(
      `Recovered ${structuralRecoveryFamilyLabel(artifact.family)} added to the working draft.`,
      'success',
    );
  };

  const settleRainContingencyRecovery = (
    pending: RainContingency[],
    message: string,
  ) => {
    const partition = partitionVenueMapRainContingencyCollisions({
      ...map,
      rainContingencies: [...(map.rainContingencies || []), ...pending],
    });
    const nextMap = { ...partition.map, updatedAt: new Date().toISOString() };
    // Map-only history cannot reconstruct quarantined plans. Recovery decisions
    // therefore establish a new explicit baseline, as duplicate-object recovery does.
    setUndoStack([]);
    setRedoStack([]);
    setRainContingencyQuarantine(partition.quarantinedContingencies);
    update(nextMap);
    showToast(message, 'success');
  };

  const updateQuarantinedRainContingency = (
    occurrenceIndex: number,
    patch: Partial<RainContingency>,
  ) => {
    const next = rainContingencyQuarantine.map((contingency, index) =>
      index === occurrenceIndex ? { ...contingency, ...patch } : contingency,
    );
    settleRainContingencyRecovery(next, 'Rain-plan recovery updated.');
  };

  const reidentifyQuarantinedRainContingency = (occurrenceIndex: number) => {
    const selected = rainContingencyQuarantine[occurrenceIndex];
    if (!selected) return;
    const usedIds = new Set([
      ...(map.rainContingencies || []).map((contingency) => contingency.id),
      ...rainContingencyQuarantine.map((contingency) => contingency.id),
    ]);
    updateQuarantinedRainContingency(occurrenceIndex, {
      id: recoveredIdentityId(selected.id, usedIds),
    });
  };

  const removeQuarantinedRainContingency = (occurrenceIndex: number) => {
    settleRainContingencyRecovery(
      rainContingencyQuarantine.filter((_, index) => index !== occurrenceIndex),
      'Quarantined rain plan removed from the working draft.',
    );
  };

  const keepOnlyQuarantinedRainContingency = (occurrenceIndex: number) => {
    const selected = rainContingencyQuarantine[occurrenceIndex];
    if (!selected) return;
    const component = new Set([occurrenceIndex]);
    const queue = [occurrenceIndex];
    while (queue.length > 0) {
      const current = rainContingencyQuarantine[queue.shift()!];
      rainContingencyQuarantine.forEach((candidate, index) => {
        if (
          !component.has(index)
          && (
            candidate.id.trim() === current.id.trim()
            || candidate.outdoorVenueId.trim() === current.outdoorVenueId.trim()
          )
        ) {
          component.add(index);
          queue.push(index);
        }
      });
    }
    settleRainContingencyRecovery(
      [
        ...rainContingencyQuarantine.filter((_, index) => !component.has(index)),
        selected,
      ],
      'Selected rain plan kept; its conflicting plans were removed from the working draft.',
    );
  };

  const settleDrawingIntegrityRecovery = (
    pending: DrawingObject[],
    message: string,
  ) => {
    const partition = partitionVenueMapDrawingIntegrity({
      ...map,
      drawings: [...(map.drawings || []), ...pending],
    });
    setUndoStack([]);
    setRedoStack([]);
    setDrawingIntegrityQuarantine(partition.quarantinedDrawings);
    update({ ...partition.map, updatedAt: new Date().toISOString() });
    showToast(message, 'success');
  };

  const repairedDrawingGeometry = (drawing: DrawingObject): DrawingObject => {
    if (drawing.type === 'zone' || drawing.type === 'rectangle') {
      return constrainMapDrawing({
        ...drawing,
        width: Number.isFinite(drawing.width) && drawing.width! > 0 ? drawing.width : Math.min(20, map.width),
        height: Number.isFinite(drawing.height) && drawing.height! > 0 ? drawing.height : Math.min(15, map.height),
      }, map.width, map.height);
    }
    if (drawing.type === 'circle') {
      return constrainMapDrawing({
        ...drawing,
        radius: Number.isFinite(drawing.radius) && drawing.radius! > 0
          ? drawing.radius
          : Math.min(10, map.width / 2, map.height / 2),
      }, map.width, map.height);
    }
    const validPoints = (drawing.points || []).filter((point) =>
      Number.isFinite(point.x) && Number.isFinite(point.y),
    );
    const first = validPoints[0] || {
      x: Number.isFinite(drawing.x) ? drawing.x : 0,
      y: Number.isFinite(drawing.y) ? drawing.y : 0,
    };
    const distinct = validPoints.find((point) => point.x !== first.x || point.y !== first.y);
    const second = distinct || {
      x: first.x < map.width ? Math.min(map.width, first.x + 10) : Math.max(0, first.x - 10),
      y: first.y,
    };
    return constrainMapDrawing({
      ...drawing,
      points: [first, second],
    }, map.width, map.height);
  };

  const repairQuarantinedDrawing = (occurrenceIndex: number) => {
    const selectedDrawing = drawingIntegrityQuarantine[occurrenceIndex];
    if (!selectedDrawing || !['zone', 'rectangle', 'circle', 'line'].includes(selectedDrawing.type)) return;
    settleDrawingIntegrityRecovery(
      drawingIntegrityQuarantine.map((drawing, index) =>
        index === occurrenceIndex ? repairedDrawingGeometry(drawing) : drawing,
      ),
      'Shape geometry rebuilt with safe defaults. Review it before publication.',
    );
  };

  const convertQuarantinedDrawingToZone = (occurrenceIndex: number) => {
    const selectedDrawing = drawingIntegrityQuarantine[occurrenceIndex];
    if (!selectedDrawing) return;
    settleDrawingIntegrityRecovery(
      drawingIntegrityQuarantine.map((drawing, index) => index === occurrenceIndex
        ? constrainMapDrawing({
            ...drawing,
            type: 'zone',
            width: Number.isFinite(drawing.width) && drawing.width! > 0
              ? drawing.width
              : Math.min(20, map.width),
            height: Number.isFinite(drawing.height) && drawing.height! > 0
              ? drawing.height
              : Math.min(15, map.height),
            points: undefined,
            radius: undefined,
          }, map.width, map.height)
        : drawing),
      'Unsupported shape explicitly converted to an editable rectangular zone.',
    );
  };

  const removeQuarantinedDrawing = (occurrenceIndex: number) => {
    settleDrawingIntegrityRecovery(
      drawingIntegrityQuarantine.filter((_, index) => index !== occurrenceIndex),
      'Quarantined shape removed from the working draft.',
    );
  };

  const recoverDuplicateIdentity = (
    group: VenueMapDuplicateIdentityGroup,
    occurrenceIndex: number,
    action: 'keep-and-reid' | 'reid' | 'remove',
  ) => {
    const currentGroup = duplicateIdentityGroups.find((candidate) =>
      candidate.family === group.family && candidate.id === group.id,
    );
    const selectedObject = currentGroup?.objects[occurrenceIndex];
    if (!currentGroup || !selectedObject) return;

    const usedIds = new Set<string>([
      ...(group.family === 'point'
        ? map.points.map((point) => point.id)
        : group.family === 'route'
          ? [...(map.routes || []), ...duplicateDependentRoutes].map((route) => route.id)
          : (map.drawings || []).map((drawing) => drawing.id)),
      ...duplicateIdentityGroups
        .filter((candidate) => candidate.family === group.family)
        .flatMap((candidate) => candidate.objects.map((object) => object.id)),
    ]);
    const withFreshId = (object: VenueMapIdentityObject): VenueMapIdentityObject => {
      const id = recoveredIdentityId(group.id, usedIds);
      usedIds.add(id);
      return { ...object, id };
    };

    let recoveredObjects: VenueMapIdentityObject[] = [];
    let nextObjects = currentGroup.objects.filter((_, index) => index !== occurrenceIndex);
    if (action === 'keep-and-reid') {
      recoveredObjects = [
        selectedObject,
        ...nextObjects.map((object) => withFreshId(object)),
      ];
      nextObjects = [];
    } else if (action === 'reid') {
      recoveredObjects = [withFreshId(selectedObject)];
    }
    if (nextObjects.length === 1) {
      recoveredObjects.push(nextObjects[0]);
      nextObjects = [];
    }

    const nextGroups = nextObjects.length > 1
      ? duplicateIdentityGroups.map((candidate) =>
          candidate.family === group.family && candidate.id === group.id
            ? { ...candidate, objects: nextObjects }
            : candidate,
        )
      : duplicateIdentityGroups.filter((candidate) =>
          candidate.family !== group.family || candidate.id !== group.id,
        );
    const unresolvedPointIds = new Set(
      nextGroups
        .filter((candidate) => candidate.family === 'point')
        .map((candidate) => candidate.id),
    );
    let candidateMap = { ...map };
    let pendingRoutes = [...duplicateDependentRoutes];

    if (group.family === 'point') {
      candidateMap = {
        ...candidateMap,
        points: [...candidateMap.points, ...(recoveredObjects as VenueMapPoint[])],
      };
    } else if (group.family === 'drawing') {
      candidateMap = {
        ...candidateMap,
        drawings: [...(candidateMap.drawings || []), ...(recoveredObjects as DrawingObject[])],
      };
    } else {
      // Every recovered route passes through the same reference-integrity gate;
      // resolving its duplicated ID must not accidentally release stale points.
      pendingRoutes.push(...recoveredObjects as VenueMapRoute[]);
    }

    const routesReadyForReferenceCheck = pendingRoutes.filter((route) =>
      route.pointIds.every((pointId) => !unresolvedPointIds.has(pointId)),
    );
    const routesNeedingReferenceRecovery = routesReadyForReferenceCheck.filter((route) =>
      venueMapRoutePriorityIssue(route) !== null
        || route.pointIds.length < 2
        || venueMapRouteReferenceIssues(route, candidateMap.points).length > 0,
    );
    const readyRoutes = routesReadyForReferenceCheck.filter((route) =>
      !routesNeedingReferenceRecovery.includes(route),
    );
    if (readyRoutes.length > 0) {
      candidateMap = {
        ...candidateMap,
        routes: [...(candidateMap.routes || []), ...readyRoutes],
      };
    }
    pendingRoutes = pendingRoutes.filter((route) =>
      !routesReadyForReferenceCheck.includes(route),
    );
    const drawingPartition = partitionVenueMapDrawingIntegrity(candidateMap);
    candidateMap = { ...drawingPartition.map, updatedAt: new Date().toISOString() };

    // Map-only history snapshots cannot safely reconstruct quarantine state.
    // Clear prior history at each explicit recovery decision so Undo cannot
    // silently drop a recovered occurrence after the quarantine is resolved.
    setUndoStack([]);
    setRedoStack([]);
    setDuplicateIdentityGroups(nextGroups);
    setDuplicateDependentRoutes(pendingRoutes);
    if (drawingPartition.quarantinedDrawings.length > 0) {
      setDrawingIntegrityQuarantine((previous) => [
        ...previous,
        ...drawingPartition.quarantinedDrawings.filter((drawing) =>
          !previous.some((candidate) => candidate.id === drawing.id),
        ),
      ]);
    }
    if (routesNeedingReferenceRecovery.length > 0) {
      setRouteReferenceQuarantine((previous) => [
        ...previous,
        ...routesNeedingReferenceRecovery.filter((route) =>
          !previous.some((candidate) => candidate.id === route.id),
        ),
      ]);
    }
    update(candidateMap);
    showToast(
      action === 'remove'
        ? 'Duplicate occurrence removed from the working draft.'
        : 'Duplicate recovery IDs applied to the working draft.',
      'info',
    );
  };

  const updateQuarantinedRoutePoints = (routeId: string, pointIds: string[]) => {
    setRouteReferenceQuarantine((routes) => routes.map((route) =>
      route.id === routeId ? { ...route, pointIds } : route,
    ));
    setDirty(true);
  };

  const updateQuarantinedRoutePriority = (
    routeId: string,
    priority: VenueMapRoutePriority,
  ) => {
    setRouteReferenceQuarantine((routes) => routes.map((route) =>
      route.id === routeId ? { ...route, priority } : route,
    ));
    setDirty(true);
  };

  const applyQuarantinedRoute = (routeId: string) => {
    const route = routeReferenceQuarantine.find((candidate) => candidate.id === routeId);
    if (
      !route
      || venueMapRoutePriorityIssue(route)
      || route.pointIds.length < 2
      || venueMapRouteReferenceIssues(route, map.points).length > 0
    ) {
      showToast('Choose a valid routing priority and repair every unavailable walkway point before applying it.', 'warning');
      return;
    }
    setUndoStack([]);
    setRedoStack([]);
    setRouteReferenceQuarantine((routes) => routes.filter((candidate) => candidate.id !== routeId));
    setRouteRecoveryAddPoint((current) => {
      const next = { ...current };
      delete next[routeId];
      return next;
    });
    update({
      ...map,
      routes: [...(map.routes || []), route],
      updatedAt: new Date().toISOString(),
    });
    showToast(`Walkway “${route.name}” restored to the working draft.`, 'success');
  };

  const removeQuarantinedRoute = (routeId: string) => {
    const route = routeReferenceQuarantine.find((candidate) => candidate.id === routeId);
    if (!route) return;
    setUndoStack([]);
    setRedoStack([]);
    setRouteReferenceQuarantine((routes) => routes.filter((candidate) => candidate.id !== routeId));
    setRouteRecoveryAddPoint((current) => {
      const next = { ...current };
      delete next[routeId];
      return next;
    });
    update({ ...map, updatedAt: new Date().toISOString() });
    showToast(`Walkway “${route.name}” removed from the working draft.`, 'info');
  };

  const persist = async (next: VenueMapConfig): Promise<VenueMapDesignerSaveResult> => {
    setSaving(true);
    try {
      const submittedDraft = JSON.stringify(next);
      const canonical = normalizeVenueMapConfig(next);
      if (!canonical) throw new Error('Venue map data is invalid and was not saved.');
      const canonicalSnapshot = JSON.stringify(canonical);
      // Local and cloud persistence must receive the exact same normalized map;
      // otherwise one successful action can create different server/cache truth.
      const result = await onSave(canonical, baseUpdatedAtRef.current);
      const outcome = result || { status: 'saved' as const };
      if (!mountedRef.current) return outcome;
      if (outcome.status === 'conflict' || outcome.status === 'error') {
        // The in-memory map remains the admin's draft. Do not advance its CAS
        // base or mark it clean until they explicitly reload/overwrite.
        if (outcome.status === 'conflict') {
          // The shell initially knows only the submitted snapshot. A request may
          // have been pending while more edits landed in this mounted editor;
          // explicit overwrite must use what the admin can currently see.
          onConflictDraftChange?.(
            normalizeVenueMapConfig(mapRef.current) || mapRef.current,
            stagedDraftDirtyRef.current,
          );
        }
        setDirty(true);
        return outcome;
      }
      baseUpdatedAtRef.current = outcome.updatedAt ?? baseUpdatedAtRef.current;
      savedMapRef.current = canonicalSnapshot;
      // A cloud request can finish after the admin has continued editing. The
      // accepted canonical snapshot is now the CAS baseline, but it must not
      // replace newer mounted-editor state or falsely mark later changes saved.
      if (JSON.stringify(mapRef.current) === submittedDraft) {
        mapRef.current = canonical;
        setMap(canonical);
        setDirty(false);
      } else {
        setDirty(true);
      }
      return outcome;
    } catch (error) {
      if (mountedRef.current) {
        setDirty(true);
        showToast(describeUnknownError(error, 'The venue map could not be saved.'), 'warning');
      }
      return { status: 'error' };
    } finally {
      if (mountedRef.current) setSaving(false);
    }
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
  useEffect(() => {
    onDirtyChange?.(dirty || stagedDraftDirty || baseMapUploading || saving);
  }, [baseMapUploading, dirty, onDirtyChange, saving, stagedDraftDirty]);

  // ── Undo / redo ──────────────────────────────────────────────────────────
  const pushUndo = (m: VenueMapConfig) => {
    setUndoStack((prev) => [...prev, m].slice(-60));
    setRedoStack([]);
    pendingDragRef.current = null;
  };
  const restoreHistorySnapshot = (next: VenueMapConfig) => {
    mapRef.current = next;
    if (!sizeDraftDirty) { setSizeW(String(next.width)); setSizeH(String(next.height)); }
    if (!backgroundUrlDraftDirty) setBgUrlInput(next.backgroundImageUrl || '');
    setMap(next);
    setDirty(JSON.stringify(next) !== savedMapRef.current);

    // History restores map JSON, so reconcile every transient editor that can
    // otherwise keep referring to an object the restored snapshot no longer
    // contains. A surviving point remains selected but becomes a stable history
    // baseline; subsequent edits start a fresh Apply/Cancel and undo session.
    const restoredPoint = selectedId
      ? next.points.find((point) => point.id === selectedId)
      : undefined;
    if (!restoredPoint) setSelectedId(null);
    pointDraftBaselineRef.current = restoredPoint ? { ...restoredPoint } : null;
    pointDraftBaselineUpdatedAtRef.current = next.updatedAt;
    newPointDraftRef.current = false;
    setEditing(false);

    if (selectedDrawingId && !(next.drawings || []).some((drawing) => drawing.id === selectedDrawingId)) {
      setSelectedDrawingId(null);
    }
    if (renamingRoute && !(next.routes || []).some((route) => route.id === renamingRoute)) {
      setRenamingRoute(null);
      setRouteRename('');
      setRouteEditAudience('public');
      setRouteEditAccessibility('unknown');
      setRouteEditPriority('standard');
      setRouteEditNotes('');
      setRouteEditEventSpaceIds([]);
      setRouteEditPointIds([]);
    }

    pendingDragRef.current = null;
    fieldUndoCapturedRef.current = false;
    drawingUndoCapturedRef.current = false;
  };
  const undo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((u) => u.slice(0, -1));
    setRedoStack((r) => [...r, map]);
    restoreHistorySnapshot(prev);
  };
  const redo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((r) => r.slice(0, -1));
    setUndoStack((u) => [...u, map]);
    restoreHistorySnapshot(next);
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
      if (confirmClearZones) return;
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

  const venueIdCounts = new Map<string, number>();
  for (const venue of venues) {
    venueIdCounts.set(venue.id, (venueIdCounts.get(venue.id) || 0) + 1);
  }
  const uniquelyLinkableVenues = venues.filter((venue) => venueIdCounts.get(venue.id) === 1);

  // Venues (event spaces + lodging) that have no pin linked to them. Ambiguous
  // catalog identities are excluded from controls until the catalog is repaired.
  const missingVenues = uniquelyLinkableVenues.filter(
    (v) => !map.points.some((p) => p.kind === 'space' && p.venueId === v.id),
  );

  // Rain backups are part of the canonical map and therefore share this
  // editor's single draft, Save action, and CAS conflict flow.
  const outdoorVenues = uniquelyLinkableVenues.filter(isRainContingencySource);
  const indoorVenues = uniquelyLinkableVenues.filter(isRainContingencyBackup);
  const usedOutdoorVenueIds = new Set(
    (map.rainContingencies || []).map((contingency) => contingency.outdoorVenueId),
  );
  const availableOutdoorVenues = outdoorVenues.filter(
    (venue) => !usedOutdoorVenueIds.has(venue.id)
      && indoorVenues.some((backup) => backup.id !== venue.id),
  );
  const invalidRainContingencies = (map.rainContingencies || []).flatMap((contingency) => {
    const issue = rainContingencyValidationIssue(contingency, venues);
    return issue ? [{ contingency, issue }] : [];
  });
  const rainContingencyIssueById = new Map(
    invalidRainContingencies.map(({ contingency, issue }) => [contingency.id, issue]),
  );
  const duplicateRecoveryPending = duplicateIdentityGroups.length > 0
    || duplicateDependentRoutes.length > 0;
  const routeReferenceRecoveryPending = routeReferenceQuarantine.length > 0;
  const rainContingencyCollisionRecoveryPending = rainContingencyQuarantine.length > 0;
  const drawingIntegrityRecoveryPending = drawingIntegrityQuarantine.length > 0;
  const structuralRecoveryPending = structuralRecoveryArtifacts.length > 0;
  const mapFrameRecoveryPending = structuralRecoveryArtifacts.some(
    (artifact) => artifact.family === 'map' && artifact.mapFrameMalformed === true,
  );
  const mapComplexityRecoveryPending = structuralRecoveryArtifacts.some(
    (artifact) => artifact.family === 'map' && artifact.mapComplexityExceeded === true,
  );
  const invalidSpacePointLinks = map.points.flatMap((point) => {
    const issue = venueMapSpacePointLinkIssue(point, venues);
    return issue ? [{ point, issue }] : [];
  });
  const invalidEventScopeObjects = [
    ...map.points.map((point) => ({
      type: 'Point',
      id: point.id,
      label: point.label,
      eventSpaceIds: point.eventSpaceIds,
    })),
    ...(map.routes || []).map((route) => ({
      type: 'Walkway',
      id: route.id,
      label: route.name,
      eventSpaceIds: route.eventSpaceIds,
    })),
    ...(map.drawings || []).map((drawing, index) => ({
      type: 'Shape',
      id: drawing.id,
      label: drawing.text || `Shape ${index + 1}`,
      eventSpaceIds: drawing.eventSpaceIds,
    })),
  ].flatMap((object) => {
    const unavailableIds = unavailableVenueMapEventScopeIds(object.eventSpaceIds, venues);
    return unavailableIds.length ? [{ ...object, unavailableIds }] : [];
  });

  const updateRainContingency = (id: string, patch: Partial<RainContingency>) => {
    pushUndo(map);
    update({
      ...map,
      rainContingencies: (map.rainContingencies || []).map((contingency) =>
        contingency.id === id ? { ...contingency, ...patch } : contingency,
      ),
      updatedAt: new Date().toISOString(),
    });
  };

  const addRainContingency = () => {
    if ((map.rainContingencies || []).length >= VENUE_MAP_MAX_RAIN_CONTINGENCIES) {
      showToast(`A Venue Map can contain at most ${VENUE_MAP_MAX_RAIN_CONTINGENCIES} rain plans.`, 'warning');
      return;
    }
    const outdoorVenue = availableOutdoorVenues[0];
    const indoorVenue = outdoorVenue
      ? indoorVenues.find((candidate) => candidate.id !== outdoorVenue.id)
      : undefined;
    if (!outdoorVenue || !indoorVenue) return;
    pushUndo(map);
    update({
      ...map,
      rainContingencies: [
        ...(map.rainContingencies || []),
        {
          id: `rc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          outdoorVenueId: outdoorVenue.id,
          indoorVenueId: indoorVenue.id,
        },
      ],
      updatedAt: new Date().toISOString(),
    });
    showToast('Rain backup added to this map draft. Save the venue map to publish it.', 'info');
  };

  const removeRainContingency = (id: string) => {
    pushUndo(map);
    update({
      ...map,
      rainContingencies: (map.rainContingencies || []).filter(
        (contingency) => contingency.id !== id,
      ),
      updatedAt: new Date().toISOString(),
    });
    showToast('Rain backup removed from this map draft.', 'info');
  };

  const handlePlace = (kind: VenueMapPointKind, x: number, y: number) => {
    if (map.points.length >= VENUE_MAP_MAX_POINTS) {
      showToast(`A Venue Map can contain at most ${VENUE_MAP_MAX_POINTS} points.`, 'warning');
      return;
    }
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

  const removePointAndQuarantineRoutes = (
    pointId: string,
    options: { captureHistory?: boolean; updatedAt?: string } = {},
  ): number => {
    const removed = removeMapPoint(map, pointId);
    const routePartition = partitionVenueMapRouteReferenceIntegrity(removed);
    if (options.captureHistory && routePartition.quarantinedRoutes.length === 0) {
      pushUndo(map);
    } else if (routePartition.quarantinedRoutes.length > 0) {
      // Map-only history cannot reconstruct quarantine state. Preserve safety by
      // starting a fresh history after a deletion that requires route recovery.
      setUndoStack([]);
      setRedoStack([]);
    }
    if (routePartition.quarantinedRoutes.length > 0) {
      setRouteReferenceQuarantine((previous) => [
        ...previous,
        ...routePartition.quarantinedRoutes.filter((route) =>
          !previous.some((candidate) => candidate.id === route.id),
        ),
      ]);
    }
    update({
      ...routePartition.map,
      updatedAt: options.updatedAt || routePartition.map.updatedAt,
    });
    return routePartition.quarantinedRoutes.length;
  };

  const cancelPointEdit = () => {
    if (!selected) return;
    if (!editing) {
      setSelectedId(null);
      pointDraftBaselineRef.current = null;
      return;
    }
    if (newPointDraftRef.current) {
      removePointAndQuarantineRoutes(selected.id, {
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
    const quarantinedRouteCount = removePointAndQuarantineRoutes(selected.id, {
      captureHistory: true,
    });
    setRoutePointIds((ids) => ids.filter((id) => id !== selected.id));
    setSelectedId(null);
    pointDraftBaselineRef.current = null;
    newPointDraftRef.current = false;
    setEditing(false);
    fieldUndoCapturedRef.current = false;
    showToast(
      quarantinedRouteCount > 0
        ? `Point removed. ${quarantinedRouteCount} affected ${quarantinedRouteCount === 1 ? 'walkway now requires' : 'walkways now require'} explicit repair before publication.`
        : 'Point removed. Save the venue map to publish this change.',
      'info',
    );
  };

  /** Duplicate the selected point at a small offset and select the copy. */
  const duplicateSelected = () => {
    if (!selected) return;
    if (map.points.length >= VENUE_MAP_MAX_POINTS) {
      showToast(`A Venue Map can contain at most ${VENUE_MAP_MAX_POINTS} points.`, 'warning');
      return;
    }
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
    if (map.points.length >= VENUE_MAP_MAX_POINTS) {
      showToast(`A Venue Map can contain at most ${VENUE_MAP_MAX_POINTS} points.`, 'warning');
      return;
    }
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
    if ((map.drawings || []).length >= VENUE_MAP_MAX_DRAWINGS) {
      showToast(`A Venue Map can contain at most ${VENUE_MAP_MAX_DRAWINGS} shapes.`, 'warning');
      return;
    }
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

  const clearAllZones = () => {
    if ((map.drawings || []).length === 0) {
      setConfirmClearZones(false);
      return;
    }
    pushUndo(map);
    update(clearMapDrawings(map));
    setSelectedDrawingId(null);
    drawingUndoCapturedRef.current = false;
    setConfirmClearZones(false);
    showToast('All shapes removed from this draft. Save the venue map to publish this change.', 'info');
  };

  const resetRouteDraft = () => {
    setRouteName('');
    setRoutePointIds([]);
    setRouteAudience('public');
    setRouteAccessibility('unknown');
    setRoutePriority('standard');
    setRouteNotes('');
    setRouteEventSpaceIds([]);
  };

  const commitRoute = () => {
    if (routePointIds.length < 2) {
      showToast('A walkway needs at least 2 current map points.', 'warning');
      return;
    }
    if (routePointIds.length > VENUE_MAP_MAX_ROUTE_POINTS) {
      showToast(`A walkway can contain at most ${VENUE_MAP_MAX_ROUTE_POINTS} ordered points.`, 'warning');
      return;
    }
    if ((map.routes || []).length >= VENUE_MAP_MAX_ROUTES) {
      showToast(`A Venue Map can contain at most ${VENUE_MAP_MAX_ROUTES} walkways.`, 'warning');
      return;
    }
    const next = addMapRoute(map, routeName, routePointIds, {
      audience: routeAudience,
      accessibility: routeAccessibility,
      priority: routePriority,
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
    resetRouteDraft();
    showToast('Walkway added. Save the venue map to publish it.', 'success');
  };

  const startRename = (id: string, current: string) => {
    const route = (map.routes || []).find((item) => item.id === id);
    setRenamingRoute(id);
    setRouteRename(current);
    setRouteEditAudience(route?.audience || 'public');
    setRouteEditAccessibility(route?.accessibility || 'unknown');
    setRouteEditPriority(route?.priority || 'standard');
    setRouteEditNotes(route?.notes || '');
    setRouteEditEventSpaceIds(route?.eventSpaceIds || []);
    setRouteEditPointIds(route?.pointIds || []);
  };
  const commitRename = () => {
    if (renamingRoute && routeEditPointIds.length < 2) {
      showToast('A walkway needs at least 2 current map points.', 'warning');
      return;
    }
    if (renamingRoute && routeEditPointIds.length > VENUE_MAP_MAX_ROUTE_POINTS) {
      showToast(`A walkway can contain at most ${VENUE_MAP_MAX_ROUTE_POINTS} ordered points.`, 'warning');
      return;
    }
    if (renamingRoute) {
      pushUndo(map);
      update(updateMapRoute(map, renamingRoute, {
        name: routeRename,
        audience: routeEditAudience,
        accessibility: routeEditAccessibility,
        priority: routeEditPriority,
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
    setRouteEditPriority('standard');
    setRouteEditNotes('');
    setRouteEditEventSpaceIds([]);
    setRouteEditPointIds([]);
  };

  const publishMap = async () => {
    if (unmanagedCloudBaseMap) {
      showToast('Upload this legacy base image to the venue’s private map storage, or remove it, before publishing.', 'warning');
      return;
    }
    if (mapComplexityRecoveryPending) {
      showToast('Download the original oversized map for recovery, then reset this Venue Map before publishing.', 'warning');
      return;
    }
    if (mapFrameRecoveryPending) {
      showToast('Accept valid map dimensions or reset the Venue Map before publishing.', 'warning');
      return;
    }
    if (structuralRecoveryPending) {
      showToast('Explicitly reconstruct or remove every malformed saved map occurrence before publishing.', 'warning');
      return;
    }
    if (duplicateRecoveryPending) {
      showToast('Resolve every quarantined duplicate identity before publishing the venue map.', 'warning');
      return;
    }
    if (routeReferenceRecoveryPending) {
      showToast('Repair or remove every quarantined walkway before publishing the venue map.', 'warning');
      return;
    }
    if (rainContingencyCollisionRecoveryPending) {
      showToast('Resolve every duplicate or competing rain plan before publishing the venue map.', 'warning');
      return;
    }
    if (drawingIntegrityRecoveryPending) {
      showToast('Repair, convert, or remove every unsupported or malformed map shape before publishing.', 'warning');
      return;
    }
    if (invalidSpacePointLinks.length > 0) {
      showToast('Link, reclassify, or remove every unavailable space pin before publishing the venue map.', 'warning');
      return;
    }
    if (stagedDraftDirty) {
      showToast('Apply or cancel the in-progress point, size, base-map URL, or walkway edits before saving the venue map.', 'warning');
      return;
    }
    if (invalidRainContingencies.length > 0) {
      showToast('Repair or remove every unavailable rain backup before publishing the venue map.', 'warning');
      return;
    }
    if (invalidEventScopeObjects.length > 0) {
      showToast('Remove unavailable event-space scopes before publishing the venue map.', 'warning');
      return;
    }
    const complexityIssues = venueMapComplexityIssues(map);
    if (complexityIssues.length > 0) {
      showToast(`Reduce this map before publishing. ${complexityIssues[0]}`, 'warning');
      return;
    }
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
    const outcome = await persist(map);
    if (outcome.status === 'saved') {
      showToast('Venue map saved and portal snapshots queued for refresh.', 'success');
    } else if (outcome.status === 'conflict') {
      showToast('This draft was not published because the shared map changed elsewhere.', 'warning');
    } else {
      showToast('The shared map could not be saved. Your draft remains open; keep this page open and try again.', 'warning');
    }
  };

  const restrictedLayerCount = [
    ...map.points,
    ...(map.routes || []),
    ...(map.drawings || []),
  ].filter((item) => item.audience && item.audience !== 'public').length;
  const zoneAudienceSummary = MAP_AUDIENCES
    .map((audience) => ({
      audience,
      count: (map.drawings || []).filter(
        (drawing) => (drawing.audience || 'public') === audience,
      ).length,
    }))
    .filter(({ count }) => count > 0)
    .map(({ audience, count }) => `${count} ${mapAudienceLabel(audience).toLowerCase()}`)
    .join(', ');
  const exportHasUnpublishedChanges = dirty || stagedDraftDirty || baseMapUploading || saving;
  const quarantinedRecoveryPending = structuralRecoveryPending
    || duplicateRecoveryPending
    || routeReferenceRecoveryPending
    || rainContingencyCollisionRecoveryPending
    || drawingIntegrityRecoveryPending;
  const exportSourceLabel = mapFrameRecoveryPending
    ? 'Frame recovery map — portals receive no map'
    : quarantinedRecoveryPending
      ? 'Recovery map — quarantined objects omitted'
    : unmanagedCloudBaseMap
      ? 'Admin recovery map — portal publication blocked'
      : exportHasUnpublishedChanges
        ? 'Unpublished working draft'
        : 'Saved canonical map';
  const exportSourceSlug = quarantinedRecoveryPending
    ? 'recovery-not-publishable'
    : unmanagedCloudBaseMap
      ? 'recovery-not-publishable'
      : exportHasUnpublishedChanges
        ? 'unpublished-draft'
        : 'saved-map';
  const exportAudienceLabel = previewAudience === 'guest'
    ? 'Guest portal preview'
    : previewAudience === 'couple'
      ? 'Couple portal preview'
      : 'Staff master — internal venue use';
  const exportAudienceSlug = previewAudience === 'guest'
    ? 'guest-preview'
    : previewAudience === 'couple'
      ? 'couple-preview'
      : 'staff-master';
  const exportButtonAudience = previewAudience === 'guest'
    ? 'Guest preview'
    : previewAudience === 'couple'
      ? 'Couple preview'
      : 'Staff master';

  const exportMap = async (kind: 'png' | 'pdf') => {
    const svg = svgRef.current;
    if (!svg) { showToast('Map is not ready to export yet.', 'warning'); return; }
    const base = (mapTitle || 'venue-map').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'venue-map';
    const filename = `${base}-${exportSourceSlug}-${exportAudienceSlug}`;
    const footerText = `${exportSourceLabel} | ${exportAudienceLabel} | Exported ${new Date().toLocaleDateString()}`;
    try {
      if (map.backgroundImageUrl && !svg.querySelector('image')) {
        throw new Error('The base map is still loading. Wait a moment, then export again.');
      }
      const options = { footerText };
      if (kind === 'png') await downloadLayoutPng(svg, filename, options);
      else await downloadLayoutPdf(svg, filename, options);
      showToast(`${exportSourceLabel} · ${exportAudienceLabel} exported (${kind.toUpperCase()}).`, 'success');
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
            disabled={mapFrameRecoveryPending || mapComplexityRecoveryPending}
            onClick={() => {
              if (previewAudience) setPreviewAudience(null);
              else {
                setPreviewVenueId(venues[0]?.id || '');
                setPreviewAudience('guest');
              }
            }}
            className={`px-3 py-1.5 rounded-lg border text-sm disabled:cursor-not-allowed disabled:opacity-50 ${previewAudience ? 'bg-teal-700 border-teal-700 text-white' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            title={mapComplexityRecoveryPending
              ? 'Audience previews are unavailable until the oversized map is downloaded and reset'
              : mapFrameRecoveryPending
                ? 'Audience previews are unavailable until the map frame is accepted or reset'
                : 'Preview audience-visible map layers'}
          >
            {previewAudience ? '✕ Exit preview' : '👁 Preview audiences'}
          </button>
          <button
            type="button"
            disabled={mapComplexityRecoveryPending}
            onClick={() => void exportMap('png')}
            className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            title={mapComplexityRecoveryPending ? 'Download the original recovery JSON instead' : undefined}
          >
            🖼️ {exportButtonAudience} PNG
          </button>
          <button
            type="button"
            disabled={mapComplexityRecoveryPending}
            onClick={() => void exportMap('pdf')}
            className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            title={mapComplexityRecoveryPending ? 'Download the original recovery JSON instead' : undefined}
          >
            📄 {exportButtonAudience} PDF
          </button>
          <button
            type="button"
            disabled={mapComplexityRecoveryPending}
            onClick={() => window.print()}
            className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 no-print disabled:cursor-not-allowed disabled:opacity-50"
            title={mapComplexityRecoveryPending ? 'Download the original recovery JSON instead' : `Print ${exportAudienceLabel}`}
          >
            🖨️ Print {exportButtonAudience}
          </button>
        </div>
      </div>

      <div
        className={`rounded-lg border px-3 py-2 text-xs ${
          exportSourceSlug !== 'saved-map' || (!previewAudience && restrictedLayerCount > 0)
            ? 'border-amber-300 bg-amber-50 text-amber-950'
            : previewAudience
              ? 'border-teal-300 bg-teal-50 text-teal-900'
              : 'border-gray-200 bg-gray-50 text-gray-700'
        }`}
        role="status"
        aria-live="polite"
      >
        <span className="font-semibold">Export/print source: {exportSourceLabel}. Audience: {exportAudienceLabel}.</span>{' '}
        {exportSourceSlug !== 'saved-map'
          ? 'This output does not represent the map currently available in portals.'
          : previewAudience
            ? 'Files and printouts contain the saved audience projection currently shown below.'
            : restrictedLayerCount > 0
              ? `Includes ${restrictedLayerCount} couple/staff-only ${restrictedLayerCount === 1 ? 'layer' : 'layers'}; do not distribute as a guest map.`
              : 'This is still the complete venue-authored map; use an audience preview before guest distribution.'}
      </div>

      {structuralRecoveryPending && (
        <section className="no-print rounded-lg border border-red-300 bg-red-50 px-3 py-3 text-xs text-red-950 spm-studio-chrome" aria-labelledby="structural-map-recovery-heading">
          <h3 id="structural-map-recovery-heading" className="font-semibold">
            <span role="alert">
              Publication blocked: {structuralRecoveryArtifacts.length} malformed saved map {structuralRecoveryArtifacts.length === 1 ? 'occurrence requires' : 'occurrences require'} an explicit decision
            </span>
          </h3>
          <p className="mt-1">
            These records are retained only in the admin recovery layer and are never sent to Couple or Guest portals. Accept a valid recovered frame, deliberately reconstruct a typed object, download an oversized source, remove an occurrence, or reset the map.
          </p>
          <div className="mt-3 space-y-3">
            {structuralRecoveryArtifacts.map((artifact, index) => (
              <article key={artifact.key} className="rounded-lg border border-red-200 bg-white p-2" aria-label={`Malformed saved map occurrence ${index + 1}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold capitalize">
                      {artifact.family === 'map'
                        ? artifact.mapComplexityExceeded
                          ? 'Oversized Venue Map'
                          : artifact.mapFrameMalformed
                            ? 'Venue Map frame'
                            : structuralRecoveryFamilyLabel(artifact.family)
                        : `${structuralRecoveryFamilyLabel(artifact.family)} ${artifact.collectionMalformed ? 'collection' : `occurrence ${artifact.occurrenceIndex + 1}`}`}
                    </p>
                    <ul className="mt-0.5 list-disc pl-4 text-red-800">
                      {artifact.issues.map((issue) => <li key={issue}>{issue}</li>)}
                    </ul>
                  </div>
                  <span className="rounded bg-red-100 px-1.5 py-0.5 font-mono text-[10px]">Recovery only · {artifact.key}</span>
                </div>

                {artifact.family === 'map' && artifact.mapFrameMalformed && (
                  <p className="mt-2 rounded border border-amber-300 bg-amber-50 p-2 text-amber-950">
                    All spatial objects remain admin-recoverable, but no portal receives this map until you use Map settings to choose valid dimensions and explicitly accept the repaired frame. The current recovery frame is {map.width} × {map.height}.
                  </p>
                )}

                {artifact.family === 'map' && artifact.mapComplexityExceeded && (
                  <p className="mt-2 rounded border border-amber-300 bg-amber-50 p-2 text-amber-950">
                    The working canvas is intentionally empty so this page stays responsive. Download the {quarantinedMapRecoveryRedactedRef.current ? 'secret-redacted recovery source' : 'exact admin-only source'} before resetting it; the current canonical server row is not rewritten until you explicitly save the reset map.
                  </p>
                )}

                {!artifact.collectionMalformed && artifact.family !== 'map' && (
                  <div className="mt-2 space-y-2">
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                      <label className="text-[11px] font-medium text-gray-700">
                        Canonical ID
                        <input
                          type="text"
                          maxLength={200}
                          value={artifact.candidate.id || ''}
                          onChange={(event) => updateStructuralRecoveryCandidate(artifact.key, {
                            id: event.target.value,
                          })}
                          className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 font-mono text-xs"
                          aria-label={`Canonical ID for malformed ${structuralRecoveryFamilyLabel(artifact.family)} occurrence ${index + 1}`}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => generateStructuralRecoveryId(artifact)}
                        className="min-h-9 rounded border border-teal-300 bg-white px-2 py-1 font-semibold text-teal-800 hover:bg-teal-50"
                        aria-label={`Generate a new ID for malformed map occurrence ${index + 1}`}
                      >
                        Generate new ID
                      </button>
                    </div>

                    {artifact.family === 'point' && (
                      <>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <label className="text-[11px] font-medium text-gray-700">Point label
                            <input
                              type="text"
                              maxLength={200}
                              value={artifact.candidate.label || ''}
                              onChange={(event) => updateStructuralRecoveryCandidate(artifact.key, {
                                label: event.target.value,
                              })}
                              className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-xs"
                            />
                          </label>
                          <label className="text-[11px] font-medium text-gray-700">Point type
                            <select
                              value={artifact.candidate.kind || ''}
                              onChange={(event) => updateStructuralRecoveryCandidate(artifact.key, {
                                kind: event.target.value || undefined,
                              })}
                              className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs"
                            >
                              <option value="">Choose a point type</option>
                              {KINDS.map((kind) => <option key={kind} value={kind}>{pointKindLabel(kind)}</option>)}
                            </select>
                          </label>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <label className="text-[11px] font-medium text-gray-700">Horizontal position (0–{map.width})
                            <input
                              type="number"
                              min={0}
                              max={map.width}
                              step="any"
                              value={Number.isFinite(artifact.candidate.x) ? artifact.candidate.x : ''}
                              onChange={(event) => updateStructuralRecoveryCandidate(artifact.key, {
                                x: event.target.value === '' ? undefined : Number(event.target.value),
                              })}
                              className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-xs"
                              aria-label={`Horizontal position for malformed point occurrence ${index + 1}`}
                            />
                          </label>
                          <label className="text-[11px] font-medium text-gray-700">Vertical position (0–{map.height})
                            <input
                              type="number"
                              min={0}
                              max={map.height}
                              step="any"
                              value={Number.isFinite(artifact.candidate.y) ? artifact.candidate.y : ''}
                              onChange={(event) => updateStructuralRecoveryCandidate(artifact.key, {
                                y: event.target.value === '' ? undefined : Number(event.target.value),
                              })}
                              className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-xs"
                              aria-label={`Vertical position for malformed point occurrence ${index + 1}`}
                            />
                          </label>
                        </div>
                      </>
                    )}

                    {artifact.family === 'route' && (
                      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                        <label className="text-[11px] font-medium text-gray-700">Walkway name
                          <input
                            type="text"
                            maxLength={200}
                            value={artifact.candidate.name || ''}
                            onChange={(event) => updateStructuralRecoveryCandidate(artifact.key, {
                              name: event.target.value,
                            })}
                            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-xs"
                          />
                        </label>
                        <span className="pb-2 text-[10px] text-gray-500">
                          {artifact.candidate.pointIds?.length || 0} recovered ordered point references
                        </span>
                      </div>
                    )}

                    {artifact.family === 'drawing' && (
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="text-[11px] font-medium text-gray-700">Shape label
                          <input
                            type="text"
                            maxLength={300}
                            value={artifact.candidate.text || ''}
                            onChange={(event) => updateStructuralRecoveryCandidate(artifact.key, {
                              text: event.target.value,
                            })}
                            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-xs"
                          />
                        </label>
                        <label className="text-[11px] font-medium text-gray-700">Shape type
                          <select
                            value={['zone', 'rectangle', 'circle', 'line'].includes(artifact.candidate.type || '')
                              ? artifact.candidate.type
                              : ''}
                            onChange={(event) => updateStructuralRecoveryCandidate(artifact.key, {
                              type: event.target.value || undefined,
                            })}
                            className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs"
                          >
                            <option value="">Choose a shape type</option>
                            <option value="zone">Zone</option>
                            <option value="rectangle">Rectangle</option>
                            <option value="circle">Circle</option>
                            <option value="line">Line</option>
                          </select>
                        </label>
                      </div>
                    )}

                    {artifact.family === 'rainContingency' && (
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="text-[11px] font-medium text-gray-700">Outdoor source
                          <select
                            value={artifact.candidate.outdoorVenueId || ''}
                            onChange={(event) => updateStructuralRecoveryCandidate(artifact.key, {
                              outdoorVenueId: event.target.value || undefined,
                            })}
                            className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs"
                          >
                            <option value="">Choose an outdoor source</option>
                            {outdoorVenues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}
                          </select>
                        </label>
                        <label className="text-[11px] font-medium text-gray-700">Indoor backup
                          <select
                            value={artifact.candidate.indoorVenueId || ''}
                            onChange={(event) => updateStructuralRecoveryCandidate(artifact.key, {
                              indoorVenueId: event.target.value || undefined,
                            })}
                            className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs"
                          >
                            <option value="">Choose an indoor backup</option>
                            {indoorVenues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}
                          </select>
                        </label>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-2 flex flex-wrap gap-2">
                  {artifact.family === 'map' && artifact.mapComplexityExceeded ? (
                    <>
                      <button
                        type="button"
                        onClick={downloadComplexityRecovery}
                        className="min-h-9 rounded bg-[#4A1942] px-3 py-1.5 font-semibold text-white hover:bg-[#3b1435]"
                      >
                        Download {quarantinedMapRecoveryRedactedRef.current ? 'redacted' : 'original'} recovery JSON
                      </button>
                      <button
                        type="button"
                        disabled={!complexityRecoveryDownloaded}
                        onClick={() => setConfirmResetMalformedMap(true)}
                        className="min-h-9 rounded border border-red-300 bg-white px-3 py-1.5 font-semibold text-red-800 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                        title={complexityRecoveryDownloaded
                          ? 'Confirm a new empty working map'
                          : 'Download the recovery JSON before resetting this map'}
                      >
                        Reset Venue Map
                      </button>
                    </>
                  ) : artifact.family === 'map' && artifact.mapFrameMalformed ? (
                    <>
                      <button
                        type="button"
                        onClick={() => acceptRecoveredMapFrame(artifact.key)}
                        className="min-h-9 rounded bg-[#4A1942] px-3 py-1.5 font-semibold text-white hover:bg-[#3b1435]"
                        aria-label={`Accept repaired Venue Map frame ${map.width} by ${map.height}`}
                      >
                        Accept current dimensions
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmResetMalformedMap(true)}
                        className="min-h-9 rounded border border-red-300 bg-white px-3 py-1.5 font-semibold text-red-800 hover:bg-red-100"
                      >
                        Reset Venue Map instead
                      </button>
                    </>
                  ) : (
                    <>
                      {!artifact.collectionMalformed && artifact.family !== 'map' && (
                        <button
                          type="button"
                          onClick={() => reconstructStructuralRecoveryArtifact(artifact)}
                          className="min-h-9 rounded bg-[#4A1942] px-3 py-1.5 font-semibold text-white hover:bg-[#3b1435]"
                          aria-label={`Reconstruct malformed map occurrence ${index + 1}`}
                        >
                          Reconstruct object
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeStructuralRecoveryArtifact(artifact.key)}
                        className="min-h-9 rounded border border-red-300 bg-white px-3 py-1.5 font-semibold text-red-800 hover:bg-red-100"
                        aria-label={`Remove malformed saved map occurrence ${index + 1}`}
                      >
                        {artifact.collectionMalformed ? 'Discard malformed collection' : 'Remove occurrence'}
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
          <p className="mt-2 font-medium">No generated or temporary recovery key becomes canonical until you explicitly reconstruct the object and publish.</p>
        </section>
      )}

      {duplicateRecoveryPending && (
        <section className="no-print rounded-lg border border-red-300 bg-red-50 px-3 py-3 text-xs text-red-950 spm-studio-chrome" aria-labelledby="duplicate-map-identity-heading">
          <h3 id="duplicate-map-identity-heading" className="font-semibold">
            <span role="alert">Publication blocked: duplicated map identities require recovery</span>
          </h3>
          <p className="mt-1">
            Every ambiguous occurrence is quarantined off the working canvas and out of portal projections. Choose explicitly which occurrence keeps the original ID; when only one remains after re-ID/removal, that occurrence keeps it. Re-ID’d points begin unlinked while existing walkways remain anchored to the occurrence you keep.
          </p>
          <div className="mt-3 space-y-3">
            {duplicateIdentityGroups.map((group) => (
              <div key={`${group.family}:${group.id}`} className="rounded-lg border border-red-200 bg-white p-2">
                <p className="font-semibold">
                  Duplicate {duplicateIdentityFamilyLabel(group.family)} ID “{group.id}” — {group.objects.length} occurrences
                </p>
                <ol className="mt-2 space-y-2">
                  {group.objects.map((object, index) => {
                    const occurrenceLabel = duplicateIdentityObjectLabel(group.family, object, index);
                    return (
                      <li key={`${group.family}:${group.id}:${index}`} className="rounded border border-gray-200 bg-gray-50 p-2">
                        <p className="font-medium text-gray-800">{index + 1}. {occurrenceLabel}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => recoverDuplicateIdentity(group, index, 'keep-and-reid')}
                            className="min-h-8 rounded bg-[#4A1942] px-2 py-1 font-semibold text-white hover:bg-[#3b1435]"
                            aria-label={`Keep occurrence ${index + 1}, ${occurrenceLabel}, with original ID ${group.id} and re-ID the other occurrences`}
                          >
                            Keep this; re-ID others
                          </button>
                          <button
                            type="button"
                            onClick={() => recoverDuplicateIdentity(group, index, 'reid')}
                            className="min-h-8 rounded border border-teal-300 bg-white px-2 py-1 font-semibold text-teal-800 hover:bg-teal-50"
                            aria-label={`Assign a new ID to occurrence ${index + 1}, ${occurrenceLabel}`}
                          >
                            Assign new ID
                          </button>
                          <button
                            type="button"
                            onClick={() => recoverDuplicateIdentity(group, index, 'remove')}
                            className="min-h-8 rounded border border-red-300 bg-white px-2 py-1 font-semibold text-red-700 hover:bg-red-100"
                            aria-label={`Remove duplicate occurrence ${index + 1}, ${occurrenceLabel}`}
                          >
                            Remove occurrence
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </div>
          {duplicateDependentRoutes.length > 0 && (
            <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-2 text-amber-950">
              <p className="font-semibold">
                {duplicateDependentRoutes.length} affected {duplicateDependentRoutes.length === 1 ? 'walkway is' : 'walkways are'} temporarily quarantined
              </p>
              <p className="mt-0.5">
                {duplicateDependentRoutes.map((route) => route.name).join(', ')}. Each returns unchanged after one occurrence of every referenced point ID is explicitly kept.
              </p>
            </div>
          )}
          <p className="mt-2 font-medium">Recovery choices affect only this draft until you publish. Leave the designer without publishing to discard them.</p>
        </section>
      )}

      {routeReferenceRecoveryPending && (
        <section className="no-print rounded-lg border border-red-300 bg-red-50 px-3 py-3 text-xs text-red-950 spm-studio-chrome" aria-labelledby="route-reference-recovery-heading">
          <h3 id="route-reference-recovery-heading" className="font-semibold">
            <span role="alert">Publication blocked: {routeReferenceQuarantine.length} {routeReferenceQuarantine.length === 1 ? 'walkway has' : 'walkways have'} unsafe or unavailable routing data</span>
          </h3>
          <p className="mt-1">
            Each whole walkway is quarantined so an invalid priority cannot become a routine guest route and a missing intermediate point cannot become a false direct segment. Choose a valid priority, repair or rebuild its ordered sequence explicitly, or remove the walkway.
          </p>
          <div className="mt-3 space-y-3">
            {routeReferenceQuarantine.map((route) => {
              const issues = venueMapRouteReferenceIssues(route, map.points);
              const priorityIssue = venueMapRoutePriorityIssue(route);
              const issueByIndex = new Map(issues.map((issue) => [issue.index, issue]));
              const canApply = !priorityIssue && route.pointIds.length >= 2 && issues.length === 0;
              return (
                <div key={route.id} className="rounded-lg border border-red-200 bg-white p-2">
                  <p className="font-semibold">Walkway “{route.name}”</p>
                  <label className="mt-2 block text-[11px] font-medium text-gray-700">
                    Routing priority
                    <select
                      value={priorityIssue ? '' : route.priority || 'standard'}
                      onChange={(event) => updateQuarantinedRoutePriority(
                        route.id,
                        event.target.value as VenueMapRoutePriority,
                      )}
                      className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs"
                      aria-label={`Recovery priority for ${route.name}`}
                    >
                      {priorityIssue && <option value="" disabled>Invalid saved priority — choose a safe value</option>}
                      {MAP_ROUTE_PRIORITIES.map((priority) => (
                        <option key={priority} value={priority}>{routePriorityLabel(priority)}</option>
                      ))}
                    </select>
                  </label>
                  {priorityIssue && (
                    <p className="mt-1 rounded border border-red-200 bg-red-50 px-2 py-1 font-medium text-red-800" role="alert">
                      {priorityIssue} The route remains hidden from Couple and Guest portals.
                    </p>
                  )}
                  {route.pointIds.length < 2 && (
                    <p className="mt-1 rounded border border-red-200 bg-red-50 px-2 py-1 font-medium text-red-800">
                      At least two distinct current map points are required.
                    </p>
                  )}
                  <ol className="mt-2 space-y-1.5">
                    {route.pointIds.map((pointId, index) => {
                      const issue = issueByIndex.get(index);
                      const linkedPoint = map.points.find((point) => point.id === pointId);
                      const issueText = issue?.reason === 'malformed'
                        ? 'Malformed saved reference'
                        : issue?.reason === 'unavailable'
                          ? `Unavailable point ID “${pointId}”`
                          : issue?.reason === 'ambiguous'
                            ? `Ambiguous point ID “${pointId}”`
                            : issue?.reason === 'duplicate'
                              ? `Repeated point “${linkedPoint?.label || pointId}”`
                              : null;
                      return (
                        <li key={`${route.id}:${index}`} className={`rounded border p-2 ${issue ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
                          <div className="flex flex-wrap items-end gap-1.5">
                            <label className="min-w-48 flex-1 text-[11px] font-medium text-gray-700">
                              Stop {index + 1}{issueText ? ` — ${issueText}` : ''}
                              <select
                                value={linkedPoint && issue?.reason !== 'ambiguous' ? pointId : ''}
                                onChange={(event) => {
                                  if (!event.target.value) return;
                                  const next = [...route.pointIds];
                                  next[index] = event.target.value;
                                  updateQuarantinedRoutePoints(route.id, next);
                                }}
                                className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs"
                                aria-label={`Replacement for stop ${index + 1} of ${route.name}`}
                              >
                                <option value="">Choose a current map point</option>
                                {map.points.map((point) => (
                                  <option key={point.id} value={point.id}>{point.label}</option>
                                ))}
                              </select>
                            </label>
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => {
                                const next = [...route.pointIds];
                                [next[index - 1], next[index]] = [next[index], next[index - 1]];
                                updateQuarantinedRoutePoints(route.id, next);
                              }}
                              className="min-h-8 rounded border border-gray-300 bg-white px-2 py-1 disabled:opacity-40"
                              aria-label={`Move stop ${index + 1} earlier in ${route.name}`}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              disabled={index === route.pointIds.length - 1}
                              onClick={() => {
                                const next = [...route.pointIds];
                                [next[index], next[index + 1]] = [next[index + 1], next[index]];
                                updateQuarantinedRoutePoints(route.id, next);
                              }}
                              className="min-h-8 rounded border border-gray-300 bg-white px-2 py-1 disabled:opacity-40"
                              aria-label={`Move stop ${index + 1} later in ${route.name}`}
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              onClick={() => updateQuarantinedRoutePoints(
                                route.id,
                                route.pointIds.filter((_, candidateIndex) => candidateIndex !== index),
                              )}
                              className="min-h-8 rounded border border-red-300 bg-white px-2 py-1 font-semibold text-red-700 hover:bg-red-100"
                              aria-label={`Remove stop ${index + 1} from ${route.name}`}
                            >
                              Remove stop
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                  <div className="mt-2 flex flex-wrap items-end gap-2 rounded border border-gray-200 bg-gray-50 p-2">
                    <label className="min-w-48 flex-1 text-[11px] font-medium text-gray-700">
                      Add a current map point
                      <select
                        value={routeRecoveryAddPoint[route.id] || ''}
                        onChange={(event) => setRouteRecoveryAddPoint((current) => ({
                          ...current,
                          [route.id]: event.target.value,
                        }))}
                        className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs"
                        aria-label={`Point to add to ${route.name}`}
                      >
                        <option value="">Choose a point</option>
                        {map.points.map((point) => (
                          <option key={point.id} value={point.id}>{point.label}</option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      disabled={!routeRecoveryAddPoint[route.id]}
                      onClick={() => {
                        const pointId = routeRecoveryAddPoint[route.id];
                        if (!pointId) return;
                        updateQuarantinedRoutePoints(route.id, [...route.pointIds, pointId]);
                        setRouteRecoveryAddPoint((current) => ({ ...current, [route.id]: '' }));
                      }}
                      className="min-h-8 rounded border border-teal-300 bg-white px-2 py-1 font-semibold text-teal-800 hover:bg-teal-50 disabled:opacity-40"
                      aria-label={`Add selected stop to ${route.name}`}
                    >
                      Add stop
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!canApply}
                      onClick={() => applyQuarantinedRoute(route.id)}
                      className="min-h-9 rounded bg-[#4A1942] px-3 py-1.5 font-semibold text-white hover:bg-[#3b1435] disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={`Apply repaired walkway ${route.name}`}
                    >
                      Apply repaired walkway
                    </button>
                    <button
                      type="button"
                      onClick={() => removeQuarantinedRoute(route.id)}
                      className="min-h-9 rounded border border-red-300 bg-white px-3 py-1.5 font-semibold text-red-700 hover:bg-red-100"
                      aria-label={`Remove walkway ${route.name} from draft`}
                    >
                      Remove walkway from draft
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-2 font-medium">Recovery changes remain local until publication. Leave the designer without publishing to discard them.</p>
        </section>
      )}

      {rainContingencyCollisionRecoveryPending && (
        <section className="no-print rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-950 spm-studio-chrome" aria-labelledby="rain-plan-collision-heading">
          <h3 id="rain-plan-collision-heading" className="font-semibold">
            <span role="alert">
              Publication blocked: {rainContingencyQuarantine.length} duplicate or competing rain {rainContingencyQuarantine.length === 1 ? 'plan requires' : 'plans require'} recovery
            </span>
          </h3>
          <p className="mt-1">
            Every conflicting plan is withheld from Couple and Guest portals. Explicitly re-ID it, move it to another outdoor space, keep only one plan, or remove it.
          </p>
          <div className="mt-2 space-y-2">
            {rainContingencyQuarantine.map((contingency, index) => {
              const collisionIssues = rainContingencyCollisionIssues(
                contingency,
                rainContingencyQuarantine,
              );
              const validationIssue = rainContingencyValidationIssue(contingency, venues);
              const currentSourceAvailable = outdoorVenues.some((venue) =>
                venue.id === contingency.outdoorVenueId,
              );
              const currentBackupAvailable = indoorVenues.some((venue) =>
                venue.id === contingency.indoorVenueId
                  && venue.id !== contingency.outdoorVenueId,
              );
              const sourceUsedElsewhere = new Set([
                ...(map.rainContingencies || []).map((candidate) => candidate.outdoorVenueId),
                ...rainContingencyQuarantine
                  .filter((_, candidateIndex) => candidateIndex !== index)
                  .map((candidate) => candidate.outdoorVenueId),
              ]);
              return (
                <article key={`${contingency.id}:${contingency.outdoorVenueId}:${index}`} className="rounded border border-red-200 bg-white p-2" aria-label={`Quarantined rain plan ${index + 1}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">Plan {index + 1}: {linkedVenueName(contingency.outdoorVenueId)} → {linkedVenueName(contingency.indoorVenueId)}</p>
                      <ul className="mt-0.5 list-disc pl-4 text-red-800">
                        {collisionIssues.map((issue) => <li key={issue}>{issue}</li>)}
                        {validationIssue && <li>{validationIssue}</li>}
                      </ul>
                    </div>
                    <span className="rounded bg-red-100 px-1.5 py-0.5 font-mono text-[10px]">{contingency.id}</span>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <label className="text-[11px] font-medium text-gray-700">
                      Outdoor source
                      <select
                        value={contingency.outdoorVenueId}
                        onChange={(event) => updateQuarantinedRainContingency(index, {
                          outdoorVenueId: event.target.value,
                        })}
                        className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs"
                        aria-label={`Outdoor source for quarantined rain plan ${index + 1}`}
                      >
                        {!currentSourceAvailable && (
                          <option value={contingency.outdoorVenueId} disabled>
                            Unavailable — {linkedVenueName(contingency.outdoorVenueId)}
                          </option>
                        )}
                        {outdoorVenues.map((venue) => (
                          <option
                            key={venue.id}
                            value={venue.id}
                            disabled={venue.id !== contingency.outdoorVenueId && sourceUsedElsewhere.has(venue.id)}
                          >
                            {venue.name}{sourceUsedElsewhere.has(venue.id) && venue.id !== contingency.outdoorVenueId ? ' — already assigned' : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-[11px] font-medium text-gray-700">
                      Indoor backup
                      <select
                        value={contingency.indoorVenueId}
                        onChange={(event) => updateQuarantinedRainContingency(index, {
                          indoorVenueId: event.target.value,
                        })}
                        className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs"
                        aria-label={`Indoor backup for quarantined rain plan ${index + 1}`}
                      >
                        {!currentBackupAvailable && (
                          <option value={contingency.indoorVenueId} disabled>
                            Unavailable — {linkedVenueName(contingency.indoorVenueId)}
                          </option>
                        )}
                        {indoorVenues
                          .filter((venue) => venue.id !== contingency.outdoorVenueId)
                          .map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {collisionIssues.some((issue) => issue.includes('Plan ID')) && (
                      <button
                        type="button"
                        onClick={() => reidentifyQuarantinedRainContingency(index)}
                        className="min-h-8 rounded border border-teal-300 bg-white px-2 py-1 font-semibold text-teal-800 hover:bg-teal-50"
                        aria-label={`Assign a new ID to quarantined rain plan ${index + 1}`}
                      >
                        Assign new ID
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => keepOnlyQuarantinedRainContingency(index)}
                      className="min-h-8 rounded border border-amber-300 bg-white px-2 py-1 font-semibold text-amber-900 hover:bg-amber-50"
                      aria-label={`Keep only quarantined rain plan ${index + 1} in its conflict group`}
                    >
                      Keep this plan only
                    </button>
                    <button
                      type="button"
                      onClick={() => removeQuarantinedRainContingency(index)}
                      className="min-h-8 rounded border border-red-300 bg-white px-2 py-1 font-semibold text-red-800 hover:bg-red-100"
                      aria-label={`Remove quarantined rain plan ${index + 1}`}
                    >
                      Remove plan
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          <p className="mt-2 font-medium">Recovery changes remain local until publication. Leave without publishing to discard them.</p>
        </section>
      )}

      {drawingIntegrityRecoveryPending && (
        <section className="no-print rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-950 spm-studio-chrome" aria-labelledby="drawing-integrity-heading">
          <h3 id="drawing-integrity-heading" className="font-semibold">
            <span role="alert">
              Publication blocked: {drawingIntegrityQuarantine.length} unsupported or malformed map {drawingIntegrityQuarantine.length === 1 ? 'shape requires' : 'shapes require'} recovery
            </span>
          </h3>
          <p className="mt-1">
            These shapes are withheld from the working canvas and all Couple and Guest projections. Rebuild known geometry, explicitly convert a shape to a rectangular zone, or remove it.
          </p>
          <div className="mt-2 space-y-2">
            {drawingIntegrityQuarantine.map((drawing, index) => {
              const issue = venueMapDrawingIntegrityIssue(drawing);
              const knownType = ['zone', 'rectangle', 'circle', 'line'].includes(drawing.type);
              return (
                <article key={`${drawing.id}:${index}`} className="rounded border border-red-200 bg-white p-2" aria-label={`Quarantined map shape ${index + 1}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{drawing.text || `Map shape ${index + 1}`}</p>
                      <p className="mt-0.5 text-red-800">{issue}</p>
                    </div>
                    <span className="rounded bg-red-100 px-1.5 py-0.5 font-mono text-[10px]">{drawing.type || 'blank'} · {drawing.id}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {knownType && (
                      <button
                        type="button"
                        onClick={() => repairQuarantinedDrawing(index)}
                        className="min-h-8 rounded border border-teal-300 bg-white px-2 py-1 font-semibold text-teal-800 hover:bg-teal-50"
                        aria-label={`Rebuild geometry for quarantined map shape ${index + 1}`}
                      >
                        Rebuild geometry
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => convertQuarantinedDrawingToZone(index)}
                      className="min-h-8 rounded border border-amber-300 bg-white px-2 py-1 font-semibold text-amber-900 hover:bg-amber-50"
                      aria-label={`Convert quarantined map shape ${index + 1} to a rectangular zone`}
                    >
                      Convert to zone
                    </button>
                    <button
                      type="button"
                      onClick={() => removeQuarantinedDrawing(index)}
                      className="min-h-8 rounded border border-red-300 bg-white px-2 py-1 font-semibold text-red-800 hover:bg-red-100"
                      aria-label={`Remove quarantined map shape ${index + 1}`}
                    >
                      Remove shape
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          <p className="mt-2 font-medium">Recovery changes remain local until publication. Leave without publishing to discard them.</p>
        </section>
      )}

      {invalidSpacePointLinks.length > 0 && (
        <section className="no-print rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-900 spm-studio-chrome" aria-labelledby="space-pin-link-heading">
          <h3 id="space-pin-link-heading" className="font-semibold">
            <span role="alert">Publication blocked: {invalidSpacePointLinks.length} {invalidSpacePointLinks.length === 1 ? 'space pin is' : 'space pins are'} not linked to a unique current venue</span>
          </h3>
          <ul className="mt-1 space-y-1">
            {invalidSpacePointLinks.map(({ point, issue }, index) => (
              <li key={`${point.id}:${index}`} className="flex flex-wrap items-center justify-between gap-2 rounded border border-red-200 bg-white px-2 py-1.5">
                <span><strong>{point.label}:</strong> {issue}</span>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewAudience(null);
                    handleSelectPoint(point.id);
                  }}
                  className="min-h-8 rounded border border-red-300 bg-white px-2 py-1 font-semibold hover:bg-red-100"
                  aria-label={`Repair venue link for ${point.label}`}
                >
                  Repair pin
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-1">Link each pin below, change it to a non-space kind, or remove it. Invalid space pins and their dependent routes are omitted from portals.</p>
        </section>
      )}

      {invalidEventScopeObjects.length > 0 && (
        <div className="no-print rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-900 spm-studio-chrome" role="alert">
          <p className="font-semibold">
            Publication blocked: {invalidEventScopeObjects.length} map {invalidEventScopeObjects.length === 1 ? 'object has' : 'objects have'} unavailable event-space scope.
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {invalidEventScopeObjects.map((object) => (
              <li key={`${object.type}:${object.id}`}>
                {object.type} “{object.label}”: {object.unavailableIds.map(venueMapEventScopeRecoveryLabel).join(', ')}
              </li>
            ))}
          </ul>
          <p className="mt-1">Open each object below to remove only unavailable scopes or reset it to all wedding events.</p>
        </div>
      )}

      <div className="spm-venue-map-print-grid grid grid-cols-1 lg:grid-cols-3 gap-3">
        {previewAudience ? (
          <div className="lg:col-span-3 space-y-3">
            <div className="rounded-xl border border-teal-300 bg-teal-50/60 p-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-sm font-semibold text-teal-900">👁 Audience preview</span>
                <p className="text-xs text-teal-800 mt-0.5">
                  Staff-only layers are excluded. An individual guest’s map is also scoped to that wedding’s selected spaces and rain backup.
                </p>
                <p className={`mt-1 text-xs font-semibold ${exportSourceSlug === 'saved-map' ? 'text-teal-900' : 'text-amber-900'}`}>
                  Source: {exportSourceLabel}{exportSourceSlug === 'saved-map' ? '' : ' — not currently available in portals'}
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
                {previewAudience === 'guest' && uniquelyLinkableVenues.length > 0 && (
                  <label className="text-xs font-semibold text-teal-900">
                    Wedding space
                    <select
                      value={previewVenueId}
                      onChange={(event) => setPreviewVenueId(event.target.value)}
                      className="ml-2 rounded-lg border border-teal-300 bg-white px-2 py-1.5 text-xs"
                      aria-label="Preview wedding event space"
                    >
                      {uniquelyLinkableVenues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}
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
                { managedBaseImageOnly: cloudMode, venues },
              )}
              editable={false}
              onPointClick={openInMaps}
              isPointInteractive={(point) => isValidLatitude(point.lat) && isValidLongitude(point.lng)}
              pointActionLabel={() => 'Open in maps.'}
              title={mapTitle}
              showLegend
              hideMapWhenBackgroundUnavailable
              svgRef={svgRef as React.RefObject<SVGSVGElement>}
            />
          </div>
        ) : (
        <>
        {/* Canvas */}
        <div className="lg:col-span-2 spm-print-canvas-container">
          <div className="relative">
            <VenueMapCanvas
              map={map}
              editable={!mapComplexityRecoveryPending}
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
                  {mapComplexityRecoveryPending
                    ? 'Oversized map quarantined — download the original recovery JSON, then reset this map.'
                    : <>Start your map — click the canvas to place a point, or add venue pins from the side panel.</>}
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
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
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
                Routing priority
                <select value={routePriority} onChange={(e) => setRoutePriority(e.target.value as VenueMapRoutePriority)} className="mt-1 px-2 py-1.5 border border-gray-300 rounded text-xs bg-white">
                  {MAP_ROUTE_PRIORITIES.map((priority) => <option key={priority} value={priority}>{routePriorityLabel(priority)}</option>)}
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
                  onChange={(e) => {
                    if (!e.target.value) return;
                    setRoutePointIds((ids) => {
                      if (ids.length >= VENUE_MAP_MAX_ROUTE_POINTS) {
                        showToast(`A walkway can contain at most ${VENUE_MAP_MAX_ROUTE_POINTS} ordered points.`, 'warning');
                        return ids;
                      }
                      return [...ids, e.target.value];
                    });
                  }}
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
            {uniquelyLinkableVenues.length > 0 && (
              <details className="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5">
                <summary className="cursor-pointer text-xs font-medium text-gray-600">
                  Event-space scope: {routeEventSpaceIds.length === 0 ? 'All wedding events' : `${routeEventSpaceIds.length} selected space${routeEventSpaceIds.length === 1 ? '' : 's'}`}
                </summary>
                <div className="mt-2 grid gap-1 sm:grid-cols-2">
                  {uniquelyLinkableVenues.map((venue) => (
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
              <button type="button" onClick={resetRouteDraft} disabled={!newRouteDraftDirty} className="px-2 py-1 rounded text-xs text-gray-500 hover:underline disabled:opacity-40">Reset route draft</button>
              <span className="text-[11px] text-gray-500">Only mark “step-free” after verifying the full route on site.</span>
            </div>
            <p className="mt-1 text-[10px] text-gray-500">
              Guest directions use Preferred routes before Standard, then Secondary, and choose the shortest displayed path within the first connected tier. Emergency-only routes are never used for routine directions.
            </p>
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
            {unmanagedCloudBaseMap && (
              <div className="rounded-md border border-red-300 bg-red-50 px-2.5 py-2 text-[11px] text-red-800" role="alert">
                <strong className="block">Private-map upload required</strong>
                This legacy external, embedded, or general-bucket image remains visible here for admin recovery, but it is hidden from portal users and cannot be republished. Upload it to this venue’s private map storage or remove it.
              </div>
            )}
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
                  disabled={baseMapUploading}
                  onClick={() => {
                    pushUndo(map);
                    update(updateMapBackground(map, undefined, map.backgroundOpacity));
                    setBgUrlInput('');
                    showToast('Base map removed.', 'info');
                  }}
                  className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
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
            {cloudMode ? (
              <p className="border-t border-gray-200/80 pt-2 text-[10px] text-gray-500">
                Cloud portal maps accept private uploads only. External image URLs and embedded files cannot be lifecycle-scoped and are therefore not publishable.
              </p>
            ) : (
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
                    disabled={baseMapUploading}
                    aria-label="Base map image URL"
                    className="flex-1 px-2.5 py-1 border border-gray-300 rounded-lg text-xs font-mono disabled:cursor-not-allowed disabled:bg-gray-100"
                  />
                  <button
                    type="button"
                    disabled={baseMapUploading}
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
                      setBgUrlInput(value);
                      showToast('Base map URL applied to the local draft. Confirm export works before saving.', 'info');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-gray-900 text-white text-xs font-semibold hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Apply
                  </button>
                </div>
                {backgroundUrlDraftDirty && (
                  <button
                    type="button"
                    onClick={() => setBgUrlInput(map.backgroundImageUrl || '')}
                    className="mt-1 text-[11px] text-gray-600 hover:underline"
                  >
                    Reset URL draft
                  </button>
                )}
                <p className="mt-1 text-[10px] text-gray-400">External hosts must allow cross-origin image downloads or PNG/PDF export will stop with an error.</p>
              </div>
            )}
          </div>

          {/* Map-native vector shapes */}
          <div className="rounded-xl border border-gray-200 p-3 space-y-2.5 bg-gray-50/60">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-800">🎨 Property shapes</span>
              <span className="text-xs text-gray-400">
                {(map.drawings || []).length} shape{(map.drawings || []).length === 1 ? '' : 's'}
              </span>
            </div>
            <p className="text-[11px] text-gray-500">
              Add editable zones for lawns, parking, buildings, gardens, or restricted operations. Existing rectangular, circular, and line shapes remain editable and separate from the base image.
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
                  onClick={() => setConfirmClearZones(true)}
                  className="px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50"
                >
                  Clear all shapes
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
                      {drawing.text || `Shape ${index + 1}`}
                    </button>
                    <span className="shrink-0 text-[10px] text-gray-400">{drawing.type} · {mapAudienceLabel(drawing.audience)}</span>
                    <button
                      type="button"
                      onClick={() => {
                        pushUndo(map);
                        update(removeMapDrawing(map, drawing.id));
                        if (selectedDrawingId === drawing.id) setSelectedDrawingId(null);
                      }}
                      className="shrink-0 px-1 text-red-500 hover:text-red-700"
                      aria-label={`Delete shape ${drawing.text || drawing.id}`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            {selectedDrawing && (
              <div className="space-y-2 rounded-lg border border-teal-200 bg-white p-2">
                <label className="block text-xs text-gray-600">Shape label
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
                <EventScopeEditor
                  eventSpaceIds={selectedDrawing.eventSpaceIds}
                  venues={uniquelyLinkableVenues}
                  subjectLabel={selectedDrawing.text || selectedDrawing.id}
                  compact
                  onChange={(eventSpaceIds) => editDrawing({ eventSpaceIds })}
                />
                {(selectedDrawing.type === 'zone' || selectedDrawing.type === 'rectangle') && (
                  <div className="grid grid-cols-4 gap-1">
                    {([
                      ['x', 'X', selectedDrawing.x, Math.max(0, map.width - (selectedDrawing.width ?? 1))],
                      ['y', 'Y', selectedDrawing.y, Math.max(0, map.height - (selectedDrawing.height ?? 1))],
                      ['width', 'Width', selectedDrawing.width ?? 1, Math.max(1, map.width - selectedDrawing.x)],
                      ['height', 'Height', selectedDrawing.height ?? 1, Math.max(1, map.height - selectedDrawing.y)],
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
                {selectedDrawing.type === 'circle' && (
                  <div className="grid grid-cols-3 gap-1">
                    {([
                      ['x', 'Center X', selectedDrawing.x, selectedDrawing.radius ?? 1, map.width - (selectedDrawing.radius ?? 1)],
                      ['y', 'Center Y', selectedDrawing.y, selectedDrawing.radius ?? 1, map.height - (selectedDrawing.radius ?? 1)],
                      ['radius', 'Radius', selectedDrawing.radius ?? 1, 1, Math.min(map.width, map.height) / 2],
                    ] as const).map(([field, label, value, min, max]) => (
                      <label key={field} className="text-[10px] text-gray-500">{label}
                        <input
                          type="number"
                          min={min}
                          max={Math.max(min, max)}
                          step="0.5"
                          value={Math.round(value * 10) / 10}
                          onChange={(event) => {
                            const parsed = Number(event.target.value);
                            if (Number.isFinite(parsed)) editDrawing({
                              [field]: Math.max(min, Math.min(Math.max(min, max), parsed)),
                            });
                          }}
                          className="mt-1 w-full rounded border border-gray-300 px-1 py-1 text-xs"
                        />
                      </label>
                    ))}
                  </div>
                )}
                {selectedDrawing.type === 'line' && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-medium text-gray-600">Line vertices</p>
                    {(selectedDrawing.points || []).map((point, pointIndex) => (
                      <div key={pointIndex} className="grid grid-cols-[1fr_1fr_auto] items-end gap-1">
                        <label className="text-[10px] text-gray-500">X {pointIndex + 1}
                          <input
                            type="number"
                            min={0}
                            max={map.width}
                            step="0.5"
                            value={Math.round(point.x * 10) / 10}
                            onChange={(event) => {
                              const parsed = Number(event.target.value);
                              if (!Number.isFinite(parsed)) return;
                              const points = [...(selectedDrawing.points || [])];
                              points[pointIndex] = { ...point, x: Math.max(0, Math.min(map.width, parsed)) };
                              editDrawing({ points });
                            }}
                            className="mt-1 w-full rounded border border-gray-300 px-1 py-1 text-xs"
                            aria-label={`Line vertex ${pointIndex + 1} X coordinate`}
                          />
                        </label>
                        <label className="text-[10px] text-gray-500">Y {pointIndex + 1}
                          <input
                            type="number"
                            min={0}
                            max={map.height}
                            step="0.5"
                            value={Math.round(point.y * 10) / 10}
                            onChange={(event) => {
                              const parsed = Number(event.target.value);
                              if (!Number.isFinite(parsed)) return;
                              const points = [...(selectedDrawing.points || [])];
                              points[pointIndex] = { ...point, y: Math.max(0, Math.min(map.height, parsed)) };
                              editDrawing({ points });
                            }}
                            className="mt-1 w-full rounded border border-gray-300 px-1 py-1 text-xs"
                            aria-label={`Line vertex ${pointIndex + 1} Y coordinate`}
                          />
                        </label>
                        <button
                          type="button"
                          disabled={(selectedDrawing.points || []).length <= 2}
                          onClick={() => editDrawing({
                            points: (selectedDrawing.points || []).filter((_, index) => index !== pointIndex),
                          })}
                          className="min-h-8 rounded border border-red-200 px-2 text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label={`Remove line vertex ${pointIndex + 1}`}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        const points = selectedDrawing.points || [];
                        const last = points[points.length - 1] || { x: 0, y: 0 };
                        editDrawing({
                          points: [
                            ...points,
                            {
                              x: Math.min(map.width, last.x + 5),
                              y: last.x + 5 <= map.width ? last.y : Math.min(map.height, last.y + 5),
                            },
                          ],
                        });
                      }}
                      className="w-full rounded border border-teal-300 bg-white px-2 py-1 text-[10px] font-semibold text-teal-800 hover:bg-teal-50"
                    >
                      Add line vertex
                    </button>
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
                <button type="button" onClick={() => { setSelectedDrawingId(null); drawingUndoCapturedRef.current = false; }} className="w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-600">Done editing shape</button>
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
                  min={VENUE_MAP_FRAME_MIN}
                  max={VENUE_MAP_FRAME_MAX}
                  onChange={(e) => setSizeW(e.target.value)}
                  className="mt-1 w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  aria-label="Map width"
                />
              </label>
              <label className="block text-xs text-gray-500">Height
                <input
                  type="number"
                  value={sizeH}
                  min={VENUE_MAP_FRAME_MIN}
                  max={VENUE_MAP_FRAME_MAX}
                  onChange={(e) => setSizeH(e.target.value)}
                  className="mt-1 w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  aria-label="Map height"
                />
              </label>
            </div>
            <button
              type="button"
              disabled={!sizeDraftDirty || !sizeDraftValid}
              aria-describedby={!sizeDraftValid ? 'venue-map-size-error' : undefined}
              onClick={() => {
                pushUndo(map);
                const next = updateMapSize(map, Number(sizeW), Number(sizeH));
                setSizeW(String(next.width));
                setSizeH(String(next.height));
                update(next);
                showToast(`Map resized to ${next.width}×${next.height}.`, 'success');
              }}
              className="w-full px-3 py-1.5 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Apply size
            </button>
            {sizeDraftDirty && (
              <button
                type="button"
                onClick={() => { setSizeW(String(map.width)); setSizeH(String(map.height)); }}
                className="w-full text-[11px] text-gray-600 hover:underline"
              >
                Reset size draft
              </button>
            )}
            {!sizeDraftValid && (
              <p id="venue-map-size-error" role="alert" className="text-[11px] font-medium text-red-700">
                Width and height must each be a finite number from {VENUE_MAP_FRAME_MIN} to {VENUE_MAP_FRAME_MAX}.
              </p>
            )}
            <p className="text-[11px] text-gray-400">Points are clamped if the map shrinks beneath them.</p>
          </div>

          {/* Venue coverage */}
          <div className="rounded-xl border border-gray-200 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-800">🗂️ Map coverage</span>
              <span className="text-xs text-gray-400">
                {uniquelyLinkableVenues.length - missingVenues.length}/{uniquelyLinkableVenues.length} pinned
              </span>
            </div>
            <p className="text-[11px] text-gray-500">
              Any venue without a pin won't appear on the couple or guest map. Add a
              pin for each space &amp; lodging, then drag it into place.
            </p>
            {uniquelyLinkableVenues.length === 0 ? (
              <p className="text-xs text-amber-700">No uniquely identifiable current venue records are available to pin.</p>
            ) : missingVenues.length === 0 ? (
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

          {/* Rain contingencies are canonical map data; edit them here so they
              receive the same dirty guard and CAS conflict handling as geometry. */}
          <div className="rounded-xl border border-gray-200 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-gray-800">🌧️ Rain contingencies</span>
              <button
                type="button"
                onClick={addRainContingency}
                disabled={availableOutdoorVenues.length === 0}
                className="rounded-lg bg-[#4A1942] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#3b1435] disabled:cursor-not-allowed disabled:opacity-40"
              >
                + Add rain backup
              </button>
            </div>
            <p className="text-[11px] text-gray-500">
              Pair each outdoor-capable event space with one distinct indoor backup. Guests assigned to that outdoor space can then see its backup on their scoped map.
            </p>
            {invalidRainContingencies.length > 0 && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] font-semibold text-red-800" role="alert">
                Publication blocked: repair or remove {invalidRainContingencies.length === 1 ? 'the unavailable rain backup' : `all ${invalidRainContingencies.length} unavailable rain backups`} below. Existing saved data remains visible here for recovery but is omitted from portals.
              </p>
            )}
            {(map.rainContingencies || []).length === 0 ? (
              <p className="text-xs text-gray-400">No rain-contingency backups set.</p>
            ) : (
              <div className="space-y-2">
                {(map.rainContingencies || []).map((contingency) => {
                  const backupPinned = map.points.some(
                    (point) => point.kind === 'space' && point.venueId === contingency.indoorVenueId,
                  );
                  const validationIssue = rainContingencyIssueById.get(contingency.id);
                  const currentOutdoorIsEligible = outdoorVenues.some(
                    (venue) => venue.id === contingency.outdoorVenueId,
                  );
                  const currentBackupIsEligible = indoorVenues.some(
                    (venue) => venue.id === contingency.indoorVenueId
                      && venue.id !== contingency.outdoorVenueId,
                  );
                  return (
                    <div
                      key={contingency.id}
                      className={`rounded-lg border p-2 ${validationIssue ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'}`}
                    >
                      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-1.5">
                        <label className="min-w-0 text-[10px] text-gray-500">
                          Outdoor space
                          <select
                            value={contingency.outdoorVenueId}
                            onChange={(event) => {
                              const outdoorVenueId = event.target.value;
                              const currentBackupIsValid = contingency.indoorVenueId !== outdoorVenueId
                                && indoorVenues.some((venue) => venue.id === contingency.indoorVenueId);
                              const indoorVenueId = currentBackupIsValid
                                ? contingency.indoorVenueId
                                : indoorVenues.find((venue) => venue.id !== outdoorVenueId)?.id;
                              if (indoorVenueId) {
                                updateRainContingency(contingency.id, { outdoorVenueId, indoorVenueId });
                              }
                            }}
                            className="mt-1 w-full rounded border border-gray-300 bg-white px-1.5 py-1 text-xs"
                            aria-label={`Outdoor space for rain backup ${contingency.id}`}
                          >
                            {!currentOutdoorIsEligible && (
                              <option value={contingency.outdoorVenueId} disabled>
                                Unavailable — {linkedVenueName(contingency.outdoorVenueId)}
                              </option>
                            )}
                            {outdoorVenues
                              .filter((venue) => (
                                venue.id === contingency.outdoorVenueId
                                || !usedOutdoorVenueIds.has(venue.id)
                              ) && indoorVenues.some((backup) => backup.id !== venue.id))
                              .map((venue) => (
                                <option key={venue.id} value={venue.id}>{venue.name}</option>
                              ))}
                          </select>
                        </label>
                        <span className="mt-4 text-gray-400" aria-hidden="true">→</span>
                        <label className="min-w-0 text-[10px] text-gray-500">
                          Indoor backup
                          <select
                            value={contingency.indoorVenueId}
                            onChange={(event) => updateRainContingency(contingency.id, {
                              indoorVenueId: event.target.value,
                            })}
                            className="mt-1 w-full rounded border border-gray-300 bg-white px-1.5 py-1 text-xs"
                            aria-label={`Indoor backup for ${contingency.outdoorVenueId}`}
                          >
                            {!currentBackupIsEligible && (
                              <option value={contingency.indoorVenueId} disabled>
                                Unavailable — {linkedVenueName(contingency.indoorVenueId)}
                              </option>
                            )}
                            {indoorVenues
                              .filter((venue) => venue.id !== contingency.outdoorVenueId)
                              .map((venue) => (
                                <option key={venue.id} value={venue.id}>{venue.name}</option>
                              ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          onClick={() => removeRainContingency(contingency.id)}
                          className="mt-4 px-1 text-red-500 hover:text-red-700"
                          aria-label={`Remove rain backup for ${linkedVenueName(contingency.outdoorVenueId)}`}
                        >
                          ✕
                        </button>
                      </div>
                      {validationIssue && (
                        <p className="mt-1 text-[10px] font-semibold text-red-800" role="status">
                          Not publishable: {validationIssue} Choose an eligible space or remove this pair.
                        </p>
                      )}
                      {!validationIssue && !backupPinned && (
                        <p className="mt-1 text-[10px] text-amber-700" role="status">
                          Add a map pin for {linkedVenueName(contingency.indoorVenueId)} so guests can see this backup.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {outdoorVenues.length === 0 && (
              <p className="text-[10px] text-gray-400">Mark a venue space as outdoor or both to configure a rain backup.</p>
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
                  <select
                    value={selected.venueId || ''}
                    onChange={(e) => linkVenue(e.target.value)}
                    className="mt-1 w-full px-2 py-1 border border-gray-300 rounded text-sm bg-white"
                    aria-invalid={Boolean(selectedSpaceLinkIssue)}
                  >
                    <option value="">(none — publication blocked)</option>
                    {selected.venueId && selectedSpaceLinkIssue && (
                      <option value={selected.venueId} disabled>
                        Unavailable — {selected.venueId}
                      </option>
                    )}
                    {uniquelyLinkableVenues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                  {selectedSpaceLinkIssue && (
                    <span className="mt-1 block text-[10px] font-medium text-red-700" role="alert">
                      {selectedSpaceLinkIssue} Repair, reclassify, or remove this pin before publication.
                    </span>
                  )}
                </label>
              )}
              <EventScopeEditor
                eventSpaceIds={selected.eventSpaceIds}
                venues={uniquelyLinkableVenues}
                subjectLabel={selected.label}
                onChange={(eventSpaceIds) => editSelected(updateMapPoint(
                  map,
                  selected.id,
                  { eventSpaceIds },
                ))}
              />
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
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <label className="text-[11px] text-gray-500">Audience
                          <select value={routeEditAudience} onChange={(event) => setRouteEditAudience(event.target.value as VenueMapAudience)} className="mt-1 w-full rounded border border-gray-300 bg-white px-1 py-1 text-xs">
                            {MAP_AUDIENCES.map((audience) => <option key={audience} value={audience}>{mapAudienceLabel(audience)}</option>)}
                          </select>
                        </label>
                        <label className="text-[11px] text-gray-500">Routing priority
                          <select value={routeEditPriority} onChange={(event) => setRouteEditPriority(event.target.value as VenueMapRoutePriority)} className="mt-1 w-full rounded border border-gray-300 bg-white px-1 py-1 text-xs">
                            {MAP_ROUTE_PRIORITIES.map((priority) => <option key={priority} value={priority}>{routePriorityLabel(priority)}</option>)}
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
                      <EventScopeEditor
                        eventSpaceIds={routeEditEventSpaceIds}
                        venues={uniquelyLinkableVenues}
                        subjectLabel={routeRename || route.name}
                        compact
                        onChange={(eventSpaceIds) => setRouteEditEventSpaceIds(eventSpaceIds || [])}
                      />
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
                          onChange={(event) => {
                            if (!event.target.value) return;
                            setRouteEditPointIds((ids) => {
                              if (ids.length >= VENUE_MAP_MAX_ROUTE_POINTS) {
                                showToast(`A walkway can contain at most ${VENUE_MAP_MAX_ROUTE_POINTS} ordered points.`, 'warning');
                                return ids;
                              }
                              return [...ids, event.target.value];
                            });
                          }}
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
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${route.priority === 'preferred' ? 'bg-emerald-100 text-emerald-800' : route.priority === 'secondary' ? 'bg-violet-100 text-violet-800' : route.priority === 'emergency-only' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600'}`}>
                          {routePriorityLabel(route.priority)}
                        </span>
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

      <div className="flex flex-wrap items-center justify-end gap-2 no-print spm-studio-chrome">
        <span className={`mr-auto text-xs font-medium ${dirty || stagedDraftDirty || baseMapUploading || saving || unmanagedCloudBaseMap || structuralRecoveryPending || duplicateRecoveryPending || routeReferenceRecoveryPending || rainContingencyCollisionRecoveryPending || drawingIntegrityRecoveryPending || invalidSpacePointLinks.length > 0 || invalidRainContingencies.length > 0 || invalidEventScopeObjects.length > 0 ? 'text-amber-700' : 'text-emerald-700'}`} role="status">
          {baseMapUploading
            ? '● Base map upload in progress — keep this page open'
            : saving
              ? '● Publishing canonical venue map…'
              : unmanagedCloudBaseMap
                ? '● Private base-map upload required before the next publication'
                : mapFrameRecoveryPending
                  ? '● Accept valid map dimensions or reset the Venue Map before publishing'
                  : structuralRecoveryPending
                    ? '● Reconstruct or remove malformed saved map occurrences before publishing'
                  : duplicateRecoveryPending
                    ? '● Resolve quarantined duplicate identities before publishing'
                  : routeReferenceRecoveryPending
                    ? '● Repair quarantined walkway priorities or point references before publishing'
                    : rainContingencyCollisionRecoveryPending
                      ? '● Resolve duplicate or competing rain plans before publishing'
                      : drawingIntegrityRecoveryPending
                        ? '● Repair, convert, or remove quarantined map shapes before publishing'
                        : invalidSpacePointLinks.length > 0
                          ? '● Link, reclassify, or remove unavailable space pins before publishing'
                      : invalidRainContingencies.length > 0
                      ? '● Repair unavailable rain backups before publishing'
                      : invalidEventScopeObjects.length > 0
                        ? '● Remove unavailable event-space scopes before publishing'
                        : stagedDraftDirty
                          ? '● Apply or cancel the in-progress edits before publishing'
                          : dirty
                            ? '● Local draft has unpublished changes'
                            : '✓ Canonical venue map is saved'}
        </span>
        {onClose && <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600">Close</button>}
        <button type="button" disabled={baseMapUploading || saving || unmanagedCloudBaseMap} onClick={() => void publishMap()} className="px-4 py-2 rounded-lg bg-[#4A1942] text-white text-sm disabled:cursor-not-allowed disabled:opacity-50">💾 {saving ? 'Publishing…' : 'Save & publish Venue Map'}</button>
      </div>

      <ConfirmDialog
        open={confirmResetMalformedMap}
        title="Reset the entire Venue Map?"
        message={`${mapComplexityRecoveryPending ? `The ${quarantinedMapRecoveryRedactedRef.current ? 'redacted' : 'original'} recovery JSON download was initiated. Keep that file if you may need any oversized-map data. ` : ''}This starts a new 100 × 80 working map and removes every recovered point, walkway, shape, rain plan, and base image. This reset cannot be undone inside the designer. The currently published map remains unchanged unless you save and publish the new empty map.`}
        confirmLabel="Reset working map"
        cancelLabel="Keep recovery map"
        tone="danger"
        onConfirm={resetMalformedVenueMap}
        onCancel={() => setConfirmResetMalformedMap(false)}
      />

      <ConfirmDialog
        open={confirmClearZones}
        title="Clear all property shapes?"
        message={`This removes all ${(map.drawings || []).length} shape${(map.drawings || []).length === 1 ? '' : 's'} from the working draft${zoneAudienceSummary ? ` (${zoneAudienceSummary})` : ''}. Nothing changes in portals until you publish. You can still use Undo before leaving the designer.`}
        confirmLabel="Clear all shapes"
        cancelLabel="Keep shapes"
        tone="danger"
        onConfirm={clearAllZones}
        onCancel={() => setConfirmClearZones(false)}
      />
    </div>
  );
}
