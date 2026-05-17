/*
 * ============================================================
 * pcf8574Lcd.js — Emulación del adaptador I²C PCF8574 para LCD HD44780
 * ============================================================
 *
 * Implementa un slave I²C (dirección configurable, típicamente 0x27)
 * que decodifica el protocolo del expansor de bus PCF8574 y lo
 * traduce a comandos del controlador LCD HD44780 en modo 4 bits.
 *
 * El adaptador PCF8574 conecta sus 8 pines de expansión al LCD así:
 *
 *   Bit  7  6  5  4  3   2   1   0
 *        D7 D6 D5 D4 BL  EN  RW  RS
 *
 *   BL = Backlight (1 = encendido)
 *   EN = Enable pulse (flanco ↓ captura el nibble)
 *   RW = Read/Write (0 = escribir al LCD — lo más común)
 *   RS = Register Select (0 = comando, 1 = dato de carácter)
 *
 * Protocolo de transferencia:
 *   Para enviar 1 byte al HD44780 en modo 4 bits se necesitan
 *   4 bytes I²C (2 nibbles × 2 pulsos EN por nibble):
 *     1. nibble alto + RS + BL, EN=1
 *     2. nibble alto + RS + BL, EN=0  ← flanco ↓ captura nibble
 *     3. nibble bajo + RS + BL, EN=1
 *     4. nibble bajo + RS + BL, EN=0  ← flanco ↓ captura nibble
 *
 *   La librería LiquidCrystal_I2C (Arduino) usa exactamente este formato.
 *
 * Comandos HD44780 implementados:
 *   0x01        Clear Display
 *   0x02        Return Home
 *   0x04..0x07  Entry Mode Set  (ignorado — asumimos incremento automático)
 *   0x08..0x0F  Display On/Off Control  (on/off, cursor, blink)
 *   0x10..0x1F  Cursor/Display Shift    (ignorado)
 *   0x20..0x3F  Function Set            (4-bit o 8-bit — solo registramos)
 *   0x40..0x7F  Set CGRAM Address       (ignorado — CGRAM no simulada)
 *   0x80..0xFF  Set DDRAM Address       → mueve cursor a posición
 *   RS=1        Dato de carácter        → escribe en la posición actual
 *
 * Mapeado DDRAM → posición en pantalla (16×2):
 *   Fila 0: DDRAM 0x00–0x0F
 *   Fila 1: DDRAM 0x40–0x4F
 *
 * El elemento visual wokwi-lcd1602 expone:
 *   .characters  Uint8Array[32] con los códigos de los 32 caracteres visibles
 *   .cursor      boolean
 *   .blink       boolean
 *   .cursorX     número 0-15
 *   .cursorY     número 0-1
 *   .backlight   boolean
 */

/** Dirección I²C por defecto del módulo PCF8574 + LCD 1602 */
export const DEFAULT_LCD_ADDR = 0x27;

/** Máxima columna visible */
const COLS = 16;
/** Máximas filas visibles */
const ROWS = 2;

/**
 * Convierte dirección DDRAM a [col, row] visibles.
 * Retorna null si la dirección está fuera del área visible.
 * @param {number} ddramAddr
 * @returns {[number, number] | null}
 */
function ddramToPos(ddramAddr) {
  if (ddramAddr >= 0x00 && ddramAddr <= 0x0F) return [ddramAddr,        0];
  if (ddramAddr >= 0x40 && ddramAddr <= 0x4F) return [ddramAddr - 0x40, 1];
  return null; // Fuera del área visible (solo tenemos 16×2)
}

export class PCF8574LCD {
  /**
   * @param {HTMLElement} lcdElement - Instancia del Web Component wokwi-lcd1602
   * @param {number} [addr=0x27]     - Dirección I²C de 7 bits
   */
  constructor(lcdElement, addr = DEFAULT_LCD_ADDR) {
    this.element = lcdElement;
    this.addr    = addr;

    // Estado interno del HD44780
    this._characters  = new Uint8Array(COLS * ROWS); // 32 posiciones
    this._ddramAddr   = 0;    // Dirección DDRAM actual (0x00-0x27 o 0x40-0x67)
    this._displayOn   = true;
    this._cursorOn    = false;
    this._blinkOn     = false;
    this._backlight   = true;

    // Máquina de estados del decodificador 4-bit
    // El PCF8574 envía cada byte en 4 escrituras I²C; capturamos solo las
    // que tienen EN=0 (flanco descendente) con el nibble ya estable.
    // Estado: null = esperando nibble alto, number = nibble alto guardado
    this._highNibble  = null; // número 0-15 o null
    this._highRS      = false;
    this._highBL      = true;

    // Señal EN anterior para detectar flancos descendentes
    this._prevEN      = false;

    // Aplicar estado inicial al elemento visual
    this._flushToElement();
  }

  // ── I2CSlaveHandler protocol ──────────────────────────────────────────────

  /**
   * Llamado por I2CBus cuando el master escribe un byte al slave.
   * @param {number} byte - Byte recibido del PCF8574 (8 bits)
   * @returns {boolean} true = ACK
   */
  onWrite(byte) {
    const d7d4 = (byte >> 4) & 0x0F; // nibble de datos en los 4 bits altos
    const bl   = !!(byte & 0x08);    // bit 3 = Backlight
    const en   = !!(byte & 0x04);    // bit 2 = Enable
    // const rw = !!(byte & 0x02);   // bit 1 = RW (ignorado, siempre escribimos)
    const rs   = !!(byte & 0x01);    // bit 0 = RS

    // Detectar flanco DESCENDENTE de EN (1→0) para capturar nibble
    if (this._prevEN && !en) {
      if (this._highNibble === null) {
        // Es el nibble alto — guardarlo
        this._highNibble = d7d4;
        this._highRS     = rs;
        this._highBL     = bl;
      } else {
        // Es el nibble bajo — tenemos el byte completo
        const fullByte = (this._highNibble << 4) | d7d4;
        this._processHD44780(fullByte, this._highRS, bl);
        this._highNibble = null;
      }
    }

    // Actualizar backlight en cada byte (puede cambiar sin nibble completo)
    if (this._backlight !== bl) {
      this._backlight = bl;
      if (this.element) this.element.backlight = bl;
    }

    this._prevEN = en;
    return true; // Siempre ACK
  }

  /** Lectura no implementada (LiquidCrystal_I2C nunca lee del LCD). */
  onRead() { return 0x00; }

  /** Fin de transacción I²C — resetear estado de nibble por seguridad. */
  onStop() {
    // Si quedó un nibble alto huérfano (secuencia incompleta), descartar
    this._highNibble = null;
    this._prevEN     = false;
  }

  // ── Decodificador HD44780 ─────────────────────────────────────────────────

  /**
   * Procesa un byte de comando o dato del HD44780.
   * @param {number} byte   - Byte de 8 bits
   * @param {boolean} rs    - false = comando, true = dato de carácter
   * @param {boolean} bl    - Estado del backlight
   */
  _processHD44780(byte, rs, bl) {
    if (rs) {
      // ── Dato de carácter ──────────────────────────────────────────────────
      this._writeChar(byte);
    } else {
      // ── Comando ───────────────────────────────────────────────────────────
      if (byte === 0x01) {
        // Clear Display — limpiar y volver a inicio
        this._characters.fill(0x20); // 0x20 = espacio
        this._ddramAddr = 0;
        this._flushToElement();
        return;
      }

      if (byte === 0x02 || byte === 0x03) {
        // Return Home
        this._ddramAddr = 0;
        this._flushToElement();
        return;
      }

      if ((byte & 0xF0) === 0x00 && (byte & 0x08)) {
        // Display On/Off Control: 0x08–0x0F
        // bit 2 = D (display on/off)
        // bit 1 = C (cursor on/off)
        // bit 0 = B (blink on/off)
        this._displayOn = !!(byte & 0x04);
        this._cursorOn  = !!(byte & 0x02);
        this._blinkOn   = !!(byte & 0x01);
        this._flushToElement();
        return;
      }

      if ((byte & 0x80) || (byte & 0xC0) === 0x80) {
        // Set DDRAM Address: bit7 = 1
        const addr = byte & 0x7F;
        this._ddramAddr = addr;
        this._flushToElement();
        return;
      }

      if ((byte & 0xC0) === 0x40) {
        // Set CGRAM Address — ignorado (no simulamos CGRAM)
        return;
      }

      // Otros comandos (Function Set, Entry Mode, Shift) — ignorados
    }
  }

  // ── Escritura de carácter ─────────────────────────────────────────────────

  _writeChar(charCode) {
    const pos = ddramToPos(this._ddramAddr);
    if (pos !== null) {
      const [col, row] = pos;
      if (col < COLS && row < ROWS) {
        this._characters[row * COLS + col] = charCode;
      }
    }

    // Avanzar cursor (con wrap: col 15 → 16 queda fuera del visible, no hace wrap automático en HD44780)
    this._ddramAddr++;

    // Wrap: si pasamos de 0x0F vamos a 0x10 (invisible), luego con setCursor va a 0x40
    // El HD44780 real no hace wrap automático a línea 2 — lo omitimos igual que el hardware real

    this._flushToElement();
  }

  // ── Sync con el Web Component visual ─────────────────────────────────────

  _flushToElement() {
    if (!this.element) return;

    // Actualizar array de caracteres
    this.element.characters = new Uint8Array(this._characters);

    // Backlight
    this.element.backlight = this._backlight;

    // Cursor y blink
    this.element.cursor  = this._cursorOn;
    this.element.blink   = this._blinkOn;

    // Posición del cursor
    const pos = ddramToPos(this._ddramAddr);
    if (pos) {
      this.element.cursorX = pos[0];
      this.element.cursorY = pos[1];
    }
  }

  // ── Métodos de utilidad ───────────────────────────────────────────────────

  /** Reiniciar el estado del LCD al estado de power-on (usado en sim.reset). */
  reset() {
    this._characters.fill(0x20);
    this._ddramAddr  = 0;
    this._displayOn  = true;
    this._cursorOn   = false;
    this._blinkOn    = false;
    this._backlight  = true;
    this._highNibble = null;
    this._prevEN     = false;
    this._flushToElement();
  }
}
