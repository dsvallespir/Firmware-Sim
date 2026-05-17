/*
 * DiagramEditor.jsx
 * -----------------
 * Interactive circuit diagram canvas with:
 *   - Pan (middle-mouse drag or Space+drag) & Zoom (Ctrl+wheel / pinch)
 *   - Wokwi-element rendering via WokwiElement
 *   - Drag to move components
 *   - Wire-draw mode: click pin → click pin to connect
 *   - Selection with bounding-box highlight
 *   - Context menu: Delete, Duplicate, Rotate, Properties
 *   - Drag-from-palette drop (HTML5 DnD)
 *   - Simulation feedback: pinStates drive output component visuals
 *   - Input component events forwarded to simulator (setPinState / setAnalogValue)
 *
 * Props:
 *   diagram          – current wokwi-v1 diagram JSON (from useCircuitEditor)
 *   onAddPart        – (type, left, top, attrs) => void
 *   onRemovePart     – (id) => void
 *   onMovePart       – (id, left, top) => void
 *   onStartDrag      – () => void  — called before drag, captures undo snapshot
 *   onEndDrag        – () => void  — called after drag, commits to history
 *   onRotatePart     – (id) => void
 *   onDuplicatePart  – (id) => void
 *   onAddConnection  – (from, to, color) => void
 *   onRemoveConnection – (index) => void
 *   onSetConnectionWaypoints – (index, points) => void  (live drag, no undo)
 *   onUpdateConnectionWaypoints – (index, points) => void  (commits to history)
 *   pinStates        – { [pin]: value } from avr8js
 *   setPinState      – (pin, value) => void
 *   setAnalogValue   – (pin, value) => void
 *   registerPinListener – (cb) => unsubscribe
 *   isRunning        – boolean
 */

import {
  useState, useCallback, useRef, useEffect, useMemo,
} from 'react';
import { Trash2, RotateCw, Copy, X } from 'lucide-react';
import WokwiElement from './WokwiElement';
import CircuitWires, { wirePath } from './CircuitWires';
import ComponentPalette from './ComponentPalette';
import { getBehavior, isOutputComponent, isInputComponent } from '../../utils/partBehaviors';
import { boardPinToArduinoNumber, buildConnectionMap } from '../../utils/circuitSchema';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const CANVAS_W = 2400;
const CANVAS_H = 1800;
const GRID = 20;

function snap(v, enabled) { return enabled ? Math.round(v / GRID) * GRID : v; }

const WIRE_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#a855f7', '#e2e8f0', '#78716c',
];

// ---------------------------------------------------------------------------
// Utility: rotate a point around a centre
// ---------------------------------------------------------------------------
function rotatePoint(px, py, cx, cy, angleDeg) {
  if (!angleDeg) return { x: px, y: py };
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = px - cx;
  const dy = py - cy;
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
}

// ---------------------------------------------------------------------------
// Sensor types that get an interactive overlay panel
// ---------------------------------------------------------------------------
const SENSOR_TYPES = new Set([
  'wokwi-hc-sr04',
  'wokwi-dht22',
  'wokwi-pir-motion-sensor',
  'wokwi-ntc-temperature-sensor',
]);

// ---------------------------------------------------------------------------
// SensorPanel — floating control overlay for each active sensor
// ---------------------------------------------------------------------------
function SensorPanel({ part, config = {}, onChange }) {
  const s = {
    position: 'absolute',
    left: part.left + 160,
    top: part.top,
    zIndex: 60,
    background: 'rgba(2,6,23,0.97)',
    border: '1px solid rgba(100,116,139,0.3)',
    borderRadius: 8,
    padding: '8px 12px',
    minWidth: 185,
    fontSize: 11,
    color: '#e2e8f0',
    boxShadow: '0 4px 24px rgba(0,0,0,0.55)',
    pointerEvents: 'all',
    userSelect: 'none',
  };
  const title = { fontWeight: 700, fontSize: 10, marginBottom: 6 };
  const row   = { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 };
  const val   = { fontFamily: 'monospace', minWidth: 52, textAlign: 'right' };

  const { type } = part;

  if (type === 'wokwi-hc-sr04') {
    const dist = config.distance ?? 20;
    return (
      <div style={s} onPointerDown={e => e.stopPropagation()}>
        <div style={{...title, color:'#60a5fa'}}>📡 HC-SR04 — Distancia</div>
        <div style={row}>
          <input type="range" min={2} max={400} value={dist}
            style={{flex:1, accentColor:'#3b82f6'}}
            onChange={e => onChange({ distance: Number(e.target.value) })} />
          <span style={{...val, color:'#93c5fd'}}>{dist} cm</span>
        </div>
        <div style={{fontSize:9, color:'#475569'}}>
          ECHO = {Math.round(dist * 58.2)} µs
        </div>
      </div>
    );
  }

  if (type === 'wokwi-dht22') {
    const temp = config.temperature ?? 25;
    const humi = config.humidity    ?? 50;
    return (
      <div style={s} onPointerDown={e => e.stopPropagation()}>
        <div style={{...title, color:'#fb923c'}}>🌡 DHT22 — Temp / Humedad</div>
        <div style={row}>
          <span style={{color:'#94a3b8', width:10}}>T</span>
          <input type="range" min={-20} max={80} value={temp}
            style={{flex:1, accentColor:'#f97316'}}
            onChange={e => onChange({ temperature: Number(e.target.value) })} />
          <span style={{...val, color:'#fdba74'}}>{temp}°C</span>
        </div>
        <div style={row}>
          <span style={{color:'#94a3b8', width:10}}>H</span>
          <input type="range" min={0} max={100} value={humi}
            style={{flex:1, accentColor:'#3b82f6'}}
            onChange={e => onChange({ humidity: Number(e.target.value) })} />
          <span style={{...val, color:'#93c5fd'}}>{humi}%</span>
        </div>
      </div>
    );
  }

  if (type === 'wokwi-pir-motion-sensor') {
    const motion = config.motion ?? false;
    return (
      <div style={s} onPointerDown={e => e.stopPropagation()}>
        <div style={{...title, color:'#fbbf24'}}>👁 PIR — Movimiento</div>
        <button
          onPointerDown={e => {
            e.stopPropagation();
            onChange({ motion: true });
            setTimeout(() => onChange({ motion: false }), 2000);
          }}
          style={{
            width:'100%', padding:'5px 0', borderRadius:5, fontSize:10,
            fontWeight:600, cursor:'pointer', border:'1px solid',
            background: motion ? 'rgba(245,158,11,0.25)' : 'rgba(51,65,85,0.8)',
            borderColor: motion ? '#f59e0b' : '#475569',
            color: motion ? '#fcd34d' : '#94a3b8',
          }}
        >
          {motion ? '⚡ ¡Movimiento detectado!' : '▶ Simular movimiento (2s)'}
        </button>
      </div>
    );
  }

  if (type === 'wokwi-ntc-temperature-sensor') {
    const temp = config.temperature ?? 25;
    // Previsualizar ADC
    const B=3977, R25=10000, T25=298.15, Ref=10000;
    const Rntc = R25 * Math.exp(B*(1/(temp+273.15) - 1/T25));
    const adc  = Math.round(Ref/(Rntc+Ref)*1023);
    return (
      <div style={s} onPointerDown={e => e.stopPropagation()}>
        <div style={{...title, color:'#f87171'}}>🌡 NTC — Temperatura</div>
        <div style={row}>
          <input type="range" min={-20} max={120} value={temp}
            style={{flex:1, accentColor:'#ef4444'}}
            onChange={e => onChange({ temperature: Number(e.target.value) })} />
          <span style={{...val, color:'#fca5a5'}}>{temp}°C</span>
        </div>
        <div style={{fontSize:9, color:'#475569'}}>ADC ≈ {adc}</div>
      </div>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// ContextMenu component
// ---------------------------------------------------------------------------
function ContextMenu({ x, y, onDelete, onDuplicate, onRotate, onClose }) {
  useEffect(() => {
    const handler = () => onClose();
    window.addEventListener('pointerdown', handler);
    return () => window.removeEventListener('pointerdown', handler);
  }, [onClose]);

  const handleOnRotate = () => {
    onRotate();
    onClose();
  }
  return (
    <div
      style={{ position: 'fixed', left: x, top: y, zIndex: 1000 }}
      className="bg-slate-800 border border-slate-600 rounded-lg shadow-2xl py-1 min-w-[160px]"
      onPointerDown={(e) => e.stopPropagation()}
      
    >
      <button
        onClick={() => { onRotate(); onClose(); }}
        //onClick={() => {console.log('click'); handleOnRotate(); }}
        className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 transition-colors"
      >
        <RotateCw className="w-3.5 h-3.5 text-slate-400" />
        Rotar 90°
      </button>
      <button
        onClick={() => { onDuplicate(); onClose(); }}
        className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 transition-colors"
      >
        <Copy className="w-3.5 h-3.5 text-slate-400" />
        Duplicar
      </button>
      <div className="my-1 border-t border-slate-700" />
      <button
        onClick={() => { onDelete(); onClose(); }}
        className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-400 hover:bg-red-900/30 transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Eliminar
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function DiagramEditor({
  diagram,
  onAddPart,
  onRemovePart,
  onMovePart,
  onStartDrag,
  onEndDrag,
  onRotatePart,
  onDuplicatePart,
  onAddConnection,
  onRemoveConnection,
  onSetConnectionWaypoints,
  onUpdateConnectionWaypoints,
  pinStates = {},
  setPinState,
  setAnalogValue,
  schedulePinChange,
  registerPinListener,
  sensorConfig,
  onSensorConfigChange,
  probeMode = false,
  onProbePin,
  isRunning = false,
  i2cBus = null,
  spiBus = null,
}) {
  // ── Null-safe aliases (diagram can be null during undo) ───────────────────
  const parts       = diagram?.parts       ?? [];
  const connections  = diagram?.connections ?? [];

  // ── Viewport state ────────────────────────────────────────────────────────
  const [pan, setPan]   = useState({ x: 20, y: 20 });
  const [zoom, setZoom] = useState(1);

  // ── Editor mode ───────────────────────────────────────────────────────────
  const [mode, setMode] = useState('select'); // 'select' | 'wire' | 'probe'
  // Sync with external probeMode prop (e.g. activated from WorkbenchPage toolbar)
  const prevProbeModeRef = useRef(probeMode);
  if (prevProbeModeRef.current !== probeMode) {
    prevProbeModeRef.current = probeMode;
    if (probeMode && mode !== 'probe') setMode('probe');
    else if (!probeMode && mode === 'probe') setMode('select');
  }

  // ── Selection ─────────────────────────────────────────────────────────────
  const [selectedId, setSelectedId] = useState(null);

  // ── Dragging ──────────────────────────────────────────────────────────────
  const draggingRef = useRef(null); // { id, startClientX, startClientY, origLeft, origTop }
  // { wireIdx, pointIdx, origPoints, startClientX, startClientY }
  const draggingWaypointRef = useRef(null);

  // ── Panning ───────────────────────────────────────────────────────────────
  const panningRef = useRef(null); // { startClientX, startClientY, origPanX, origPanY }

  // ── Wire drawing ──────────────────────────────────────────────────────────
  const [wireColor, setWireColor]     = useState('#22c55e');
  const [pendingWire, setPendingWire] = useState(null); // { pin: 'id:pin', pos: {x,y} }
  const [mouseCanvasPos, setMouseCanvasPos] = useState(null);
  const [hoveredPin, setHoveredPin]   = useState(null);

  // ── Context menu ──────────────────────────────────────────────────────────
  const [contextMenu, setContextMenu] = useState(null); // { x, y, partId }

  // ── Palette ───────────────────────────────────────────────────────────────
  const [paletteCollapsed, setPaletteCollapsed] = useState(false);

  // ── Snap to grid ──────────────────────────────────────────────────────────
  const [snapGrid, setSnapGrid] = useState(false);

  // ── Wokwi element refs ────────────────────────────────────────────────────
  const elementRefs  = useRef(new Map()); // id → DOM element
  const wrapperRefs  = useRef(new Map()); // id → wrapper div
  const pinInfoStore = useRef(new Map()); // id → [{ name, x, y }]
  const cleanupRefs  = useRef(new Map()); // id → cleanup fn
  // ── Sensor config ref (always fresh, avoids stale closures in attachEvents) ─────────
  const sensorConfigRef = useRef(sensorConfig);
  sensorConfigRef.current = sensorConfig;
  // ── Pin positions (canvas coords) ─────────────────────────────────────────
  const [pinPositions, setPinPositions] = useState(new Map());

  // ── Canvas container ref ──────────────────────────────────────────────────
  const containerRef = useRef(null);

  // ── Refs needed for event closure stability ───────────────────────────────
  const panRef     = useRef(pan);
  const zoomRef    = useRef(zoom);
  const modeRef    = useRef(mode);
  panRef.current   = pan;
  zoomRef.current  = zoom;
  modeRef.current  = mode;

  // ---------------------------------------------------------------------------
  // Convert viewport coords to canvas coords
  // ---------------------------------------------------------------------------
  const toCanvas = useCallback((clientX, clientY) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - panRef.current.x) / zoomRef.current,
      y: (clientY - rect.top  - panRef.current.y) / zoomRef.current,
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Recalculate pin positions after any component move / resize
  // ---------------------------------------------------------------------------
  const recalcPinPositions = useCallback(() => {
    const positions = new Map();

    for (const part of parts) {
      const pins = pinInfoStore.current.get(part.id);
      if (!pins || pins.length === 0) continue;

      const wrapper = wrapperRefs.current.get(part.id);
      let w = wrapper?.offsetWidth  || 0;
      let h = wrapper?.offsetHeight || 0;

      // Fallback size estimation from pin bounding box
      if ((w === 0 || h === 0) && pins.length > 0) {
        const xs = pins.map((p) => p.x || 0);
        const ys = pins.map((p) => p.y || 0);
        w = w || Math.max(...xs) + 1;
        h = h || Math.max(...ys) + 1;
      }

      const angle = part.rotate || 0;
      for (const pin of pins) {
        const { x: rx, y: ry } = rotatePoint(pin.x || 0, pin.y || 0, w / 2, h / 2, angle);
        positions.set(`${part.id}.${pin.name}`, {
          x: part.left + rx,
          y: part.top  + ry,
        });
      }
    }

    setPinPositions(positions);
  }, [parts]);

  // Recalc when parts change
  useEffect(() => {
    const raf = requestAnimationFrame(recalcPinPositions);
    return () => cancelAnimationFrame(raf);
  }, [recalcPinPositions, parts]);

  // ResizeObserver for dynamic component sizing
  useEffect(() => {
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(recalcPinPositions);
    });
    for (const [, node] of wrapperRefs.current) ro.observe(node);
    return () => ro.disconnect();
  }, [recalcPinPositions, parts]);

  // ---------------------------------------------------------------------------
  // WokwiElement callbacks
  // ---------------------------------------------------------------------------
  const handlePinInfo = useCallback((partId, pins) => {
    pinInfoStore.current.set(partId, pins);
    requestAnimationFrame(recalcPinPositions);
  }, [recalcPinPositions]);

  const handleReady = useCallback((partId, el) => {
    elementRefs.current.set(partId, el);
    setTimeout(recalcPinPositions, 150);
  }, [recalcPinPositions]);

  // ---------------------------------------------------------------------------
  // Simulation: wire input components when simulation starts
  // ---------------------------------------------------------------------------

  // Build connection map using BFS — resolves through intermediate components (resistors, etc.)
  // Key insight: all pins of the same non-board component are internally connected,
  // so resistor_103:1 and resistor_103:2 are neighbors even if not wired directly.
  // Result: Map<"partId:pinName", arduinoPinNumber>
  const connectionMap = useMemo(() => {
    const map = new Map();
    const BOARD_IDS = new Set(['uno', 'nano', 'mega', 'board']);

    // Collect all pin nodes that appear in connections
    const allNodes = new Set();
    for (const conn of connections) {
      allNodes.add(conn[0]);
      allNodes.add(conn[1]);
    }

    // Group nodes by component id → all pins of that component
    const componentPins = new Map(); // id → Set<"id:pin">
    for (const node of allNodes) {
      const colonIdx = node.indexOf(':');
      const id = node.slice(0, colonIdx);
      if (!componentPins.has(id)) componentPins.set(id, new Set());
      componentPins.get(id).add(node);
    }

    // Build undirected adjacency list: "id:pin" → Set<"id:pin">
    const adj = new Map();
    const addEdge = (a, b) => {
      if (!adj.has(a)) adj.set(a, new Set());
      if (!adj.has(b)) adj.set(b, new Set());
      adj.get(a).add(b);
      adj.get(b).add(a);
    };

    // Wire connections
    for (const conn of connections) {
      addEdge(conn[0], conn[1]);
    }

    // Internal component connections: all pins of same non-board part are neighbors
    for (const [id, pins] of componentPins) {
      if (BOARD_IDS.has(id)) continue;
      const pinsArr = [...pins];
      for (let i = 0; i < pinsArr.length; i++) {
        for (let j = i + 1; j < pinsArr.length; j++) {
          addEdge(pinsArr[i], pinsArr[j]);
        }
      }
    }

    // For every non-board node, BFS to find the connected board pin
    for (const node of allNodes) {
      const colonIdx = node.indexOf(':');
      const nodeId = node.slice(0, colonIdx);
      if (BOARD_IDS.has(nodeId)) continue;

      const visited = new Set([node]);
      const queue = [node];
      while (queue.length > 0) {
        const cur = queue.shift();
        const ci = cur.indexOf(':');
        const curId  = cur.slice(0, ci);
        const curPin = cur.slice(ci + 1);
        if (BOARD_IDS.has(curId)) {
          // Found a board node — if it maps to a valid Arduino pin, record and stop
          // Otherwise keep searching (e.g. GND has no pin number)
          const arduinoPin = boardPinToArduinoNumber(curPin);
          if (arduinoPin !== null) {
            map.set(node, arduinoPin);
            break; // found a valid signal pin, done
          }
          // GND/VCC/etc. — don't traverse into the board, just skip
          continue;
        }
        for (const neighbor of (adj.get(cur) || [])) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
    }
    return map;
  }, [connections]);

  useEffect(() => {
    // Cleanup previous
    for (const [, fn] of cleanupRefs.current) if (typeof fn === 'function') fn();
    cleanupRefs.current.clear();

    if (!isRunning) return;

    for (const part of parts) {
      if (!isInputComponent(part.type)) continue;
      const behavior = getBehavior(part.type);
      if (!behavior) continue;
      const el = elementRefs.current.get(part.id);
      if (!el) continue;

      const helpers = {
        setPinState:       (pin, val) => setPinState?.(pin, val),
        setAnalogValue:    (pin, val) => setAnalogValue?.(pin, val),
        getConnectedPin:   (pinName)  => connectionMap.get(`${part.id}:${pinName}`) ?? null,
        schedulePinChange: (pin, delayMicros, value) => schedulePinChange?.(pin, delayMicros, value),
        registerPinListener: (cb) => registerPinListener?.(cb) ?? (() => {}),
        getSensorValue:    (key) => sensorConfigRef.current?.get(part.id)?.[key],
        // I²C helpers
        registerI2CSlave:   (addr, handler) => i2cBus?.current?.registerSlave(addr, handler),
        unregisterI2CSlave: (addr)          => i2cBus?.current?.unregisterSlave(addr),
        getPartAttr:        (key)           => part.attrs?.[key] ?? null,
        // SPI helpers
        registerSpiDevice:   (csPin, handler) => spiBus?.current?.registerDevice(csPin, handler, registerPinListener),
        unregisterSpiDevice: (csPin)          => spiBus?.current?.unregisterDevice(csPin),
      };

      const cleanup = behavior.attachEvents(el, helpers);
      if (typeof cleanup === 'function') cleanupRefs.current.set(part.id, cleanup);
    }

    return () => {
      for (const [, fn] of cleanupRefs.current) if (typeof fn === 'function') fn();
      cleanupRefs.current.clear();
    };
  }, [isRunning, parts, connectionMap, setPinState, setAnalogValue]);

  // Sync output components with pinStates
  useEffect(() => {
    if (!isRunning) return;
    for (const part of parts) {
      if (!isOutputComponent(part.type)) continue;
      const behavior = getBehavior(part.type);
      if (!behavior) continue;
      const el = elementRefs.current.get(part.id);
      if (!el) continue;

      // Use BFS-resolved connectionMap: compId:pin → arduinoPin
      for (const [key, arduinoPin] of connectionMap) {
        const colonIdx = key.indexOf(':');
        const cId  = key.slice(0, colonIdx);
        const cPin = key.slice(colonIdx + 1);
        if (cId !== part.id) continue;

        const pinValue = pinStates[arduinoPin];
        if (pinValue !== undefined) {
          behavior.onPinChange(el, cPin, pinValue, pinStates[`pwm_${arduinoPin}`]);
        }
      }
    }
  }, [isRunning, pinStates, parts, connections]);

  // Board LED via direct pin listener
  useEffect(() => {
    if (!registerPinListener) return;
    const un = registerPinListener((pin, value) => {
      // Update board LED13 visually
      const boardEl = elementRefs.current.get('uno')
                   || elementRefs.current.get('nano')
                   || elementRefs.current.get('mega');
      if (boardEl && pin === 13) boardEl.led13 = !!value;
    });
    return () => typeof un === 'function' && un();
  }, [registerPinListener]);

  // Board ledPower
  useEffect(() => {
    const boardEl = elementRefs.current.get('uno')
                 || elementRefs.current.get('nano')
                 || elementRefs.current.get('mega');
    if (boardEl) boardEl.ledPower = isRunning;
  }, [isRunning]);

  // ---------------------------------------------------------------------------
  // Pointer events on the outer container (pan + mouse tracking)
  // ---------------------------------------------------------------------------
  const handleContainerPointerDown = useCallback((e) => {
    // Middle mouse or Space pan
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      panningRef.current = {
        startClientX: e.clientX,
        startClientY: e.clientY,
        origPanX: panRef.current.x,
        origPanY: panRef.current.y,
      };
      return;
    }
    // Left click on empty canvas → deselect
    if (e.button === 0) {
      setSelectedId(null);
      setContextMenu(null);
      if (modeRef.current === 'wire') {
        setPendingWire(null);
        setMouseCanvasPos(null);
      }
    }
  }, []);

  const handleContainerPointerMove = useCallback((e) => {
    if (panningRef.current) {
      const dx = e.clientX - panningRef.current.startClientX;
      const dy = e.clientY - panningRef.current.startClientY;
      setPan({
        x: panningRef.current.origPanX + dx,
        y: panningRef.current.origPanY + dy,
      });
    }
    if (draggingRef.current) {
      const { id, startClientX, startClientY, origLeft, origTop } = draggingRef.current;
      const dx = (e.clientX - startClientX) / zoomRef.current;
      const dy = (e.clientY - startClientY) / zoomRef.current;
      onMovePart(id, snap(origLeft + dx, snapGrid), snap(origTop + dy, snapGrid));
    }
    if (draggingWaypointRef.current) {
      const { wireIdx, pointIdx, origPoints, startClientX, startClientY } = draggingWaypointRef.current;
      const dx = (e.clientX - startClientX) / zoomRef.current;
      const dy = (e.clientY - startClientY) / zoomRef.current;
      const newPoints = origPoints.map((p, i) =>
        i === pointIdx ? [snap(p[0] + dx, snapGrid), snap(p[1] + dy, snapGrid)] : p,
      );
      onSetConnectionWaypoints?.(wireIdx, newPoints);
    }
    if (modeRef.current === 'wire' && pendingWire) {
      setMouseCanvasPos(toCanvas(e.clientX, e.clientY));
    }
  }, [onMovePart, onSetConnectionWaypoints, pendingWire, toCanvas, snapGrid]);

  const handleContainerPointerUp = useCallback(() => {
    if (panningRef.current) panningRef.current = null;
    if (draggingRef.current) {
      onEndDrag();
      draggingRef.current = null;
    }
    if (draggingWaypointRef.current) {
      onEndDrag(); // commits preDragRef to undo history
      draggingWaypointRef.current = null;
    }
  }, [onEndDrag]);

  // Zoom with Ctrl+Wheel
  const handleWheel = useCallback((e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const rect = containerRef.current.getBoundingClientRect();
    const ox = e.clientX - rect.left;
    const oy = e.clientY - rect.top;
    setZoom((z) => {
      const nz = Math.min(4, Math.max(0.2, z * factor));
      // Adjust pan to zoom around the cursor
      setPan((p) => ({
        x: ox - (ox - p.x) * (nz / z),
        y: oy - (oy - p.y) * (nz / z),
      }));
      return nz;
    });
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        setPendingWire(null);
        setMouseCanvasPos(null);
        setContextMenu(null);
        setMode('select');
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && !e.target.closest('input, textarea')) {
        onRemovePart(selectedId);
        setSelectedId(null);
      }
      if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        /* undo handled by parent */
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, onRemovePart]);

  // ---------------------------------------------------------------------------
  // Palette: drop on canvas
  // ---------------------------------------------------------------------------
  const handleDragOver = useCallback((e) => {
    if (e.dataTransfer.types.includes('palette-type')) e.preventDefault();
  }, []);

  const handleDrop = useCallback((e) => {
    const type  = e.dataTransfer.getData('palette-type');
    const attrs = JSON.parse(e.dataTransfer.getData('palette-attrs') || '{}');
    if (!type) return;
    const pos = toCanvas(e.clientX, e.clientY);
    onAddPart(type, snap(pos.x - 60, snapGrid), snap(pos.y - 60, snapGrid), attrs);
  }, [toCanvas, onAddPart, snapGrid]);

  // Palette click-to-add → place near canvas centre
  const handlePaletteAdd = useCallback((type, attrs) => {
    const cx = (CANVAS_W / 2) + Math.random() * 40 - 20;
    const cy = (CANVAS_H / 4) + Math.random() * 40 - 20;
    onAddPart(type, snap(cx, snapGrid), snap(cy, snapGrid), attrs);
  }, [onAddPart, snapGrid]);

  // ---------------------------------------------------------------------------
  // Component drag
  // ---------------------------------------------------------------------------
  const handlePartPointerDown = useCallback((e, part) => {
    if (e.button !== 0) return;
    if (modeRef.current === 'wire') return; // wire mode: don't drag
    e.stopPropagation();
    setSelectedId(part.id);
    setContextMenu(null);
    onStartDrag();
    draggingRef.current = {
      id: part.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origLeft: part.left,
      origTop:  part.top,
    };
  }, [onStartDrag]);

  const handlePartContextMenu = useCallback((e, partId) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, partId });
    setSelectedId(partId);
  }, []);

  // ---------------------------------------------------------------------------
  // Pin click (wire drawing)
  // ---------------------------------------------------------------------------
  const handlePinClick = useCallback((pinKey, pos, e) => {
    e?.stopPropagation();
    if (modeRef.current !== 'wire') return;

    if (!pendingWire) {
      setPendingWire({ pin: pinKey, pos });
      setMouseCanvasPos(pos);
    } else if (pendingWire.pin === pinKey) {
      // Same pin → cancel
      setPendingWire(null);
      setMouseCanvasPos(null);
    } else {
      // Convert dot-format keys to colon-format for addConnection
      const toColon = (k) => k.replace('.', ':');
      onAddConnection(toColon(pendingWire.pin), toColon(pinKey), wireColor);
      setPendingWire(null);
      setMouseCanvasPos(null);
    }
  }, [pendingWire, onAddConnection, wireColor]);

  // ---------------------------------------------------------------------------
  // Wire right-click → delete
  // ---------------------------------------------------------------------------
  const handleWireContextMenu = useCallback((e, idx) => {
    e.preventDefault();
    onRemoveConnection(idx);
  }, [onRemoveConnection]);

  // ---------------------------------------------------------------------------
  // Wire segment left-click (select mode) → insert waypoint at click position
  // ---------------------------------------------------------------------------
  const handleWireSegmentClick = useCallback((e, wireIdx, segIdx) => {
    if (modeRef.current !== 'select') return;
    const pos = toCanvas(e.clientX, e.clientY);
    const conn = connections[wireIdx];
    if (!conn) return;
    const points = [...(conn[3] ?? [])];
    // segIdx is the segment index (0 = between endpoint and first waypoint, etc.)
    points.splice(segIdx, 0, [pos.x, pos.y]);
    onUpdateConnectionWaypoints?.(wireIdx, points);
  }, [connections, toCanvas, onUpdateConnectionWaypoints]);

  // ---------------------------------------------------------------------------
  // Waypoint handle pointer down → start drag
  // ---------------------------------------------------------------------------
  const handleWaypointPointerDown = useCallback((e, wireIdx, pointIdx) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const conn = connections[wireIdx];
    if (!conn) return;
    onStartDrag(); // captures preDragRef for undo
    draggingWaypointRef.current = {
      wireIdx,
      pointIdx,
      origPoints: (conn[3] ?? []).map((p) => [...p]),
      startClientX: e.clientX,
      startClientY: e.clientY,
    };
  }, [connections, onStartDrag]);

  // ---------------------------------------------------------------------------
  // Waypoint handle right-click → delete that waypoint
  // ---------------------------------------------------------------------------
  const handleWaypointContextMenu = useCallback((e, wireIdx, pointIdx) => {
    e.preventDefault();
    e.stopPropagation();
    const conn = connections[wireIdx];
    if (!conn) return;
    const points = (conn[3] ?? []).filter((_, i) => i !== pointIdx);
    onUpdateConnectionWaypoints?.(wireIdx, points);
  }, [connections, onUpdateConnectionWaypoints]);

  // ---------------------------------------------------------------------------
  // Build the props for each WokwiElement
  // ---------------------------------------------------------------------------
  const getPartProps = useCallback((part) => {
    const props = { ...(part.attrs || {}) };
    // Board-specific
    if (part.type === 'wokwi-arduino-uno') {
      props.led13    = !!pinStates[13];
      props.ledPower = isRunning;
    }
    return props;
  }, [pinStates, isRunning]);

  // ---------------------------------------------------------------------------
  // SVG mouse move for wire preview
  // ---------------------------------------------------------------------------
  const handleSvgMouseMove = useCallback((e) => {
    if (modeRef.current !== 'wire' || !pendingWire) return;
    setMouseCanvasPos(toCanvas(e.clientX, e.clientY));
  }, [pendingWire, toCanvas]);

  // ---------------------------------------------------------------------------
  // Build CircuitWires-compatible wire list from connections
  // ---------------------------------------------------------------------------
  const wireList = useMemo(() =>
    connections.map((conn) => {
      const [from, to, color, points = []] = conn;
      const [fId, fPin] = from.split(':');
      const [tId, tPin] = to.split(':');
      return { from: [fId, fPin], to: [tId, tPin], color, points };
    }),
  [connections]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const cursor = mode === 'wire'
    ? 'crosshair'
    : mode === 'probe'
    ? 'cell'
    : draggingRef.current ? 'grabbing' : 'default';

  return (
    <div className="flex flex-row h-full overflow-hidden bg-slate-950">
      {/* ── Palette sidebar ── */}
      <ComponentPalette
        onAdd={handlePaletteAdd}
        collapsed={paletteCollapsed}
        onToggle={() => setPaletteCollapsed((v) => !v)}
      />

      {/* ── Canvas area ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* ── Diagram toolbar ── */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border-b border-slate-700 flex-shrink-0">
          {/* Palette toggle when collapsed */}
          {paletteCollapsed && (
            <button
              onClick={() => setPaletteCollapsed(false)}
              className="px-2 py-1 rounded text-[10px] font-medium bg-slate-700 text-slate-300 hover:bg-slate-600"
              title="Mostrar paleta"
            >
              ⊞ Componentes
            </button>
          )}

          {/* Mode buttons */}
          <button
            onClick={() => { setMode('select'); setPendingWire(null); }}
            className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors border ${
              mode === 'select'
                ? 'bg-emerald-600 text-white border-emerald-500'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
            title="Modo selección (Esc)"
          >
            ↖ Seleccionar
          </button>
          <button
            onClick={() => setMode(mode === 'wire' ? 'select' : 'wire')}
            className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors border ${
              mode === 'wire'
                ? 'bg-blue-600 text-white border-blue-500'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
            title="Modo cable (clic en pines para conectar)"
          >
            ╱ Cablear
          </button>

          <button
            onClick={() => setMode(mode === 'probe' ? 'select' : 'probe')}
            className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors border ${
              mode === 'probe'
                ? 'bg-cyan-700 text-cyan-100 border-cyan-500'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
            title="Modo sonda — clic en un pin o cable para capturar en el Analizador Lógico"
          >
            🔬 Sonda
          </button>

          <button
            onClick={() => setSnapGrid(v => !v)}
            className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors border ${
              snapGrid
                ? 'bg-violet-600 text-white border-violet-500'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
            title="Ajustar al grid (20 px)"
          >
            ⊹ Grid
          </button>

          {/* Wire colours (only visible in wire mode) */}
          {mode === 'wire' && (
            <div className="flex items-center gap-1 pl-2 border-l border-slate-700">
              {WIRE_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setWireColor(c)}
                  style={{ background: c }}
                  className={`w-3.5 h-3.5 rounded-full border-2 transition-transform ${
                    wireColor === c ? 'border-white scale-125' : 'border-transparent hover:scale-110'
                  }`}
                  title={c}
                />
              ))}
              {pendingWire && (
                <span className="text-[9px] text-slate-400 ml-1">
                  Clic en pin destino · Esc cancela
                </span>
              )}
            </div>
          )}

          <div className="flex-1" />

          {/* Zoom controls */}
          <span className="text-[10px] text-slate-500 font-mono">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom((z) => Math.min(4, z * 1.2))}
            className="px-1.5 py-0.5 rounded text-[11px] bg-slate-800 text-slate-400 hover:text-white border border-slate-700"
            title="Acercar (Ctrl+Rueda)"
          >+</button>
          <button
            onClick={() => setZoom((z) => Math.max(0.2, z / 1.2))}
            className="px-1.5 py-0.5 rounded text-[11px] bg-slate-800 text-slate-400 hover:text-white border border-slate-700"
            title="Alejar (Ctrl+Rueda)"
          >−</button>
          <button
            onClick={() => { setZoom(1); setPan({ x: 20, y: 20 }); }}
            className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 hover:text-white border border-slate-700"
            title="Resetear vista"
          >⌂</button>

          {/* Delete selected */}
          {selectedId && mode === 'select' && (
            <button
              onClick={() => { onRemovePart(selectedId); setSelectedId(null); }}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-red-900/40 text-red-400 border border-red-800/40 hover:bg-red-800/50"
            >
              <Trash2 className="w-3 h-3" /> Eliminar
            </button>
          )}
        </div>

        {/* ── Canvas ── */}
        <div
          ref={containerRef}
          className="flex-1 overflow-hidden relative select-none"
          style={{ cursor, background: '#0f172a' }}
          onPointerDown={handleContainerPointerDown}
          onPointerMove={handleContainerPointerMove}
          onPointerUp={handleContainerPointerUp}
          onPointerLeave={handleContainerPointerUp}
          onWheel={handleWheel}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* Grid background (subtle dots) */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                'radial-gradient(circle, #334155 1px, transparent 1px)',
              backgroundSize: `${GRID * zoom}px ${GRID * zoom}px`,
              backgroundPosition: `${pan.x}px ${pan.y}px`,
              opacity: snapGrid ? 0.55 : 0.3,
            }}
          />

          {/* Transformed canvas */}
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
              position: 'absolute',
              width:  CANVAS_W,
              height: CANVAS_H,
            }}
          >
            {/* Wires */}
            <CircuitWires
              wires={wireList}
              pinPositions={pinPositions}
              width={CANVAS_W}
              height={CANVAS_H}
              onWireContextMenu={handleWireContextMenu}
              onWireSegmentClick={mode === 'select' ? handleWireSegmentClick : undefined}
            />

            {/* Components */}
            {parts.map((part) => {
              const isSelected = selectedId === part.id;
              return (
                <div
                  key={part.id}
                  ref={(node) => {
                    if (node) {
                      wrapperRefs.current.set(part.id, node);
                    }
                  }}
                  style={{
                    position:        'absolute',
                    left:            part.left,
                    top:             part.top,
                    transform:       part.rotate ? `rotate(${part.rotate}deg)` : undefined,
                    transformOrigin: 'center center',
                    zIndex:          isSelected ? 10 : 3,
                    cursor:          mode === 'select' ? 'grab' : 'default',
                    outline:         isSelected ? '2px solid #3b82f6' : '2px solid transparent',
                    outlineOffset:   '2px',
                    borderRadius:    '3px',
                  }}
                  onPointerDown={(e) => handlePartPointerDown(e, part)}
                  onContextMenu={(e) => handlePartContextMenu(e, part.id)}
                >
                  <WokwiElement
                    tag={part.type}
                    properties={getPartProps(part)}
                    onPinInfo={(pins) => handlePinInfo(part.id, pins)}
                    onReady={(el) => handleReady(part.id, el)}
                  />
                </div>
              );
            })}

            {/* Sensor control overlays (visible while simulation is running) */}
            {isRunning && parts
              .filter(p => SENSOR_TYPES.has(p.type))
              .map(part => {
                const partId   = part.id;
                const cfgEntry = sensorConfig?.get(partId) ?? {};
                return (
                  <SensorPanel
                    key={`sensor-panel-${partId}`}
                    part={part}
                    config={cfgEntry}
                    onChange={updates =>
                      onSensorConfigChange?.(partId, updates)
                    }
                  />
                );
              })
            }

            {/* Wire drawing SVG overlay */}
            <svg
              style={{
                position:      'absolute',
                inset:         0,
                width:         CANVAS_W,
                height:        CANVAS_H,
                zIndex:        20,
                pointerEvents: (mode === 'wire' || mode === 'probe') ? 'all' : 'none',
                overflow:      'visible',
              }}
              onMouseMove={handleSvgMouseMove}
            >
              {/* Dashed preview line */}
              {pendingWire && mouseCanvasPos && (
                <>
                  <path
                    d={wirePath(
                      pendingWire.pos.x, pendingWire.pos.y,
                      mouseCanvasPos.x,  mouseCanvasPos.y,
                    )}
                    fill="none"
                    stroke={wireColor}
                    strokeWidth={2.5}
                    strokeDasharray="7 4"
                    strokeLinecap="round"
                    opacity={0.9}
                  />
                  <path
                    d={wirePath(
                      pendingWire.pos.x, pendingWire.pos.y,
                      mouseCanvasPos.x,  mouseCanvasPos.y,
                    )}
                    fill="none"
                    stroke="white"
                    strokeWidth={0.5}
                    strokeDasharray="7 4"
                    strokeLinecap="round"
                    opacity={0.3}
                  />
                </>
              )}

              {/* Waypoint handles — visible in select mode */}
              {mode === 'select' && connections.map((conn, wireIdx) => {
                const points = conn[3] ?? [];
                return points.map((wp, ptIdx) => (
                  <g key={`wp-${wireIdx}-${ptIdx}`}>
                    {/* Outer ring */}
                    <circle
                      cx={wp[0]} cy={wp[1]} r={7}
                      fill="rgba(59,130,246,0.15)"
                      stroke="rgba(59,130,246,0.4)"
                      strokeWidth={1}
                      style={{ pointerEvents: 'none' }}
                    />
                    {/* Draggable handle */}
                    <circle
                      cx={wp[0]} cy={wp[1]} r={5}
                      fill="#3b82f6"
                      stroke="#93c5fd"
                      strokeWidth={1.5}
                      style={{ cursor: 'move', pointerEvents: 'all' }}
                      onPointerDown={(e) => handleWaypointPointerDown(e, wireIdx, ptIdx)}
                      onContextMenu={(e) => handleWaypointContextMenu(e, wireIdx, ptIdx)}
                    />
                  </g>
                ));
              })}

              {/* Pin circles — visible in wire AND probe modes */}
              {[...pinPositions.entries()].map(([key, pos]) => {
                const isPending    = pendingWire?.pin === key;
                const isHovered    = hoveredPin === key;
                const isProbe      = mode === 'probe';
                const circleColor  = isProbe
                  ? (isHovered ? '#22d3ee' : 'rgba(34,211,238,0.4)')
                  : isPending ? wireColor : 'rgba(255,255,255,0.1)';
                const strokeColor  = isProbe
                  ? (isHovered ? '#67e8f9' : 'rgba(34,211,238,0.6)')
                  : isPending ? wireColor
                  : isHovered ? 'rgba(255,255,255,0.9)'
                  : 'rgba(255,255,255,0.4)';

                return (
                  <g key={key}>
                    {(isPending || isHovered) && (
                      <circle
                        cx={pos.x} cy={pos.y}
                        r={isPending ? 10 : 8}
                        fill={isProbe ? 'rgba(34,211,238,0.12)' : (isPending ? wireColor : 'rgba(255,255,255,0.15)')}
                        opacity={0.2}
                        style={{ pointerEvents: 'none' }}
                      />
                    )}
                    <circle
                      cx={pos.x} cy={pos.y}
                      r={isPending ? 5.5 : 4}
                      fill={circleColor}
                      stroke={strokeColor}
                      strokeWidth={1.5}
                      style={{ cursor: isProbe ? 'cell' : 'pointer', pointerEvents: 'all' }}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        if (isProbe) {
                          e.stopPropagation();
                          // Resolve to Arduino pin via connectionMap
                          const colonKey = key.replace('.', ':');
                          const arduinoPin = connectionMap.get(colonKey);
                          if (arduinoPin != null) {
                            // Find wire color for this pin
                            const wireConn = connections.find(
                              c => c[0] === colonKey || c[1] === colonKey
                            );
                            const color = wireConn?.[2] ?? '#22c55e';
                            onProbePin?.(arduinoPin, color, colonKey);
                          }
                        } else {
                          handlePinClick(key, pos, e);
                        }
                      }}
                      onMouseEnter={() => setHoveredPin(key)}
                      onMouseLeave={() => setHoveredPin(null)}
                    />
                    {/* Pin label on hover */}
                    {isHovered && (
                      <>
                        <rect
                          x={pos.x + 8}
                          y={pos.y - 10}
                          width={key.length * 5.5 + 8}
                          height={14}
                          rx={3}
                          fill="rgba(15,15,30,0.9)"
                          style={{ pointerEvents: 'none' }}
                        />
                        <text
                          x={pos.x + 12}
                          y={pos.y + 1}
                          fontSize={9}
                          fill={isProbe ? '#67e8f9' : '#e2e8f0'}
                          fontFamily="monospace"
                          style={{ pointerEvents: 'none' }}
                        >
                          {key}{isProbe && connectionMap.get(key.replace('.', ':')) != null
                            ? ` → D${connectionMap.get(key.replace('.', ':'))}` : ''}
                        </text>
                      </>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Simulation status badge */}
          {isRunning && (
            <div className="absolute bottom-3 right-3 flex items-center gap-1.5
                            bg-emerald-900/60 border border-emerald-700/50 rounded-lg
                            px-2.5 py-1 text-[11px] text-emerald-300 font-medium
                            backdrop-blur-sm pointer-events-none z-30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Simulando
            </div>
          )}
        </div>
      </div>

      {/* ── Context menu ── */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onDelete={() => { onRemovePart(contextMenu.partId); setSelectedId(null); }}
          onDuplicate={() => onDuplicatePart(contextMenu.partId)}
          onRotate={() => onRotatePart(contextMenu.partId)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
