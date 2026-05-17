/*
 * ============================================================
 * SimulatorPanelEmbedded.jsx - Simulador Arduino embebido en lecciones
 * ============================================================
 *
 * Versión inline del simulador para embeber directamente en el
 * contenido markdown de una lección usando la etiqueta:
 *
 *     <simulator></simulator>          (auto-detecta lección)
 *     <simulator lesson="03"></simulator>   (lección explícita)
 *
 * Carga automáticamente los archivos .ino cuyo prefijo numérico
 * coincide con el número de la lección actual. Ejemplo:
 *   - Lección "05_Voltaje_y_Corriente.md"  →  carga 05_*.ino
 *
 * También acepta un archivo específico vía el atributo `file`:
 *   <simulator file="02_ejercicio_03.ino"></simulator>
 *
 * Para mostrar el código en modo solo lectura (sin edición):
 *   <simulator read-only="true"></simulator>
 *
 * Prioridad de selección de archivos:
 *   1. Prop `file` (nombre exacto del .ino)
 *   2. Prop `lessonNumber` (prefijo numérico explícito)
 *   3. Auto-detect desde `lessonFilename`
 *
 * Diferencias con SimulatorPanel (el panel completo):
 *   - Sin botones cerrar/expandir (vive inline en el contenido)
 *   - Sin árbol de archivos lateral
 *   - Carga automática basada en número de lección
 *   - Layout compacto para fluir con el markdown
 *   - No modifica ni reemplaza SimulatorPanel
 *
 * Reutiliza los mismos sub-componentes:
 *   SimulatorEditor, CompileTerminal, SerialMonitor,
 *   CircuitView (lazy), useAVRSimulator
 */

import { useState, useCallback, useEffect, useMemo, lazy, Suspense, useRef } from 'react';
import {
  Play, Square, RotateCcw, Loader2, ChevronDown,
  Cpu, Terminal, Radio, CircuitBoard, Lock,
} from 'lucide-react';
import api from '../lib/api';
import useAVRSimulator from '../hooks/useAVRSimulator';
import { resolveCodeLanguage } from '../lib/fileTreeUtils';
import SimulatorEditor from './SimulatorEditor';
import CompileTerminal from './CompileTerminal';
import SerialMonitor from './SerialMonitor';

const CircuitView = lazy(() => import('./circuit/CircuitView'));

const DEFAULT_BOARDS = [
  { fqbn: 'arduino:avr:uno',  name: 'Arduino Uno' },
  { fqbn: 'arduino:avr:nano', name: 'Arduino Nano' },
  { fqbn: 'arduino:avr:mega', name: 'Arduino Mega 2560' },
];

/**
 * Extrae el prefijo numérico de un nombre de archivo.
 *   "03_primer.ino" → "03"
 *   "12_sensor_temp.ino" → "12"
 */
function extractLessonNumber(filename) {
  const match = filename?.match(/^(\d+)/);
  return match ? match[1] : null;
}

export default function SimulatorPanelEmbedded({
  courseSlug,
  moduleSlug,
  codeFiles = [],
  lessonFilename = '',
  lessonNumber: lessonNumberProp = null,
  file: fileProp = null,
  circuitJson = null,
  readOnly = false,
}) {
  // ── Determinar número de lección objetivo ─────────────────
  const targetNumber = useMemo(() => {
    if (lessonNumberProp) return String(lessonNumberProp).padStart(2, '0');
    return extractLessonNumber(lessonFilename);
  }, [lessonNumberProp, lessonFilename]);

  // ── Filtrar archivos .ino que coinciden ────────────────────
  // Prioridad: prop `file` (nombre exacto) > `lessonNumber` > auto-detect
  const matchingFiles = useMemo(() => {
    // Si se especificó un archivo concreto, buscar por filename exacto
    if (fileProp) {
      const match = codeFiles.filter(
        (f) => f.filename === fileProp
      );
      if (match.length > 0) return match;
      // Fallback: buscar por slug derivado del nombre de archivo
      const slugFromFile = fileProp.replace(/\.[^.]+$/, '').replace(/_/g, '-');
      const matchBySlug = codeFiles.filter(
        (f) => f.slug === slugFromFile || f.slug?.endsWith(slugFromFile)
      );
      if (matchBySlug.length > 0) return matchBySlug;
    }
    // Filtrar por prefijo numérico de la lección
    if (!targetNumber) return [];
    return codeFiles.filter((f) => {
      const prefix = extractLessonNumber(f.filename);
      return prefix === targetNumber && f.filename?.endsWith('.ino');
    });
  }, [codeFiles, targetNumber, fileProp]);

  // ── Estado del editor ────────────────────────────────────
  const [code, setCode] = useState('');
  const [selectedBoard, setSelectedBoard] = useState('arduino:avr:uno');
  const [boards, setBoards] = useState(DEFAULT_BOARDS);
  const [boardMenuOpen, setBoardMenuOpen] = useState(false);

  // ── Estado de compilación ────────────────────────────────
  const [compileStatus, setCompileStatus] = useState('idle');
  const [compileResult, setCompileResult] = useState(null);  // Mensaje de rate-limit con cuenta regresiva (null = sin restricción activa)
  const [rateLimitMsg, setRateLimitMsg] = useState(null);     // { text, seconds }
  const rateLimitTimer = useRef(null);
  // ── Estado del panel ─────────────────────────────────────
  const [activeTab, setActiveTab] = useState(circuitJson ? 'circuit' : 'terminal');
  const [initialLoading, setInitialLoading] = useState(true);

  // ── Simulador AVR ────────────────────────────────────────
  const sim = useAVRSimulator();

  // ── Archivos abiertos (tabs del editor) ──────────────────
  const [openFiles, setOpenFiles] = useState([]);
  const [activeFileId, setActiveFileId] = useState(null);
  const [fileContents, setFileContents] = useState({});

  // ── Cargar archivos .ino coincidentes al montar ──────────
  useEffect(() => {
    if (matchingFiles.length === 0) {
      setInitialLoading(false);
      return;
    }

    let cancelled = false;

    const loadFiles = async () => {
      const firstFile = matchingFiles[0];

      // Crear tabs para todos los archivos coincidentes
      const tabs = matchingFiles.map((f) => ({
        id: f.slug,
        name: f.filename,
        language: resolveCodeLanguage(f),
        modified: false,
      }));
      setOpenFiles(tabs);
      setActiveFileId(firstFile.slug);

      // Cargar contenido del primer archivo
      try {
        const { data } = await api.get(
          `/content/${courseSlug}/${moduleSlug}/${firstFile.slug}`
        );
        if (cancelled) return;
        const content = data.content_raw || '';
        setCode(content);
        setFileContents({ [firstFile.slug]: content });
      } catch (err) {
        if (cancelled) return;
        const errorMsg = `// Error al cargar: ${err.message}`;
        setCode(errorMsg);
        setFileContents({ [firstFile.slug]: errorMsg });
      }
      setInitialLoading(false);
    };

    loadFiles();
    return () => { cancelled = true; };
  }, [matchingFiles, courseSlug, moduleSlug]);

  // ── Cargar boards del backend ────────────────────────────
  useEffect(() => {
    api.get('/compile/boards')
      .then(({ data }) => {
        if (data.boards?.length > 0) setBoards(data.boards);
      })
      .catch(() => {});
  }, []);

  // ── Manejo de tabs ───────────────────────────────────────
  const handleTabSelect = useCallback(async (id) => {
    setActiveFileId(id);

    if (fileContents[id]) {
      setCode(fileContents[id]);
      return;
    }

    // Cargar contenido bajo demanda
    try {
      const { data } = await api.get(
        `/content/${courseSlug}/${moduleSlug}/${id}`
      );
      const content = data.content_raw || '';
      setFileContents((prev) => ({ ...prev, [id]: content }));
      setCode(content);
    } catch (err) {
      const errorMsg = `// Error al cargar: ${err.message}`;
      setFileContents((prev) => ({ ...prev, [id]: errorMsg }));
      setCode(errorMsg);
    }
  }, [courseSlug, moduleSlug, fileContents]);

  const handleTabClose = useCallback((id) => {
    setOpenFiles((prev) => {
      const next = prev.filter((f) => f.id !== id);
      if (id === activeFileId && next.length > 0) {
        const newActive = next[next.length - 1];
        setActiveFileId(newActive.id);
        setCode(fileContents[newActive.id] || '');
      }
      return next;
    });
  }, [activeFileId, fileContents]);

  // ── Valores derivados del archivo activo ─────────────────
  const activeFile = openFiles.find((f) => f.id === activeFileId);
  const activeContent = activeFileId ? (fileContents[activeFileId] ?? code) : code;
  const activeLanguage = activeFile?.language || 'cpp';

  const handleCodeChange = useCallback((value) => {
    setCode(value);
    if (activeFileId) {
      setFileContents((prev) => ({ ...prev, [activeFileId]: value }));
      setOpenFiles((prev) =>
        prev.map((f) => (f.id === activeFileId ? { ...f, modified: true } : f))
      );
    }
  }, [activeFileId]);

  // ── Compilar y simular ───────────────────────────────────
  const startRateLimitCountdown = useCallback((message, seconds) => {
    if (rateLimitTimer.current) clearInterval(rateLimitTimer.current);
    setRateLimitMsg({ text: message, seconds });
    let remaining = seconds;
    rateLimitTimer.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(rateLimitTimer.current);
        rateLimitTimer.current = null;
        setRateLimitMsg(null);
      } else {
        setRateLimitMsg((prev) => prev ? { ...prev, seconds: remaining } : null);
      }
    }, 1000);
  }, []);

  // Limpiar timer al desmontar
  useEffect(() => () => {
    if (rateLimitTimer.current) clearInterval(rateLimitTimer.current);
  }, []);

  const handleCompile = useCallback(async () => {
    if (compileStatus === 'compiling' || rateLimitMsg) return;

    setCompileStatus('compiling');
    setCompileResult(null);
    setActiveTab('terminal');

    if (sim.isRunning) sim.stop();

    try {
      const { data } = await api.post('/compile/', {
        files: [{ name: 'sketch.ino', content: code }],
        board_fqbn: selectedBoard,
      });

      setCompileResult(data);

      if (data.success && data.hex_content) {
        setCompileStatus('success');
        const loaded = sim.loadHex(data.hex_content);
        if (loaded) {
          sim.start();
          setTimeout(() => {
            setActiveTab(circuitJson ? 'circuit' : 'serial');
          }, 1500);
        }
      } else {
        setCompileStatus('error');
      }
    } catch (err) {
      if (err.response?.status === 429) {
        const detail = err.response?.data?.detail || {};
        const msg  = typeof detail === 'object' ? detail.message : String(detail);
        const wait = typeof detail === 'object' ? (detail.wait_seconds || 60) : 60;
        setCompileStatus('idle');
        startRateLimitCountdown(msg || 'Demasiadas compilaciones. Intentá en un momento.', wait);
        return;
      }
      const rawDetail = err.response?.data?.detail || err.message || 'Error desconocido';
      const errorMsg  = typeof rawDetail === 'object'
        ? (rawDetail.message || JSON.stringify(rawDetail))
        : String(rawDetail);
      setCompileStatus('error');
      setCompileResult({ success: false, stdout: '', stderr: '', error: errorMsg });
    }
  }, [code, selectedBoard, compileStatus, rateLimitMsg, sim, circuitJson, startRateLimitCountdown]);

  const handleStop = useCallback(() => sim.stop(), [sim]);
  const handleReset = useCallback(() => { sim.reset(); sim.start(); }, [sim]);

  // ── Tabs del panel derecho ───────────────────────────────
  const tabs = [
    { id: 'terminal', label: 'Terminal', icon: Terminal },
    { id: 'serial', label: 'Serial', icon: Radio },
    ...(circuitJson
      ? [{ id: 'circuit', label: 'Circuito', icon: CircuitBoard }]
      : []),
  ];

  // ── No renderizar si no hay archivos coincidentes ────────
  if (!initialLoading && matchingFiles.length === 0) return null;

  // ── Loading ──────────────────────────────────────────────
  if (initialLoading) {
    return (
      <div className="my-6 flex items-center justify-center py-12 bg-slate-900 rounded-xl
                       border border-slate-700">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
        <span className="ml-2 text-sm text-slate-400">Cargando simulador...</span>
      </div>
    );
  }

  return (
    <div className="my-6 simulator-panel-embedded bg-slate-900 rounded-xl border border-slate-700
                    shadow-lg overflow-hidden">
      {/* ════════════════════════════════════════════════════════
       * TOOLBAR
       * ════════════════════════════════════════════════════════ */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-2">
          {/* Ícono + título */}
          <Cpu className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-semibold text-slate-200">
            Ejercicio
          </span>

          {/* Badge solo lectura */}
          {readOnly && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium
                             bg-slate-700 text-slate-400 border border-slate-600">
              <Lock className="w-2.5 h-2.5" />
              Solo lectura
            </span>
          )}

          <div className="w-px h-5 bg-slate-700 mx-1" />

          {/* Mensaje de rate limit con cuenta regresiva */}
          {rateLimitMsg ? (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                             bg-amber-900/40 text-amber-300 border border-amber-700/50">
              <Loader2 className="w-3.5 h-3.5" />
              {rateLimitMsg.text.split('.')[0]}. ({rateLimitMsg.seconds}s)
            </span>
          ) : (
            /* Botón Compilar y Simular */
            <button
              onClick={handleCompile}
              disabled={compileStatus === 'compiling' || !code.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                         bg-emerald-600 text-white hover:bg-emerald-500
                         disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {compileStatus === 'compiling' ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span className="hidden sm:inline">Compilando...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Compilar y Simular</span>
                  <span className="sm:hidden">Compilar</span>
                </>
              )}
            </button>
          )}

          {/* Pausar */}
          {sim.isRunning && (
            <button
              onClick={handleStop}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium
                         bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
            >
              <Square className="w-3 h-3" />
              <span className="hidden sm:inline">Pausar</span>
            </button>
          )}

          {/* Reset */}
          {sim.isLoaded && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium
                         bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Selector de board */}
          <div className="relative">
            <button
              onClick={() => !readOnly && setBoardMenuOpen(!boardMenuOpen)}
              disabled={readOnly}
              title={readOnly ? 'Selección de placa bloqueada' : undefined}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
                         border transition-colors ${
                           readOnly
                             ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed opacity-60'
                             : 'bg-slate-700 text-slate-300 hover:bg-slate-600 border-slate-600'
                         }`}
            >
              <span className="hidden sm:inline">
                {boards.find((b) => b.fqbn === selectedBoard)?.name || selectedBoard}
              </span>
              <span className="sm:hidden text-[10px]">Board</span>
              {readOnly ? <Lock className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {boardMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setBoardMenuOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1 z-50 bg-slate-800 border border-slate-600
                               rounded-lg shadow-xl py-1 min-w-[200px]">
                  {boards.map((board) => (
                    <button
                      key={board.fqbn}
                      onClick={() => {
                        setSelectedBoard(board.fqbn);
                        setBoardMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                        selectedBoard === board.fqbn
                          ? 'bg-emerald-600/20 text-emerald-400'
                          : 'text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {board.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Indicador de estado */}
          {sim.isRunning && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="hidden sm:inline">Simulando</span>
            </span>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
       * CONTENIDO: Editor + Panel derecho
       * ════════════════════════════════════════════════════════ */}
      <div className="flex flex-col lg:flex-row h-[420px]">
        {/* ── Editor ───────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 lg:w-1/2 border-b lg:border-b-0 lg:border-r border-slate-700
                        h-1/2 lg:h-full">
          <SimulatorEditor
            openFiles={openFiles}
            activeFileId={activeFileId}
            onSelectFile={handleTabSelect}
            onCloseFile={handleTabClose}
            code={activeContent}
            onChange={handleCodeChange}
            language={activeLanguage}
            readOnly={readOnly}
          />
        </div>

        {/* ── Panel derecho (tabs) ─────────────────────────────── */}
        <div className="flex-1 min-w-0 lg:w-1/2 flex flex-col h-1/2 lg:h-full">
          {/* Tab headers */}
          <div className="flex items-center bg-slate-800 border-b border-slate-700">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium
                           transition-colors border-b-2 ${
                             activeTab === tab.id
                               ? 'border-emerald-400 text-emerald-400 bg-slate-900/50'
                               : 'border-transparent text-slate-500 hover:text-slate-300'
                           }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
                {tab.id === 'serial' && sim.serialOutput && activeTab !== 'serial' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                )}
              </button>
            ))}

            {/* LED pin 13 indicator */}
            {sim.isLoaded && (
              <div className="ml-auto px-3 flex items-center gap-1.5">
                <span className="text-[10px] text-slate-500">LED 13:</span>
                <span
                  className={`w-2.5 h-2.5 rounded-full border transition-colors ${
                    sim.pinStates[13]
                      ? 'bg-amber-400 border-amber-300 shadow-sm shadow-amber-400/50'
                      : 'bg-slate-700 border-slate-600'
                  }`}
                />
              </div>
            )}
          </div>

          {/* Tab content */}
          <div className="flex-1 min-h-0">
            {activeTab === 'terminal' && (
              <CompileTerminal
                status={compileStatus}
                stdout={compileResult?.stdout || ''}
                stderr={compileResult?.stderr || ''}
                error={compileResult?.error}
                flashUsed={compileResult?.flash_used}
                flashTotal={compileResult?.flash_total}
                ramUsed={compileResult?.ram_used}
                ramTotal={compileResult?.ram_total}
              />
            )}
            {activeTab === 'serial' && (
              <SerialMonitor
                output={sim.serialOutput}
                baudRate={sim.baudRate}
                onSend={sim.serialWrite}
                onClear={sim.clearSerial}
                isRunning={sim.isRunning}
              />
            )}
            {activeTab === 'circuit' && circuitJson && (
              <Suspense
                fallback={
                  <div className="flex items-center justify-center h-full bg-slate-900">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                    <span className="ml-2 text-sm text-slate-400">Cargando circuito...</span>
                  </div>
                }
              >
                <CircuitView
                  circuitDefinition={circuitJson}
                  pinStates={sim.pinStates}
                  setPinState={sim.setPinState}
                  setAnalogValue={sim.setAnalogValue}
                  isRunning={sim.isRunning}
                  onPinChange={sim.registerPinListener}
                  onReset={() => { sim.reset(); sim.start(); }}
                />
              </Suspense>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
