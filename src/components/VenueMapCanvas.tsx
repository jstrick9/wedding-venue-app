import { useEffect, useId, useRef, useState } from 'react';
import { VenueMapConfig, VenueMapPoint, VenueMapPointKind } from '../types';
import {
  pointColor,
  pointKindIcon,
  pointKindLabel,
  routePoints,
  routePriorityLabel,
} from '../utils/venueMapDesigner';
import { isStoragePathRef, resolveImageRef } from '../services/storage/imageStorage';

export interface VenueMapCanvasProps {
  map: VenueMapConfig;
  /** When true, points can be dragged and the canvas click-places (designer mode). */
  editable?: boolean;
  selectedPointId?: string | null;
  onSelectPoint?: (id: string | null) => void;
  onMovePoint?: (id: string, x: number, y: number) => void;
  onPlacePoint?: (kind: VenueMapPointKind, x: number, y: number) => void;
  /** Which point kind a click on empty canvas places (designer mode; default 'space'). */
  placeKind?: VenueMapPointKind;
  /** Point ids to visually highlight (e.g. pins already added to an in-progress route). */
  highlightPointIds?: string[];
  /** Fired on click/tap of an actionable point in read-only mode. */
  onPointClick?: (point: VenueMapPoint) => void;
  /** Limits which read-only points expose button semantics and invoke the action. */
  isPointInteractive?: (point: VenueMapPoint) => boolean;
  /** Describes the read-only action in each interactive point's accessible name. */
  pointActionLabel?: (point: VenueMapPoint) => string;
  /** Show labels (default true). */
  showLabels?: boolean;
  /** Render a color legend (by point kind) in the corner of the map — included in exports. */
  showLegend?: boolean;
  /** Forwarded so print/export can capture the rendered SVG. */
  svgRef?: React.RefObject<SVGSVGElement | null>;
  /** Optional title rendered inside the SVG (top center) so it appears in exports. */
  title?: string;
  /** Hide spatial geometry while a configured base image is loading or unavailable. */
  hideMapWhenBackgroundUnavailable?: boolean;
  /** Re-pull portal data when the server reports that the published image is unavailable. */
  onRetryBackgroundImage?: () => void;
}

const KIND_RADIUS: Record<VenueMapPointKind, number> = {
  space: 5,
  parking: 5,
  entry: 4.5,
  amenity: 4,
  path: 2,
};
const ALL_KINDS: VenueMapPointKind[] = ['space', 'parking', 'entry', 'amenity', 'path'];
const hasValidGps = (point: VenueMapPoint) =>
  Number.isFinite(point.lat)
  && Number.isFinite(point.lng)
  && point.lat! >= -90
  && point.lat! <= 90
  && point.lng! >= -180
  && point.lng! <= 180;

interface MapClientRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Convert a viewport point through an xMidYMid/meet SVG viewport. */
export function clientPointToVenueMap(
  rect: MapClientRect,
  mapWidth: number,
  mapHeight: number,
  clientX: number,
  clientY: number,
): { x: number; y: number; inside: boolean } {
  const width = Math.max(1, mapWidth);
  const height = Math.max(1, mapHeight);
  if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0, inside: false };
  const scale = Math.min(rect.width / width, rect.height / height);
  if (!Number.isFinite(scale) || scale <= 0) return { x: 0, y: 0, inside: false };
  const renderedWidth = width * scale;
  const renderedHeight = height * scale;
  const offsetX = (rect.width - renderedWidth) / 2;
  const offsetY = (rect.height - renderedHeight) / 2;
  const rawX = (clientX - rect.left - offsetX) / scale;
  const rawY = (clientY - rect.top - offsetY) / scale;
  return {
    x: Math.max(0, Math.min(width, rawX)),
    y: Math.max(0, Math.min(height, rawY)),
    inside: rawX >= 0 && rawX <= width && rawY >= 0 && rawY <= height,
  };
}

/**
 * Shared, reusable full-property renderer. Pointer, keyboard, and assistive-
 * technology interactions all use the same point model in editable and portal
 * views.
 */
export function VenueMapCanvas({
  map,
  editable = false,
  selectedPointId,
  onSelectPoint,
  onMovePoint,
  onPlacePoint,
  placeKind = 'space',
  highlightPointIds,
  onPointClick,
  isPointInteractive,
  pointActionLabel,
  showLabels = true,
  showLegend = false,
  svgRef,
  title,
  hideMapWhenBackgroundUnavailable = false,
  onRetryBackgroundImage,
}: VenueMapCanvasProps) {
  const panHintId = useId();
  const svgRefInternal = useRef<SVGSVGElement | null>(null);
  const ref = svgRef || svgRefInternal;
  const [drag, setDrag] = useState<{
    id: string;
    pointerId: number;
    dx: number;
    dy: number;
  } | null>(null);
  const [focusedPointId, setFocusedPointId] = useState<string | null>(null);
  const [backgroundRetry, setBackgroundRetry] = useState(0);
  const [backgroundResolution, setBackgroundResolution] = useState<{
    source?: string;
    status: 'none' | 'loading' | 'ready' | 'error';
    url?: string;
  }>(() => {
    const source = map.backgroundImageUrl;
    if (map.backgroundImageUnavailable) return { source, status: 'error' };
    if (!source) return { status: 'none' };
    if (!isStoragePathRef(source)) return { source, status: 'ready', url: source };
    return { source, status: 'loading' };
  });

  useEffect(() => {
    let cancelled = false;
    const source = map.backgroundImageUrl;
    if (map.backgroundImageUnavailable) {
      setBackgroundResolution({ source, status: 'error' });
      return () => { cancelled = true; };
    }
    if (!source) {
      setBackgroundResolution({ status: 'none' });
      return () => { cancelled = true; };
    }
    if (!isStoragePathRef(source)) {
      setBackgroundResolution({ source, status: 'ready', url: source });
      return () => { cancelled = true; };
    }

    const refreshSignedUrl = (initial: boolean) => {
      if (initial) setBackgroundResolution({ source, status: 'loading' });
      void resolveImageRef(source)
        .then((url) => {
          if (!cancelled) {
            setBackgroundResolution(url
              ? { source, status: 'ready', url }
              : { source, status: 'error' });
          }
        })
        .catch(() => {
          if (cancelled) return;
          setBackgroundResolution((current) => (
            !initial && current.source === source && current.status === 'ready'
              ? current
              : { source, status: 'error' }
          ));
        });
    };

    refreshSignedUrl(true);
    const refreshTimer = window.setInterval(() => refreshSignedUrl(false), 50 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
    };
  }, [backgroundRetry, map.backgroundImageUnavailable, map.backgroundImageUrl]);

  const backgroundSource = map.backgroundImageUrl;
  const activeBackground = map.backgroundImageUnavailable
    ? { source: backgroundSource, status: 'error' as const, url: undefined }
    : !backgroundSource
      ? { source: undefined, status: 'none' as const, url: undefined }
      : backgroundResolution.source === backgroundSource
        ? backgroundResolution
        : isStoragePathRef(backgroundSource)
          ? { source: backgroundSource, status: 'loading' as const, url: undefined }
          : { source: backgroundSource, status: 'ready' as const, url: backgroundSource };
  const resolvedBackgroundUrl = activeBackground.status === 'ready'
    ? activeBackground.url
    : undefined;
  const backgroundExpected = Boolean(backgroundSource || map.backgroundImageUnavailable);
  const backgroundUnavailable = backgroundExpected
    && activeBackground.status === 'error';
  const hideSpatialMap = hideMapWhenBackgroundUnavailable
    && backgroundExpected
    && activeBackground.status !== 'ready';
  const retryBackground = () => {
    if (backgroundSource) {
      setBackgroundResolution({ source: backgroundSource, status: 'loading' });
      setBackgroundRetry((attempt) => attempt + 1);
    }
    onRetryBackgroundImage?.();
  };

  const W = Math.max(1, map.width || 100);
  const H = Math.max(1, map.height || 80);
  const unit = Math.max(0.25, Math.min(W, H) / 80);
  const mapAspectRatio = W / H;
  const extremeAspectRatio = mapAspectRatio > 4 || mapAspectRatio < 0.25;
  const minimumRenderedShortSide = 240;
  const extremeRenderedWidth = W >= H
    ? mapAspectRatio * minimumRenderedShortSide
    : minimumRenderedShortSide;

  const toMap = (event: { clientX: number; clientY: number }) => {
    const svg = ref.current;
    if (!svg) return { x: 0, y: 0, inside: false };
    return clientPointToVenueMap(svg.getBoundingClientRect(), W, H, event.clientX, event.clientY);
  };

  const canActivatePoint = (point: VenueMapPoint) =>
    point.kind !== 'path'
    && Boolean(onPointClick)
    && (isPointInteractive ? isPointInteractive(point) : true);
  const pointActionDescription = (point: VenueMapPoint) =>
    pointActionLabel?.(point) || (hasValidGps(point) ? 'Open in maps.' : 'Open this location.');

  const handleSvgClick = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!editable || !onPlacePoint) return;
    const target = event.target as Element;
    if (target.closest('[data-map-point], [data-map-ui]')) return;
    const position = toMap(event);
    if (position.inside) onPlacePoint(placeKind, position.x, position.y);
  };

  const handlePointDown = (event: React.PointerEvent<SVGGElement>, point: VenueMapPoint) => {
    if (!editable || !onMovePoint) return;
    event.preventDefault();
    event.stopPropagation();
    const position = toMap(event);
    ref.current?.setPointerCapture?.(event.pointerId);
    setDrag({
      id: point.id,
      pointerId: event.pointerId,
      dx: point.x - position.x,
      dy: point.y - position.y,
    });
    onSelectPoint?.(point.id);
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!drag || drag.pointerId !== event.pointerId || !onMovePoint) return;
    event.preventDefault();
    const position = toMap(event);
    onMovePoint(drag.id, position.x + drag.dx, position.y + drag.dy);
  };

  const endDrag = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (ref.current?.hasPointerCapture?.(event.pointerId)) {
      ref.current.releasePointerCapture?.(event.pointerId);
    }
    setDrag(null);
  };

  const handlePointKey = (event: React.KeyboardEvent<SVGGElement>, point: VenueMapPoint) => {
    if (event.key === 'Enter' || event.key === ' ') {
      if (!editable && !canActivatePoint(point)) return;
      event.preventDefault();
      if (editable) onSelectPoint?.(point.id);
      else onPointClick?.(point);
      return;
    }
    if (!editable || !onMovePoint || !event.key.startsWith('Arrow')) return;
    event.preventDefault();
    const step = event.shiftKey ? 5 : 1;
    const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
    const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
    onSelectPoint?.(point.id);
    onMovePoint(point.id, point.x + dx, point.y + dy);
  };

  const legendKinds = ALL_KINDS.filter((kind) => map.points.some((point) => point.kind === kind));
  const legendH = (legendKinds.length * 6 + 6) * unit;
  const longest = legendKinds.reduce((max, kind) => Math.max(max, pointKindLabel(kind).length), 0);
  const legendW = Math.max(18, longest * 2 + 11) * unit;
  const mapName = title?.trim() || 'Venue map';
  const interactive = editable || map.points.some(canActivatePoint);
  const actionablePoints = editable ? [] : map.points.filter(canActivatePoint);
  const nonActionableFallbackPoints = hideSpatialMap
    ? map.points.filter((point) => point.kind !== 'path' && !canActivatePoint(point))
    : [];
  const panExtremeMap = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!extremeAspectRatio || event.defaultPrevented) return;
    const distance = event.shiftKey ? 160 : 64;
    const delta = event.key === 'ArrowLeft'
      ? { left: -distance, top: 0 }
      : event.key === 'ArrowRight'
        ? { left: distance, top: 0 }
        : event.key === 'ArrowUp'
          ? { left: 0, top: -distance }
          : event.key === 'ArrowDown'
            ? { left: 0, top: distance }
            : null;
    if (!delta) return;
    event.preventDefault();
    event.currentTarget.scrollBy({ ...delta, behavior: 'smooth' });
  };

  return (
    <div>
      {backgroundExpected && activeBackground.status === 'loading' && hideMapWhenBackgroundUnavailable && (
        <div className="mb-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-3 text-sm text-sky-900" role="status">
          Loading the published property base map before showing spatial guidance…
        </div>
      )}
      {backgroundUnavailable && (
        <div className="mb-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-950" role="alert">
          <p className="font-semibold">The property base map is temporarily unavailable.</p>
          <p className="mt-1 text-xs">
            {hideMapWhenBackgroundUnavailable
              ? 'Spatial pins and walkways are hidden to avoid showing them against the wrong context. Named locations and any available actions remain below.'
              : 'Map vectors remain visible for venue-admin recovery. Retry first; if the image remains unavailable, upload a replacement base map or remove the broken reference.'}
          </p>
          {(backgroundSource || onRetryBackgroundImage) && (
            <button
              type="button"
              onClick={retryBackground}
              className="mt-2 min-h-11 rounded-lg border border-amber-400 bg-white px-3 py-2 text-xs font-semibold text-amber-950 hover:bg-amber-100"
            >
              Retry base map
            </button>
          )}
        </div>
      )}
      {!hideSpatialMap && (
        <>
          {extremeAspectRatio && (
            <p id={panHintId} className="no-print mb-2 text-xs text-gray-600">
              This map has an extra-wide or extra-tall layout. Scroll, swipe, or focus this viewport and use the arrow keys to pan without shrinking its locations.
            </p>
          )}
          <div
            data-map-scroll-viewport
            tabIndex={extremeAspectRatio ? 0 : undefined}
            role={extremeAspectRatio ? 'region' : undefined}
            aria-label={extremeAspectRatio ? 'Scrollable venue map viewport' : undefined}
            aria-describedby={extremeAspectRatio ? panHintId : undefined}
            onKeyDown={panExtremeMap}
            className={`spm-map-scroll-viewport ${extremeAspectRatio
              ? 'max-h-[70vh] overflow-auto overscroll-contain rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700'
              : ''}`}
          >
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className="block h-auto w-full rounded-lg border border-teal-100 bg-teal-50"
        role="group"
        aria-label={`${mapName}. ${map.points.length} mapped point${map.points.length === 1 ? '' : 's'} and ${(map.routes || []).length} walkway${(map.routes || []).length === 1 ? '' : 's'}.`}
        onClick={handleSvgClick}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{
          aspectRatio: `${W} / ${H}`,
          cursor: editable ? 'crosshair' : undefined,
          touchAction: editable
            ? extremeAspectRatio ? 'pan-x pan-y' : 'pan-y'
            : 'auto',
          width: extremeAspectRatio ? `${extremeRenderedWidth}px` : undefined,
          maxWidth: extremeAspectRatio ? 'none' : undefined,
          marginInline: extremeAspectRatio && H > W ? 'auto' : undefined,
        }}
      >
        <title>{mapName}</title>
        <desc>
          {interactive
            ? 'Interactive property map. Tab to individual points for details and actions.'
            : 'Property map showing venue locations and authored walkways.'}
        </desc>

        {/* Background and annotation layers are pointer-transparent so admins can
            place pins anywhere over a base map, route, or zone. */}
        {resolvedBackgroundUrl && (
          <image
            href={resolvedBackgroundUrl}
            x={0}
            y={0}
            width={W}
            height={H}
            preserveAspectRatio="none"
            opacity={map.backgroundOpacity ?? 0.85}
            pointerEvents="none"
            onError={() => setBackgroundResolution({
              source: backgroundSource,
              status: 'error',
            })}
          />
        )}

        <g pointerEvents="none" aria-hidden="true">
          {(map.drawings || []).map((draw) => {
            if (draw.type === 'rectangle' || draw.type === 'zone') {
              const width = draw.width ?? 20 * unit;
              const height = draw.height ?? 15 * unit;
              return (
                <g
                  key={draw.id}
                  transform={draw.rotation
                    ? `rotate(${draw.rotation} ${draw.x + width / 2} ${draw.y + height / 2})`
                    : undefined}
                >
                  <rect
                    x={draw.x}
                    y={draw.y}
                    width={width}
                    height={height}
                    fill={draw.fillColor || '#0d9488'}
                    fillOpacity={draw.opacity ?? 0.25}
                    stroke={draw.strokeColor || '#0d9488'}
                    strokeOpacity={draw.opacity ?? 1}
                    strokeWidth={draw.strokeWidth ?? 1 * unit}
                    rx={2 * unit}
                  />
                  {draw.text && (
                    <text
                      x={draw.x + width / 2}
                      y={draw.y + height / 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={3.5 * unit}
                      fontWeight="bold"
                      fill={draw.strokeColor || '#0d9488'}
                    >
                      {draw.text}
                    </text>
                  )}
                </g>
              );
            }
            if (draw.type === 'circle') {
              return (
                <g key={draw.id}>
                  <circle
                    cx={draw.x}
                    cy={draw.y}
                    r={draw.radius ?? 10 * unit}
                    fill={draw.fillColor || '#0d9488'}
                    fillOpacity={draw.opacity ?? 0.25}
                    stroke={draw.strokeColor || '#0d9488'}
                    strokeOpacity={draw.opacity ?? 1}
                    strokeWidth={draw.strokeWidth ?? 1 * unit}
                  />
                  {draw.text && (
                    <text
                      x={draw.x}
                      y={draw.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={3.5 * unit}
                      fontWeight="bold"
                      fill={draw.strokeColor || '#0d9488'}
                    >
                      {draw.text}
                    </text>
                  )}
                </g>
              );
            }
            if (draw.type === 'line' && draw.points && draw.points.length >= 2) {
              const labelPoint = draw.points[Math.floor(draw.points.length / 2)];
              return (
                <g key={draw.id}>
                  <polyline
                    points={draw.points.map((point) => `${point.x},${point.y}`).join(' ')}
                    fill="none"
                    stroke={draw.strokeColor || '#0d9488'}
                    strokeWidth={draw.strokeWidth ?? 1.5 * unit}
                    opacity={draw.opacity ?? 1}
                  />
                  {draw.text && (
                    <text
                      x={labelPoint.x}
                      y={labelPoint.y - 1.5 * unit}
                      textAnchor="middle"
                      fontSize={3.5 * unit}
                      fontWeight="bold"
                      fill={draw.strokeColor || '#0d9488'}
                      paintOrder="stroke"
                      stroke="#ffffff"
                      strokeWidth={0.8 * unit}
                    >
                      {draw.text}
                    </text>
                  )}
                </g>
              );
            }
            return null;
          })}

          {(map.routes || []).map((route) => {
            const points = routePoints(map, route);
            if (points.length < 2) return null;
            const stepFree = route.accessibility === 'step-free';
            const notStepFree = route.accessibility === 'not-step-free';
            const priority = route.priority || 'standard';
            const preferred = priority === 'preferred';
            const secondary = priority === 'secondary';
            const emergencyOnly = priority === 'emergency-only';
            const labelPoint = points[Math.floor(points.length / 2)];
            return (
              <g key={route.id}>
                <polyline
                  points={points.map((point) => `${point.x},${point.y}`).join(' ')}
                  fill="none"
                  stroke={emergencyOnly ? '#b91c1c' : stepFree ? '#047857' : notStepFree ? '#b45309' : '#0f766e'}
                  strokeWidth={(preferred ? 2 : emergencyOnly ? 1.8 : 1.4) * unit}
                  strokeDasharray={emergencyOnly
                    ? `${1.2 * unit},${1.2 * unit}`
                    : secondary
                      ? `${5 * unit},${2 * unit}`
                      : stepFree ? undefined : `${3 * unit},${2 * unit}`}
                  opacity={secondary ? 0.7 : 0.9}
                />
                {emergencyOnly && (
                  <text
                    x={labelPoint.x + 1.5 * unit}
                    y={labelPoint.y - 1.5 * unit}
                    fontSize={3 * unit}
                    fontWeight="bold"
                    fill="#991b1b"
                    paintOrder="stroke"
                    stroke="#ffffff"
                    strokeWidth={0.8 * unit}
                  >
                    Emergency only: {route.name}
                  </text>
                )}
              </g>
            );
          })}
        </g>

        {/* Points */}
        {map.points.map((point) => {
          const radius = (KIND_RADIUS[point.kind] ?? 4) * unit;
          const selected = selectedPointId === point.id;
          const focused = focusedPointId === point.id;
          const highlighted = highlightPointIds?.includes(point.id) ?? false;
          const pointInteractive = editable || canActivatePoint(point);
          const accessibleAction = !editable && pointInteractive
            ? pointActionDescription(point)
            : '';
          return (
            <g
              key={point.id}
              data-map-point={point.id}
              tabIndex={pointInteractive ? 0 : undefined}
              role={pointInteractive ? 'button' : undefined}
              aria-label={pointInteractive
                ? `${pointKindLabel(point.kind)}: ${point.label}${accessibleAction ? `. ${accessibleAction}` : ''}`
                : undefined}
              onPointerDown={(event) => handlePointDown(event, point)}
              onClick={(event) => {
                event.stopPropagation();
                if (!editable && canActivatePoint(point)) onPointClick?.(point);
              }}
              onKeyDown={(event) => handlePointKey(event, point)}
              onFocus={() => {
                setFocusedPointId(point.id);
                if (editable) onSelectPoint?.(point.id);
              }}
              onBlur={() => setFocusedPointId((current) => current === point.id ? null : current)}
              style={{
                cursor: editable ? 'grab' : pointInteractive ? 'pointer' : 'default',
                touchAction: editable ? 'none' : 'auto',
              }}
            >
              <circle cx={point.x} cy={point.y} r={radius + 3 * unit} fill="transparent" />
              {focused && (
                <g data-map-focus-ring={point.id} pointerEvents="none" aria-hidden="true">
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={radius + 2.8 * unit}
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth={3 * unit}
                  />
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={radius + 2.8 * unit}
                    fill="none"
                    stroke="#111827"
                    strokeWidth={1.5 * unit}
                  />
                </g>
              )}
              {highlighted && point.kind !== 'path' && (
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={radius + 3.5 * unit}
                  fill="none"
                  stroke="#4A1942"
                  strokeWidth={1.1 * unit}
                  strokeDasharray={`${2 * unit},${1.5 * unit}`}
                  pointerEvents="none"
                />
              )}
              {point.kind !== 'path' ? (
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={radius}
                  fill={pointColor(point.kind)}
                  stroke={selected ? '#111827' : 'white'}
                  strokeWidth={(selected ? 1.6 : 1) * unit}
                  pointerEvents="none"
                />
              ) : (
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={1.5 * unit}
                  fill={pointColor(point.kind)}
                  pointerEvents="none"
                />
              )}
              {showLabels && point.kind !== 'path' && (
                <text
                  x={point.x + radius + 1.5 * unit}
                  y={point.y - radius - unit}
                  fontSize={4.5 * unit}
                  fill="#1f2937"
                  paintOrder="stroke"
                  stroke="#ffffff"
                  strokeWidth={0.9 * unit}
                  strokeLinejoin="round"
                  pointerEvents="none"
                >
                  {pointKindIcon(point.kind)} {point.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Visual title and legend render above the base image and annotations. */}
        {title && (
          <g data-map-ui="title" pointerEvents="none" aria-hidden="true">
            <rect x={W * 0.2} y={1.2 * unit} width={W * 0.6} height={7 * unit} rx={2 * unit} fill="#ffffff" opacity={0.86} />
            <text x={W / 2} y={6.2 * unit} textAnchor="middle" fontSize={5 * unit} fontWeight="bold" fill="#1f2937">
              {title}
            </text>
          </g>
        )}
        {showLegend && legendKinds.length > 0 && (
          <g data-map-ui="legend" pointerEvents="none" aria-hidden="true">
            <rect
              x={W - legendW - 2 * unit}
              y={H - legendH - 2 * unit}
              width={legendW}
              height={legendH}
              rx={2 * unit}
              fill="#ffffff"
              opacity={0.9}
              stroke="#d1d5db"
              strokeWidth={0.5 * unit}
            />
            {legendKinds.map((kind, index) => (
              <g key={kind}>
                <circle
                  cx={W - legendW + 4 * unit}
                  cy={H - legendH + (4 + index * 6) * unit}
                  r={1.8 * unit}
                  fill={pointColor(kind)}
                />
                <text
                  x={W - legendW + 9 * unit}
                  y={H - legendH + (5.4 + index * 6) * unit}
                  fontSize={3.5 * unit}
                  fill="#374151"
                >
                  {pointKindLabel(kind)}
                </text>
              </g>
            ))}
          </g>
        )}
      </svg>
          </div>
        </>
      )}
      {editable && onSelectPoint && map.points.length > 0 && (
        <details className="no-print mt-2 rounded-lg border border-gray-200 bg-white text-sm spm-studio-chrome">
          <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 px-3 py-2 font-semibold text-gray-700">
            <span>Map points for editing</span>
            <span className="text-xs font-normal text-gray-500">
              {map.points.length} point{map.points.length === 1 ? '' : 's'}
            </span>
          </summary>
          <div className="grid gap-2 border-t border-gray-200 p-2 sm:grid-cols-2">
            {map.points.map((point) => {
              const selected = point.id === selectedPointId;
              return (
                <button
                  key={point.id}
                  type="button"
                  onClick={() => onSelectPoint(point.id)}
                  aria-pressed={selected}
                  aria-label={`Select ${point.label} for editing. ${pointKindLabel(point.kind)} at X ${point.x}, Y ${point.y}.`}
                  className={`flex min-h-11 w-full items-center gap-2 rounded-lg border px-3 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                    selected
                      ? 'border-teal-500 bg-teal-50 text-teal-950'
                      : 'border-gray-200 text-gray-700 hover:border-teal-300 hover:bg-teal-50'
                  }`}
                >
                  <span aria-hidden="true">{pointKindIcon(point.kind)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{point.label}</span>
                    <span className="block text-xs text-gray-500">
                      {pointKindLabel(point.kind)} · X {point.x}, Y {point.y}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </details>
      )}
      {nonActionableFallbackPoints.length > 0 && (
        <details className="mt-2 rounded-lg border border-gray-200 bg-white text-sm">
          <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 px-3 py-2 font-semibold text-gray-700">
            <span>Named map locations</span>
            <span className="text-xs font-normal text-gray-500">
              {nonActionableFallbackPoints.length} location{nonActionableFallbackPoints.length === 1 ? '' : 's'}
            </span>
          </summary>
          <ul className="grid gap-2 border-t border-gray-200 p-2 sm:grid-cols-2">
            {nonActionableFallbackPoints.map((point) => (
              <li key={point.id} className="rounded-lg border border-gray-200 px-3 py-2 text-gray-700">
                <span className="font-semibold">{pointKindIcon(point.kind)} {point.label}</span>
                <span className="block text-xs text-gray-500">{pointKindLabel(point.kind)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {actionablePoints.length > 0 && (
        <details className="mt-2 rounded-lg border border-gray-200 bg-white text-sm">
          <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 px-3 py-2 font-semibold text-gray-700">
            <span>Map location actions</span>
            <span className="text-xs font-normal text-gray-500">{actionablePoints.length} location{actionablePoints.length === 1 ? '' : 's'}</span>
          </summary>
          <div className="grid gap-2 border-t border-gray-200 p-2 sm:grid-cols-2">
            {actionablePoints.map((point) => (
              <button
                key={point.id}
                type="button"
                onClick={() => onPointClick?.(point)}
                className="flex min-h-11 w-full items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-left text-gray-700 hover:border-teal-300 hover:bg-teal-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                aria-label={`${pointKindLabel(point.kind)}: ${point.label}. ${pointActionDescription(point)}`}
              >
                <span aria-hidden="true">{pointKindIcon(point.kind)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{point.label}</span>
                  <span className="block text-xs text-gray-500">{pointActionDescription(point)}</span>
                </span>
              </button>
            ))}
          </div>
        </details>
      )}
      <p className="sr-only">
        {map.points.map((point) => `${pointKindLabel(point.kind)}: ${point.label}${point.description ? `. ${point.description}` : ''}.`).join(' ')}
        {hideSpatialMap
          ? ' Spatial walkways and zones are hidden until the property base map is available.'
          : (map.routes || []).map((route) => ` Walkway: ${route.name}. Routing priority: ${routePriorityLabel(route.priority)}. ${route.accessibility === 'step-free' ? 'Venue-verified step-free.' : route.accessibility === 'not-step-free' ? 'Not step-free.' : 'Mobility status not verified.'}${route.notes ? ` ${route.notes}` : ''}`).join('')}
        {!hideSpatialMap && (map.drawings || []).filter((drawing) => drawing.text).map((drawing) => ` Map shape: ${drawing.text}.`).join('')}
      </p>
    </div>
  );
}
