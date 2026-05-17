/**
 * DebuggerPanel.jsx
 * -----------------
 * Pseudo-debugger: Step-over a nivel de instrucción AVR, tabla de registros
 * del CPU (R0–R31, PC, SP, SREG/flags) y historial de pasos.
 *
 * No requiere GDB ni protocolo externo — trabaja directamente con el objeto
 * `cpu` de avr8js ejecutando una instrucción a la vez via `step()`.
 *
 * Columnas:
 *  ┌─────────────────────────┬────────────────────────┐
 *  │  R0–R31  ·  SP  ·  SREG │  Historial de pasos    │
 *  └─────────────────────────┴────────────────────────┘
 */

import { useRef, useState, useCallback, useEffect, memo } from 'react';
import { Play, Square, SkipForward, RotateCcw, Trash2, ChevronRight } from 'lucide-react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const SREG_FLAGS = ['C', 'Z', 'N', 'V', 'S', 'H', 'T', 'I']; // LSB → MSB
const MAX_HISTORY = 500;

// ---------------------------------------------------------------------------
// Hex helpers
// ---------------------------------------------------------------------------
const h8  = (v) => (v & 0xff).toString(16).padStart(2, '0').toUpperCase();
const h16 = (v) => (v & 0xffff).toString(16).padStart(4, '0').toUpperCase();
const h32 = (v) => (v >>> 0).toString(16).padStart(6, '0').toUpperCase();

// ---------------------------------------------------------------------------
// Snapshot reader — reads current CPU state into a plain object
// ---------------------------------------------------------------------------
function readSnapshot(cpu) {
  if (!cpu) return null;
  const regs = new Array(32);
  for (let i = 0; i < 32; i++) regs[i] = cpu.data[i];
  // Pair registers (word registers)
  const X = (cpu.data[27] << 8) | cpu.data[26];
  const Y = (cpu.data[29] << 8) | cpu.data[28];
  const Z = (cpu.data[31] << 8) | cpu.data[30];
  return {
    regs,
    pc:     cpu.pc,
    pcByte: cpu.pc * 2,
    sp:     cpu.SP,
    sreg:   cpu.SREG,
    cycles: cpu.cycles,
    X, Y, Z,
  };
}

// ---------------------------------------------------------------------------
// SREG flag row
// ---------------------------------------------------------------------------
const FlagBit = memo(({ label, value }) => (
  <span
    className={`inline-flex flex-col items-center justify-center w-7 h-8 rounded text-[9px] font-mono font-bold transition-colors ${
      value
        ? 'bg-amber-500/20 border border-amber-500/50 text-amber-300'
        : 'bg-slate-800 border border-slate-700 text-slate-500'
    }`}
  >
    <span className="text-[8px] text-slate-500 leading-none">{label}</span>
    <span className="leading-none mt-0.5">{value ? '1' : '0'}</span>
  </span>
));

// ---------------------------------------------------------------------------
// Register row (shows changed values in amber)
// ---------------------------------------------------------------------------
const RegCell = memo(({ name, value, prev }) => {
  const changed = prev !== undefined && prev !== value;
  return (
    <div
      className={`flex items-center justify-between px-1.5 py-0.5 rounded text-[10px] font-mono ${
        changed ? 'bg-amber-900/30 border border-amber-700/40' : ''
      }`}
    >
      <span className="text-slate-500 w-5">{name}</span>
      <span className={changed ? 'text-amber-300' : 'text-slate-300'}>
        0x{h8(value)}
      </span>
      <span className="text-slate-600 w-4 text-right">{value}</span>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Step history entry
// ---------------------------------------------------------------------------
const HistoryEntry = memo(({ entry, index, isLatest }) => (
  <div
    className={`flex items-start gap-1.5 px-2 py-1 border-b border-slate-800/60 text-[9px] font-mono ${
      isLatest ? 'bg-slate-800/40' : ''
    }`}
  >
    <span className="text-slate-600 w-6 text-right flex-shrink-0">#{index + 1}</span>
    <ChevronRight className="w-2.5 h-2.5 text-slate-600 mt-0.5 flex-shrink-0" />
    <div className="flex-1 min-w-0">
      <span className="text-cyan-400">PC:0x{h32(entry.pcByte)}</span>
      <span className="text-slate-500 mx-1">SP:0x{h16(entry.sp)}</span>
      <span className="text-slate-400">cyc:{entry.cycles}</span>
      {entry.changed.length > 0 && (
        <div className="mt-0.5 text-amber-400">
          Δ {entry.changed.map(c => `${c.name}=0x${h8(c.value)}`).join(' ')}
        </div>
      )}
    </div>
  </div>
));

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function DebuggerPanel({
  isLoaded   = false,
  isRunning  = false,
  onStep,        // () => cpuSnapshot | null
  onPause,       // () => void
  onResume,      // () => void
  onReset,       // () => void
}) {
  const [snapshot,    setSnapshot]    = useState(null);
  const [prevSnapshot, setPrevSnap]   = useState(null);
  const [history,     setHistory]     = useState([]);  // [{pcByte, sp, cycles, changed:[]}]
  const historyEndRef = useRef(null);

  // ── Keyboard shortcut: F10 = step ────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'F10' && !isRunning && isLoaded) {
        e.preventDefault();
        handleStep();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, isLoaded]);

  // ── Auto-scroll history ───────────────────────────────────────────────────
  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history.length]);

  // ── Step handler ──────────────────────────────────────────────────────────
  const handleStep = useCallback(() => {
    if (!onStep) return;
    const snap = onStep(); // executes 1 instruction + returns snapshot
    if (!snap) return;

    setSnapshot(prev => {
      setPrevSnap(prev);
      // Compute changed registers
      const changed = [];
      if (prev) {
        for (let i = 0; i < 32; i++) {
          if (prev.regs[i] !== snap.regs[i]) {
            changed.push({ name: `R${i}`, value: snap.regs[i] });
          }
        }
        if (prev.sp   !== snap.sp)   changed.push({ name: 'SP',   value: snap.sp & 0xff });
        if (prev.sreg !== snap.sreg) changed.push({ name: 'SREG', value: snap.sreg });
      }

      setHistory(h => {
        const entry = { pcByte: snap.pcByte, sp: snap.sp, cycles: snap.cycles, changed };
        const next = [...h, entry];
        return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
      });

      return snap;
    });
  }, [onStep]);

  const handleClearHistory = () => setHistory([]);
  const handlePause  = () => { onPause?.();  setSnapshot(readSnapshot(null)); };

  if (!isLoaded) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#070d1a] text-slate-500 text-sm">
        Compila y carga un sketch para usar el depurador.
      </div>
    );
  }

  const sreg = snapshot?.sreg ?? 0;

  return (
    <div className="flex flex-col h-full bg-[#070d1a] text-slate-300 overflow-hidden select-none">

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 px-3 py-1 bg-slate-900 border-b border-slate-700 flex-shrink-0 text-[11px]">
        <span className="font-semibold text-slate-200 flex items-center gap-1.5">
          <span className="text-red-400">🐛</span> Depurador
        </span>

        <div className="w-px h-4 bg-slate-700 mx-1" />

        {/* Step */}
        <button
          onClick={handleStep}
          disabled={isRunning || !isLoaded}
          title="Step (F10)"
          className="flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-medium
                     bg-cyan-700/30 text-cyan-300 border border-cyan-600/40
                     hover:bg-cyan-700/50 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <SkipForward className="w-3 h-3" /> Step <span className="text-cyan-600 text-[9px]">F10</span>
        </button>

        {/* Pause / Resume */}
        {isRunning ? (
          <button
            onClick={onPause}
            title="Pausar simulación"
            className="flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-medium
                       bg-amber-700/30 text-amber-300 border border-amber-600/40
                       hover:bg-amber-700/50"
          >
            <Square className="w-3 h-3" /> Pausar
          </button>
        ) : (
          <button
            onClick={onResume}
            disabled={!isLoaded}
            title="Reanudar simulación"
            className="flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-medium
                       bg-emerald-700/30 text-emerald-300 border border-emerald-600/40
                       hover:bg-emerald-700/50 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Play className="w-3 h-3" /> Reanudar
          </button>
        )}

        <button
          onClick={onReset}
          disabled={!isLoaded}
          title="Reset CPU"
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px]
                     bg-slate-800 text-slate-400 border border-slate-700
                     hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <RotateCcw className="w-3 h-3" /> Reset
        </button>

        <div className="flex-1" />

        {snapshot && (
          <span className="font-mono text-[10px] text-slate-400">
            PC: <span className="text-cyan-400">0x{h32(snapshot.pcByte)}</span>
            <span className="mx-2 text-slate-600">|</span>
            Ciclos: <span className="text-slate-300">{snapshot.cycles.toLocaleString()}</span>
          </span>
        )}

        <button
          onClick={handleClearHistory}
          title="Limpiar historial"
          className="p-0.5 text-slate-600 hover:text-red-400"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Body: registers + history ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── LEFT: Registers ── */}
        <div className="w-64 flex-shrink-0 border-r border-slate-800 flex flex-col overflow-hidden">

          {/* SREG flags */}
          <div className="px-2 py-2 border-b border-slate-800 bg-slate-900/40">
            <div className="text-[9px] text-slate-500 uppercase tracking-wide mb-1.5">SREG</div>
            <div className="flex gap-1 flex-wrap">
              {SREG_FLAGS.map((flag, i) => (
                <FlagBit key={flag} label={flag} value={!!(sreg & (1 << i))} />
              ))}
            </div>
            <div className="mt-1 text-[9px] font-mono text-slate-500">
              0x{h8(sreg)} = 0b{sreg.toString(2).padStart(8, '0')}
            </div>
          </div>

          {/* SP */}
          <div className="px-2 py-1.5 border-b border-slate-800 flex items-center justify-between text-[10px] font-mono">
            <span className="text-slate-500">SP</span>
            <span className={snapshot && prevSnapshot && snapshot.sp !== prevSnapshot.sp
              ? 'text-amber-300' : 'text-slate-300'}>
              0x{h16(snapshot?.sp ?? 0)}
            </span>
            <span className="text-slate-600">{snapshot?.sp ?? 0}</span>
          </div>

          {/* Word registers X Y Z */}
          <div className="px-2 py-1.5 border-b border-slate-800 grid grid-cols-3 gap-1 text-[9px] font-mono text-center">
            {[['X', snapshot?.X], ['Y', snapshot?.Y], ['Z', snapshot?.Z]].map(([n, v]) => (
              <div key={n} className="bg-slate-800/60 rounded px-1 py-0.5">
                <div className="text-slate-500">{n}</div>
                <div className="text-slate-300">0x{h16(v ?? 0)}</div>
              </div>
            ))}
          </div>

          {/* R0–R31 */}
          <div className="flex-1 overflow-y-auto p-1.5 grid grid-cols-2 gap-0.5 content-start">
            {Array.from({ length: 32 }, (_, i) => (
              <RegCell
                key={i}
                name={`R${i}`}
                value={snapshot?.regs[i] ?? 0}
                prev={prevSnapshot?.regs[i]}
              />
            ))}
          </div>
        </div>

        {/* ── RIGHT: Step history ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="sticky top-0 px-3 py-1 bg-slate-900 border-b border-slate-800
                          text-[9px] uppercase tracking-wide text-slate-500 flex items-center gap-2">
            Historial de pasos
            <span className="text-slate-600">({history.length} / {MAX_HISTORY})</span>
            {history.length >= MAX_HISTORY && (
              <span className="text-amber-600 text-[8px]">LIFO — se descartaron pasos antiguos</span>
            )}
          </div>
          {history.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-slate-600 text-xs">
              Presiona <kbd className="mx-1 px-1.5 py-0.5 bg-slate-700 rounded text-[9px] border border-slate-600">F10</kbd>
              o el botón <strong className="mx-1 text-cyan-500">Step</strong> para comenzar.
            </div>
          ) : (
            history.map((entry, i) => (
              <HistoryEntry
                key={i}
                entry={entry}
                index={i}
                isLatest={i === history.length - 1}
              />
            ))
          )}
          <div ref={historyEndRef} />
        </div>
      </div>

      {/* ── Status bar ── */}
      <div className="flex items-center gap-4 px-3 py-0.5 bg-slate-900 border-t border-slate-700
                      text-[9px] text-slate-500 flex-shrink-0">
        <span>ATmega328P · 16 MHz · 62.5 ns/ciclo</span>
        {!isRunning && isLoaded && (
          <span className="text-cyan-500">● Detenido — listo para step</span>
        )}
        {isRunning && (
          <span className="text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Simulación en curso — pausa para usar el depurador
          </span>
        )}
      </div>
    </div>
  );
}
