/**
 * LogicAnalyzerPanel.jsx
 * ----------------------
 * Panel de visualización de formas de onda digitales.
 *
 * - Renderizado 100 % en Canvas 2D (sin librería externa).
 * - Eje X en µs derivados de cpu.cycles / 16 (no tiempo real del sistema).
 * - Buffer circular con 50 000 flancos máx. por canal.
 * - Zoom con rueda del mouse, pan con drag o teclas ←/→.
 * - Auto-scroll al último flanco cuando la simulación está corriendo.
 */

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { X, Trash2, ZoomIn, ZoomOut, Maximize2, RefreshCw } from 'lucide-react';

// ---------------------------------------------------------------------------
// Constantes de layout
// ---------------------------------------------------------------------------
const LABEL_W  = 90;   // px — ancho de la columna de etiquetas
const RULER_H  = 22;   // px — alto de la regla de tiempo
const ROW_H    = 52;   // px — alto de cada canal
const MIN_VIEW = 50;   // µs mínimos visibles

// Rangos de zoom predefinidos (µs)
const ZOOM_LEVELS = [100, 500, 1_000, 5_000, 10_000, 50_000, 100_000, 500_000, 1_000_000, 5_000_000];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatTime(us) {
  if (us === 0) return '0';
  if (Math.abs(us) < 1_000)   return `${us.toFixed(0)} µs`;
  if (Math.abs(us) < 1_000_000) return `${(us / 1_000).toFixed(2)} ms`;
  return `${(us / 1_000_000).toFixed(3)} s`;
}

function niceTickInterval(viewDuration, maxTicks = 8) {
  const raw  = viewDuration / maxTicks;
  const exp  = Math.pow(10, Math.floor(Math.log10(raw)));
  const frac = raw / exp;
  let nice;
  if (frac < 1.5) nice = 1;
  else if (frac < 3.5) nice = 2;
  else if (frac < 7.5) nice = 5;
  else nice = 10;
  return nice * exp;
}

// ---------------------------------------------------------------------------
// Canvas rendering
// ---------------------------------------------------------------------------
function renderCanvas(canvas, channels, viewStart, viewDuration, cursorUs) {
  if (!canvas) return;
  const ctx  = canvas.getContext('2d');
  const W    = canvas.width;
  const H    = canvas.height;
  const WAVE_W = W - LABEL_W;

  ctx.clearRect(0, 0, W, H);

  // ── Fondo ──────────────────────────────────────────────────────────────
  ctx.fillStyle = '#070d1a';
  ctx.fillRect(0, 0, W, H);

  const toX = (t) => LABEL_W + ((t - viewStart) / viewDuration) * WAVE_W;

  // ── Regla de tiempo ─────────────────────────────────────────────────────
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(LABEL_W, 0, WAVE_W, RULER_H);

  const tickInterval = niceTickInterval(viewDuration);
  const firstTick = Math.ceil(viewStart / tickInterval) * tickInterval;

  ctx.font = '9px ui-monospace, monospace';
  ctx.textAlign = 'center';

  for (let t = firstTick; t <= viewStart + viewDuration; t += tickInterval) {
    const x = toX(t);
    if (x < LABEL_W || x > W) continue;

    // Línea de cuadrícula vertical
    ctx.strokeStyle = 'rgba(51,65,85,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, RULER_H);
    ctx.lineTo(x, H);
    ctx.stroke();

    // Tick + label
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, RULER_H - 6);
    ctx.lineTo(x, RULER_H);
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.fillText(formatTime(t), x, RULER_H - 8);
  }

  // Borde inferior de la regla
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(LABEL_W, RULER_H);
  ctx.lineTo(W, RULER_H);
  ctx.stroke();

  // ── Canales ──────────────────────────────────────────────────────────────
  let rowIdx = 0;
  for (const [, ch] of channels) {
    const rowY   = RULER_H + rowIdx * ROW_H;
    const HIGH_Y = rowY + ROW_H * 0.18;
    const LOW_Y  = rowY + ROW_H * 0.82;

    // Fondo alterno
    ctx.fillStyle = rowIdx % 2 === 0 ? '#0b1222' : '#0d1628';
    ctx.fillRect(0, rowY, W, ROW_H);

    // Separador
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, rowY + ROW_H);
    ctx.lineTo(W, rowY + ROW_H);
    ctx.stroke();

    // Zona de etiqueta
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, rowY, LABEL_W, ROW_H);

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(LABEL_W, rowY);
    ctx.lineTo(LABEL_W, rowY + ROW_H);
    ctx.stroke();

    // Etiqueta
    ctx.textAlign    = 'right';
    ctx.font         = 'bold 11px ui-monospace, monospace';
    ctx.fillStyle    = ch.color;
    ctx.fillText(ch.label, LABEL_W - 6, rowY + ROW_H * 0.5 + 2);

    ctx.font      = '9px ui-monospace, monospace';
    ctx.fillStyle = '#334155';
    ctx.fillText(`${ch.edges.length} flancos`, LABEL_W - 6, rowY + ROW_H * 0.5 + 14);

    // ── Forma de onda ────────────────────────────────────────────────────
    const { edges } = ch;

    // Nivel inicial: último flanco antes de viewStart
    let initLevel = 0;
    {
      let lo = 0, hi = edges.length - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (edges[mid].t <= viewStart) { initLevel = edges[mid].v; lo = mid + 1; }
        else hi = mid - 1;
      }
    }

    ctx.strokeStyle = ch.color;
    ctx.lineWidth   = 1.5;
    ctx.shadowColor  = ch.color;
    ctx.shadowBlur   = 2;
    ctx.beginPath();

    let curX = LABEL_W;
    let curY = initLevel ? HIGH_Y : LOW_Y;
    ctx.moveTo(curX, curY);

    // Buscar primer flanco en ventana
    let startIdx = 0;
    {
      let lo = 0, hi = edges.length - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (edges[mid].t < viewStart) { startIdx = mid + 1; lo = mid + 1; }
        else hi = mid - 1;
      }
    }

    for (let i = startIdx; i < edges.length; i++) {
      const e = edges[i];
      if (e.t > viewStart + viewDuration) break;
      const ex = toX(e.t);
      const ey = e.v ? HIGH_Y : LOW_Y;
      ctx.lineTo(ex, curY); // horizontal al estado previo
      ctx.lineTo(ex, ey);   // transición vertical
      curX = ex;
      curY = ey;
    }
    ctx.lineTo(W, curY); // extender hasta el borde derecho
    ctx.stroke();
    ctx.shadowBlur = 0;

    rowIdx++;
  }

  // ── Cursor de tiempo ────────────────────────────────────────────────────
  if (cursorUs !== null) {
    const cx = toX(cursorUs);
    if (cx >= LABEL_W && cx <= W) {
      ctx.strokeStyle = 'rgba(248,250,252,0.55)';
      ctx.lineWidth   = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(cx, RULER_H);
      ctx.lineTo(cx, H);
      ctx.stroke();
      ctx.setLineDash([]);

      // Etiqueta del cursor
      const label = formatTime(cursorUs);
      const lw = ctx.measureText(label).width + 10;
      const lx = Math.min(cx, W - lw - 2);
      ctx.fillStyle = 'rgba(15,23,42,0.9)';
      ctx.fillRect(lx, H - 16, lw, 14);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '9px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(label, lx + 5, H - 5);
    }
  }

  // ── Estado vacío ────────────────────────────────────────────────────────
  if (channels.size === 0) {
    ctx.fillStyle = '#1e293b';
    ctx.font = '13px ui-sans-serif, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Activa el modo 🔬 Sonda y haz clic en un pin o cable del diagrama', W / 2, H / 2 - 10);
    ctx.font = '11px ui-sans-serif, sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText('Los flancos se capturan en tiempo de ciclo de CPU (1 ciclo = 62.5 ns)', W / 2, H / 2 + 12);
  }
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export default function LogicAnalyzerPanel({
  channels,       // Map<pin, {edges, color, label}>
  latestTime = 0, // µs del último flanco capturado
  isRunning  = false,
  onRemoveChannel,
  onClearAll,
}) {
  const canvasRef    = useRef(null);
  const containerRef = useRef(null);

  // ── Ventana de tiempo visible ────────────────────────────────────────────
  const [viewDuration, setViewDuration] = useState(10_000); // 10 ms por defecto
  const [viewStart,    setViewStart]    = useState(0);
  const [autoScroll,   setAutoScroll]   = useState(true);
  const [cursorUs,     setCursorUs]     = useState(null);

  // Pan con drag
  const dragRef = useRef(null); // {startX: px, startViewStart: µs}

  // ── Auto-scroll ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (autoScroll && isRunning && latestTime > 0) {
      const newStart = Math.max(0, latestTime - viewDuration * 0.9);
      setViewStart(newStart);
    }
  }, [latestTime, autoScroll, isRunning, viewDuration]);

  // ── Tamaño del canvas ────────────────────────────────────────────────────
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 200 });

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width } = entry.contentRect;
      const h = RULER_H + Math.max(1, channels.size) * ROW_H + 4;
      setCanvasSize({ w: Math.floor(width), h: Math.max(h, 100) });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [channels.size]);

  // Recalcular altura cuando cambia número de canales
  useEffect(() => {
    if (!containerRef.current) return;
    const { width } = containerRef.current.getBoundingClientRect();
    const h = RULER_H + Math.max(1, channels.size) * ROW_H + 4;
    setCanvasSize({ w: Math.floor(width), h: Math.max(h, 100) });
  }, [channels.size]);

  // ── Re-render del canvas ─────────────────────────────────────────────────
  useEffect(() => {
    renderCanvas(canvasRef.current, channels, viewStart, viewDuration, cursorUs);
  }, [channels, viewStart, viewDuration, cursorUs, canvasSize]);

  // ── Zoom (rueda del mouse) ────────────────────────────────────────────────
  // NOTA: NO usar onWheel={} de React — React lo registra como passive:true
  // desde React 17, lo que impide llamar a e.preventDefault() y bloquear el
  // scroll de la página. Hay que adjuntar el listener directamente con
  // addEventListener({ passive: false }).
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const rect  = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left - LABEL_W;
    const relFrac = Math.max(0, Math.min(1, mouseX / (rect.width - LABEL_W)));

    const factor = e.deltaY > 0 ? 1.4 : 1 / 1.4;
    const newDur  = Math.max(MIN_VIEW, Math.min(5_000_000, viewDuration * factor));

    // Mantener el punto bajo el cursor fijo
    const pivotT  = viewStart + relFrac * viewDuration;
    const newStart = Math.max(0, pivotT - relFrac * newDur);

    setViewDuration(newDur);
    setViewStart(newStart);
    setAutoScroll(false);
  }, [viewStart, viewDuration]);

  // Adjuntar wheel con passive:false para poder llamar preventDefault()
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // ── Pan (drag) ────────────────────────────────────────────────────────────
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    dragRef.current = { startX: e.clientX, startViewStart: viewStart };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [viewStart]);

  const handleMouseMove = useCallback((e) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Cursor de tiempo
    const mouseX = e.clientX - rect.left - LABEL_W;
    const t = viewStart + (mouseX / (rect.width - LABEL_W)) * viewDuration;
    setCursorUs(Math.max(0, t));

    // Pan
    if (!dragRef.current) return;
    const deltaX   = e.clientX - dragRef.current.startX;
    const deltaUs  = -(deltaX / (rect.width - LABEL_W)) * viewDuration;
    const newStart = Math.max(0, dragRef.current.startViewStart + deltaUs);
    setViewStart(newStart);
    setAutoScroll(false);
  }, [viewStart, viewDuration]);

  const handleMouseUp = useCallback(() => { dragRef.current = null; }, []);

  // ── Zoom keyboard ─────────────────────────────────────────────────────────
  const zoomIn  = () => setViewDuration(d => Math.max(MIN_VIEW, d / 2));
  const zoomOut = () => setViewDuration(d => Math.min(5_000_000, d * 2));
  const fitAll  = () => {
    if (latestTime > 0) {
      setViewStart(0);
      setViewDuration(latestTime * 1.1 || 10_000);
    }
    setAutoScroll(false);
  };

  // ── Tabla de canales (sidebar derecho) ───────────────────────────────────
  const channelList = useMemo(() => [...channels.entries()], [channels]);

  // ── Canvas total height ───────────────────────────────────────────────────
  const totalH = RULER_H + Math.max(1, channels.size) * ROW_H + 4;

  return (
    <div className="flex flex-col h-full bg-[#070d1a] text-slate-300 overflow-hidden select-none">

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 px-3 py-1 bg-slate-900 border-b border-slate-700 flex-shrink-0 text-[11px]">
        <span className="font-semibold text-slate-200 flex items-center gap-1.5">
          <span className="text-cyan-400">⬛</span> Analizador Lógico
        </span>

        <div className="w-px h-4 bg-slate-700 mx-1" />

        {/* Zoom */}
        <button onClick={zoomIn}  title="Zoom in"  className="p-0.5 hover:text-white"><ZoomIn  className="w-3.5 h-3.5" /></button>
        <button onClick={zoomOut} title="Zoom out" className="p-0.5 hover:text-white"><ZoomOut className="w-3.5 h-3.5" /></button>
        <button onClick={fitAll}  title="Encajar todo" className="p-0.5 hover:text-white"><Maximize2 className="w-3.5 h-3.5" /></button>

        <span className="text-slate-500 font-mono">{formatTime(viewDuration)} / ventana</span>

        <div className="w-px h-4 bg-slate-700 mx-1" />

        {/* Auto-scroll */}
        <button
          onClick={() => setAutoScroll(v => !v)}
          className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${
            autoScroll
              ? 'bg-cyan-700/30 text-cyan-300 border-cyan-600/40'
              : 'bg-slate-800 text-slate-500 border-slate-700 hover:text-slate-200'
          }`}
          title="Seguir últimos datos"
        >
          ↠ Auto-scroll
        </button>

        <div className="flex-1" />

        {/* Clear all */}
        <button
          onClick={onClearAll}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700"
          title="Limpiar todos los canales"
        >
          <RefreshCw className="w-3 h-3" /> Limpiar
        </button>

        <span className="text-slate-500 text-[9px] font-mono">
          {[...channels.values()].reduce((s, ch) => s + ch.edges.length, 0).toLocaleString()} flancos
        </span>
      </div>

      {/* ── Canvas + channel list ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Canvas waveform */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto"
          style={{ cursor: dragRef.current ? 'ew-resize' : 'crosshair' }}
        >
          <canvas
            ref={canvasRef}
            width={canvasSize.w}
            height={totalH}
            style={{ display: 'block', minWidth: '100%' }}
            onPointerDown={handleMouseDown}
            onPointerMove={handleMouseMove}
            onPointerUp={handleMouseUp}
            onPointerLeave={() => setCursorUs(null)}
          />
        </div>

        {/* ── Channel list sidebar ── */}
        {channelList.length > 0 && (
          <div
            className="w-36 flex-shrink-0 border-l border-slate-700 overflow-y-auto bg-slate-900"
            style={{ fontSize: 10 }}
          >
            <div className="px-2 py-1 text-slate-500 border-b border-slate-800 text-[9px] uppercase tracking-wide">
              Canales activos
            </div>
            {channelList.map(([pin, ch]) => (
              <div
                key={pin}
                className="flex items-center gap-1.5 px-2 py-1.5 border-b border-slate-800 hover:bg-slate-800"
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: ch.color }}
                />
                <span className="flex-1 truncate font-mono" style={{ color: ch.color }}>
                  {ch.label}
                </span>
                <span className="text-slate-600 text-[9px]">
                  {ch.edges.length > 0
                    ? `${ch.edges.length} flancos`
                    : 'sin datos'}
                </span>
                <button
                  onClick={() => onRemoveChannel?.(pin)}
                  className="p-0.5 text-slate-600 hover:text-red-400 flex-shrink-0"
                  title="Eliminar canal"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Status bar ── */}
      <div className="flex items-center gap-4 px-3 py-0.5 bg-slate-900 border-t border-slate-700 text-[9px] text-slate-500 flex-shrink-0">
        <span>Resolución: 62.5 ns / ciclo</span>
        <span>Ventana: {formatTime(viewStart)} – {formatTime(viewStart + viewDuration)}</span>
        {cursorUs !== null && (
          <span className="text-slate-300">Cursor: <span className="font-mono text-cyan-400">{formatTime(cursorUs)}</span></span>
        )}
        {isRunning && (
          <span className="ml-auto flex items-center gap-1 text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Capturando
          </span>
        )}
      </div>
    </div>
  );
}
