/*
 * ============================================================
 * fileTreeUtils.js - Utilidades puras para árbol de archivos
 * ============================================================
 *
 * Funciones sin side-effects, diseñadas para ser testeables:
 *
 * - buildFileTree(files):  convierte lista plana de archivos con
 *   relative_path en un árbol jerárquico de carpetas/archivos.
 *
 * - resolveCodeLanguage(file): determina el lenguaje para syntax
 *   highlighting priorizando: backend language > extensión > plaintext.
 *
 * - formatFileSize(bytes): formato legible de tamaño.
 */

// ----------------------------------------------------------
// Mapeo extensión → lenguaje para Prism/SyntaxHighlighter
// Sincronizado con LANG_MAP de MarkdownRenderer.jsx
// ----------------------------------------------------------
const EXT_LANG_MAP = {
  '.c': 'c', '.h': 'c',
  '.cpp': 'cpp', '.hpp': 'cpp', '.cc': 'cpp',
  '.ino': 'cpp',
  '.py': 'python',
  '.vhd': 'vhdl', '.vhdl': 'vhdl',
  '.v': 'verilog', '.sv': 'systemverilog',
  '.sh': 'bash',
  '.mk': 'makefile', '.cmake': 'cmake',
  '.rs': 'rust',
  '.js': 'javascript', '.ts': 'typescript',
  '.json': 'json',
  '.yaml': 'yaml', '.yml': 'yaml',
  '.toml': 'toml',
  '.md': 'markdown',
};

/**
 * Determina el lenguaje de un archivo para syntax highlighting.
 *
 * Prioridad:
 * 1. Campo `language` del backend (ya calculado durante el scan)
 * 2. Extensión del filename
 * 3. Fallback a "text"
 *
 * @param {{ language?: string, filename?: string }} file
 * @returns {string} Nombre de lenguaje compatible con Prism
 */
export function resolveCodeLanguage(file) {
  // 1. Backend language
  if (file?.language) return file.language;

  // 2. Por extensión
  const name = file?.filename || file?.relative_path || '';
  const dotIdx = name.lastIndexOf('.');
  if (dotIdx >= 0) {
    const ext = name.slice(dotIdx).toLowerCase();
    if (EXT_LANG_MAP[ext]) return EXT_LANG_MAP[ext];
  }

  // 3. Fallback
  return 'text';
}

/**
 * Convierte una lista plana de archivos en un árbol jerárquico.
 *
 * Cada archivo del backend tiene un `relative_path` como:
 *   "src/main.c", "src/uart/uart.c", "hello_serial/hello_serial.ino"
 *
 * El árbol resultante tiene nodos:
 *   - type: "folder" con children[]
 *   - type: "file" con la data original del archivo
 *
 * Orden: carpetas primero (alfabético), archivos después (alfabético).
 *
 * @param {Array<{ relative_path: string, filename: string, ... }>} files
 * @returns {{ name: string, type: string, children?: Array, file?: object }[]}
 */
export function buildFileTree(files) {
  if (!files || files.length === 0) return [];

  // Paso 1: construir estructura intermedia como mapa anidado
  const root = {};

  for (const file of files) {
    const path = file.relative_path || file.filename || '';
    const parts = path.split('/').filter(Boolean);

    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;

      if (isLast) {
        // Es el archivo final
        current[part] = { __file: file };
      } else {
        // Es una carpeta intermedia
        if (!current[part] || current[part].__file) {
          current[part] = current[part] || {};
        }
        current = current[part];
      }
    }
  }

  // Paso 2: convertir mapa anidado en array de nodos
  function mapToNodes(obj) {
    const folders = [];
    const fileNodes = [];

    for (const [name, value] of Object.entries(obj)) {
      if (name === '__file') continue;

      if (value.__file) {
        // Es un archivo
        fileNodes.push({
          name,
          type: 'file',
          file: value.__file,
        });
      } else {
        // Es una carpeta
        folders.push({
          name,
          type: 'folder',
          children: mapToNodes(value),
        });
      }
    }

    // Orden: carpetas primero (alfabético), archivos después (alfabético)
    folders.sort((a, b) => a.name.localeCompare(b.name));
    fileNodes.sort((a, b) => a.name.localeCompare(b.name));

    return [...folders, ...fileNodes];
  }

  return mapToNodes(root);
}

/**
 * Formatea bytes a formato legible.
 *
 * @param {number|null|undefined} bytes
 * @returns {string|null}
 */
export function formatFileSize(bytes) {
  if (bytes == null || bytes === undefined) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
