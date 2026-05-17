/*
 * ============================================================
 * SerialMonitor.jsx - Monitor serial del simulador AVR
 * ============================================================
 *
 * Muestra la salida de Serial.print() del sketch Arduino y
 * permite enviar datos al Serial del simulador.
 *
 * Características:
 * - Auto-scroll al final
 * - Input para enviar texto al USART
 * - Indicador de baud rate
 * - Botón limpiar
 * - Soporte para enviar con Enter o con botón
 */

import { useState, useRef, useEffect } from 'react';
import { Trash2, Send, ArrowDown } from 'lucide-react';

export default function SerialMonitor({
  output = '',
  baudRate = 0,
  onSend,
  onClear,
  isRunning = false,
}) {
  const [inputText, setInputText] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const outputRef = useRef(null);

  // Auto-scroll cuando llega nuevo output
  useEffect(() => {
    if (autoScroll && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output, autoScroll]);

  // Detectar si el usuario scrolleó manualmente
  const handleScroll = () => {
    if (!outputRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = outputRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 40;
    setAutoScroll(isAtBottom);
  };

  const handleSend = () => {
    if (inputText.trim() && onSend) {
      onSend(inputText + '\n');
      setInputText('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 rounded-lg overflow-hidden">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Serial Monitor
          </span>
          {baudRate > 0 && (
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
              {baudRate} baud
            </span>
          )}
          {isRunning && (
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-emerald-400">RX</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!autoScroll && (
            <button
              onClick={() => {
                setAutoScroll(true);
                if (outputRef.current) {
                  outputRef.current.scrollTop = outputRef.current.scrollHeight;
                }
              }}
              title="Scroll al final"
              className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800"
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onClear}
            title="Limpiar"
            className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Output area ─────────────────────────────────────── */}
      <div
        ref={outputRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-3 font-mono text-[13px] leading-relaxed
                   text-emerald-300 whitespace-pre-wrap break-all
                   selection:bg-emerald-500/30 min-h-[120px]"
      >
        {output || (
          <span className="text-slate-600 italic">
            {isRunning
              ? 'Esperando datos del Serial...'
              : 'Iniciá la simulación para ver la salida serial'}
          </span>
        )}
      </div>

      {/* ── Input area ──────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-900 border-t border-slate-800">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enviar al Serial..."
          disabled={!isRunning}
          className="flex-1 bg-slate-800 text-slate-200 text-sm font-mono rounded px-3 py-1.5
                     border border-slate-700 focus:border-emerald-500 focus:outline-none
                     placeholder:text-slate-600 disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={!isRunning || !inputText.trim()}
          title="Enviar (Enter)"
          className="p-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-500
                     disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
