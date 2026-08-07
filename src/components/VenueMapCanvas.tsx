import { useRef, useState } from 'react';
import { VenueMapConfig, VenueMapPoint, VenueMapPointKind } from '../types';
import { pointColor, pointKindIcon } from '../utils/venueMapDesigner';
import { routePoints } from '../utils/venueMapDesigner';

export interface VenueMapCanvasProps {
  map: VenueMapConfig;
  /** When true, points can be dragged and the canvas click-places (designer mode). */
  editable?: boolean;
  selectedPointId?: string | null;
  onSelectPoint?: (id: string | null) => void;
  onMovePoint?: (id: string, x: number, y: number) => void;
  onPlacePoint?: (kind: VenueMapPointKind, x: number, y: number) => void;
  /** Fired on click/tap of a point even in read-only mode (e.g. couple drill-in). */
  onPointClick?: (point: VenueMapPoint) => void;
  /** Show labels (default true). */
  showLabels?: boolean;
  /** Forwarded so print/export can capture the rendered SVG. */
  svgRef?: React.RefObject<SVGSVGElement | null>;
  /** Optional subtitle/header shown above the map (for the printable Venue Map). */
  title?: string;
}

const KIND_RADIUS = { space: 5, parking: 5, entry: 4.5, amenity: 4, path: 2 };

/**
 * Shared, reusable interactive full-venue map renderer. Renders every point and
 * walkway route of the venue map as an SVG. In `editable` mode (the designer) the
 * venue can drag points and click-to-place; in read-only mode (couple drill-in,
 * guest wayfinding, printable) it just renders.
 */
export function VenueMapCanvas({
  map,
  editable = false,
  selectedPointId,
  onSelectPoint,
  onMovePoint,
  onPlacePoint,
  onPointClick,
  showLabels = true,
  svgRef,
  title,
}: VenueMapCanvasProps) {
  const svgRefInternal = useRef<SVGSVGElement | null>(null);
  const ref = svgRef || svgRefInternal;
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number } | null>(null);

  const W = Math.max(1, map.width || 100);
  const H = Math.max(1, map.height || 80);

  const toMap = (e: React.MouseEvent<SVGElement>) => {
    const svg = ref.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const y = ((e.clientY - rect.top) / rect.height) * H;
    return { x, y };
  };

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!editable || !onPlacePoint) return;
    if (e.target !== e.currentTarget) return; // ignore clicks on points/routes
    const { x, y } = toMap(e);
    onPlacePoint('space', x, y);
  };

  const handlePointDown = (e: React.MouseEvent<SVGGElement>, p: VenueMapPoint) => {
    if (!editable) return;
    e.stopPropagation();
    const { x, y } = toMap(e);
    setDrag({ id: p.id, dx: p.x - x, dy: p.y - y });
    onSelectPoint?.(p.id);
  };

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!drag || !onMovePoint) return;
    const { x, y } = toMap(e);
    onMovePoint(drag.id, x + drag.dx, y + drag.dy);
  };

  const endDrag = () => setDrag(null);

  return (
    <div>
      {title && (
        <div className="text-center py-1 text-sm font-semibold text-gray-700">{title}</div>
      )}
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-64 bg-teal-50 rounded-lg border border-teal-100"
        onClick={handleSvgClick}
        onMouseMove={handleMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        style={editable ? { cursor: 'crosshair' } : undefined}
      >
        {/* Walkway routes */}
        {(map.routes || []).map((route) => {
          const pts = routePoints(map, route);
          if (pts.length < 2) return null;
          return (
            <polyline
              key={route.id}
              points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke="#14b8a6"
              strokeWidth={1.2}
              strokeDasharray="3,2"
              opacity={0.8}
            />
          );
        })}
        {/* Points */}
        {map.points.map((p) => {
          const r = KIND_RADIUS[p.kind] ?? 4;
          const selected = selectedPointId === p.id;
          return (
            <g
              key={p.id}
              onMouseDown={(e) => handlePointDown(e, p)}
              onClick={(e) => { if (!editable) { e.stopPropagation(); onPointClick?.(p); } }}
              style={{ cursor: editable ? 'grab' : onPointClick && p.kind !== 'path' ? 'pointer' : 'default' }}
            >
              {p.kind !== 'path' && (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={r}
                  fill={pointColor(p.kind)}
                  stroke={selected ? '#111827' : 'white'}
                  strokeWidth={selected ? 1.6 : 1}
                />
              )}
              {p.kind === 'path' && (
                <circle cx={p.x} cy={p.y} r={1.5} fill={pointColor(p.kind)} />
              )}
              {showLabels && p.kind !== 'path' && (
                <text x={p.x + r + 1.5} y={p.y - r - 1} fontSize={4.5} fill="#374151">
                  {pointKindIcon(p.kind)} {p.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
