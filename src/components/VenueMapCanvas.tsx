import { useEffect, useRef, useState } from 'react';
import { VenueMapConfig, VenueMapPoint, VenueMapPointKind } from '../types';
import {
  pointColor,
  pointKindIcon,
  pointKindLabel,
  routePoints,
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
}: VenueMapCanvasProps) {
  const svgRefInternal = useRef<SVGSVGElement | null>(null);
  const ref = svgRef || svgRefInternal;
  const [drag, setDrag] = useState<{
    id: string;
    pointerId: number;
    dx: number;
    dy: number;
  } | null>(null);
  const [resolvedBackgroundUrl, setResolvedBackgroundUrl] = useState<string | undefined>(
    map.backgroundImageUrl && !isStoragePathRef(map.backgroundImageUrl) ? map.backgroundImageUrl : undefined,
  );

  useEffect(() => {
    let cancelled = false;
    const source = map.backgroundImageUrl;
    if (!source) {
      setResolvedBackgroundUrl(undefined);
      return () => { cancelled = true; };
    }
    if (!isStoragePathRef(source)) {
      setResolvedBackgroundUrl(source);
      return () => { cancelled = true; };
    }
    const refreshSignedUrl = () => {
      void resolveImageRef(source)
        .then((url) => { if (!cancelled) setResolvedBackgroundUrl(url || undefined); })
        .catch(() => { if (!cancelled) setResolvedBackgroundUrl(undefined); });
    };
    refreshSignedUrl();
    const refreshTimer = window.setInterval(refreshSignedUrl, 50 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
    };
  }, [map.backgroundImageUrl]);

  const W = Math.max(1, map.width || 100);
  const H = Math.max(1, map.height || 80);
  const unit = Math.max(0.25, Math.min(W, H) / 80);

  const toMap = (event: { clientX: number; clientY: number }) => {
    const svg = ref.current;
    if (!svg) return { x: 0, y: 0, inside: false };
    return clientPointToVenueMap(svg.getBoundingClientRect(), W, H, event.clientX, event.clientY);
  };

  const canActivatePoint = (point: VenueMapPoint) =>
    point.kind !== 'path'
    && Boolean(onPointClick)
    && (isPointInteractive ? isPointInteractive(point) : true);

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

  return (
    <div>
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
          touchAction: editable ? 'pan-y' : 'auto',
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
                <circle
                  key={draw.id}
                  cx={draw.x}
                  cy={draw.y}
                  r={draw.radius ?? 10 * unit}
                  fill={draw.fillColor || '#0d9488'}
                  fillOpacity={draw.opacity ?? 0.25}
                  stroke={draw.strokeColor || '#0d9488'}
                  strokeOpacity={draw.opacity ?? 1}
                  strokeWidth={draw.strokeWidth ?? 1 * unit}
                />
              );
            }
            if (draw.type === 'line' && draw.points && draw.points.length >= 2) {
              return (
                <polyline
                  key={draw.id}
                  points={draw.points.map((point) => `${point.x},${point.y}`).join(' ')}
                  fill="none"
                  stroke={draw.strokeColor || '#0d9488'}
                  strokeWidth={draw.strokeWidth ?? 1.5 * unit}
                  opacity={draw.opacity ?? 1}
                />
              );
            }
            return null;
          })}

          {(map.routes || []).map((route) => {
            const points = routePoints(map, route);
            if (points.length < 2) return null;
            const stepFree = route.accessibility === 'step-free';
            const notStepFree = route.accessibility === 'not-step-free';
            return (
              <polyline
                key={route.id}
                points={points.map((point) => `${point.x},${point.y}`).join(' ')}
                fill="none"
                stroke={stepFree ? '#047857' : notStepFree ? '#b45309' : '#0f766e'}
                strokeWidth={1.4 * unit}
                strokeDasharray={stepFree ? undefined : `${3 * unit},${2 * unit}`}
                opacity={0.9}
              />
            );
          })}
        </g>

        {/* Points */}
        {map.points.map((point) => {
          const radius = (KIND_RADIUS[point.kind] ?? 4) * unit;
          const selected = selectedPointId === point.id;
          const highlighted = highlightPointIds?.includes(point.id) ?? false;
          const pointInteractive = editable || canActivatePoint(point);
          const gpsAvailable = hasValidGps(point);
          const accessibleAction = !editable && pointInteractive
            ? pointActionLabel?.(point) || (gpsAvailable ? 'Open in maps available.' : '')
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
              onFocus={() => { if (editable) onSelectPoint?.(point.id); }}
              style={{
                cursor: editable ? 'grab' : pointInteractive ? 'pointer' : 'default',
                touchAction: editable ? 'none' : 'auto',
              }}
            >
              <circle cx={point.x} cy={point.y} r={radius + 3 * unit} fill="transparent" />
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
      <p className="sr-only">
        {map.points.map((point) => `${pointKindLabel(point.kind)}: ${point.label}${point.description ? `. ${point.description}` : ''}.`).join(' ')}
        {(map.routes || []).map((route) => ` Walkway: ${route.name}. ${route.accessibility === 'step-free' ? 'Venue-verified step-free.' : route.accessibility === 'not-step-free' ? 'Not step-free.' : 'Mobility status not verified.'}${route.notes ? ` ${route.notes}` : ''}`).join('')}
        {(map.drawings || []).filter((drawing) => drawing.text).map((drawing) => ` Map zone: ${drawing.text}.`).join('')}
      </p>
    </div>
  );
}
