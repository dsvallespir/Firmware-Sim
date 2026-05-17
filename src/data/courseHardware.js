/*
 * ============================================================
 * courseHardware.js - Hardware requerido por curso
 * ============================================================
 *
 * Datos estáticos del BOM (Bill of Materials) de cada curso.
 * Cursos de puro software tienen un array vacío (no se muestra sección).
 *
 * Estructura de cada item:
 *   name  — nombre del componente
 *   icon  — emoji representativo
 *   note  — nota opcional (versión mínima, alternativa, etc.)
 *   url   — enlace de compra sugerido (null si no aplica)
 */

export const COURSE_HARDWARE = {
  'esp32-firmware': [
    {
      name: 'ESP32 DevKit v1 (o equivalente)',
      icon: '🔌',
      note: 'ESP32-WROOM-32 recomendado',
      url: 'https://www.amazon.com/s?k=esp32+devkit',
    },
    {
      name: 'Cable USB-A a micro-USB',
      icon: '🔗',
      note: null,
      url: null,
    },
    {
      name: 'Protoboard 400 puntos + jumpers',
      icon: '🧩',
      note: null,
      url: null,
    },
    {
      name: 'LEDs, resistencias 220Ω, sensor DHT22',
      icon: '⚡',
      note: 'Kit básico de electrónica',
      url: null,
    },
  ],

  'stm32-firmware': [
    {
      name: 'STM32 Nucleo-F401RE (o F446RE)',
      icon: '🔌',
      note: 'ST-Link integrado — no necesita programador externo',
      url: 'https://www.st.com/en/evaluation-tools/nucleo-f401re.html',
    },
    {
      name: 'Cable USB-A a mini-USB',
      icon: '🔗',
      note: null,
      url: null,
    },
    {
      name: 'Protoboard + jumpers hembra-macho',
      icon: '🧩',
      note: null,
      url: null,
    },
  ],

  'fpga-vhdl': [
    {
      name: 'Tang Nano 20K',
      icon: '🔌',
      note: 'FPGA Gowin GW2AR-18 — exactamente la placa del curso',
      url: 'https://www.aliexpress.com/w/wholesale-tang-nano-20k.html',
    },
    {
      name: 'Cable USB-C',
      icon: '🔗',
      note: 'Para programación y alimentación',
      url: null,
    },
    {
      name: 'Pantalla VGA (opcional)',
      icon: '🖥️',
      note: 'Para los módulos de VGA del curso',
      url: null,
    },
  ],

  'raspberry-pi-systems': [
    {
      name: 'Raspberry Pi 4 Model B (2 GB o más)',
      icon: '🔌',
      note: 'También compatible con Pi 3B+',
      url: 'https://www.raspberrypi.com/products/raspberry-pi-4-model-b/',
    },
    {
      name: 'Tarjeta microSD 16 GB+ (Class 10 / U1)',
      icon: '💾',
      note: 'Se recomienda Samsung Endurance o SanDisk',
      url: null,
    },
    {
      name: 'Fuente de alimentación 5 V / 3 A USB-C',
      icon: '⚡',
      note: 'Oficial de Raspberry Pi o equivalente',
      url: null,
    },
    {
      name: 'Disipador + ventilador (opcional)',
      icon: '🌬️',
      note: 'Recomendado para uso continuo',
      url: null,
    },
  ],

  // Cursos de software puro — sin hardware requerido
  'tcp-ip-linux-c':   [],
  'computer-vision':  [],
  'blockchain-cpp':   [],
};
