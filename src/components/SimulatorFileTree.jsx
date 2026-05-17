/*
 * ============================================================
 * SimulatorFileTree.jsx - Árbol de archivos para el simulador
 * ============================================================
 *
 * Versión compacta del árbol de CodeExplorer, adaptada al tema
 * slate del simulador. Reutiliza buildFileTree() de fileTreeUtils.
 *
 * Props:
 *   codeFiles:    Array<{ slug, filename, relative_path, ... }>
 *   selectedSlug: string | null — Slug del archivo activo
 *   onSelectFile: (file) => void
 */

import { useState } from 'react';
import {
  FolderOpen, Folder, FileCode2,
  ChevronRight, ChevronDown,
} from 'lucide-react';
import { buildFileTree, resolveCodeLanguage } from '../lib/fileTreeUtils';

// ----------------------------------------------------------
// Nodo carpeta (recursivo, expandible)
// ----------------------------------------------------------
function FolderNode({ node, selectedSlug, onSelect, depth = 0 }) {
  const [expanded, setExpanded] = useState(depth < 2);

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 w-full text-left px-1.5 py-1
                   text-xs text-slate-400 hover:bg-slate-700/50 rounded
                   transition-colors"
        style={{ paddingLeft: `${depth * 10 + 6}px` }}
      >
        {expanded
          ? <ChevronDown className="w-3 h-3 text-slate-500 flex-shrink-0" />
          : <ChevronRight className="w-3 h-3 text-slate-500 flex-shrink-0" />}
        {expanded
          ? <FolderOpen className="w-3.5 h-3.5 text-yellow-400/70 flex-shrink-0" />
          : <Folder className="w-3.5 h-3.5 text-yellow-400/50 flex-shrink-0" />}
        <span className="truncate font-medium">{node.name}/</span>
      </button>
      {expanded && node.children?.map((child) => (
        <TreeNode
          key={child.name}
          node={child}
          selectedSlug={selectedSlug}
          onSelect={onSelect}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

// ----------------------------------------------------------
// Nodo archivo
// ----------------------------------------------------------
function FileNode({ node, selectedSlug, onSelect, depth = 0 }) {
  const isSelected = selectedSlug === node.file?.slug;
  const lang = resolveCodeLanguage(node.file);

  // Icono especial para .ino
  const isIno = node.name.endsWith('.ino');

  return (
    <button
      onClick={() => onSelect(node.file)}
      className={`flex items-center gap-1 w-full text-left px-1.5 py-1
                  text-xs rounded transition-colors ${
                    isSelected
                      ? 'bg-emerald-500/15 text-emerald-300 font-medium'
                      : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
                  }`}
      style={{ paddingLeft: `${depth * 10 + 6}px` }}
    >
      <FileCode2 className={`w-3.5 h-3.5 flex-shrink-0 ${
        isSelected ? 'text-emerald-400' : isIno ? 'text-sky-400/60' : 'text-slate-500'
      }`} />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

// ----------------------------------------------------------
// Nodo genérico (dispatch)
// ----------------------------------------------------------
function TreeNode({ node, selectedSlug, onSelect, depth = 0 }) {
  if (node.type === 'folder') {
    return (
      <FolderNode
        node={node}
        selectedSlug={selectedSlug}
        onSelect={onSelect}
        depth={depth}
      />
    );
  }
  return (
    <FileNode
      node={node}
      selectedSlug={selectedSlug}
      onSelect={onSelect}
      depth={depth}
    />
  );
}

// ----------------------------------------------------------
// Componente principal
// ----------------------------------------------------------
export default function SimulatorFileTree({
  codeFiles = [],
  selectedSlug = null,
  onSelectFile,
}) {
  const tree = buildFileTree(codeFiles);

  if (tree.length === 0) {
    return (
      <div className="p-3 text-xs text-slate-500 text-center">
        Sin archivos
      </div>
    );
  }

  return (
    <div className="p-1 space-y-0.5">
      {tree.map((node) => (
        <TreeNode
          key={node.name}
          node={node}
          selectedSlug={selectedSlug}
          onSelect={onSelectFile}
        />
      ))}
    </div>
  );
}
