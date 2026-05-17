/*
 * ============================================================
 * circuitSchema.js — Parser y validador de circuitos JSON
 * ============================================================
 *
 * Define el formato de definición de circuitos para las lecciones.
 * Cada lección puede tener un circuito asociado (campo circuit_json)
 * que describe qué componentes hay y cómo están conectados.
 *
 * Formato compatible conceptualmente con diagram.json de Wokwi,
 * pero simplificado para circuitos predefinidos (no editables).
 *
 * Ejemplo:
 * {
 *   "version": 1,
 *   "board": { "type": "wokwi-arduino-uno" },
 *   "components": [
 *     { "id": "led1", "type": "wokwi-led", "x": 350, "y": 80,
 *       "props": { "color": "red" } }
 *   ],
 *   "wires": [
 *     { "from": ["board", "13"], "to": ["led1", "A"], "color": "green" }
 *   ]
 * }
 */

/**
 * @typedef {object} CircuitBoard
 * @property {string} type - Tag del web component (ej: 'wokwi-arduino-uno')
 * @property {number} [x=0] - Posición X
 * @property {number} [y=0] - Posición Y
 */

/**
 * @typedef {object} CircuitComponent
 * @property {string} id - Identificador único del componente
 * @property {string} type - Tag del web component (ej: 'wokwi-led')
 * @property {number} x - Posición X
 * @property {number} y - Posición Y
 * @property {number} [rotate=0] - Rotación en grados
 * @property {object} [props={}] - Propiedades del web component
 */

/**
 * @typedef {object} CircuitWire
 * @property {[string, string]} from - [componentId, pinName]
 * @property {[string, string]} to - [componentId, pinName]
 * @property {string} [color='green'] - Color del cable
 */

/**
 * @typedef {object} CircuitDefinition
 * @property {number} version - Versión del schema (actualmente 1)
 * @property {CircuitBoard} board - Board principal
 * @property {CircuitComponent[]} components - Componentes externos
 * @property {CircuitWire[]} wires - Conexiones entre pines
 */

// Boards soportados como tags wokwi válidos
const VALID_BOARDS = [
  'wokwi-arduino-uno',
  'wokwi-arduino-nano',
  'wokwi-arduino-mega',
];

/**
 * Parsear y validar un circuit JSON.
 * @param {string|object} input - JSON string o objeto
 * @returns {{ valid: boolean, circuit: CircuitDefinition|null, error: string|null }}
 */
export function parseCircuit(input) {
  try {
    const circuit = typeof input === 'string' ? JSON.parse(input) : input;

    if (!circuit || typeof circuit !== 'object') {
      return { valid: false, circuit: null, error: 'Circuit must be an object' };
    }

    // Validar version
    if (circuit.version !== 1) {
      return { valid: false, circuit: null, error: `Unsupported version: ${circuit.version}` };
    }

    // Validar board
    if (!circuit.board || !circuit.board.type) {
      return { valid: false, circuit: null, error: 'Missing board.type' };
    }
    if (!VALID_BOARDS.includes(circuit.board.type)) {
      return { valid: false, circuit: null, error: `Unknown board: ${circuit.board.type}` };
    }

    // Normalizar board defaults
    circuit.board.x = circuit.board.x ?? 0;
    circuit.board.y = circuit.board.y ?? 0;

    // Aliases comunes para referirse al board en wires
    // Esto permite usar 'board', 'uno', 'nano', 'mega' o el tag completo
    const boardAliases = new Set([
      'board',
      circuit.board.type,                                      // 'wokwi-arduino-uno'
      circuit.board.type.replace('wokwi-arduino-', ''),        // 'uno'
    ]);

    // Validar components
    if (!Array.isArray(circuit.components)) {
      circuit.components = [];
    }
    const ids = new Set(boardAliases); // todos los aliases del board son IDs válidos
    for (const comp of circuit.components) {
      if (!comp.id || !comp.type) {
        return { valid: false, circuit: null, error: `Component missing id or type` };
      }
      if (ids.has(comp.id)) {
        return { valid: false, circuit: null, error: `Duplicate component id: ${comp.id}` };
      }
      ids.add(comp.id);
      comp.x = comp.x ?? 0;
      comp.y = comp.y ?? 0;
      comp.rotate = comp.rotate ?? 0;
      comp.props = comp.props ?? {};
    }

    // Validar wires
    if (!Array.isArray(circuit.wires)) {
      circuit.wires = [];
    }
    for (const wire of circuit.wires) {
      if (!Array.isArray(wire.from) || wire.from.length !== 2) {
        return { valid: false, circuit: null, error: 'Wire.from must be [componentId, pinName]' };
      }
      if (!Array.isArray(wire.to) || wire.to.length !== 2) {
        return { valid: false, circuit: null, error: 'Wire.to must be [componentId, pinName]' };
      }
      if (!ids.has(wire.from[0])) {
        return { valid: false, circuit: null, error: `Wire references unknown component: ${wire.from[0]}` };
      }
      if (!ids.has(wire.to[0])) {
        return { valid: false, circuit: null, error: `Wire references unknown component: ${wire.to[0]}` };
      }
      // Normalizar aliases del board → 'board' canónico
      if (boardAliases.has(wire.from[0])) wire.from[0] = 'board';
      if (boardAliases.has(wire.to[0])) wire.to[0] = 'board';
      wire.color = wire.color ?? 'green';
    }

    return { valid: true, circuit, error: null };
  } catch (e) {
    return { valid: false, circuit: null, error: `JSON parse error: ${e.message}` };
  }
}

/**
 * Buscar a qué pin Arduino está conectado un pin de un componente.
 * Recorre los wires buscando una conexión entre el componente y el board.
 *
 * @param {CircuitWire[]} wires - Array de wires del circuito
 * @param {string} componentId - ID del componente
 * @param {string} pinName - Nombre del pin del componente
 * @returns {string|null} - Pin name del board (ej: "13", "A0", "GND.1") o null
 */
export function findBoardPin(wires, componentId, pinName) {
  for (const wire of wires) {
    // Componente → Board
    if (wire.from[0] === componentId && wire.from[1] === pinName && wire.to[0] === 'board') {
      return wire.to[1];
    }
    // Board → Componente
    if (wire.to[0] === componentId && wire.to[1] === pinName && wire.from[0] === 'board') {
      return wire.from[1];
    }
  }

  // Búsqueda indirecta: componente → otro componente → board
  // (ej: LED → resistencia → board pin 13)
  for (const wire of wires) {
    let intermediateId = null;
    let intermediatePin = null;

    if (wire.from[0] === componentId && wire.to[0] !== 'board') {
      intermediateId = wire.to[0];
      intermediatePin = null; // buscar cualquier pin del intermedio
    } else if (wire.to[0] === componentId && wire.from[0] !== 'board') {
      intermediateId = wire.from[0];
      intermediatePin = null;
    }

    if (intermediateId) {
      // Buscar wire del intermedio al board
      for (const w2 of wires) {
        if (w2.from[0] === intermediateId && w2.to[0] === 'board') {
          return w2.to[1];
        }
        if (w2.to[0] === intermediateId && w2.from[0] === 'board') {
          return w2.from[1];
        }
      }
    }
  }

  return null;
}

/**
 * Convertir un nombre de pin del board a número Arduino.
 * "13" → 13, "A0" → 14, "A5" → 19, "GND.1" → null, etc.
 *
 * @param {string} pinName - Pin name del board
 * @returns {number|null} - Arduino pin number o null para pines especiales
 */
export function boardPinToArduinoNumber(pinName) {
  if (!pinName) return null;

  // Pines especiales (no tienen número Arduino)
  const lower = pinName.toLowerCase();
  if (lower.startsWith('gnd') || lower.startsWith('vcc') ||
      lower.startsWith('5v') || lower.startsWith('3.3v') ||
      lower === 'vin' || lower === 'reset' || lower === 'aref') {
    return null;
  }

  // Normalizar sufijos de pad duplicado: "A5.2" → "A5", "13.1" → "13"
  // El Arduino Uno expone algunos pines en múltiples pads (e.g., A4.1, A4.2, GND.1, GND.2…)
  const normalized = pinName.replace(/\.\d+$/, '');

  // Pines analógicos: A0-A5 → 14-19
  const analogMatch = normalized.match(/^A(\d+)$/i);
  if (analogMatch) {
    return 14 + parseInt(analogMatch[1], 10);
  }

  // Pines digitales directos
  const num = parseInt(normalized, 10);
  if (!isNaN(num) && num >= 0 && num <= 53) {
    return num;
  }

  return null;
}

/**
 * Construir un mapa de conexiones: componentId.pinName → Arduino pin number.
 * Usado por CircuitView para cablear la simulación.
 *
 * @param {CircuitDefinition} circuit
 * @returns {Map<string, number>} - Mapa "compId.pinName" → Arduino pin#
 */
export function buildConnectionMap(circuit) {
  const map = new Map();

  for (const comp of circuit.components) {
    // Para cada wire que toca este componente, resolver el board pin
    for (const wire of circuit.wires) {
      let compPin = null;

      if (wire.from[0] === comp.id) {
        compPin = wire.from[1];
      } else if (wire.to[0] === comp.id) {
        compPin = wire.to[1];
      }

      if (compPin) {
        const boardPin = findBoardPin(circuit.wires, comp.id, compPin);
        const arduinoNum = boardPinToArduinoNumber(boardPin);
        if (arduinoNum !== null) {
          map.set(`${comp.id}.${compPin}`, arduinoNum);
        }
      }
    }
  }

  return map;
}

export default { parseCircuit, findBoardPin, boardPinToArduinoNumber, buildConnectionMap };
