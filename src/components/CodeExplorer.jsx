/*
 * ============================================================
 * CodeExplorer.jsx - Explorador de archivos de código del módulo
 * ============================================================
 *
 * Componente overlay que permite explorar los archivos de código
 * fuente asociados a un módulo, sin reemplazar el contenido teórico.
 *
 * Layout:
 *   [Árbol de carpetas | Visor de código readonly]
 *
 * Comportamiento:
 *   - Muestra árbol construido con buildFileTree()
 *   - Carga contenido bajo demanda al seleccionar archivo
 *   - Cachea contenido ya cargado
 *   - Botón "Volver a la lección" cierra el explorador
 *
 * NO modifica MarkdownRenderer ni los snippets inline.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  X, FolderOpen, Folder, FileCode2,
  ChevronRight, ChevronDown, Copy, Check,
  Download, ArrowLeft, Loader2, Hash, Maximize2, Minimize2,
} from 'lucide-react';
import api from '../lib/api';
import { buildFileTree, resolveCodeLanguage, formatFileSize } from '../lib/fileTreeUtils';

// ----------------------------------------------------------
// Etiquetas legibles de lenguaje (subset de MarkdownRenderer)
// ----------------------------------------------------------
const LANG_LABEL = {
  c: 'C', cpp: 'C++', python: 'Python', vhdl: 'VHDL',
  verilog: 'Verilog', systemverilog: 'SystemVerilog',
  bash: 'Bash', makefile: 'Makefile', cmake: 'CMake',
  json: 'JSON', yaml: 'YAML', toml: 'TOML',
  rust: 'Rust', javascript: 'JavaScript', typescript: 'TypeScript',
  markdown: 'Markdown', text: 'Text',
};

// ----------------------------------------------------------
// Nodo carpeta (recursivo, expandible)
// ----------------------------------------------------------
function FolderNode({ node, selectedFile, onSelectFile, depth = 0 }) {
  const [expanded, setExpanded] = useState(depth < 2); // auto-expand top levels

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 w-full text-left px-2 py-1.5
                   text-sm text-dark-300 hover:bg-dark-700/50 rounded-md
                   transition-colors group"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {expanded
          ? <ChevronDown className="w-3.5 h-3.5 text-dark-500 flex-shrink-0" />
          : <ChevronRight className="w-3.5 h-3.5 text-dark-500 flex-shrink-0" />}
        {expanded
          ? <FolderOpen className="w-4 h-4 text-yellow-400/70 flex-shrink-0" />
          : <Folder className="w-4 h-4 text-yellow-400/50 flex-shrink-0" />}
        <span className="truncate font-medium">{node.name}/</span>
      </button>
      {expanded && node.children?.map((child) => (
        <TreeNode
          key={child.name}
          node={child}
          selectedFile={selectedFile}
          onSelectFile={onSelectFile}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

// ----------------------------------------------------------
// Nodo archivo
// ----------------------------------------------------------
function FileNode({ node, selectedFile, onSelectFile, depth = 0 }) {
  const isSelected = selectedFile?.slug === node.file?.slug;
  const lang = resolveCodeLanguage(node.file);

  return (
    <button
      onClick={() => onSelectFile(node.file)}
      className={`flex items-center gap-1.5 w-full text-left px-2 py-1.5
                  text-sm rounded-md transition-colors ${
                    isSelected
                      ? 'bg-primary-500/15 text-primary-300 font-medium'
                      : 'text-dark-400 hover:bg-dark-700/50 hover:text-dark-200'
                  }`}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
    >
      <FileCode2 className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-primary-400' : 'text-dark-500'}`} />
      <span className="truncate">{node.name}</span>
      <span className="ml-auto text-[10px] font-mono text-dark-600 flex-shrink-0">
        {LANG_LABEL[lang] || lang}
      </span>
    </button>
  );
}

// ----------------------------------------------------------
// Nodo genérico (dispatch a folder o file)
// ----------------------------------------------------------
function TreeNode({ node, selectedFile, onSelectFile, depth = 0 }) {
  if (node.type === 'folder') {
    return (
      <FolderNode
        node={node}
        selectedFile={selectedFile}
        onSelectFile={onSelectFile}
        depth={depth}
      />
    );
  }
  return (
    <FileNode
      node={node}
      selectedFile={selectedFile}
      onSelectFile={onSelectFile}
      depth={depth}
    />
  );
}

// ----------------------------------------------------------
// Componente principal
// ----------------------------------------------------------
export default function CodeExplorer({
  courseSlug,
  moduleSlug,
  moduleTitle,
  codeFiles, // Array de LessonMeta del endpoint /files
  onClose,
}) {
  const { t } = useTranslation();
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContents, setFileContents] = useState({}); // cache: slug → content_raw
  const [loadingContent, setLoadingContent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const codeRef = useRef(null);

  // Construir árbol de archivos (puro, se recalcula solo si cambian los files)
  const tree = buildFileTree(codeFiles || []);

  // Auto-seleccionar primer archivo si no hay selección
  // Usa handleSelectFile para disparar también la carga de contenido
  useEffect(() => {
    if (!selectedFile && codeFiles?.length > 0) {
      handleSelectFile(codeFiles[0]);
    }
  }, [codeFiles]);

  // Cargar contenido bajo demanda al seleccionar archivo
  const handleSelectFile = useCallback(async (file) => {
    setSelectedFile(file);

    // Si ya está en cache, no recargar
    if (fileContents[file.slug]) return;

    setLoadingContent(true);
    try {
      const { data } = await api.get(
        `/content/${courseSlug}/${moduleSlug}/${file.slug}`
      );
      setFileContents((prev) => ({
        ...prev,
        [file.slug]: data.content_raw,
      }));
    } catch (err) {
      console.error('Error loading file content:', err);
      setFileContents((prev) => ({
        ...prev,
        [file.slug]: `// Error al cargar: ${err.response?.data?.detail || err.message}`,
      }));
    } finally {
      setLoadingContent(false);
    }
  }, [courseSlug, moduleSlug, fileContents]);

  // Copiar contenido al portapapeles
  const handleCopy = useCallback(async () => {
    const content = fileContents[selectedFile?.slug];
    if (!content) return;
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [selectedFile, fileContents]);

  // Descargar archivo via endpoint server-side
  const handleDownload = useCallback(async () => {
    if (!selectedFile) return;
    try {
      const res = await api.get(
        `/content/${courseSlug}/${moduleSlug}/${selectedFile.slug}/download`,
        { responseType: 'blob' }
      );
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = selectedFile.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading:', err);
    }
  }, [courseSlug, moduleSlug, selectedFile]);

  const currentContent = selectedFile ? fileContents[selectedFile.slug] : null;
  const currentLang = selectedFile ? resolveCodeLanguage(selectedFile) : 'text';
  const langLabel = LANG_LABEL[currentLang] || currentLang;

  return (
    <div className={`flex flex-col bg-dark-950 border border-dark-700 rounded-xl
                     overflow-hidden shadow-2xl transition-all duration-300 ${
                       isExpanded
                         ? 'fixed inset-4 lg:left-80 z-50'
                         : 'h-[600px] max-h-[70vh]'
                     }`}>
      {/* ============================================================
       * HEADER
       * ============================================================ */}
      <div className="flex items-center justify-between px-4 py-2.5
                      bg-dark-900 border-b border-dark-700 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-sm text-dark-300
                       hover:text-primary-400 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">{t('lessonViewer.backToLesson')}</span>
          </button>
          <div className="hidden sm:block w-px h-5 bg-dark-700" />
          <span className="text-xs text-dark-500 truncate max-w-[200px]">
            {moduleTitle}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Badges del archivo seleccionado */}
          {selectedFile && (
            <>
              <span className="hidden sm:inline text-[10px] font-mono px-1.5 py-0.5
                               rounded bg-primary-500/10 text-primary-400">
                {langLabel}
              </span>
              {selectedFile.line_count && (
                <span className="hidden md:inline text-[10px] text-dark-500">
                  {selectedFile.line_count} lín
                </span>
              )}
              {formatFileSize(selectedFile.size_bytes) && (
                <span className="hidden md:inline text-[10px] text-dark-600">
                  {formatFileSize(selectedFile.size_bytes)}
                </span>
              )}
            </>
          )}

          {/* Acciones */}
          {currentContent && (
            <>
              <button onClick={handleCopy} title={t('lessonViewer.copy')}
                className="p-1.5 rounded-md text-dark-400 hover:text-dark-200
                           hover:bg-dark-700 transition-colors">
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <button onClick={handleDownload} title={t('lessonViewer.download')}
                className="p-1.5 rounded-md text-dark-400 hover:text-dark-200
                           hover:bg-dark-700 transition-colors">
                <Download className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          <button onClick={() => setIsExpanded(!isExpanded)} title={isExpanded ? t('lessonViewer.reduce') : t('lessonViewer.expand')}
            className="p-1.5 rounded-md text-dark-400 hover:text-dark-200
                       hover:bg-dark-700 transition-colors">
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          <button onClick={onClose} title={t('lessonViewer.close')}
            className="p-1.5 rounded-md text-dark-400 hover:text-red-400
                       hover:bg-dark-700 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ============================================================
       * BODY: árbol + visor
       * ============================================================ */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ---- Panel izquierdo: árbol de archivos ---- */}
        <div className="w-56 flex-shrink-0 border-r border-dark-700 bg-dark-900/50
                        overflow-y-auto overflow-x-hidden">
          <div className="p-2 space-y-0.5">
            {tree.length > 0 ? (
              tree.map((node) => (
                <TreeNode
                  key={node.name}
                  node={node}
                  selectedFile={selectedFile}
                  onSelectFile={handleSelectFile}
                />
              ))
            ) : (
              <p className="text-xs text-dark-500 p-3 text-center">
                {t('lessonViewer.noFiles')}
              </p>
            )}
          </div>
        </div>

        {/* ---- Panel derecho: visor de código ---- */}
        <div className="flex-1 min-w-0 overflow-auto bg-[#0d1117]" ref={codeRef}>
          {!selectedFile ? (
            <div className="flex items-center justify-center h-full text-dark-500 text-sm">
              {t('lessonViewer.selectFile')}
            </div>
          ) : loadingContent && !currentContent ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
            </div>
          ) : currentContent ? (
            <div>
              {/* Barra del archivo */}
              <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-1.5
                              bg-dark-800/95 backdrop-blur-sm border-b border-dark-700 text-xs">
                <FileCode2 className="w-3.5 h-3.5 text-dark-500" />
                <span className="text-dark-300 font-mono">
                  {selectedFile.relative_path || selectedFile.filename}
                </span>
              </div>
              <SyntaxHighlighter
                style={atomDark}
                language={currentLang}
                PreTag="div"
                showLineNumbers
                wrapLines
                customStyle={{
                  margin: 0,
                  borderRadius: 0,
                  padding: '1rem',
                  fontSize: '0.82rem',
                  lineHeight: '1.55',
                  backgroundColor: '#0d1117',
                  minHeight: '100%',
                }}
                lineNumberStyle={{
                  minWidth: '3em',
                  paddingRight: '1.2em',
                  color: '#3d4f5e',
                  userSelect: 'none',
                  fontSize: '0.75rem',
                }}
                wrapLongLines={false}
              >
                {currentContent}
              </SyntaxHighlighter>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-dark-500 text-sm">
              Error al cargar el archivo
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
