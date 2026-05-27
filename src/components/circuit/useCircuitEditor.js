/*
 * useCircuitEditor.js
 * -------------------
 * React hook that manages the wokwi-compatible circuit diagram state.
 *
 * Diagram JSON schema (wokwi v1):
 * {
 *   version: 1,
 *   parts: [{ type, id, top, left, rotate, attrs }],
 *   connections: [["id:pin", "id:pin", "color", [waypoints]]]
 * }
 *
 * Features:
 *  - Full undo / redo history
 *  - addPart, removePart, movePart, commitMove, rotatePart, duplicatePart
 *  - addConnection, removeConnection
 *  - updatePartAttrs, loadDiagram
 */

import { useState, useCallback, useRef } from 'react';

// ---------------------------------------------------------------------------
// Default diagram – Arduino Uno on a blank canvas
// ---------------------------------------------------------------------------
export const DEFAULT_DIAGRAM = {
  version: 1,
  parts: [
    { type: 'wokwi-arduino-uno', id: 'uno', top: 60, left: 80, rotate: 0, attrs: {} },
  ],
  connections: [],
};

// ---------------------------------------------------------------------------
// ID generator
// ---------------------------------------------------------------------------
let _seq = 100;
export function generatePartId(type) {
  const base = type.replace('wokwi-', '').replace(/-/g, '_');
  return `${base}_${++_seq}`;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export default function useCircuitEditor(initial = DEFAULT_DIAGRAM) {
  const [diagram, setDiagram] = useState(initial);
  const [past, setPast]       = useState([]);
  const [future, setFuture]   = useState([]);

  // Keep a ref to the live diagram for use inside imperative callbacks
  const liveRef = useRef(diagram);
  liveRef.current = diagram;

  // Push current diagram to history and set new state
  const commit = useCallback((next) => {
    setPast((p) => [...p, liveRef.current]);
    setDiagram(next);
    setFuture([]);
    liveRef.current = next;
  }, []);

  // ── Undo / Redo ───────────────────────────────────────────────────────────

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p;
      const prev = p[p.length - 1];
      setFuture((f) => [liveRef.current, ...f]);
      setDiagram(prev);
      liveRef.current = prev;
      return p.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0];
      setPast((p) => [...p, liveRef.current]);
      setDiagram(next);
      liveRef.current = next;
      return f.slice(1);
    });
  }, []);

  // ── Parts ─────────────────────────────────────────────────────────────────

  /** Add a new part to the canvas and return its generated ID. */
  const addPart = useCallback((type, left, top, attrs = {}) => {
    const id = generatePartId(type);
    const d = liveRef.current;
    commit({ ...d, parts: [...d.parts, { type, id, top, left, rotate: 0, attrs }] });
    return id;
  }, [commit]);

  /** Remove a part and all its connections. */
  const removePart = useCallback((id) => {
    const d = liveRef.current;
    commit({
      ...d,
      parts: d.parts.filter((p) => p.id !== id),
      connections: d.connections.filter(
        (c) => !c[0].startsWith(`${id}:`) && !c[1].startsWith(`${id}:`),
      ),
    });
  }, [commit]);

  /**
   * Update a part position WITHOUT adding to history (called during drag).
   * Call commitMove() on pointer-up to push a single undo entry.
   */
  const movePart = useCallback((id, left, top) => {
    setDiagram((d) => ({
      ...d,
      parts: d.parts.map((p) => (p.id === id ? { ...p, left, top } : p)),
    }));
  }, []);

  /** Commit the current (post-drag) position to history. */
  const commitMove = useCallback(() => {
    setPast((p) => [...p, /* we use liveRef.current before setDiagram was called with movePart
                           * but since setDiagram above already updated it, just push current: */
      ...p.length === 0 ? [] : [],   // no-op spread
    ]);
    // Actually we need to push the PREVIOUS state.  We'll track it separately:
    // see preDragRef below.
  }, []);

  // A cleaner approach for commitMove: capture the pre-drag diagram.
  const preDragRef = useRef(null);

  const startDrag = useCallback(() => {
    preDragRef.current = liveRef.current;
  }, []);

  const endDrag = useCallback(() => {
    if (preDragRef.current) {
      setPast((p) => [...p, preDragRef.current]);
      setFuture([]);
      preDragRef.current = null;
    }
  }, []);

  /** Rotate a part by 90° clockwise. */
  const rotatePart = useCallback((id) => {
    const d = liveRef.current;
    commit({
      ...d,
      parts: d.parts.map((p) =>
        p.id === id ? { ...p, rotate: ((p.rotate || 0) + 90) % 360 } : p,
      ),
    });
  }, [commit]);

  /** Duplicate a part with a 40px offset. Returns the new part ID. */
  const duplicatePart = useCallback((id) => {
    const d = liveRef.current;
    const src = d.parts.find((p) => p.id === id);
    if (!src) return null;
    const newId = generatePartId(src.type);
    commit({
      ...d,
      parts: [...d.parts, { ...src, id: newId, left: src.left + 40, top: src.top + 40 }],
    });
    return newId;
  }, [commit]);

  /** Update attrs of a part (merges, does not replace). */
  const updatePartAttrs = useCallback((id, attrs) => {
    const d = liveRef.current;
    commit({
      ...d,
      parts: d.parts.map((p) =>
        p.id === id ? { ...p, attrs: { ...p.attrs, ...attrs } } : p,
      ),
    });
  }, [commit]);

  // ── Connections ───────────────────────────────────────────────────────────

  /**
   * Add a wire between two pin descriptors ("id:pin") with a color.
   * Silently ignores duplicate connections.
   */
  const addConnection = useCallback((from, to, color = '#22c55e') => {
    const d = liveRef.current;
    const exists = d.connections.some(
      (c) => (c[0] === from && c[1] === to) || (c[0] === to && c[1] === from),
    );
    if (exists) return;
    commit({ ...d, connections: [...d.connections, [from, to, color, []]] });
  }, [commit]);

  /** Remove a connection by its index in the array. */
  const removeConnection = useCallback((index) => {
    const d = liveRef.current;
    commit({ ...d, connections: d.connections.filter((_, i) => i !== index) });
  }, [commit]);

  /**
   * Live-update waypoints for a connection WITHOUT pushing to undo history.
   * Call startDrag() before the first call, then endDrag() on pointer-up.
   */
  const setConnectionWaypoints = useCallback((index, points) => {
    setDiagram((d) => ({
      ...d,
      connections: d.connections.map((c, i) =>
        i === index ? [c[0], c[1], c[2], points] : c,
      ),
    }));
  }, []);

  /**
   * Commit a waypoint change to undo history (use for insert/delete, not drag).
   */
  const updateConnectionWaypoints = useCallback((index, points) => {
    const d = liveRef.current;
    commit({
      ...d,
      connections: d.connections.map((c, i) =>
        i === index ? [c[0], c[1], c[2], points] : c,
      ),
    });
  }, [commit]);

  /** Remove all connections. */
  const clearConnections = useCallback(() => {
    commit({ ...liveRef.current, connections: [] });
  }, [commit]);

  /**
   * Elimina todas las partes que tienen CERO conexiones y no son placas Arduino.
   * Útil para limpiar componentes arrastrados fuera del canvas o pegados por error.
   * @returns {number} Cantidad de partes eliminadas
   */
  const removeOrphans = useCallback(() => {
    const d = liveRef.current;
    const connected = new Set();
    for (const c of d.connections) {
      connected.add(c[0].split(':')[0]);
      connected.add(c[1].split(':')[0]);
    }
    const KEEP_TYPES = ['wokwi-arduino-uno', 'wokwi-arduino-nano', 'wokwi-arduino-mega', 'wokwi-esp32-devkit-v1'];
    const orphans = d.parts.filter(
      (p) => !connected.has(p.id) && !KEEP_TYPES.some((t) => p.type === t),
    );
    if (orphans.length === 0) return 0;
    const orphanIds = new Set(orphans.map((p) => p.id));
    commit({
      ...d,
      parts: d.parts.filter((p) => !orphanIds.has(p.id)),
      connections: d.connections.filter(
        (c) => !orphanIds.has(c[0].split(':')[0]) && !orphanIds.has(c[1].split(':')[0]),
      ),
    });
    return orphans.length;
  }, [commit]);

  // ── Load ─────────────────────────────────────────────────────────────────

  /** Replace the entire diagram (e.g. from file import). Resets history. */
  const loadDiagram = useCallback((next) => {
    setPast([]);
    setFuture([]);
    setDiagram(next);
    liveRef.current = next;
  }, []);

  // ── Public API ────────────────────────────────────────────────────────────
  return {
    diagram,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    undo,
    redo,
    // parts
    addPart,
    removePart,
    movePart,
    startDrag,
    endDrag,
    rotatePart,
    duplicatePart,
    updatePartAttrs,
    // connections
    addConnection,
    removeConnection,
    clearConnections,
    setConnectionWaypoints,
    updateConnectionWaypoints,
    // misc
    loadDiagram,
    removeOrphans,
  };
}
