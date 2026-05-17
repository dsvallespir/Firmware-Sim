/*
 * ============================================================
 * CircuitView.jsx — Canvas visual del circuito Arduino
 * ============================================================
 *
 * Renderiza un circuito completo: board + componentes + cables,
 * conectado al motor de simulación avr8js.
 *
 * Flujo:
 * 1. Parsear circuitDefinition → board + components + wires
 * 2. Renderizar WokwiElement para cada componente
 * 3. Extraer pinInfo de cada componente → calcular posiciones
 *    - Los wokwi-elements reportan pinInfo en CSS pixels
 *    - Se aplica rotación (CSS transform) para componentes rotados
 *    - Se usa el DOM element real para obtener dimensiones
 * 4. Dibujar CircuitWires (SVG) entre pines
 * 5. Suscribirse a pin changes del simulador → actualizar visuals
 * 6. Conectar eventos de input → setPinState del simulador
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { AlertTriangle, Cpu, Zap, Pencil, Trash2 } from 'lucide-react';
import WokwiElement from './WokwiElement';
import CircuitWires, { wirePath } from './CircuitWires';
import { parseCircuit, buildConnectionMap, boardPinToArduinoNumber } from '../../utils/circuitSchema';
import { getBehavior, isOutputComponent, isInputComponent } from '../../utils/partBehaviors';

// Dimensiones por defecto del canvas
const CANVAS_W = 800;
const CANVAS_H = 520;

// Offset del board (esquina superior izquierda dentro del canvas)
const BOARD_OFFSET_X = 20;
const BOARD_OFFSET_Y = 30;

// Paleta de colores para cables dibujados por el usuario
const DRAW_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#3b82f6', // blue
  '#a855f7', // purple
  '#e2e8f0', // white
];

/**
 * Rotar punto (px, py) alrededor de centro (cx, cy) por angleDeg grados.
 * Rotación CW en sistema de coordenadas de pantalla (Y hacia abajo).
 * Coincide con CSS `transform: rotate(Xdeg)`.
 */
function rotatePoint(px, py, cx, cy, angleDeg) {
  if (!angleDeg) return { x: px, y: py };
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = px - cx;
  const dy = py - cy;
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  };
}

/**
 * CircuitView — Vista visual del circuito con simulación.
 */
export default function CircuitView({
  circuitDefinition,
  pinStates = {},
  setPinState,
  setAnalogValue,
  isRunning = false,
  onPinChange,
  onReset,
}) {
  // ── Parsear circuito ────────────────────────────────────
  const parsed = useMemo(() => {
    if (!circuitDefinition) return { valid: false, circuit: null, error: 'No circuit defined' };
    return parseCircuit(circuitDefinition);
  }, [circuitDefinition]);

  const { valid, circuit, error } = parsed;

  // Cables totales: definición + dibujados por el usuario
  const allWires = useMemo(
    () => [...(circuit?.wires || []), ...userWires],
    [circuit?.wires, userWires],
  );

  // Mapa de conexiones: "compId.pinName" → Arduino pin number
  const connectionMap = useMemo(() => {
    if (!valid || !circuit) return new Map();
    const map = buildConnectionMap(circuit);
    console.log('[CircuitView] connectionMap:', Object.fromEntries(map));
    return map;
  }, [valid, circuit]);

  // ── Pin positions para dibujar cables ───────────────────
  const [pinPositions, setPinPositions] = useState(new Map());

  // ── Estado del modo dibujo de cables ────────────────────
  const [drawMode, setDrawMode] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#22c55e');
  const [pendingPin, setPendingPin] = useState(null); // { key, pos }
  const [mousePos, setMousePos] = useState(null);
  const [userWires, setUserWires] = useState([]);
  const [hoveredPin, setHoveredPin] = useState(null);

  // Contador que se incrementa cuando un element queda listo.
  // Fuerza que el effect de input connections se re-evalúe.
  const [elementsReadyCount, setElementsReadyCount] = useState(0);

  // Refs: elementos DOM, pinInfo raw, cleanup de behaviors
  const elementRefs = useRef(new Map());   // compId → DOM element (custom element)
  const wrapperRefs = useRef(new Map());   // compId → wrapper div (has CSS transform)
  const rawPinInfos = useRef(new Map());   // compId → pins[]
  const cleanupRefs = useRef(new Map());   // compId → cleanup fn
  const canvasRef = useRef(null);          // el div contenedor del canvas
  const resizeObserverRef = useRef(null);  // observer para re-calc al obtener dimensiones
  const recalcRAFRef = useRef(null);       // debounce de recalcPositions

  // ── Recalcular posiciones de todos los pines ───────────
  // Toma los datos crudos (pinInfo + element dimensions) y
  // calcula coordenadas absolutas del canvas con rotación.
  const recalcPositions = useCallback(() => {
    if (!circuit) return;

    const positions = new Map();

    // ── Board (sin rotación) ──
    const boardPins = rawPinInfos.current.get('board');
    if (boardPins) {
      const bx = (circuit.board.x || 0) + BOARD_OFFSET_X;
      const by = (circuit.board.y || 0) + BOARD_OFFSET_Y;
      for (const pin of boardPins) {
        positions.set(`board.${pin.name}`, {
          x: bx + (pin.x || 0),
          y: by + (pin.y || 0),
        });
      }
    }

    // ── Componentes (con soporte de rotación) ──
    for (const comp of circuit.components) {
      const pins = rawPinInfos.current.get(comp.id);
      if (!pins) continue;

      // Usar el wrapper div para dimensiones (es el que tiene CSS transform).
      // offsetWidth/Height del wrapper devuelve el tamaño PRE-transform,
      // que es exactamente lo que necesitamos para el centro de rotación.
      const wrapper = wrapperRefs.current.get(comp.id);
      const el = elementRefs.current.get(comp.id);
      let w = wrapper?.offsetWidth || el?.offsetWidth || 0;
      let h = wrapper?.offsetHeight || el?.offsetHeight || 0;
      const angle = comp.rotate || 0;

      // Fallback: estimar desde pinInfo bounds (último recurso).
      // pinInfo coords están en CSS-pixel space. Para el resistor:
      // pins en (0,5.65) y (58.8,5.65), elemento real ~59×11px.
      // Usar estimaciones más cercanas que el viejo +10.
      if ((w === 0 || h === 0) && pins.length > 0) {
        const xs = pins.map(p => p.x || 0);
        const ys = pins.map(p => p.y || 0);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);
        const minY = Math.min(...ys);
        if (w === 0) w = maxX + 1;
        if (h === 0) h = (minY === maxY) ? maxY * 2 : maxY + 1;
      }

      for (const pin of pins) {
        // Rotar la posición del pin alrededor del centro del wrapper.
        // CSS transform: rotate(Xdeg) rota alrededor de (w/2, h/2)
        // en el espacio local del wrapper.
        const rotated = rotatePoint(pin.x || 0, pin.y || 0, w / 2, h / 2, angle);
        positions.set(`${comp.id}.${pin.name}`, {
          x: comp.x + rotated.x,
          y: comp.y + rotated.y,
        });
      }
    }

    setPinPositions(positions);
  }, [circuit]);

  // ── Debounce recalcPositions via RAF ─────────────────────
  const scheduleRecalc = useCallback(() => {
    if (recalcRAFRef.current) cancelAnimationFrame(recalcRAFRef.current);
    recalcRAFRef.current = requestAnimationFrame(() => recalcPositions());
  }, [recalcPositions]);

  // ── ResizeObserver: re-calc cuando wrappers obtienen tamaño real ──
  // Los wokwi custom elements renderizan Shadow DOM async,
  // así que offsetWidth puede ser 0 inicialmente. El observer
  // detecta cuándo el wrapper crece y recalcula posiciones.
  useEffect(() => {
    const observer = new ResizeObserver(() => scheduleRecalc());
    resizeObserverRef.current = observer;

    // Observar wrappers ya registrados
    for (const [, node] of wrapperRefs.current) {
      observer.observe(node);
    }

    return () => {
      observer.disconnect();
      resizeObserverRef.current = null;
      if (recalcRAFRef.current) cancelAnimationFrame(recalcRAFRef.current);
    };
  }, [scheduleRecalc]);

  // ── Handlers: Board ─────────────────────────────────────
  const handleBoardPinInfo = useCallback((pins) => {
    rawPinInfos.current.set('board', pins);
    recalcPositions();
  }, [recalcPositions]);

  const handleBoardReady = useCallback((el) => {
    elementRefs.current.set('board', el);
  }, []);

  // ── Properties reactivas del board (led13, ledPower) ──
  // Se pasan como props al WokwiElement → Lit detecta el cambio
  // y re-renderiza el SVG con el LED encendido/apagado.
  const boardProperties = useMemo(() => ({
    led13: !!pinStates[13],
    ledPower: isRunning,
  }), [pinStates[13], isRunning]);

  // ── Pin listener directo para LED del board ──────────
  // Actualiza el DOM directamente desde el port listener de avr8js,
  // sin pasar por el ciclo de React (como el demo oficial).
  useEffect(() => {
    if (!onPinChange) return;

    const unregister = onPinChange((pin, value) => {
      const boardEl = elementRefs.current.get('board');
      if (!boardEl) return;
      if (pin === 13) {
        boardEl.led13 = !!value;
      }
    });

    return () => {
      if (typeof unregister === 'function') unregister();
    };
  }, [onPinChange]);

  // Encender/apagar led de power con la simulación
  useEffect(() => {
    const boardEl = elementRefs.current.get('board');
    if (boardEl) boardEl.ledPower = isRunning;
  }, [isRunning]);

  // ── Board event handler (botón RESET) ─────────────────
  const handleBoardEvent = useCallback((eventType, detail) => {
    if (eventType === 'button-press' && detail === 'reset' && onReset) {
      onReset();
    }
  }, [onReset]);

  // ── Handlers: Componentes ───────────────────────────────
  const handleCompPinInfo = useCallback((compId, pins) => {
    rawPinInfos.current.set(compId, pins);
    // Esperar un frame para que el elemento tenga dimensiones calculadas
    requestAnimationFrame(() => recalcPositions());
  }, [recalcPositions]);

  const handleCompReady = useCallback((compId, el) => {
    elementRefs.current.set(compId, el);
    console.log(`[CircuitView] Element ready: ${compId}`);
    // Incrementar contador para que el effect de input re-evalúe refs
    setElementsReadyCount(c => c + 1);
    // Recalcular después de que Lit renderice el Shadow DOM
    // (las dimensiones del wrapper cambian cuando el contenido carga)
    setTimeout(() => recalcPositions(), 200);
  }, [recalcPositions]);

  // ── Conectar simulación a componentes de input ────────
  useEffect(() => {
    console.log('[CircuitView] Input connect effect:', { valid, hasCircuit: !!circuit, isRunning });
    if (!valid || !circuit || !isRunning) return;

    // Limpiar conexiones previas
    for (const [, cleanup] of cleanupRefs.current) {
      if (cleanup) cleanup();
    }
    cleanupRefs.current.clear();

    // Conectar cada componente de input
    for (const comp of circuit.components) {
      const behavior = getBehavior(comp.type);
      const isInput = isInputComponent(comp.type);
      console.log(`[CircuitView] Component ${comp.id} (${comp.type}):`, {
        hasBehavior: !!behavior,
        isInput,
      });
      if (!behavior || !isInput) continue;

      const element = elementRefs.current.get(comp.id);
      console.log(`[CircuitView] Element ref for ${comp.id}:`, !!element);
      if (!element) continue;

      const helpers = {
        setPinState: (pin, value) => {
          if (setPinState) setPinState(pin, value);
        },
        setAnalogValue: (pin, value) => {
          if (setAnalogValue) setAnalogValue(pin, value);
        },
        getConnectedPin: (pinName) => {
          const key = `${comp.id}.${pinName}`;
          return connectionMap.get(key) ?? null;
        },
      };

      const cleanup = behavior.attachEvents(element, helpers);
      if (cleanup) {
        cleanupRefs.current.set(comp.id, cleanup);
      }
    }

    return () => {
      for (const [, cleanup] of cleanupRefs.current) {
        if (cleanup) cleanup();
      }
      cleanupRefs.current.clear();
    };
  }, [valid, circuit, isRunning, setPinState, setAnalogValue, connectionMap, elementsReadyCount]);

  // ── Actualizar componentes de output cuando cambian los pines ──
  useEffect(() => {
    if (!valid || !circuit || !pinStates) return;

    for (const comp of circuit.components) {
      const behavior = getBehavior(comp.type);
      if (!behavior || !isOutputComponent(comp.type)) continue;

      const element = elementRefs.current.get(comp.id);
      if (!element) continue;

      // Conexión directa: componente ↔ board
      for (const wire of circuit.wires) {
        let compPin = null;
        let boardPinName = null;

        if (wire.from[0] === comp.id && wire.to[0] === 'board') {
          compPin = wire.from[1];
          boardPinName = wire.to[1];
        } else if (wire.to[0] === comp.id && wire.from[0] === 'board') {
          compPin = wire.to[1];
          boardPinName = wire.from[1];
        }

        if (compPin && boardPinName) {
          const arduinoPin = boardPinToArduinoNumber(boardPinName);
          if (arduinoPin !== null && pinStates[arduinoPin] !== undefined) {
            behavior.onPinChange(element, compPin, pinStates[arduinoPin], pinStates[`pwm_${arduinoPin}`]);
          }
        }
      }

      // Conexión indirecta (a través de resistencia u otro pasivo)
      for (const wire of circuit.wires) {
        let compPin = null;
        let intermediateId = null;

        if (wire.from[0] === comp.id && wire.to[0] !== 'board') {
          compPin = wire.from[1];
          intermediateId = wire.to[0];
        } else if (wire.to[0] === comp.id && wire.from[0] !== 'board') {
          compPin = wire.to[1];
          intermediateId = wire.from[0];
        }

        if (intermediateId) {
          for (const w2 of circuit.wires) {
            let boardPinName = null;
            if (w2.from[0] === intermediateId && w2.to[0] === 'board') {
              boardPinName = w2.to[1];
            } else if (w2.to[0] === intermediateId && w2.from[0] === 'board') {
              boardPinName = w2.from[1];
            }
            if (boardPinName) {
              const arduinoPin = boardPinToArduinoNumber(boardPinName);
              if (arduinoPin !== null && pinStates[arduinoPin] !== undefined) {
                behavior.onPinChange(element, compPin, pinStates[arduinoPin], pinStates[`pwm_${arduinoPin}`]);
              }
            }
          }
        }
      }
    }
  }, [valid, circuit, pinStates]);

  // ── Wire drawing handlers ──────────────────────────────
  const handleSvgMouseMove = useCallback((e) => {
    if (!drawMode || !pendingPin) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, [drawMode, pendingPin]);

  const handlePinClick = useCallback((key, pos, e) => {
    e?.stopPropagation();
    if (!drawMode) return;
    if (!pendingPin) {
      setPendingPin({ key, pos });
      setMousePos(pos);
    } else if (pendingPin.key === key) {
      // Cancelar
      setPendingPin(null);
      setMousePos(null);
    } else {
      // Completar cable
      const dotIdx = pendingPin.key.indexOf('.');
      const fromComp = pendingPin.key.slice(0, dotIdx);
      const fromPin  = pendingPin.key.slice(dotIdx + 1);
      const dotIdx2  = key.indexOf('.');
      const toComp   = key.slice(0, dotIdx2);
      const toPin    = key.slice(dotIdx2 + 1);
      setUserWires((prev) => [
        ...prev,
        { from: [fromComp, fromPin], to: [toComp, toPin], color: selectedColor },
      ]);
      setPendingPin(null);
      setMousePos(null);
    }
  }, [drawMode, pendingPin, selectedColor]);

  // Escape cancela el cable en curso
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { setPendingPin(null); setMousePos(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── Render: estado de error ─────────────────────────────
  if (!circuitDefinition) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3 p-8">
        <Cpu className="w-12 h-12 opacity-40" />
        <p className="text-sm text-center">
          Esta lección no tiene un circuito visual definido.<br />
          Usa la pestaña <strong>Serial</strong> para ver la salida del simulador.
        </p>
      </div>
    );
  }

  if (!valid) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-amber-500 gap-3 p-8">
        <AlertTriangle className="w-10 h-10" />
        <p className="text-sm text-center">Error en circuit definition:<br />{error}</p>
      </div>
    );
  }

  return (
    <div className="relative bg-[#1e1e2e] rounded-lg overflow-auto"
         style={{ width: '100%', height: '100%', minHeight: 400 }}>
      {/* Título del circuito */}
      <div className="absolute top-2 left-3 z-20 flex items-center gap-1.5">
        <Zap className="w-3.5 h-3.5 text-emerald-400" />
        <span className="text-[11px] font-medium text-slate-400">
          Circuito — {circuit.board.type.replace('wokwi-', '').replace(/-/g, ' ')}
        </span>
        {isRunning && (
          <span className="ml-1 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        )}
      </div>

      {/* Toolbar del modo dibujo de cables */}
      <div className="absolute top-2 right-3 z-20 flex items-center gap-1.5">
        {drawMode && (
          <>
            {/* Paleta de colores */}
            {DRAW_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setSelectedColor(c)}
                title={c}
                style={{ background: c }}
                className={`w-3.5 h-3.5 rounded-full border-2 transition-transform ${
                  selectedColor === c
                    ? 'border-white scale-125 shadow-md'
                    : 'border-transparent hover:scale-110'
                }`}
              />
            ))}
            {/* Borrar cables del usuario */}
            {userWires.length > 0 && (
              <button
                onClick={() => { setUserWires([]); setPendingPin(null); }}
                title="Borrar cables dibujados"
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]
                           bg-red-900/40 text-red-400 hover:bg-red-800/50 border border-red-800/40
                           transition-colors"
              >
                <Trash2 className="w-2.5 h-2.5" />
                {userWires.length}
              </button>
            )}
            {/* Instrucción contextual */}
            <span className="text-[9px] text-slate-500 hidden sm:inline">
              {pendingPin ? 'Click en pin destino · Esc cancela' : 'Click en pin origen'}
            </span>
          </>
        )}
        {/* Toggle draw mode */}
        <button
          onClick={() => { setDrawMode((d) => !d); setPendingPin(null); setMousePos(null); }}
          title={drawMode ? 'Salir del modo dibujo' : 'Dibujar cables'}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
            drawMode
              ? 'bg-emerald-600 text-white shadow shadow-emerald-900/40'
              : 'bg-slate-700/80 text-slate-400 hover:bg-slate-600 border border-slate-600'
          }`}
        >
          <Pencil className="w-3 h-3" />
          <span className="hidden sm:inline">{drawMode ? 'Dibujando' : 'Cables'}</span>
        </button>
      </div>

      {/* Canvas del circuito */}
      <div
        ref={canvasRef}
        className="relative mx-auto mt-8"
        style={{ width: CANVAS_W, height: CANVAS_H }}
      >
        {/* Board principal */}
        <div
          ref={(node) => {
            if (node) {
              wrapperRefs.current.set('board', node);
              resizeObserverRef.current?.observe(node);
            }
          }}
          style={{
            position: 'absolute',
            left: (circuit.board.x || 0) + BOARD_OFFSET_X,
            top: (circuit.board.y || 0) + BOARD_OFFSET_Y,
            zIndex: 2,
          }}
        >
          <WokwiElement
            tag={circuit.board.type}
            properties={boardProperties}
            onPinInfo={handleBoardPinInfo}
            onReady={handleBoardReady}
            onEvent={handleBoardEvent}
            className="circuit-board"
          />
        </div>

        {/* Componentes externos */}
        {circuit.components.map((comp) => (
          <div
            key={comp.id}
            ref={(node) => {
              if (node) {
                wrapperRefs.current.set(comp.id, node);
                resizeObserverRef.current?.observe(node);
              }
            }}
            style={{
              position: 'absolute',
              left: comp.x,
              top: comp.y,
              transform: comp.rotate ? `rotate(${comp.rotate}deg)` : undefined,
              transformOrigin: 'center center',
              zIndex: 3,
            }}
          >
            <WokwiElement
              tag={comp.type}
              properties={comp.props}
              onPinInfo={(pins) => handleCompPinInfo(comp.id, pins)}
              onReady={(el) => handleCompReady(comp.id, el)}
              className="circuit-component"
            />
          </div>
        ))}

        {/* Cables SVG */}
        <CircuitWires
          wires={allWires}
          pinPositions={pinPositions}
          width={CANVAS_W}
          height={CANVAS_H}
        />

        {/* Overlay interactivo para dibujar cables */}
        {drawMode && (
          <svg
            className="absolute inset-0"
            width={CANVAS_W}
            height={CANVAS_H}
            viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
            style={{ zIndex: 10, pointerEvents: 'none' }}
          >
            {/* Rect transparente para capturar mousemove */}
            <rect
              width={CANVAS_W}
              height={CANVAS_H}
              fill="transparent"
              style={{ pointerEvents: 'all', cursor: pendingPin ? 'crosshair' : 'default' }}
              onMouseMove={handleSvgMouseMove}
            />

            {/* Cable preview (punteado animado) */}
            {pendingPin && mousePos && (
              <>
                <path
                  d={wirePath(pendingPin.pos.x, pendingPin.pos.y, mousePos.x, mousePos.y)}
                  fill="none"
                  stroke={selectedColor}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeDasharray="7 4"
                  opacity={0.85}
                  style={{ pointerEvents: 'none' }}
                />
                <path
                  d={wirePath(pendingPin.pos.x, pendingPin.pos.y, mousePos.x, mousePos.y)}
                  fill="none"
                  stroke="white"
                  strokeWidth={0.5}
                  strokeLinecap="round"
                  strokeDasharray="7 4"
                  opacity={0.3}
                  style={{ pointerEvents: 'none' }}
                />
              </>
            )}

            {/* Puntos de pines */}
            {[...pinPositions.entries()].map(([key, pos]) => {
              const isPending = pendingPin?.key === key;
              const isHovered = hoveredPin === key;
              return (
                <g key={key}>
                  {/* Círculo exterior (halo) */}
                  {(isPending || isHovered) && (
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={isPending ? 9 : 7}
                      fill={isPending ? selectedColor : 'rgba(255,255,255,0.2)'}
                      opacity={0.25}
                      style={{ pointerEvents: 'none' }}
                    />
                  )}
                  {/* Círculo del pin */}
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={isPending ? 5.5 : 4}
                    fill={isPending ? selectedColor : 'rgba(255,255,255,0.12)'}
                    stroke={isPending ? selectedColor : isHovered ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.4)'}
                    strokeWidth={1.5}
                    style={{ pointerEvents: 'all', cursor: 'pointer' }}
                    onClick={(e) => handlePinClick(key, pos, e)}
                    onMouseEnter={() => setHoveredPin(key)}
                    onMouseLeave={() => setHoveredPin(null)}
                  />
                  {/* Label al hacer hover */}
                  {isHovered && (
                    <>
                      <rect
                        x={pos.x + 8}
                        y={pos.y - 10}
                        width={key.length * 5.5 + 8}
                        height={14}
                        rx={3}
                        fill="rgba(15,15,30,0.85)"
                        style={{ pointerEvents: 'none' }}
                      />
                      <text
                        x={pos.x + 12}
                        y={pos.y + 1}
                        fontSize={9}
                        fill="#e2e8f0"
                        fontFamily="monospace"
                        style={{ pointerEvents: 'none' }}
                      >
                        {key}
                      </text>
                    </>
                  )}
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {/* Leyenda de pines conectados (solo cuando simulando) */}
      {isRunning && Object.keys(pinStates).length > 0 && (
        <div className="absolute bottom-2 right-3 z-20">
          <div className="flex gap-2 text-[10px] text-slate-500">
            {circuit.wires
              .filter(w => w.from[0] === 'board' || w.to[0] === 'board')
              .map((w) => (w.from[0] === 'board' ? w.from[1] : w.to[1]))
              .filter((pin, i, arr) => arr.indexOf(pin) === i && !pin.startsWith('GND'))
              .slice(0, 6)
              .map((boardPin, i) => {
                const arduinoPin = boardPinToArduinoNumber(boardPin);
                const value = arduinoPin !== null ? pinStates[arduinoPin] : undefined;
                return (
                  <span key={i} className={`px-1.5 py-0.5 rounded font-mono ${
                    value ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-500'
                  }`}>
                    D{boardPin}: {value ? 'HIGH' : 'LOW'}
                  </span>
                );
              })
            }
          </div>
        </div>
      )}
    </div>
  );
}
