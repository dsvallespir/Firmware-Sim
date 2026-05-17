/*
 * ============================================================
 * SimulatorPanel.jsx - Panel principal del simulador Arduino
 * ============================================================
 *
 * Integra:
 * - Monaco Editor (código fuente)
 * - CompileTerminal (output del compilador + barras Flash/RAM)
 * - SerialMonitor (salida serial del simulador)
 * - CircuitView (canvas visual del circuito con @wokwi/elements)
 * - avr8js simulation (via useAVRSimulator hook)
 *
 * Flujo:
 * 1. Código precargado desde la lección → Monaco Editor
 * 2. Click "Compilar" → POST /api/compile/ → backend compila con arduino-cli
 * 3. Backend devuelve .hex + stdout/stderr
 * 4. Frontend muestra output en CompileTerminal
 * 5. Si éxito → avr8js carga .hex → simulación arranca
 * 6. Serial Monitor muestra output del USART
 * 7. CircuitView muestra componentes visuales + estado de pines
 *
 * Layout:
 * ┌──────────────────────────────────────────────────────────┐
 * │ ▶ Compilar y Simular  ⏸ Pausar  🔄 Reset  [Board ▾]    │
 * ├────────────────────────┬─────────────────────────────────┤
 * │                        │ [Terminal] [Serial] [Circuito]  │
 * │   Monaco Editor        │─────────────────────────────────│
 * │   (código .ino)        │  Output / serial / canvas visual│
 * │                        │                                 │
 * └────────────────────────┴─────────────────────────────────┘
 */

import { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react';
import {
  Play, Square, RotateCcw, Loader2, ChevronDown,
  Minimize2, Maximize2, X, Cpu, Terminal, Radio, CircuitBoard,
  PanelLeftClose, PanelLeft,
} from 'lucide-react';
import api from '../lib/api';
import useAVRSimulator from '../hooks/useAVRSimulator';
import { resolveCodeLanguage } from '../lib/fileTreeUtils';
import SimulatorEditor from './SimulatorEditor';
import SimulatorFileTree from './SimulatorFileTree';
import CompileTerminal from './CompileTerminal';
import SerialMonitor from './SerialMonitor';

// Lazy-load CircuitView para no cargar @wokwi/elements si no hay circuito
const CircuitView = lazy(() => import('./circuit/CircuitView'));

// Boards soportados (se sincroniza con el backend)
const DEFAULT_BOARDS = [
  { fqbn: 'arduino:avr:uno',  name: 'Arduino Uno' },
  { fqbn: 'arduino:avr:nano', name: 'Arduino Nano' },
  { fqbn: 'arduino:avr:mega', name: 'Arduino Mega 2560' },
];

export default function SimulatorPanel({
  initialCode = '',
  lessonTitle = '',
  circuitDefinition = null,
  codeFiles = [],
  courseSlug = '',
  moduleSlug = '',
  onClose,
  className = '',
}) {
  // ── Estado del editor ────────────────────────────────────
  const [code, setCode] = useState(initialCode);
  const [selectedBoard, setSelectedBoard] = useState('arduino:avr:uno');
  const [boards, setBoards] = useState(DEFAULT_BOARDS);
  const [boardMenuOpen, setBoardMenuOpen] = useState(false);

  // ── Estado de compilación ────────────────────────────────
  const [compileStatus, setCompileStatus] = useState('idle');
  const [compileResult, setCompileResult] = useState(null);  // Mensaje de rate-limit con cuenta regresiva
  const [rateLimitMsg, setRateLimitMsg] = useState(null);  // { text, seconds }
  const rateLimitTimer = useRef(null);
  // ── Estado del panel ─────────────────────────────────────
  const [activeTab, setActiveTab] = useState(circuitDefinition ? 'circuit' : 'terminal');
  const [isExpanded, setIsExpanded] = useState(false);

  // ── Simulador AVR ────────────────────────────────────────
  const sim = useAVRSimulator();

  // ── Estado de archivos (workspace) ───────────────────────
  const hasFiles = codeFiles.length > 0;
  const [openFiles, setOpenFiles] = useState([]);
  const [activeFileId, setActiveFileId] = useState(null);
  const [fileContents, setFileContents] = useState({});
  const [treeVisible, setTreeVisible] = useState(true);
  const [loadingFile, setLoadingFile] = useState(false);

  // Sincronizar código inicial e inicializar archivos abiertos
  useEffect(() => {
    setCode(initialCode);
    if (codeFiles.length > 0) {
      const inoFile = codeFiles.find(f => f.filename?.endsWith('.ino'));
      if (inoFile) {
        const lang = resolveCodeLanguage(inoFile);
        setOpenFiles([{
          id: inoFile.slug, name: inoFile.filename,
          language: lang, modified: false,
        }]);
        setActiveFileId(inoFile.slug);
        setFileContents(prev => ({ ...prev, [inoFile.slug]: initialCode }));
      }
    } else {
      setOpenFiles([]);
      setActiveFileId(null);
      setFileContents({});
    }
  }, [initialCode, codeFiles]);

  // Cargar boards del backend al montar
  useEffect(() => {
    api.get('/compile/boards')
      .then(({ data }) => {
        if (data.boards?.length > 0) setBoards(data.boards);
      })
      .catch(() => {
        // Usar boards por defecto si el backend no responde
      });
  }, []);

  // ── Manejo de archivos ───────────────────────────────────
  const handleSelectFile = useCallback(async (file) => {
    const lang = resolveCodeLanguage(file);
    const fileId = file.slug;

    setOpenFiles(prev => {
      if (prev.find(f => f.id === fileId)) return prev;
      return [...prev, { id: fileId, name: file.filename, language: lang, modified: false }];
    });
    setActiveFileId(fileId);

    if (!fileContents[fileId]) {
      setLoadingFile(true);
      try {
        const { data } = await api.get(`/content/${courseSlug}/${moduleSlug}/${file.slug}`);
        setFileContents(prev => ({ ...prev, [fileId]: data.content_raw }));
      } catch (err) {
        setFileContents(prev => ({
          ...prev,
          [fileId]: `// Error al cargar: ${err.message}`,
        }));
      } finally {
        setLoadingFile(false);
      }
    }
  }, [courseSlug, moduleSlug, fileContents]);

  const handleTabSelect = useCallback((id) => setActiveFileId(id), []);

  const handleTabClose = useCallback((id) => {
    setOpenFiles(prev => {
      const next = prev.filter(f => f.id !== id);
      if (id === activeFileId && next.length > 0) {
        setActiveFileId(next[next.length - 1].id);
      } else if (next.length === 0) {
        setActiveFileId(null);
      }
      return next;
    });
  }, [activeFileId]);

  // Valores derivados del archivo activo
  const activeFile = openFiles.find(f => f.id === activeFileId);
  const activeContent = activeFileId ? (fileContents[activeFileId] ?? code) : code;
  const activeLanguage = activeFile?.language || 'cpp';
  const isActiveEditable = !activeFileId || activeFile?.name?.endsWith('.ino');

  const handleCodeChange = useCallback((value) => {
    setCode(value);
    if (activeFileId) {
      setFileContents(prev => ({ ...prev, [activeFileId]: value }));
      setOpenFiles(prev =>
        prev.map(f => f.id === activeFileId ? { ...f, modified: true } : f)
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

  useEffect(() => () => {
    if (rateLimitTimer.current) clearInterval(rateLimitTimer.current);
  }, []);

  const handleCompile = useCallback(async () => {
    if (compileStatus === 'compiling' || rateLimitMsg) return;

    setCompileStatus('compiling');
    setCompileResult(null);
    setActiveTab('terminal');

    // Parar simulación si estaba corriendo
    if (sim.isRunning) sim.stop();

    try {
      const { data } = await api.post('/compile/', {
        files: [{ name: 'sketch.ino', content: code }],
        board_fqbn: selectedBoard,
      });

      setCompileResult(data);

      if (data.success && data.hex_content) {
        setCompileStatus('success');
        // Cargar hex en simulador y arrancar
        const loaded = sim.loadHex(data.hex_content);
        if (loaded) {
          sim.start();
          // Cambiar a la vista más relevante después de compilar
          setTimeout(() => {
            setActiveTab(circuitDefinition ? 'circuit' : 'serial');
          }, 1500);
        }
      } else {
        setCompileStatus('error');
      }
    } catch (err) {
      if (err.response?.status === 429) {
        const detail = err.response?.data?.detail || {};
        const msg    = typeof detail === 'object' ? detail.message : detail;
        const wait   = typeof detail === 'object' ? (detail.wait_seconds || 60) : 60;
        setCompileStatus('idle');
        startRateLimitCountdown(msg || 'Demasiadas compilaciones. Intentá en un momento.', wait);
        return;
      }
      const detail = err.response?.data?.detail || err.message || 'Error desconocido';
      setCompileStatus('error');
      setCompileResult({
        success: false,
        stdout: '',
        stderr: '',
        error: typeof detail === 'object' ? detail.message || JSON.stringify(detail) : detail,
      });
    }
  }, [code, selectedBoard, compileStatus, rateLimitMsg, sim, circuitDefinition, startRateLimitCountdown]);

  // ── Controles del simulador ──────────────────────────────
  const handleStop = useCallback(() => {
    sim.stop();
  }, [sim]);

  const handleReset = useCallback(() => {
    sim.reset();
    sim.start();
  }, [sim]);

  // ── Tabs del panel derecho ───────────────────────────────
  const tabs = [
    { id: 'terminal', label: 'Terminal', icon: Terminal },
    { id: 'serial', label: 'Serial', icon: Radio },
    // Circuito solo aparece si la lección define un circuito
    ...(circuitDefinition
      ? [{ id: 'circuit', label: 'Circuito', icon: CircuitBoard }]
      : []),
  ];

  return (
    <div className={`simulator-panel bg-slate-900 rounded-xl border border-slate-700
                     shadow-2xl overflow-hidden ${className}`}>
      {/* ════════════════════════════════════════════════════════
       * TOOLBAR
       * ════════════════════════════════════════════════════════ */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-2">
          {/* Ícono + título */}
          <Cpu className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-semibold text-slate-200 hidden sm:inline">
            Simulador Arduino
          </span>

          {/* Separador */}
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

          {/* Botón Pausar (solo si está corriendo) */}
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

          {/* Botón Reset (solo si está cargado) */}
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
              onClick={() => setBoardMenuOpen(!boardMenuOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
                         bg-slate-700 text-slate-300 hover:bg-slate-600 border border-slate-600
                         transition-colors"
            >
              <span className="hidden sm:inline">
                {boards.find(b => b.fqbn === selectedBoard)?.name || selectedBoard}
              </span>
              <span className="sm:hidden text-[10px]">Board</span>
              <ChevronDown className="w-3 h-3" />
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

          {/* Toggle árbol de archivos */}
          {hasFiles && !treeVisible && (
            <button
              onClick={() => setTreeVisible(true)}
              className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700"
              title="Mostrar archivos"
            >
              <PanelLeft className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Expandir/contraer */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700"
            title={isExpanded ? 'Contraer' : 'Expandir'}
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          {/* Cerrar */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700"
              title="Cerrar simulador"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
       * CONTENIDO: Editor + Panel derecho
       * ════════════════════════════════════════════════════════ */}
      <div
        className={`flex flex-col lg:flex-row transition-all duration-300 ${
          isExpanded ? 'h-[80vh]' : 'h-[500px]'
        }`}
      >
        {/* ── Árbol de archivos (sidebar colapsable) ──────────── */}
        {hasFiles && treeVisible && (
          <div className="hidden lg:flex flex-col w-44 flex-shrink-0 border-r border-slate-700
                          bg-slate-900/50 overflow-hidden">
            <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-700/50
                            flex-shrink-0">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Archivos
              </span>
              <button
                onClick={() => setTreeVisible(false)}
                className="p-0.5 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-700"
                title="Ocultar archivos"
              >
                <PanelLeftClose className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
              <SimulatorFileTree
                codeFiles={codeFiles}
                selectedSlug={activeFileId}
                onSelectFile={handleSelectFile}
              />
            </div>
          </div>
        )}

        {/* ── Editor (centro) ──────────────────────────────────── */}
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
            readOnly={!isActiveEditable}
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
                {/* Badge para serial con datos nuevos */}
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
            {activeTab === 'circuit' && circuitDefinition && (
              <Suspense
                fallback={
                  <div className="flex items-center justify-center h-full bg-slate-900">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                    <span className="ml-2 text-sm text-slate-400">Cargando circuito...</span>
                  </div>
                }
              >
                <CircuitView
                  circuitDefinition={circuitDefinition}
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
