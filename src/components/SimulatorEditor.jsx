/*
 * ============================================================
 * SimulatorEditor.jsx - Editor Monaco con tabs de archivos
 * ============================================================
 *
 * Wrapper de Monaco Editor con:
 * - Barra de tabs para archivos abiertos
 * - Sintaxis C/C++ (Arduino)
 * - Tema oscuro
 * - Minimap deshabilitado (espacio limitado)
 * - Callback onChange para sincronizar con el padre
 *
 * Props:
 *   openFiles:    Array<{ id, name, language?, modified? }> — Tabs
 *   activeFileId: string  — ID del archivo mostrado
 *   onSelectFile: (id) => void
 *   onCloseFile:  (id) => void
 *   code:         string  — Contenido del archivo activo
 *   onChange:     (value) => void
 *   language:     string
 *   readOnly:     boolean
 */

import { useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { Loader2, X, FileCode2 } from 'lucide-react';

export default function SimulatorEditor({
  openFiles = [],
  activeFileId = null,
  onSelectFile,
  onCloseFile,
  code = '',
  onChange,
  language = 'cpp',
  readOnly = false,
}) {
  const editorRef = useRef(null);

  const handleEditorDidMount = useCallback((editor, _monaco) => {
    editorRef.current = editor;
  }, []);

  const handleChange = useCallback((value) => {
    if (onChange) onChange(value);
  }, [onChange]);

  const hasTabs = openFiles.length > 0;

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      {/* ── Tab bar (solo si hay archivos abiertos) ── */}
      {hasTabs && (
        <div className="flex items-center bg-slate-900 border-b border-slate-700
                        overflow-x-auto flex-shrink-0"
             style={{ scrollbarWidth: 'none' }}>
          {openFiles.map((file) => {
            const isActive = file.id === activeFileId;
            return (
              <div
                key={file.id}
                className={`group flex items-center gap-1.5 px-3 py-1.5 text-xs
                           cursor-pointer border-r border-slate-700/50 flex-shrink-0
                           transition-colors select-none ${
                             isActive
                               ? 'bg-slate-800 text-slate-200 border-b-2 border-b-emerald-400'
                               : 'bg-slate-900 text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 border-b-2 border-b-transparent'
                           }`}
                onClick={() => onSelectFile?.(file.id)}
              >
                <FileCode2 className={`w-3 h-3 flex-shrink-0 ${
                  isActive ? 'text-emerald-400' : 'text-slate-600'
                }`} />
                <span className="truncate max-w-[120px]">{file.name}</span>
                {file.modified && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                )}
                {onCloseFile && openFiles.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseFile(file.id);
                    }}
                    className={`p-0.5 rounded hover:bg-slate-600 transition-colors flex-shrink-0 ${
                      isActive
                        ? 'text-slate-400 hover:text-slate-200'
                        : 'text-transparent group-hover:text-slate-500 hover:!text-slate-200'
                    }`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Monaco Editor ── */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <Editor
          height="100%"
          language={language}
          value={code}
          onChange={handleChange}
          onMount={handleEditorDidMount}
          theme="vs-dark"
          loading={
            <div className="flex items-center justify-center h-full bg-slate-900 gap-2">
              <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
              <span className="text-sm text-slate-400">Cargando editor...</span>
            </div>
          }
          options={{
            readOnly,
            minimap: { enabled: false },
            fontSize: 13,
            lineHeight: 20,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
            fontLigatures: true,
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            automaticLayout: true,
            tabSize: 2,
            renderWhitespace: 'selection',
            bracketPairColorization: { enabled: true },
            padding: { top: 8, bottom: 8 },
            suggest: {
              showKeywords: true,
              showSnippets: true,
            },
            quickSuggestions: {
              other: true,
              comments: false,
              strings: false,
            },
          }}
        />
      </div>
    </div>
  );
}
