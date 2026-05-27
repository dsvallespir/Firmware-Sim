/*
 * WorkbenchPage.jsx
 * -----------------
 * Full-screen standalone Arduino workbench.
 *
 * Layout:
 *  ┌──────────────────────────────────────────────────────┐
 *  │  HEADER toolbar                                      │
 *  ├────────────────────────┬─────────────────────────────┤
 *  │  LEFT  (code editor)   ║  RIGHT (circuit diagram)    │
 *  │  ┌─ file tree (180px) ┐║                             │
 *  │  │ files list         │║  ComponentPalette + Canvas  │
 *  │  └───────────────────┘║                             │
 *  │  Monaco Editor         ║                             │
 *  ├────────────────────────╩─────────────────────────────┤
 *  │  BOTTOM  [Terminal] [Serial Monitor]                  │
 *  └──────────────────────────────────────────────────────┘
 *
 * All panels are resizable via drag handles.
 */

import {
  useState, useCallback, useEffect, useRef, useMemo,
} from 'react';
import {
  Play, Square, RotateCcw, Loader2, ChevronDown,
  Plus, Trash2, FileCode2, Download, Upload,
  Undo2, Redo2, PanelLeftClose, PanelLeft,
  Terminal, Radio, CircuitBoard, Save, Activity, Bug,
} from 'lucide-react';

import api from '../lib/api';
import useAVRSimulator from '../hooks/useAVRSimulator';
import { useLogicAnalyzer } from '../hooks/useLogicAnalyzer';
import SimulatorEditor from '../components/SimulatorEditor';
import CompileTerminal from '../components/CompileTerminal';
import LogicAnalyzerPanel from '../components/LogicAnalyzerPanel';
import DebuggerPanel from '../components/DebuggerPanel';
import SerialMonitor from '../components/SerialMonitor';
import DiagramEditor from '../components/circuit/DiagramEditor';
import useCircuitEditor, { DEFAULT_DIAGRAM } from '../components/circuit/useCircuitEditor';
import LibraryManager from '../components/LibraryManager';
import { useESP32Flasher }  from "../hooks/useESP32Flasher";
// ---------------------------------------------------------------------------
// Default sketch
// ---------------------------------------------------------------------------
const DEFAULT_SKETCH = `// Arduino Workbench – Blink Example
// Parpadea el LED integrado (pin 13) cada 500 ms.

void setup() {
  pinMode(13, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  digitalWrite(13, HIGH);
  Serial.println("LED ON");
  delay(500);
  digitalWrite(13, LOW);
  Serial.println("LED OFF");
  delay(500);
}
`;

const BOARDS = [
  { fqbn: 'arduino:avr:uno',       name: 'Arduino Uno' },
  { fqbn: 'arduino:avr:nano',      name: 'Arduino Nano' },
  { fqbn: 'arduino:avr:mega',      name: 'Arduino Mega 2560' },
  { fqbn: 'arduino:avr:leonardo',  name: 'Arduino Leonardo' },
  { fqbn: 'arduino:avr:micro',     name: 'Arduino Micro' },
  { fqbn: 'esp32:esp32:esp32',     name: 'ESP32' },
  
];

let _fileSeq = 1;
const genFileId = () => `file_${++_fileSeq}`;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function fileLanguage(name) {
  if (name.endsWith('.ino') || name.endsWith('.cpp')) return 'cpp';
  if (name.endsWith('.h'))   return 'cpp';
  if (name.endsWith('.c'))   return 'c';
  if (name.endsWith('.json'))return 'json';
  return 'plaintext';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function WorkbenchPage() {
  // ── ESP32 Connection ───────────────────────────────────────────────────
  const { device, connectDevice, flashDevice } = useESP32Flasher();
  const [esp32Connected, setEsp32Connected] = useState(false);
  const [connectingESP32, setConnectingESP32] = useState(false);

  // ── Files ──────────────────────────────────────────────────────────────
  const [files, setFiles] = useState([
    { id: genFileId(), name: 'sketch.ino', content: DEFAULT_SKETCH, modified: false },
  ]);
  const [activeFileId, setActiveFileId] = useState(files[0].id);

  // ── Board ──────────────────────────────────────────────────────────────
  const [selectedBoard, setSelectedBoard] = useState('arduino:avr:uno');
  const [boardMenuOpen, setBoardMenuOpen] = useState(false);
  const [availableBoards, setAvailableBoards] = useState(BOARDS);

  // ── Libraries ─────────────────────────────────────────────────────────
  const [selectedLibs, setSelectedLibs] = useState([]);

  // ── Compilation ────────────────────────────────────────────────────────
  const [compileStatus, setCompileStatus] = useState('idle');
  const [compileResult, setCompileResult] = useState(null);

  // ── Simulator ──────────────────────────────────────────────────────────
  const sim = useAVRSimulator();

  // ── Circuit diagram ────────────────────────────────────────────────────
  const circuit = useCircuitEditor(DEFAULT_DIAGRAM);

  // ── Sensor configuration (Map<partId, {temperature, humidity, distance, motion}>) ──
  const [sensorConfig, setSensorConfig] = useState(new Map());
  const handleSensorConfigChange = useCallback((partId, updates) => {
    setSensorConfig(prev => {
      const next = new Map(prev);
      next.set(partId, { ...(prev.get(partId) ?? {}), ...updates });
      return next;
    });
  }, []);

  // ── Logic Analyzer ─────────────────────────────────────────────────
  const la = useLogicAnalyzer();
  const [probeMode, setProbeMode] = useState(false);

  // Conectar el logic analyzer al simulador
  useEffect(() => {
    const unsub = sim.registerPinListener(la.onPinChange);
    return unsub;
  }, [sim.registerPinListener, la.onPinChange]);

  const handleProbePin = useCallback((arduinoPin, color, label) => {
    la.subscribePin(arduinoPin, color, label);
    setActiveTab('logic');
  }, [la]);

  // ── Bottom panel tabs ──────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('terminal');

  // ── Layout: resizable split ────────────────────────────────────────────
  // splitPct: percentage of main area given to the LEFT (code) panel
  const [splitPct, setSplitPct]       = useState(48);
  const [bottomPx, setBottomPx]       = useState(220);
  const [fileTreeVisible, setFileTreeVisible] = useState(true);

  const mainRef      = useRef(null);
  const vDividerRef  = useRef(null);
  const hDividerRef  = useRef(null);

  // Vertical divider drag
  useEffect(() => {
    const el = vDividerRef.current;
    if (!el) return;
    const onDown = (e) => {
      e.preventDefault();
      const startX   = e.clientX;
      const startPct = splitPct;
      const onMove = (ev) => {
        if (!mainRef.current) return;
        const totalW = mainRef.current.offsetWidth;
        const dx = ev.clientX - startX;
        setSplitPct(Math.min(75, Math.max(25, startPct + (dx / totalW) * 100)));
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    };
    el.addEventListener('mousedown', onDown);
    return () => el.removeEventListener('mousedown', onDown);
  }, [splitPct]);

  // Horizontal divider drag
  useEffect(() => {
    const el = hDividerRef.current;
    if (!el) return;
    const onDown = (e) => {
      e.preventDefault();
      const startY   = e.clientY;
      const startPx  = bottomPx;
      const onMove = (ev) => {
        const dy = startY - ev.clientY;
        setBottomPx(Math.min(500, Math.max(80, startPx + dy)));
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    };
    el.addEventListener('mousedown', onDown);
    return () => el.removeEventListener('mousedown', onDown);
  }, [bottomPx]);

  // ── Actualizar estado de conexión ESP32 ───────────────────────────────
  useEffect(() => {
    setEsp32Connected(!!device);
  }, [device]);

  // ── Fetch boards from backend ───────────────────────────────────────────
  useEffect(() => {
    api.get('/compile/boards')
      .then(({ data }) => { if (data.boards?.length > 0) setAvailableBoards(data.boards); })
      .catch(() => {});
  }, []);

  // ── File management ─────────────────────────────────────────────────────
  const activeFile = files.find((f) => f.id === activeFileId);

  const handleCodeChange = useCallback((value) => {
    setFiles((prev) =>
      prev.map((f) => f.id === activeFileId ? { ...f, content: value, modified: true } : f),
    );
  }, [activeFileId]);

  const handleNewFile = useCallback(() => {
    const name = prompt('Nombre del archivo (ej: utils.h):', 'nuevo.h');
    if (!name?.trim()) return;
    const id = genFileId();
    setFiles((prev) => [...prev, { id, name: name.trim(), content: '', modified: false }]);
    setActiveFileId(id);
  }, []);

  const handleDeleteFile = useCallback((id) => {
    if (files.length <= 1) return;
    setFiles((prev) => prev.filter((f) => f.id !== id));
    if (activeFileId === id) setActiveFileId(files.find((f) => f.id !== id)?.id ?? null);
  }, [files, activeFileId]);

  const handleRenameFile = useCallback((id) => {
    const file = files.find((f) => f.id === id);
    const name = prompt('Nuevo nombre:', file?.name ?? '');
    if (!name?.trim()) return;
    setFiles((prev) => prev.map((f) => f.id === id ? { ...f, name: name.trim() } : f));
  }, [files]);

  // Open files for editor tabs
  const openFiles = useMemo(() =>
    files.map((f) => ({ id: f.id, name: f.name, language: fileLanguage(f.name), modified: f.modified })),
  [files]);

  // ── Compile & run ────────────────────────────────────────────────────────
// ── Compile & run ────────────────────────────────────────────────────────
  const handleCompile = useCallback(async () => {
    if (compileStatus === 'compiling') return;
    setCompileStatus('compiling');
    setCompileResult(null);
    setActiveTab('terminal');
    
    // Detenemos el simulador virtual si estaba corriendo
    if (sim.isRunning) sim.stop();

    try {
      const { data } = await api.post('/compile/', {
        files: files.map((f) => ({ name: f.name, content: f.content })),
        board_fqbn: selectedBoard,
        libraries: selectedLibs,
      });

      setCompileResult(data);

      if (data.success) {
        setCompileStatus('success');

        // 🟢 CASO 1: Arduino AVR (Simulador Virtual)
        if (data.hex_content) {
          const loaded = sim.loadHex(data.hex_content);
          if (loaded) {
            sim.start();
            setTimeout(() => setActiveTab('serial'), 1500);
          }
        } 
        // 🔵 CASO 2: ESP32 (Hardware Real vía Web Serial)
        else if (data.bin_content) {
          try {

            if (!device) {
              // ⚠️ Solución alternativa "Fast": Pedir el puerto ACÁ levantando un modal,
              // pero lo ideal es que ya esté conectado.
              setCompileStatus('error');
              setCompileResult({ success: false, error: "Por favor, conectá tu ESP32 primero usando el botón de conexión." });
              return;
            }
            // 1. Decodificar el binario desde Base64 a ArrayBuffer
            // 🚀 SOLUCIÓN: Decodificación moderna y segura para binarios de firmware
            const cleanBase64 = data.bin_content.replace(/\s/g, ''); 
                
            // Convertimos el string a una simulación de archivo en memoria
            const dataUrl = `data:application/octet-stream;base64,${cleanBase64}`;
            const blobResponse = await fetch(dataUrl);
            const blob = await blobResponse.blob();
            
            // Obtenemos el ArrayBuffer puro e inmaculado
            const arrayBuffer = await blob.arrayBuffer();
            
            console.log("¡Decodificación exitosa! Tamaño real del binario:", arrayBuffer.byteLength, "bytes");

            if (arrayBuffer.byteLength === 0) {
                throw new Error("El binario decodificado tiene tamaño 0.");
            }

            // Cuando ya tenés el arrayBuffer decodificado del Blob:
            console.log("=== CONTROL EN WORKBENCH ===");
            console.log("¿Es un ArrayBuffer válido?:", arrayBuffer instanceof ArrayBuffer);
            console.log("Tamaño exacto en bytes en Workbench:", arrayBuffer?.byteLength);

            // Le pasamos el buffer real a tu hook useESP32Flasher configurado en 0x10000
            await flashDevice(arrayBuffer, device);

            // 5. Pasar a la pestaña serial para ver los logs reales
            setTimeout(() => setActiveTab('serial'), 1500);

          } catch (flashError) {
            console.error("Error al flashear el dispositivo:", flashError);
            setCompileStatus('error');
            setCompileResult((prev) => ({
              ...prev,
              error: "Fallo al transferir el firmware a la placa física."
            }));
          }
        }
      } else {
        setCompileStatus('error');
      }
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || 'Unknown error';
      setCompileStatus('error');
      setCompileResult({
        success: false, stdout: '', stderr: '',
        error: typeof detail === 'object' ? (detail.message || JSON.stringify(detail)) : detail,
      });
    }
  }, [files, selectedBoard, selectedLibs, compileStatus, sim, device, flashDevice]);

  const handleStop  = useCallback(() => sim.stop(),   [sim]);
  const handleReset = useCallback(() => { sim.reset(); sim.start(); }, [sim]);

  // ── Connect ESP32 Device ─────────────────────────────────────────────────
  const handleConnectESP32 = useCallback(async () => {
    setConnectingESP32(true);
    try {
      const selectedPort = await connectDevice();
      if (selectedPort) {
        console.log("ESP32 conectado exitosamente");
      } else {
        alert("No se pudo conectar al dispositivo. Asegúrate de que el ESP32 está enchufado.");
      }
    } catch (error) {
      console.error("Error al conectar ESP32:", error);
      alert("Error al conectar ESP32: " + error.message);
    } finally {
      setConnectingESP32(false);
    }
  }, [connectDevice]);

  // ── Diagram import / export ──────────────────────────────────────────────
  const handleExportDiagram = useCallback(() => {
    const json = JSON.stringify(circuit.diagram, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'diagram.json'; a.click();
    URL.revokeObjectURL(url);
  }, [circuit.diagram]);

  // Elimina partes sin ninguna conexión (componentes "fantasma" fuera del canvas)
  const handleCleanOrphans = useCallback(() => {
    const removed = circuit.removeOrphans();
    if (removed === 0) {
      alert('No hay partes sin conexiones para eliminar.');
    } else {
      alert(`Se eliminaron ${removed} parte(s) sin conexiones.`);
    }
  }, [circuit]);

  const handleImportDiagram = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          circuit.loadDiagram(data);
        } catch {
          alert('Error al importar: JSON inválido');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [circuit]);

  // Project export (code + diagram)
  const handleExportProject = useCallback(() => {
    const project = {
      version: 1,
      files:   files.map((f) => ({ name: f.name, content: f.content })),
      diagram: circuit.diagram,
      board:   selectedBoard,
    };
    const json = JSON.stringify(project, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'proyecto.json'; a.click();
    URL.revokeObjectURL(url);
  }, [files, circuit.diagram, selectedBoard]);

  const handleImportProject = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          if (data.files) {
            const newFiles = data.files.map((f) => ({ id: genFileId(), name: f.name, content: f.content, modified: false }));
            setFiles(newFiles);
            setActiveFileId(newFiles[0]?.id ?? null);
          }
          if (data.diagram) circuit.loadDiagram(data.diagram);
          if (data.board)   setSelectedBoard(data.board);
        } catch {
          alert('Error al importar proyecto: JSON inválido');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [circuit]);

  // ── Bottom tabs ───────────────────────────────────────────────────────────
  const TABS = [
    { id: 'terminal', label: 'Terminal',         icon: Terminal },
    { id: 'serial',   label: 'Serial Monitor',   icon: Radio },
    { id: 'circuit',  label: 'Diagrama',         icon: CircuitBoard },
    { id: 'logic',    label: 'Analizador Lógico', icon: Activity },
    { id: 'debug',    label: 'Depurador',        icon: Bug },
  ];

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 overflow-hidden text-slate-200">

      {/* ══════════════════════════════════════════════════════════════════
          HEADER
      ══════════════════════════════════════════════════════════════════ */}
      <header className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border-b border-slate-700 flex-shrink-0 z-10">

        {/* Logo */}
        <div className="flex items-center gap-2 pr-3 border-r border-slate-700 mr-1">
          <span className="text-emerald-400 text-base">⚡</span>
          <span className="text-sm font-bold text-slate-200 hidden sm:inline">Arduino Workbench</span>
        </div>

        {/* Compile & Run / Connect ESP32 */}
        {selectedBoard === 'esp32:esp32:esp32' || selectedBoard === 'esp32:esp32:esp32:FlashSize=4M,FlashMode=dio' ? (
          <>
            {!esp32Connected ? (
              <button
                onClick={handleConnectESP32}
                disabled={connectingESP32}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                           bg-blue-600 text-white hover:bg-blue-500
                           disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {connectingESP32
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Conectando...</>
                  : <><Radio className="w-3.5 h-3.5" /> Conectar ESP32 Real</>
                }
              </button>
            ) : (
              <button
                onClick={handleCompile}
                disabled={compileStatus === 'compiling'}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                           bg-emerald-600 text-white hover:bg-emerald-500
                           disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {compileStatus === 'compiling'
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Compilando...</>
                  : <><Upload className="w-3.5 h-3.5" /> Compilar y Subir</>
                }
              </button>
            )}
            {esp32Connected && (
              <button
                onClick={() => { setEsp32Connected(false); }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium
                           bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
                title="Desconectar ESP32"
              >
                <span className="text-blue-400">✓ Conectado</span>
              </button>
            )}
          </>
        ) : (
          <button
            onClick={handleCompile}
            disabled={compileStatus === 'compiling'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                       bg-emerald-600 text-white hover:bg-emerald-500
                       disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {compileStatus === 'compiling'
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Compilando...</>
              : <><Play className="w-3.5 h-3.5" /> Compilar y Simular</>
            }
          </button>
        )}

        {sim.isRunning && (
          <button
            onClick={handleStop}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium
                       bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
          >
            <Square className="w-3 h-3" /> Pausar
          </button>
        )}
        {sim.isLoaded && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium
                       bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
          >
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
        )}

        {/* Board selector */}
        <div className="relative ml-1">
          <button
            onClick={() => setBoardMenuOpen((v) => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
                       bg-slate-700 text-slate-300 hover:bg-slate-600 border border-slate-600 transition-colors"
          >
            {availableBoards.find((b) => b.fqbn === selectedBoard)?.name ?? selectedBoard}
            <ChevronDown className="w-3 h-3" />
          </button>
          {boardMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setBoardMenuOpen(false)} />
              <div className="absolute left-0 top-full mt-1 z-50 bg-slate-800 border border-slate-600 rounded-lg shadow-xl py-1 min-w-[200px]">
                {availableBoards.map((b) => (
                  <button
                    key={b.fqbn}
                    onClick={() => { setSelectedBoard(b.fqbn); setBoardMenuOpen(false); }}
                    className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                      selectedBoard === b.fqbn
                        ? 'bg-emerald-600/20 text-emerald-400'
                        : 'text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Status indicator */}
        {sim.isRunning && (
          <span className="flex items-center gap-1 text-[10px] text-emerald-400 hidden sm:flex">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Simulando
          </span>
        )}
        {compileStatus === 'success' && !sim.isRunning && (
          <span className="text-[10px] text-emerald-400 hidden sm:inline">✓ Compilado</span>
        )}
        {compileStatus === 'error' && (
          <span className="text-[10px] text-red-400 hidden sm:inline">✗ Error</span>
        )}

        <div className="flex-1" />

        {/* Undo / Redo */}
        <button
          onClick={circuit.undo}
          disabled={!circuit.canUndo}
          className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700
                     disabled:opacity-30 disabled:cursor-not-allowed"
          title="Deshacer (Ctrl+Z)"
        >
          <Undo2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={circuit.redo}
          disabled={!circuit.canRedo}
          className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700
                     disabled:opacity-30 disabled:cursor-not-allowed"
          title="Rehacer (Ctrl+Y)"
        >
          <Redo2 className="w-3.5 h-3.5" />
        </button>

        {/* Import / Export project */}
        <div className="w-px h-5 bg-slate-700 mx-1" />
        <button
          onClick={handleImportProject}
          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium
                     bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700"
          title="Importar proyecto (código + diagrama)"
        >
          <Upload className="w-3 h-3" /> Abrir
        </button>
        <button
          onClick={handleExportProject}
          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium
                     bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700"
          title="Guardar proyecto (código + diagrama)"
        >
          <Save className="w-3 h-3" /> Guardar
        </button>
        <button
          onClick={handleCleanOrphans}
          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium
                     bg-slate-800 text-amber-500 hover:text-amber-300 border border-slate-700"
          title="Eliminar partes sin conexiones (componentes fuera de pantalla o no cableados)"
        >
          <Trash2 className="w-3 h-3" /> Limpiar
        </button>
      </header>

      {/* ══════════════════════════════════════════════════════════════════
          MAIN CONTENT (resizable left + right)
      ══════════════════════════════════════════════════════════════════ */}
      <div
        ref={mainRef}
        className="flex flex-row flex-1 min-h-0 overflow-hidden"
        style={{ height: `calc(100% - 36px - ${bottomPx + 4}px)` }}
      >
        {/* ── LEFT PANEL (File tree + Monaco) ── */}
        <div
          className="flex flex-row min-w-0 overflow-hidden border-r border-slate-700"
          style={{ width: `${splitPct}%`, flexShrink: 0 }}
        >
          {/* File tree */}
          {fileTreeVisible && (
            <div className="flex flex-col w-44 flex-shrink-0 border-r border-slate-700 bg-slate-900/60 overflow-hidden">
              <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-700/60 flex-shrink-0">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Archivos
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleNewFile}
                    className="p-0.5 rounded text-slate-500 hover:text-emerald-400 hover:bg-slate-700"
                    title="Nuevo archivo"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setFileTreeVisible(false)}
                    className="p-0.5 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-700"
                    title="Ocultar árbol"
                  >
                    <PanelLeftClose className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto py-1">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className={`group flex items-center gap-1.5 px-2 py-1 mx-1 rounded cursor-pointer text-xs transition-colors ${
                      activeFileId === file.id
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
                    }`}
                    onClick={() => setActiveFileId(file.id)}
                    onDoubleClick={() => handleRenameFile(file.id)}
                  >
                    <FileCode2 className={`w-3.5 h-3.5 flex-shrink-0 ${
                      activeFileId === file.id ? 'text-emerald-400' : 'text-slate-500'
                    }`} />
                    <span className="flex-1 truncate">{file.name}</span>
                    {file.modified && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                    )}
                    {files.length > 1 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteFile(file.id); }}
                        className="hidden group-hover:flex p-0.5 rounded text-slate-600 hover:text-red-400"
                        title="Eliminar archivo"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {/* Library manager — below file list */}
              <div className="border-t border-slate-700/60" style={{ height: '220px', flexShrink: 0 }}>
                <LibraryManager selectedLibs={selectedLibs} onChange={setSelectedLibs} />
              </div>
            </div>
          )}

          {/* Monaco editor */}
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
            {!fileTreeVisible && (
              <button
                onClick={() => setFileTreeVisible(true)}
                className="absolute left-0 top-12 z-20 p-1.5 bg-slate-800 border-r border-b border-slate-700 rounded-br text-slate-500 hover:text-slate-200"
                title="Mostrar árbol"
              >
                <PanelLeft className="w-3.5 h-3.5" />
              </button>
            )}
            <SimulatorEditor
              openFiles={openFiles}
              activeFileId={activeFileId}
              onSelectFile={setActiveFileId}
              onCloseFile={null}
              code={activeFile?.content ?? ''}
              onChange={handleCodeChange}
              language={fileLanguage(activeFile?.name ?? 'sketch.ino')}
              readOnly={false}
            />
          </div>
        </div>

        {/* ── Vertical resize divider ── */}
        <div
          ref={vDividerRef}
          className="w-1 flex-shrink-0 bg-slate-800 hover:bg-emerald-600/50 cursor-col-resize transition-colors"
          title="Arrastrar para redimensionar"
        />

        {/* ── RIGHT PANEL (Circuit Diagram Editor) ── */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <DiagramEditor
            diagram={circuit.diagram}
            onAddPart={circuit.addPart}
            onRemovePart={circuit.removePart}
            onMovePart={circuit.movePart}
            onStartDrag={circuit.startDrag}
            onEndDrag={circuit.endDrag}
            onRotatePart={circuit.rotatePart}
            onDuplicatePart={circuit.duplicatePart}
            onAddConnection={circuit.addConnection}
            onRemoveConnection={circuit.removeConnection}
            onSetConnectionWaypoints={circuit.setConnectionWaypoints}
            onUpdateConnectionWaypoints={circuit.updateConnectionWaypoints}
            pinStates={sim.pinStates}
            setPinState={sim.setPinState}
            setAnalogValue={sim.setAnalogValue}
            registerPinListener={sim.registerPinListener}
            schedulePinChange={sim.schedulePinChange}
            sensorConfig={sensorConfig}
            onSensorConfigChange={handleSensorConfigChange}
            probeMode={probeMode}
            onProbePin={handleProbePin}
            isRunning={sim.isRunning}
            i2cBus={sim.i2cBus}
            spiBus={sim.spiBus}
          />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          HORIZONTAL resize divider
      ══════════════════════════════════════════════════════════════════ */}
      <div
        ref={hDividerRef}
        className="h-1 flex-shrink-0 bg-slate-800 hover:bg-emerald-600/50 cursor-row-resize transition-colors"
        title="Arrastrar para redimensionar"
      />

      {/* ══════════════════════════════════════════════════════════════════
          BOTTOM PANEL (Terminal + Serial)
      ══════════════════════════════════════════════════════════════════ */}
      <div
        className="flex flex-col flex-shrink-0 overflow-hidden border-t border-slate-700"
        style={{ height: bottomPx }}
      >
        {/* Tab bar */}
        <div className="flex items-center bg-slate-900 border-b border-slate-700 flex-shrink-0">
          {TABS.map((tab) => (
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
              {tab.id === 'logic' && la.channelCount > 0 && activeTab !== 'logic' && (
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              )}
            </button>
          ))}

          {/* Diagram actions in bottom bar */}
          {activeTab === 'circuit' && (
            <div className="ml-auto flex items-center gap-1.5 pr-3">
              <button
                onClick={handleImportDiagram}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium
                           bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700"
                title="Importar diagrama JSON"
              >
                <Upload className="w-3 h-3" /> Importar diagrama
              </button>
              <button
                onClick={handleExportDiagram}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium
                           bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700"
                title="Exportar diagrama JSON"
              >
                <Download className="w-3 h-3" /> Exportar diagrama
              </button>
            </div>
          )}

          {/* LED 13 indicator */}
          {sim.isLoaded && (
            <div className="ml-auto mr-3 flex items-center gap-1.5 text-[10px] text-slate-500">
              <span>D13:</span>
              <span className={`w-2.5 h-2.5 rounded-full border transition-colors ${
                sim.pinStates[13]
                  ? 'bg-amber-400 border-amber-300 shadow-sm shadow-amber-400/50'
                  : 'bg-slate-700 border-slate-600'
              }`} />
            </div>
          )}
        </div>

        {/* Tab content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {activeTab === 'terminal' && (
            <CompileTerminal
              status={compileStatus}
              stdout={compileResult?.stdout ?? ''}
              stderr={compileResult?.stderr ?? ''}
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
          {activeTab === 'circuit' && (
            <div className="h-full flex items-center justify-center bg-slate-950">
              <p className="text-sm text-slate-500 text-center px-8">
                El editor de diagrama está en el panel derecho.<br />
                Esta pestaña es para importar/exportar el JSON del diagrama.
              </p>
            </div>
          )}
          {activeTab === 'logic' && (
            <LogicAnalyzerPanel
              channels={la.channels}
              latestTime={la.latestTime}
              isRunning={sim.isRunning}
              onRemoveChannel={la.unsubscribePin}
              onClearAll={la.clearAll}
            />
          )}
          {activeTab === 'debug' && (
            <DebuggerPanel
              isLoaded={sim.isLoaded}
              isRunning={sim.isRunning}
              onStep={sim.step}
              onPause={sim.stop}
              onResume={sim.start}
              onReset={sim.reset}
            />
          )}
        </div>
      </div>
    </div>
  );
}
