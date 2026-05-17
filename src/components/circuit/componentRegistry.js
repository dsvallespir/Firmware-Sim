/*
 * componentRegistry.js
 * --------------------
 * Defines every component available in the circuit editor palette.
 *
 * Each entry:
 *   paletteId    – unique ID used by the palette (not the diagram ID)
 *   type         – wokwi element tag name  (e.g. "wokwi-led")
 *   label        – human-readable name
 *   category     – palette category header
 *   color        – accent colour for the palette card
 *   defaultAttrs – initial attrs object merged into the diagram part
 */

export const COMPONENT_CATEGORIES = [
  'Microcontroladores',
  'Salidas',
  'Entradas',
  'Sensores',
  'Visualización',
  'Actuadores',
  'Pasivos',
  'Almacenamiento',
  'Comunicación',
];

/** @type {Array<{paletteId:string, type:string, label:string, category:string, color:string, defaultAttrs?:object}>} */
export const PALETTE_COMPONENTS = [
  // ── Microcontroladores ───────────────────────────────────────────────────
  {
    paletteId: 'arduino-uno',
    type: 'wokwi-arduino-uno',
    label: 'Arduino Uno',
    category: 'Microcontroladores',
    color: '#3b82f6',
    defaultAttrs: {},
  },
  {
    paletteId: 'arduino-nano',
    type: 'wokwi-arduino-nano',
    label: 'Arduino Nano',
    category: 'Microcontroladores',
    color: '#3b82f6',
    defaultAttrs: {},
  },
  {
    paletteId: 'arduino-mega',
    type: 'wokwi-arduino-mega',
    label: 'Arduino Mega 2560',
    category: 'Microcontroladores',
    color: '#3b82f6',
    defaultAttrs: {},
  },

  // ── Salidas ──────────────────────────────────────────────────────────────
  {
    paletteId: 'led-red',
    type: 'wokwi-led',
    label: 'LED Rojo',
    category: 'Salidas',
    color: '#ef4444',
    defaultAttrs: { color: 'red' },
  },
  {
    paletteId: 'led-green',
    type: 'wokwi-led',
    label: 'LED Verde',
    category: 'Salidas',
    color: '#22c55e',
    defaultAttrs: { color: 'limegreen' },
  },
  {
    paletteId: 'led-blue',
    type: 'wokwi-led',
    label: 'LED Azul',
    category: 'Salidas',
    color: '#3b82f6',
    defaultAttrs: { color: 'dodgerblue' },
  },
  {
    paletteId: 'led-yellow',
    type: 'wokwi-led',
    label: 'LED Amarillo',
    category: 'Salidas',
    color: '#eab308',
    defaultAttrs: { color: 'yellow' },
  },
  {
    paletteId: 'led-white',
    type: 'wokwi-led',
    label: 'LED Blanco',
    category: 'Salidas',
    color: '#e2e8f0',
    defaultAttrs: { color: 'white' },
  },
  {
    paletteId: 'rgb-led',
    type: 'wokwi-rgb-led',
    label: 'LED RGB',
    category: 'Salidas',
    color: '#a855f7',
    defaultAttrs: {},
  },

  // ── Entradas ─────────────────────────────────────────────────────────────
  {
    paletteId: 'pushbutton',
    type: 'wokwi-pushbutton',
    label: 'Pulsador',
    category: 'Entradas',
    color: '#06b6d4',
    defaultAttrs: { color: '#b3b3b3' },
  },
  {
    paletteId: 'pushbutton-6mm',
    type: 'wokwi-pushbutton-6mm',
    label: 'Pulsador 6mm',
    category: 'Entradas',
    color: '#06b6d4',
    defaultAttrs: {},
  },
  {
    paletteId: 'potentiometer',
    type: 'wokwi-potentiometer',
    label: 'Potenciómetro',
    category: 'Entradas',
    color: '#06b6d4',
    defaultAttrs: {},
  },
  {
    paletteId: 'slide-switch',
    type: 'wokwi-slide-switch',
    label: 'Switch Deslizante',
    category: 'Entradas',
    color: '#06b6d4',
    defaultAttrs: {},
  },
  {
    paletteId: 'slide-potentiometer',
    type: 'wokwi-slide-potentiometer',
    label: 'Potenciómetro Deslizante',
    category: 'Entradas',
    color: '#06b6d4',
    defaultAttrs: {},
  },

  // ── Sensores ─────────────────────────────────────────────────────────────
  {
    paletteId: 'dht22',
    type: 'wokwi-dht22',
    label: 'DHT22 Temperatura/Humedad',
    category: 'Sensores',
    color: '#10b981',
    defaultAttrs: {},
  },
  {
    paletteId: 'hc-sr04',
    type: 'wokwi-hc-sr04',
    label: 'HC-SR04 Ultrasónico',
    category: 'Sensores',
    color: '#10b981',
    defaultAttrs: {},
  },
  {
    paletteId: 'ntc',
    type: 'wokwi-ntc-temperature-sensor',
    label: 'Sensor NTC (Temperatura)',
    category: 'Sensores',
    color: '#10b981',
    defaultAttrs: {},
  },
  {
    paletteId: 'pir',
    type: 'wokwi-pir-motion-sensor',
    label: 'Sensor PIR (Movimiento)',
    category: 'Sensores',
    color: '#10b981',
    defaultAttrs: {},
  },

  // ── Visualización ─────────────────────────────────────────────────────────
  {
    paletteId: '7segment',
    type: 'wokwi-7segment',
    label: 'Display 7 Segmentos',
    category: 'Visualización',
    color: '#f59e0b',
    defaultAttrs: { color: '#ff2500' },
  },
  {
    paletteId: 'lcd1602',
    type: 'wokwi-lcd1602',
    label: 'LCD 16×2',
    category: 'Visualización',
    color: '#f59e0b',
    defaultAttrs: {},
  },
  {
    paletteId: 'ili9341',
    type: 'wokwi-ili9341',
    label: 'TFT ILI9341 (240×320)',
    category: 'Visualización',
    color: '#0ea5e9',
    defaultAttrs: {},
  },
  {
    paletteId: 'ssd1306',
    type: 'wokwi-ssd1306',
    label: 'OLED SSD1306 (128×64)',
    category: 'Visualización',
    color: '#6366f1',
    defaultAttrs: {},
  },
  {
    paletteId: 'microsd',
    type: 'wokwi-microsd-card',
    label: 'Tarjeta MicroSD',
    category: 'Almacenamiento',
    color: '#78716c',
    defaultAttrs: {},
  },

  // ── Actuadores ───────────────────────────────────────────────────────────
  {
    paletteId: 'servo',
    type: 'wokwi-servo',
    label: 'Servo Motor',
    category: 'Actuadores',
    color: '#f97316',
    defaultAttrs: {},
  },
  {
    paletteId: 'buzzer',
    type: 'wokwi-buzzer',
    label: 'Buzzer',
    category: 'Actuadores',
    color: '#8b5cf6',
    defaultAttrs: {},
  },

  // ── Pasivos ───────────────────────────────────────────────────────────────
  {
    paletteId: 'resistor-220',
    type: 'wokwi-resistor',
    label: 'Resistor 220 Ω',
    category: 'Pasivos',
    color: '#94a3b8',
    defaultAttrs: { value: '220' },
  },
  {
    paletteId: 'resistor-1k',
    type: 'wokwi-resistor',
    label: 'Resistor 1 kΩ',
    category: 'Pasivos',
    color: '#94a3b8',
    defaultAttrs: { value: '1000' },
  },
  {
    paletteId: 'resistor-10k',
    type: 'wokwi-resistor',
    label: 'Resistor 10 kΩ',
    category: 'Pasivos',
    color: '#94a3b8',
    defaultAttrs: { value: '10000' },
  },

  // ── Visualización adicional ────────────────────────────────────────────────
  {
    paletteId: 'lcd2004',
    type: 'wokwi-lcd2004',
    label: 'LCD 20×4 (I²C)',
    category: 'Visualización',
    color: '#f59e0b',
    defaultAttrs: { i2cAddress: '0x27' },
  },
  {
    paletteId: 'led-bar-graph',
    type: 'wokwi-led-bar-graph',
    label: 'LED Bar Graph (10)',
    category: 'Visualización',
    color: '#ef4444',
    defaultAttrs: {},
  },
  {
    paletteId: 'neopixel',
    type: 'wokwi-neopixel',
    label: 'NeoPixel WS2812',
    category: 'Visualización',
    color: '#a855f7',
    defaultAttrs: {},
  },
  {
    paletteId: 'led-ring-12',
    type: 'wokwi-led-ring',
    label: 'LED Ring 12 px',
    category: 'Visualización',
    color: '#a855f7',
    defaultAttrs: { leds: '12' },
  },
  {
    paletteId: 'led-ring-24',
    type: 'wokwi-led-ring',
    label: 'LED Ring 24 px',
    category: 'Visualización',
    color: '#a855f7',
    defaultAttrs: { leds: '24' },
  },
  {
    paletteId: 'neopixel-matrix-8x8',
    type: 'wokwi-neopixel-matrix',
    label: 'NeoPixel Matrix 8×8',
    category: 'Visualización',
    color: '#a855f7',
    defaultAttrs: { width: '8', height: '8' },
  },

  // ── Entradas adicionales ───────────────────────────────────────────────────
  {
    paletteId: 'analog-joystick',
    type: 'wokwi-analog-joystick',
    label: 'Joystick Analógico',
    category: 'Entradas',
    color: '#06b6d4',
    defaultAttrs: {},
  },
  {
    paletteId: 'ky-040',
    type: 'wokwi-ky-040',
    label: 'Encoder KY-040',
    category: 'Entradas',
    color: '#06b6d4',
    defaultAttrs: {},
  },
  {
    paletteId: 'dip-switch-8',
    type: 'wokwi-dip-switch-8',
    label: 'DIP Switch 8 pos.',
    category: 'Entradas',
    color: '#06b6d4',
    defaultAttrs: {},
  },
  {
    paletteId: 'tilt-switch',
    type: 'wokwi-tilt-switch',
    label: 'Tilt Switch',
    category: 'Entradas',
    color: '#06b6d4',
    defaultAttrs: {},
  },

  // ── Sensores adicionales ───────────────────────────────────────────────────
  {
    paletteId: 'photoresistor',
    type: 'wokwi-photoresistor-sensor',
    label: 'Fotorresistencia LDR',
    category: 'Sensores',
    color: '#10b981',
    defaultAttrs: {},
  },
  {
    paletteId: 'big-sound-sensor',
    type: 'wokwi-big-sound-sensor',
    label: 'Sensor Sonido (grande)',
    category: 'Sensores',
    color: '#10b981',
    defaultAttrs: {},
  },
  {
    paletteId: 'small-sound-sensor',
    type: 'wokwi-small-sound-sensor',
    label: 'Sensor Sonido (pequeño)',
    category: 'Sensores',
    color: '#10b981',
    defaultAttrs: {},
  },
  {
    paletteId: 'gas-sensor',
    type: 'wokwi-gas-sensor',
    label: 'Sensor Gas MQ-x',
    category: 'Sensores',
    color: '#10b981',
    defaultAttrs: {},
  },
  {
    paletteId: 'mpu6050',
    type: 'wokwi-mpu6050',
    label: 'MPU-6050 IMU (I²C)',
    category: 'Sensores',
    color: '#10b981',
    defaultAttrs: { i2cAddress: '0x68' },
  },
  {
    paletteId: 'ds1307',
    type: 'wokwi-ds1307',
    label: 'DS1307 RTC (I²C)',
    category: 'Sensores',
    color: '#10b981',
    defaultAttrs: {},
  },
  {
    paletteId: 'hx711',
    type: 'wokwi-hx711',
    label: 'HX711 Celda de Carga',
    category: 'Sensores',
    color: '#10b981',
    defaultAttrs: {},
  },

  // ── Actuadores adicionales ─────────────────────────────────────────────────
  {
    paletteId: 'relay',
    type: 'wokwi-ks2e-m-dc5',
    label: 'Relé KS2E',
    category: 'Actuadores',
    color: '#f97316',
    defaultAttrs: {},
  },
  {
    paletteId: 'stepper-motor',
    type: 'wokwi-stepper-motor',
    label: 'Motor Paso a Paso',
    category: 'Actuadores',
    color: '#f97316',
    defaultAttrs: {},
  },
  {
    paletteId: 'biaxial-stepper',
    type: 'wokwi-biaxial-stepper',
    label: 'Motor Paso a Paso Biaxial',
    category: 'Actuadores',
    color: '#f97316',
    defaultAttrs: {},
  },

  // ── Comunicación ──────────────────────────────────────────────────────────
  {
    paletteId: 'ir-receiver',
    type: 'wokwi-ir-receiver',
    label: 'Receptor IR',
    category: 'Comunicación',
    color: '#64748b',
    defaultAttrs: {},
  },
  {
    paletteId: 'ir-remote',
    type: 'wokwi-ir-remote',
    label: 'Control IR',
    category: 'Comunicación',
    color: '#64748b',
    defaultAttrs: {},
  },
];

/** Lookup by paletteId */
export const getPaletteItem = (paletteId) =>
  PALETTE_COMPONENTS.find((c) => c.paletteId === paletteId) ?? null;
