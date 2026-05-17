/*
 * ============================================================
 * CompileTerminal.jsx - Terminal de salida del compilador
 * ============================================================
 *
 * Muestra el output de arduino-cli con:
 * - stdout/stderr formateado
 * - Barras de uso de Flash y RAM
 * - Errores de compilación resaltados
 * - Estado: idle, compiling, success, error
 */

import { useRef, useEffect } from 'react';
import { Loader2, CheckCircle2, XCircle, Terminal } from 'lucide-react';

/**
 * Barra de uso de memoria (Flash o RAM)
 */
function MemoryBar({ label, used, total }) {
  if (used == null || total == null || total === 0) return null;

  const pct = Math.round((used / total) * 100);
  const barColor =
    pct > 90 ? 'bg-red-500' :
    pct > 70 ? 'bg-amber-500' :
    'bg-emerald-500';

  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="text-slate-400 w-12 text-right font-medium">{label}</span>
      <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full transition-all duration-500`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className="text-slate-400 font-mono w-40 text-right">
        {used.toLocaleString()} / {total.toLocaleString()} bytes ({pct}%)
      </span>
    </div>
  );
}

export default function CompileTerminal({
  status = 'idle', // 'idle' | 'compiling' | 'success' | 'error'
  stdout = '',
  stderr = '',
  error = null,
  flashUsed = null,
  flashTotal = null,
  ramUsed = null,
  ramTotal = null,
}) {
  const outputRef = useRef(null);

  // Auto-scroll al final cuando hay nuevo output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [stdout, stderr, status]);

  // Combinar y formatear output
  const formatOutput = () => {
    if (status === 'idle') {
      return null;
    }

    if (status === 'compiling') {
      return (
        <div className="flex items-center gap-2 text-amber-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Compilando...</span>
        </div>
      );
    }

    // Parsear stderr para resaltar errores
    const lines = [];
    if (stderr) {
      stderr.split('\n').forEach((line, i) => {
        if (line.match(/error:/i)) {
          lines.push(
            <div key={`e${i}`} className="text-red-400">
              {line}
            </div>
          );
        } else if (line.match(/warning:/i)) {
          lines.push(
            <div key={`e${i}`} className="text-amber-400">
              {line}
            </div>
          );
        } else if (line.trim()) {
          lines.push(
            <div key={`e${i}`} className="text-slate-400">
              {line}
            </div>
          );
        }
      });
    }
    if (stdout) {
      stdout.split('\n').forEach((line, i) => {
        if (line.trim()) {
          lines.push(
            <div key={`o${i}`} className="text-slate-300">
              {line}
            </div>
          );
        }
      });
    }

    return lines;
  };

  const statusIcon = {
    idle: <Terminal className="w-3.5 h-3.5 text-slate-500" />,
    compiling: <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />,
    success: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
    error: <XCircle className="w-3.5 h-3.5 text-red-400" />,
  };

  const statusLabel = {
    idle: 'Listo para compilar',
    compiling: 'Compilando...',
    success: 'Compilación exitosa',
    error: 'Error de compilación',
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 rounded-lg overflow-hidden">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2">
          {statusIcon[status]}
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            {statusLabel[status]}
          </span>
        </div>
      </div>

      {/* ── Memory bars (solo si hay datos) ──────────────────── */}
      {(flashUsed != null || ramUsed != null) && (
        <div className="px-3 py-2 space-y-1.5 bg-slate-900/50 border-b border-slate-800">
          <MemoryBar label="Flash" used={flashUsed} total={flashTotal} />
          <MemoryBar label="RAM" used={ramUsed} total={ramTotal} />
        </div>
      )}

      {/* ── Output area ─────────────────────────────────────── */}
      <div
        ref={outputRef}
        className="flex-1 overflow-y-auto p-3 font-mono text-[12px] leading-relaxed
                   whitespace-pre-wrap break-all min-h-[80px]"
      >
        {formatOutput() || (
          <span className="text-slate-600 italic">
            Presioná "Compilar" para compilar el sketch
          </span>
        )}
        {error && status === 'error' && (
          <div className="mt-2 text-red-400 font-medium">
            ✗ {typeof error === 'object' ? (error.message || JSON.stringify(error)) : error}
          </div>
        )}
      </div>
    </div>
  );
}
