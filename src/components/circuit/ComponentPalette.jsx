/*
 * ComponentPalette.jsx
 * --------------------
 * Collapsible sidebar listing all available circuit components.
 *
 * Interaction:
 *  - Click a component card → dispatches onAdd(type, defaultAttrs) so the
 *    parent can place it at the canvas centre.
 *  - Drag a component card onto the canvas → HTML5 DnD: sets
 *    dataTransfer with "palette-type" and "palette-attrs".
 *
 * Props:
 *   onAdd(type, attrs) – called on click-to-add
 *   collapsed          – hide the panel
 *   onToggle           – toggle collapsed
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight, ChevronLeft, ChevronRight as PanelIcon } from 'lucide-react';
import { COMPONENT_CATEGORIES, PALETTE_COMPONENTS } from './componentRegistry';

// Category accent colours
const CATEGORY_COLORS = {
  'Microcontroladores': 'border-blue-500/40 bg-blue-500/5',
  'Salidas':            'border-emerald-500/40 bg-emerald-500/5',
  'Entradas':           'border-cyan-500/40 bg-cyan-500/5',
  'Sensores':           'border-teal-500/40 bg-teal-500/5',
  'Visualización':      'border-amber-500/40 bg-amber-500/5',
  'Actuadores':         'border-orange-500/40 bg-orange-500/5',
  'Pasivos':            'border-slate-500/40 bg-slate-500/5',
};

function CategorySection({ category, items, onAdd }) {
  const [open, setOpen] = useState(category === 'Microcontroladores' || category === 'Salidas');

  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center w-full gap-1.5 px-2 py-1.5 text-[10px] font-bold
                   text-slate-400 uppercase tracking-widest hover:text-slate-200 transition-colors">
        {open
          ? <ChevronDown className="w-3 h-3 flex-shrink-0" />
          : <ChevronRight className="w-3 h-3 flex-shrink-0" />}
        {category}
      </button>

      {open && (
        <div className="flex flex-col gap-0.5 px-1 pb-1">
          {items.map((comp) => (
            <div
              key={comp.paletteId}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('palette-type', comp.type);
                e.dataTransfer.setData(
                  'palette-attrs',
                  JSON.stringify(comp.defaultAttrs || {}),
                );
                e.dataTransfer.effectAllowed = 'copy';
              }}
              onClick={() => onAdd(comp.type, comp.defaultAttrs || {})}
              title={`Agregar ${comp.label} (o arrastrar al canvas)`}
              className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer
                         select-none border text-[11px] font-medium
                         text-slate-300 hover:text-white transition-colors
                         active:scale-95 ${CATEGORY_COLORS[category] ?? 'border-slate-600/40'}`}
            >
              {/* Colour dot */}
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: comp.color }}
              />
              <span className="truncate leading-tight">{comp.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ComponentPalette({ onAdd, collapsed = false, onToggle }) {
  const [search, setSearch] = useState('');

  const filtered = search.trim()
    ? PALETTE_COMPONENTS.filter((c) =>
        c.label.toLowerCase().includes(search.toLowerCase()),
      )
    : null;

  return (
    <div
      className={`flex flex-col bg-slate-900 border-r border-slate-700
                  transition-all duration-200 flex-shrink-0 overflow-hidden
                  ${collapsed ? 'w-0' : 'w-48'}`}
    >
      {!collapsed && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between px-2 py-2 border-b border-slate-700/60 flex-shrink-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Componentes
            </span>
            <button
              onClick={onToggle}
              className="p-0.5 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-700"
              title="Ocultar paleta"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Search */}
          <div className="px-2 py-1.5 border-b border-slate-700/40 flex-shrink-0">
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-800 text-slate-200 text-[11px] rounded px-2 py-1
                         border border-slate-700 focus:border-emerald-500 focus:outline-none
                         placeholder:text-slate-600"
            />
          </div>

          {/* Hint */}
          <div className="px-2 py-1 border-b border-slate-700/30 flex-shrink-0">
            <p className="text-[9px] text-slate-600 leading-tight">
              Clic para agregar · Arrastrar al canvas para posicionar
            </p>
          </div>

          {/* Component list */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden py-1">
            {filtered ? (
              /* Flat search results */
              filtered.length === 0 ? (
                <p className="px-3 py-4 text-[11px] text-slate-600 text-center">
                  Sin resultados
                </p>
              ) : (
                <div className="flex flex-col gap-0.5 px-1">
                  {filtered.map((comp) => (
                    <div
                      key={comp.paletteId}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('palette-type', comp.type);
                        e.dataTransfer.setData(
                          'palette-attrs',
                          JSON.stringify(comp.defaultAttrs || {}),
                        );
                        e.dataTransfer.effectAllowed = 'copy';
                      }}
                      onClick={() => onAdd(comp.type, comp.defaultAttrs || {})}
                      className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer
                                 select-none border border-slate-600/40 text-[11px] font-medium
                                 text-slate-300 hover:text-white transition-colors active:scale-95"
                    >
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: comp.color }} />
                      <span className="truncate">{comp.label}</span>
                    </div>
                  ))}
                </div>
              )
            ) : (
              /* Categorised view */
              COMPONENT_CATEGORIES.map((cat) => {
                const items = PALETTE_COMPONENTS.filter((c) => c.category === cat);
                if (items.length === 0) return null;
                return (
                  <CategorySection
                    key={cat}
                    category={cat}
                    items={items}
                    onAdd={onAdd}
                  />
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
