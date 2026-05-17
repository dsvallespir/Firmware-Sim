/*
 * ============================================================
 * CircuitWires.jsx — Cables SVG entre componentes
 * ============================================================
 *
 * Dibuja líneas SVG (paths) representando las conexiones
 * eléctricas entre pines del board y componentes.
 *
 * Usa las posiciones de los pines extraídas de pinInfo de cada
 * wokwi web component para calcular los puntos de inicio/fin.
 *
 * Los cables se dibujan como curvas Bezier suaves con el color
 * definido en el circuit JSON.
 */

import { useMemo } from 'react';

/**
 * Colores predefinidos para cables (estilo Wokwi/Fritzing)
 */
const WIRE_COLORS = {
  red: '#ef4444',
  green: '#22c55e',
  blue: '#3b82f6',
  yellow: '#eab308',
  orange: '#f97316',
  purple: '#a855f7',
  black: '#1e293b',
  white: '#e2e8f0',
  brown: '#92400e',
  gray: '#6b7280',
};

function resolveColor(color) {
  if (!color) return WIRE_COLORS.green;
  if (color.startsWith('#')) return color;
  return WIRE_COLORS[color] || WIRE_COLORS.green;
}

/**
 * Generar un path SVG curvo entre dos puntos.
 * Si se proveen waypoints, genera una polilínea con segmentos rectos.
 * Sin waypoints usa curvas Bezier cúbicas para un aspecto natural.
 */
export function wirePath(x1, y1, x2, y2, waypoints = []) {
  if (waypoints && waypoints.length > 0) {
    const pts = [[x1, y1], ...waypoints, [x2, y2]];
    return pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');
  }

  const dx = x2 - x1;  // signed
  const dy = y2 - y1;  // signed
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Cable cortísimo: línea recta
  if (dist < 5) return `M ${x1} ${y1} L ${x2} ${y2}`;

  // Curvatura proporcional a la distancia, con límite
  const tension = Math.min(dist * 0.3, 60) + 15;

  if (adx > ady * 1.5) {
    // Mayormente horizontal → tangente horizontal en los extremos
    const sx = Math.sign(dx) || 1;
    return `M ${x1} ${y1} C ${x1 + tension * sx} ${y1}, ${x2 - tension * sx} ${y2}, ${x2} ${y2}`;
  } else if (ady > adx * 1.5) {
    // Mayormente vertical → tangente vertical en los extremos
    const sy = Math.sign(dy) || 1;
    return `M ${x1} ${y1} C ${x1} ${y1 + tension * sy}, ${x2} ${y2 - tension * sy}, ${x2} ${y2}`;
  } else {
    // Diagonal → S-curve suave
    return `M ${x1} ${y1} C ${x1 + dx * 0.4} ${y1}, ${x2} ${y2 - dy * 0.4}, ${x2} ${y2}`;
  }
}

/**
 * CircuitWires — Renderiza cables SVG superpuestos al circuito.
 *
 * @param {object} props
 * @param {Array} props.wires - Array de wires del circuit definition
 * @param {Map<string, {x: number, y: number}>} props.pinPositions - Mapa "compId.pinName" → {x,y} absolutas
 * @param {number} props.width - Ancho del SVG
 * @param {number} props.height - Alto del SVG
 * @param {Function} [props.onWireContextMenu] - (e, wireIdx) clic derecho → borrar
 * @param {Function} [props.onWireSegmentClick] - (e, wireIdx, segIdx) clic izquierdo → insertar waypoint
 */
export default function CircuitWires({ wires = [], pinPositions, width = 800, height = 600, onWireContextMenu, onWireSegmentClick }) {
  const paths = useMemo(() => {
    if (!pinPositions || pinPositions.size === 0) return [];

    return wires.map((wire, idx) => {
      const fromKey = `${wire.from[0]}.${wire.from[1]}`;
      const toKey = `${wire.to[0]}.${wire.to[1]}`;

      const fromPos = pinPositions.get(fromKey);
      const toPos = pinPositions.get(toKey);

      if (!fromPos || !toPos) return null;

      const points = wire.points ?? [];
      return {
        id: `wire-${idx}`,
        wireIdx: idx,
        d: wirePath(fromPos.x, fromPos.y, toPos.x, toPos.y, points),
        color: resolveColor(wire.color),
        points,
        fromPos,
        toPos,
      };
    }).filter(Boolean);
  }, [wires, pinPositions]);

  return (
    <svg
      className="absolute inset-0"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ zIndex: 5, pointerEvents: 'none' }}
    >
      {/* Sombra debajo de los cables */}
      <defs>
        <filter id="wire-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodOpacity="0.15" />
        </filter>
      </defs>

      {paths.map(({ id, d, color, wireIdx, points, fromPos, toPos }, idx) => (
        <g key={id}>
          {/* Per-segment invisible hit areas for right-click (delete) and left-click (insert waypoint) */}
          {(onWireContextMenu || onWireSegmentClick) && (() => {
            const allPts = [[fromPos.x, fromPos.y], ...points, [toPos.x, toPos.y]];
            return allPts.slice(0, -1).map((_, s) => {
              const [ax, ay] = allPts[s];
              const [bx, by] = allPts[s + 1];
              // For single-segment no-waypoint wires, use the full Bezier path as hit area
              const segD = (points.length === 0 && s === 0)
                ? d
                : `M ${ax} ${ay} L ${bx} ${by}`;
              return (
                <path
                  key={`hit-${s}`}
                  d={segD}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={12}
                  strokeLinecap="round"
                  style={{ cursor: onWireSegmentClick ? 'cell' : 'pointer', pointerEvents: 'stroke' }}
                  onClick={onWireSegmentClick
                    ? (e) => { e.preventDefault(); e.stopPropagation(); onWireSegmentClick(e, wireIdx, s); }
                    : undefined}
                  onContextMenu={onWireContextMenu
                    ? (e) => { e.preventDefault(); onWireContextMenu(e, wireIdx); }
                    : undefined}
                />
              );
            });
          })()}
          {/* Cable principal */}
          <path
            d={d}
            fill="none"
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
            filter="url(#wire-shadow)"
            style={{ pointerEvents: 'none' }}
          />
          {/* Brillo interno */}
          <path
            d={d}
            fill="none"
            stroke="white"
            strokeWidth={0.5}
            strokeLinecap="round"
            opacity={0.3}
            style={{ pointerEvents: 'none' }}
          />
        </g>
      ))}
    </svg>
  );
}
