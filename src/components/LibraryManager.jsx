/*
 * LibraryManager.jsx
 * ------------------
 * Panel de selección de bibliotecas externas Arduino.
 * Muestra las bibliotecas permitidas agrupadas por categoría,
 * con buscador y checkboxes. Las selecciones se envían con el
 * request de compilación.
 *
 * Props:
 *   selectedLibs  : string[]           — bibliotecas seleccionadas
 *   onChange      : (libs: string[]) => void
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Package, Search, ChevronDown, ChevronRight, CheckSquare, Square } from 'lucide-react';
import api from '../lib/api';

// Fallback local si la API no responde
const FALLBACK_CATEGORIES = {
  'Sensores':           ['DHT sensor library', 'Adafruit Unified Sensor', 'OneWire', 'DallasTemperature', 'HCSR04'],
  'Pantallas':          ['Adafruit GFX Library', 'Adafruit ILI9341', 'Adafruit SSD1306', 'Adafruit ST7735 and ST7789 Library', 'U8g2'],
  'I2C / LCD':          ['LiquidCrystal I2C', 'Adafruit BusIO'],
  'Motores / Servos':   ['Servo', 'Stepper', 'AccelStepper'],
  'Almacenamiento':     ['SD'],
  'Comunicación':       ['IRremote', 'PubSubClient', 'ArduinoJson'],
  'LEDs':               ['FastLED', 'Adafruit NeoPixel'],
  'Otros':              ['Keypad', 'RTClib', 'TimeLib'],
};

export default function LibraryManager({ selectedLibs = [], onChange }) {
  const [categories, setCategories]     = useState(null);  // null = cargando
  const [search, setSearch]             = useState('');
  const [collapsed, setCollapsed]       = useState({});     // { [cat]: bool }

  // ── Cargar lista desde backend ────────────────────────────────────────
  useEffect(() => {
    api.get('/compile/libraries')
      .then(({ data }) => setCategories(data))
      .catch(() => {
        // Fallback: convertir estructura simple a formato con {name, installed}
        const fallback = {};
        for (const [cat, libs] of Object.entries(FALLBACK_CATEGORIES)) {
          fallback[cat] = libs.map(name => ({ name, installed: false }));
        }
        setCategories(fallback);
      });
  }, []);

  // ── Filtrado por búsqueda ─────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!categories) return {};
    const q = search.trim().toLowerCase();
    if (!q) return categories;
    const result = {};
    for (const [cat, libs] of Object.entries(categories)) {
      const matching = libs.filter(l => l.name.toLowerCase().includes(q));
      if (matching.length) result[cat] = matching;
    }
    return result;
  }, [categories, search]);

  // ── Toggle una biblioteca ─────────────────────────────────────────────
  const toggle = useCallback((name) => {
    if (selectedLibs.includes(name)) {
      onChange(selectedLibs.filter(l => l !== name));
    } else {
      onChange([...selectedLibs, name]);
    }
  }, [selectedLibs, onChange]);

  // ── Toggle colapso de categoría ───────────────────────────────────────
  const toggleCat = useCallback((cat) => {
    setCollapsed(prev => ({ ...prev, [cat]: !prev[cat] }));
  }, []);

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-slate-900/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-slate-700/60 flex-shrink-0">
        <Package className="w-3 h-3 text-amber-400 flex-shrink-0" />
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          Bibliotecas
        </span>
        {selectedLibs.length > 0 && (
          <span className="ml-auto text-[9px] text-amber-400 font-semibold bg-amber-400/10 px-1.5 py-0.5 rounded">
            {selectedLibs.length}
          </span>
        )}
      </div>

      {/* Search */}
      <div className="px-2 py-1.5 flex-shrink-0 border-b border-slate-700/40">
        <div className="flex items-center gap-1 bg-slate-800 rounded px-1.5 py-1">
          <Search className="w-3 h-3 text-slate-500 flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="bg-transparent text-[10px] text-slate-300 placeholder-slate-600 outline-none w-full min-w-0"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-slate-900 scrollbar-thumb-slate-700">
        {categories === null ? (
          <div className="flex items-center justify-center py-4">
            <span className="text-[10px] text-slate-600 animate-pulse">Cargando...</span>
          </div>
        ) : Object.keys(filtered).length === 0 ? (
          <div className="px-3 py-3 text-[10px] text-slate-600 text-center">
            {search ? 'Sin resultados' : 'Sin bibliotecas'}
          </div>
        ) : (
          Object.entries(filtered).map(([cat, libs]) => (
            <div key={cat}>
              {/* Category header */}
              <button
                onClick={() => toggleCat(cat)}
                className="w-full flex items-center gap-1 px-2 py-1 text-[9px] font-bold
                           uppercase tracking-widest text-slate-500 hover:text-slate-400
                           hover:bg-slate-800/40 transition-colors"
              >
                {collapsed[cat]
                  ? <ChevronRight className="w-3 h-3 flex-shrink-0" />
                  : <ChevronDown  className="w-3 h-3 flex-shrink-0" />
                }
                {cat}
              </button>

              {/* Libraries */}
              {!collapsed[cat] && libs.map(({ name, installed }) => {
                const isSelected = selectedLibs.includes(name);
                return (
                  <button
                    key={name}
                    onClick={() => toggle(name)}
                    className={`w-full flex items-start gap-1.5 px-3 py-1 text-left transition-colors
                               hover:bg-slate-800/60
                               ${isSelected ? 'bg-amber-400/5' : ''}`}
                  >
                    {isSelected
                      ? <CheckSquare className="w-3 h-3 text-amber-400 flex-shrink-0 mt-px" />
                      : <Square      className="w-3 h-3 text-slate-600 flex-shrink-0 mt-px" />
                    }
                    <span className={`text-[10px] leading-tight ${isSelected ? 'text-amber-300' : 'text-slate-400'}`}>
                      {name}
                      {installed && !isSelected && (
                        <span className="ml-1 text-[8px] text-emerald-600">✓</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Footer: selected count + clear */}
      {selectedLibs.length > 0 && (
        <div className="flex items-center justify-between px-2 py-1 border-t border-slate-700/60 flex-shrink-0">
          <span className="text-[9px] text-slate-500">{selectedLibs.length} seleccionada{selectedLibs.length !== 1 ? 's' : ''}</span>
          <button
            onClick={() => onChange([])}
            className="text-[9px] text-slate-500 hover:text-red-400 transition-colors"
          >
            Limpiar
          </button>
        </div>
      )}
    </div>
  );
}
