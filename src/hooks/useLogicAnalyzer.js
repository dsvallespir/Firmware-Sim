/**
 * useLogicAnalyzer.js
 * -------------------
 * Hook que gestiona la captura de flancos de pines digitales para el
 * Analizador Lógico. Usa un buffer circular por canal para limitar RAM.
 *
 * Flujo:
 *  1. WorkbenchPage registra `la.onPinChange` como pin listener en useAVRSimulator.
 *  2. Al clickear en un pin en modo Sonda (DiagramEditor), se llama a `subscribePin`.
 *  3. Los cambios de pin llegan a `onPinChange(arduinoPin, value, cycles)`.
 *  4. LogicAnalyzerPanel lee `channels` y dibuja las formas de onda.
 */

import { useState, useRef, useCallback, useMemo } from 'react';

const MAX_EDGES = 50_000; // Máximo de flancos por canal
const CPU_HZ   = 16_000_000;

// ---------------------------------------------------------------------------
// Buffer circular de tamaño fijo
// ---------------------------------------------------------------------------
class RingBuffer {
  constructor(capacity) {
    this._cap  = capacity;
    this._data = new Array(capacity);
    this._head = 0; // índice del elemento más antiguo
    this._tail = 0; // próxima posición de escritura
    this._size = 0;
  }

  push(item) {
    this._data[this._tail] = item;
    this._tail = (this._tail + 1) % this._cap;
    if (this._size < this._cap) {
      this._size++;
    } else {
      // Buffer lleno: avanzar head (descarta más antiguo)
      this._head = (this._head + 1) % this._cap;
    }
  }

  /** Devuelve los elementos en orden cronológico. */
  toArray() {
    const out = new Array(this._size);
    for (let i = 0; i < this._size; i++) {
      out[i] = this._data[(this._head + i) % this._cap];
    }
    return out;
  }

  get size()  { return this._size; }
  get latest() {
    if (this._size === 0) return null;
    return this._data[(this._tail - 1 + this._cap) % this._cap];
  }

  clear() { this._head = 0; this._tail = 0; this._size = 0; }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useLogicAnalyzer() {
  // Map<arduinoPin, { buf: RingBuffer, color: string, label: string, lastValue: number }>
  const channelsRef   = useRef(new Map());
  // Versión incremental para forzar re-renders throttleados
  const [version, setVersion] = useState(0);
  const rafRef        = useRef(null);

  const scheduleRender = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      setVersion(v => v + 1);
    });
  }, []);

  // ── Callback para useAVRSimulator.registerPinListener ──────────────────────
  /**
   * @param {number} arduinoPin - Pin Arduino (0-19)
   * @param {boolean|number} value - Nuevo estado
   * @param {number} cycles - cpu.cycles en el momento del cambio
   */
  const onPinChange = useCallback((arduinoPin, value, cycles) => {
    const ch = channelsRef.current.get(arduinoPin);
    if (!ch) return;

    const v = value ? 1 : 0;
    if (ch.lastValue === v) return; // ignorar si no hay flanco real
    ch.lastValue = v;

    const t_us = (cycles ?? 0) / (CPU_HZ / 1_000_000); // cycles → µs
    ch.buf.push({ t: t_us, v });
    scheduleRender();
  }, [scheduleRender]);

  // ── Suscribir / desuscribir canales ───────────────────────────────────────
  const subscribePin = useCallback((pin, color = '#22c55e', label = null) => {
    if (channelsRef.current.has(pin)) return; // ya suscrito
    const autoLabel = pin >= 14 ? `A${pin - 14}` : `D${pin}`;
    channelsRef.current.set(pin, {
      buf:       new RingBuffer(MAX_EDGES),
      color,
      label:     label ?? autoLabel,
      lastValue: -1, // fuerza que el primer cambio se almacene siempre
    });
    setVersion(v => v + 1);
  }, []);

  const unsubscribePin = useCallback((pin) => {
    channelsRef.current.delete(pin);
    setVersion(v => v + 1);
  }, []);

  const clearChannel = useCallback((pin) => {
    const ch = channelsRef.current.get(pin);
    if (ch) { ch.buf.clear(); ch.lastValue = -1; }
    setVersion(v => v + 1);
  }, []);

  const clearAll = useCallback(() => {
    channelsRef.current.forEach(ch => { ch.buf.clear(); ch.lastValue = -1; });
    setVersion(v => v + 1);
  }, []);

  const updateLabel = useCallback((pin, label) => {
    const ch = channelsRef.current.get(pin);
    if (ch) { ch.label = label; setVersion(v => v + 1); }
  }, []);

  // ── Snapshot para rendering ───────────────────────────────────────────────
  // Se recalcula solo cuando cambia `version` (máximo 1 vez por rAF ≈ 60 fps)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const channels = useMemo(() => {
    const snap = new Map();
    channelsRef.current.forEach((ch, pin) => {
      snap.set(pin, {
        edges: ch.buf.toArray(),
        color: ch.color,
        label: ch.label,
      });
    });
    return snap;
  }, [version]); // version es la única dependencia intencional

  // Timestamp del flanco más reciente entre todos los canales (para auto-scroll)
  const latestTime = useMemo(() => {
    let max = 0;
    channels.forEach(ch => {
      const last = ch.edges.at?.(-1) ?? ch.edges[ch.edges.length - 1];
      if (last && last.t > max) max = last.t;
    });
    return max;
  }, [channels]);

  return {
    channels,      // Map<pin, {edges:[{t,v}], color, label}> — snapshot inmutable
    channelsRef,   // acceso directo sin re-render
    onPinChange,   // conectar a sim.registerPinListener(la.onPinChange)
    subscribePin,
    unsubscribePin,
    clearChannel,
    clearAll,
    updateLabel,
    latestTime,    // µs del último flanco capturado
    channelCount: channelsRef.current.size,
  };
}
