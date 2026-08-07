import { useRef, useState } from 'react';
import { VenueMapConfig, VenueMapPoint, VenueMapPointKind } from '../types';
import { pointColor, pointKindIcon, pointKindLabel } from '../utils/venueMapDesigner';
import { routePoints } from '../utils/venueMapDesigner';

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
  /** Fired on click/tap of a point even in read-only mode (e.g. couple drill-in). */
  onPointClick?: (point: VenueMapPoint) => void;
  /** Show labels (default true). */
  showLabels?: boolean;
  /** Render a color legend (by point kind) in the corner of the map — included in exports. */
  showLegend?: boolean;
  /** Forwarded so print/export can capture the rendered SVG. */
  svgRef?: React.RefObject<SVGSVGElement | null>;
  /** Optional title rendered inside the SVG (top center) so it appears in exports. */
  title?: string;
}

const KIND_RADIUS = { space: 5, parking: 5, entry: 4.5, amenity: 4, path: 2 };

const ALL_KINDS: VenueMapPointKind[] = ['space', 'parking', 'entry', 'amenity', 'path'];

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
  placeKind = 'space',
  highlightPointIds,
  onPointClick,
  showLabels = true,
  showLegend = false,
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
    onPlacePoint(placeKind, x, y);
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

  // Which kinds actually appear, for the color legend.
  const legendKinds = ALL_KINDS.filter((k) => map.points.some((p) => p.kind === k));
  const legendH = legendKinds.length * 6 + 6;
  const longest = legendKinds.reduce((m, k) => Math.max(m, pointKindLabel(k).length), 0);
  const legendW = Math.max(18, longest * 2 + 11);

  return (
    <div>
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
        {title && (
          <text x={W / 2} y={7} textAnchor="middle" fontSize={5} fontWeight="bold" fill="#374151">
            {title}
          </text>
        )}
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
          const highlighted = highlightPointIds?.includes(p.id) ?? false;
          return (
            <g
              key={p.id}
              onMouseDown={(e) => handlePointDown(e, p)}
              onClick={(e) => { if (!editable) { e.stopPropagation(); onPointClick?.(p); } }}
              style={{ cursor: editable ? 'grab' : onPointClick && p.kind !== 'path' ? 'pointer' : 'default' }}
            >
              {highlighted && p.kind !== 'path' && (
                <circle cx={p.x} cy={p.y} r={r + 3.5} fill="none" stroke="#4A1942" strokeWidth={1.1} strokeDasharray="2,1.5" />
              )}
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
        {/* Legend (bottom-right) */}
        {showLegend && legendKinds.length > 0 && (
          <g>
            <rect
              x={W - legendW - 2}
              y={H - legendH - 2}
              width={legendW}
              height={legendH}
              rx={2}
              fill="#ffffff"
              opacity={0.88}
              stroke="#d1d5db"
            />
            {legendKinds.map((k, i) => (
              <g key={k}>
                <circle cx={W - legendW + 4} cy={H - legendH + 4 + i * 6} r={1.8} fill={pointColor(k)} />
                <text x={W - legendW + 9} y={H - legendH + 5.4 + i * 6} fontSize={3.5} fill="#374151">
                  {pointKindLabel(k)}
                </text>
              </g>
            ))}
          </g>
        )}
      </svg>
    </div>
  );
}
