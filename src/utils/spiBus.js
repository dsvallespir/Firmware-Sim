/*
 * ============================================================
 * spiBus.js — Multiplexor del bus SPI para AVRSPI (avr8js)
 * ============================================================
 *
 * Implementa un despachador de bytes SPI que conecta el periférico
 * AVRSPI del ATmega328P con múltiples dispositivos SPI virtuales,
 * seleccionados por su pin CS (Chip Select) individual.
 *
 * Protocolo SPI:
 *   - Cada dispositivo tiene un pin CS dedicado.
 *   - CS LOW  → dispositivo seleccionado (onSelect)
 *   - CS HIGH → dispositivo deseleccionado (onDeselect)
 *   - Mientras CS está LOW, cada byte escrito en SPDR se despacha
 *     vía onByte(value) y el dispositivo retorna el byte MISO.
 *
 * Contrato del handler de dispositivo SPI:
 * ─────────────────────────────────────────
 * {
 *   onByte(value: number): number   — Recibe byte MOSI, retorna byte MISO
 *   onSelect(): void                — CS bajó a LOW
 *   onDeselect(): void              — CS volvió a HIGH
 * }
 *
 * Integración con avr8js:
 *   - AVRSPI.onByte(value) se llama cuando el sketch escribe en SPDR.
 *   - SpiBus sobreescribe AVRSPI.onByte para despachar al dispositivo activo.
 *   - completeTransfer(miso) debe llamarse sincrónicamente para desbloquear el CPU.
 *   - Los cambios de pin CS se detectan via registerPinListener del hook.
 */

// Pines SPI del ATmega328P (números Arduino)
const SPI_SCK  = 13;  // PB5
const SPI_MOSI = 11;  // PB3
const SPI_MISO = 12;  // PB4
// Ciclos estimados por byte a FOSC/4 (4 MHz): 8 bits × 4 ciclos/bit = 32 ciclos
const CYCLES_PER_BIT = 4;

export class SpiBus {
  /**
   * @param {object} spi             — Instancia de AVRSPI (avr8js)
   * @param {object} [opts]
   * @param {object} [opts.cpu]          — cpu de avr8js (para leer cpu.cycles)
   * @param {function} [opts.firePinChange] — (pin, value, cycles) => void
   *   Callback para inyectar bordes sintéticos de SCK/MOSI en el sistema de
   *   listeners de pines (usado por el Analizador Lógico). Sin esto, las
   *   señales SPI no son visibles porque el periférico AVRSPI no pasa por
   *   portB.addListener.
   */
  constructor(spi, { cpu = null, firePinChange = null } = {}) {
    this._spi = spi;
    this._cpu = cpu;
    this._firePinChange = firePinChange;
    // Map<csPin, { handler, cleanupPinListener }>
    this._devices = new Map();
    this._activeDevice = null;

    // Hook AVRSPI.onByte — llamado sincrónicamente cuando sketch escribe SPDR
    spi.onByte = (value) => {
      const miso = this._activeDevice?.onByte(value) ?? 0xFF;
      spi.completeTransfer(miso);
      // Generar bordes sintéticos de SCK y MOSI para el Analizador Lógico.
      // El periférico AVRSPI controla SCK/MOSI directamente sin pasar por
      // portB.addListener, por lo que sin este paso esos pines son invisibles
      // para el logic analyzer y el modo sonda.
      this._fireSyntheticEdges(value);
    };
  }

  /**
   * Genera bordes sintéticos de SCK (pin 13) y MOSI (pin 11) para el byte
   * que acaba de ser transferido.
   * Distribuye los 8 flancos de reloj en ventanas de CYCLES_PER_BIT ciclos
   * hacia atrás desde el ciclo actual.
   */
  _fireSyntheticEdges(mosiValue) {
    if (!this._firePinChange || !this._cpu) return;
    const fire = this._firePinChange;
    const baseCycles = this._cpu.cycles;
    // Bit MSB primero (modo SPI 0 por defecto)
    for (let bit = 7; bit >= 0; bit--) {
      const offset = (7 - bit) * CYCLES_PER_BIT;
      const mosiBit = (mosiValue >> bit) & 1;
      // MOSI cambia antes del flanco de subida del reloj
      fire(SPI_MOSI, mosiBit,     baseCycles + offset);
      // SCK flanco de subida
      fire(SPI_SCK,  1,           baseCycles + offset + 1);
      // SCK flanco de bajada
      fire(SPI_SCK,  0,           baseCycles + offset + 3);
    }
  }

  /**
   * Registra un dispositivo SPI.
   * @param {number|null} csPin           - Pin Arduino del CS (null = sin CS = siempre activo)
   * @param {object}      handler         - { onByte, onSelect?, onDeselect? }
   * @param {function}    registerPinListener - Función del hook para suscribirse a cambios de pin
   */
  registerDevice(csPin, handler, registerPinListener) {
    let cleanupPinListener = null;

    if (csPin != null && registerPinListener) {
      // Escuchar flancos en el pin CS
      cleanupPinListener = registerPinListener((pin, value) => {
        if (pin !== csPin) return;

        if (!value) {
          // CS → LOW: seleccionar dispositivo
          this._activeDevice = handler;
          handler.onSelect?.();
        } else {
          // CS → HIGH: deseleccionar dispositivo
          if (this._activeDevice === handler) {
            handler.onDeselect?.();
            this._activeDevice = null;
          }
        }
      });
    } else if (csPin == null) {
      // Sin CS: siempre activo
      this._activeDevice = handler;
    }

    this._devices.set(csPin, { handler, cleanupPinListener });
  }

  /**
   * Desregistra un dispositivo SPI y elimina su listener de pin CS.
   * @param {number|null} csPin
   */
  unregisterDevice(csPin) {
    const entry = this._devices.get(csPin);
    if (!entry) return;

    entry.cleanupPinListener?.();

    if (this._activeDevice === entry.handler) {
      this._activeDevice = null;
    }

    this._devices.delete(csPin);
  }

  /**
   * Eliminar todos los dispositivos registrados.
   * Llamado en sim.reset() antes de recrear AVRSPI.
   */
  clear() {
    for (const [, entry] of this._devices) {
      entry.cleanupPinListener?.();
    }
    this._devices.clear();
    this._activeDevice = null;
  }
}
