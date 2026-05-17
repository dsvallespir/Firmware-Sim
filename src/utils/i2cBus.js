/*
 * ============================================================
 * i2cBus.js — Emulación del bus I²C (TWI) del ATmega328P
 * ============================================================
 *
 * Implementa el TWIEventHandler de avr8js actuando como un
 * bus I²C maestro/esclavo multiplexado. Despacha transacciones
 * a slaves registrados por su dirección de 7 bits.
 *
 * Uso:
 *   import { I2CBus } from '../utils/i2cBus';
 *   const bus = new I2CBus(twiPeripheral);
 *   bus.registerSlave(0x27, lcdHandler);
 *
 * Protocolo AVRTWI (avr8js):
 *   El firmware escribe en los registros TWI (TWCR, TWDR, etc.).
 *   La clase AVRTWI procesa los writeHooks y llama a los métodos
 *   del eventHandler en orden:
 *     start(repeated)            → firmware inicia condición START
 *     connectToSlave(addr, write) → firmware envió dirección + R/W
 *     writeByte(value)            → firmware envió un byte de datos
 *     readByte(ack)               → firmware solicita un byte
 *     stop()                      → firmware generó STOP
 *
 *   Cada método debe llamar el complete*() correspondiente en la
 *   instancia AVRTWI para desbloquearlo y continuar la transacción.
 */

// Pines I²C del ATmega328P (números Arduino)
const I2C_SDA = 18; // PC4 / A4
const I2C_SCL = 19; // PC5 / A5
// Ciclos por bit a 100 kHz con CPU a 16 MHz = 160.
// Usamos 20 para simplificar (solo afecta resolución temporal en el Analizador Lógico).
const I2C_CYCLES_PER_BIT = 20;

/**
 * Interfaz que debe implementar cada slave I²C.
 * @typedef {object} I2CSlaveHandler
 * @property {function(number): boolean} onWrite  - Recibe byte; retorna true=ACK, false=NACK
 * @property {function(): number}        onRead   - Retorna el siguiente byte a enviar al master
 * @property {function(): void}          [onStop] - Notificación de condición STOP
 */

export class I2CBus {
  /**
   * @param {import('avr8js').AVRTWI} twi - Instancia AVRTWI de avr8js
   * @param {object} [opts]
   * @param {object} [opts.cpu]             — cpu de avr8js (para leer cpu.cycles)
   * @param {function} [opts.firePinChange] — (pin, value, cycles) => void
   *   Callback para inyectar bordes sintéticos de SDA/SCL en el Analizador Lógico.
   *   AVRTWI controla esos pines directamente sin pasar por portC.addListener.
   */
  constructor(twi, { cpu = null, firePinChange = null } = {}) {
    this._twi = twi;
    this._cpu = cpu;
    this._firePinChange = firePinChange;
    /** @type {Map<number, I2CSlaveHandler>} */
    this._slaves = new Map();
    this._currentSlave = null;
    this._isWrite = false;

    // Registrar este bus como el event handler del periférico TWI
    twi.eventHandler = this;
  }

  /**
   * Genera bordes sintéticos de SCL (pin 19) y SDA (pin 18) para el byte
   * que acaba de ser transferido, visible en el Analizador Lógico.
   * AVRTWI controla SDA/SCL directamente sin pasar por portC.addListener.
   * @param {number} byteValue - Byte transferido (0–255)
   * @param {boolean} ack      - true si la transferencia fue ACK (SDA=LOW en bit 9)
   */
  _fireSyntheticEdges(byteValue, ack) {
    if (!this._firePinChange || !this._cpu) return;
    const fire = this._firePinChange;
    const baseCycles = this._cpu.cycles;
    for (let bit = 7; bit >= 0; bit--) {
      const offset = (7 - bit) * I2C_CYCLES_PER_BIT;
      const sdaBit = (byteValue >> bit) & 1;
      fire(I2C_SDA, sdaBit, baseCycles + offset);
      fire(I2C_SCL, 1,      baseCycles + offset + Math.floor(I2C_CYCLES_PER_BIT / 4));
      fire(I2C_SCL, 0,      baseCycles + offset + Math.floor((I2C_CYCLES_PER_BIT * 3) / 4));
    }
    // Bit 9: ACK (SDA=0) o NACK (SDA=1)
    const ackOffset = 8 * I2C_CYCLES_PER_BIT;
    fire(I2C_SDA, ack ? 0 : 1, baseCycles + ackOffset);
    fire(I2C_SCL, 1,            baseCycles + ackOffset + Math.floor(I2C_CYCLES_PER_BIT / 4));
    fire(I2C_SCL, 0,            baseCycles + ackOffset + Math.floor((I2C_CYCLES_PER_BIT * 3) / 4));
  }

  // ── Slave registry ─────────────────────────────────────────────────────────

  /**
   * Registrar un dispositivo slave en el bus.
   * @param {number} addr7bit - Dirección I²C de 7 bits (ej: 0x27)
   * @param {I2CSlaveHandler} handler
   */
  registerSlave(addr7bit, handler) {
    this._slaves.set(addr7bit, handler);
    console.log(`[I2CBus] Slave registrado en dirección 0x${addr7bit.toString(16).toUpperCase()}`);
  }

  /**
   * Desregistrar un slave del bus.
   * @param {number} addr7bit
   */
  unregisterSlave(addr7bit) {
    this._slaves.delete(addr7bit);
    console.log(`[I2CBus] Slave desregistrado de dirección 0x${addr7bit.toString(16).toUpperCase()}`);
  }

  /**
   * Limpiar todos los slaves (usado en reset del simulador).
   */
  clear() {
    this._slaves.clear();
    this._currentSlave = null;
  }

  // ── TWIEventHandler implementation ─────────────────────────────────────────
  // Estos métodos son llamados sincrónicamente por AVRTWI.tick()
  // dentro del RAF loop → deben ser O(1) y no alojar memoria.

  /** El firmware emitió una condición START (o repeated START). */
  start(/* repeated */) {
    this._currentSlave = null;
    this._twi.completeStart();
  }

  /** El firmware envió la dirección del slave + bit R/W. */
  connectToSlave(addr7bit, write) {
    const slave = this._slaves.get(addr7bit) ?? null;
    this._currentSlave = slave;
    this._isWrite = write;

    // ACK si el slave está registrado, NACK si no hay nadie en esa dirección
    this._twi.completeConnect(slave !== null);
  }

  /** El firmware envió un byte de datos al slave. */
  writeByte(value) {
    let ack = false;
    if (this._currentSlave) {
      try {
        ack = this._currentSlave.onWrite(value);
      } catch (err) {
        console.error('[I2CBus] Error en slave.onWrite:', err);
      }
    }
    this._twi.completeWrite(ack);
    // Inyectar bordes sintéticos para el Analizador Lógico.
    // AVRTWI controla SDA/SCL directamente sin pasar por portC.addListener.
    this._fireSyntheticEdges(value, ack);
  }

  /** El firmware solicita un byte del slave. */
  readByte(ack) {
    let value = 0xff; // pull-up por defecto si no hay slave
    if (this._currentSlave) {
      try {
        value = this._currentSlave.onRead() & 0xff;
      } catch (err) {
        console.error('[I2CBus] Error en slave.onRead:', err);
      }
    }
    this._twi.completeRead(value);
    // ack = true si el master seguirá leyendo (ACK), false si es el último byte (NACK)
    this._fireSyntheticEdges(value, ack);
  }

  /** El firmware emitió una condición STOP. */
  stop() {
    if (this._currentSlave?.onStop) {
      try {
        this._currentSlave.onStop();
      } catch (err) {
        console.error('[I2CBus] Error en slave.onStop:', err);
      }
    }
    this._currentSlave = null;
    this._twi.completeStop();
  }
}
