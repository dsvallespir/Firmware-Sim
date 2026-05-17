/*
 * ============================================================
 * ssd1306Driver.js — Driver SPI para el controlador OLED SSD1306 (128×64)
 * ============================================================
 *
 * Emula el protocolo SPI del controlador de pantalla OLED SSD1306
 * (monocromo, 128×64 píxeles, 1 bit por pixel).
 *
 * Compatible con las librerías Arduino:
 *   - Adafruit_SSD1306
 *   - u8g2 / u8x8 (modo SPI SW o HW)
 *
 * Protocolo SPI:
 *   - Pin D/C (o DC): LOW = byte de comando, HIGH = byte de dato GDDRAM
 *   - CS LOW  → inicio de transacción
 *   - CS HIGH → fin de transacción, actualización del elemento visual
 *
 * Organización del GDDRAM:
 *   8 páginas × 128 columnas = 1024 bytes.
 *   Cada byte = 8 píxeles verticales (bit0 = fila superior de la página).
 *   Pixel(col, row): página = row >> 3, bit = row & 7
 *   GDDRAM[página * 128 + col] & (1 << bit)
 *
 * Modos de direccionamiento:
 *   0x00 — Horizontal: avanza col, luego página (usado por Adafruit_SSD1306 v2)
 *   0x01 — Vertical:   avanza página, luego col
 *   0x02 — Page:       avanza solo col; página se establece con 0xB0-0xB7
 *
 * Comandos implementados (subconjunto para Adafruit_SSD1306):
 *   0xAE / 0xAF     Display OFF / ON
 *   0xA4 / 0xA5     Reanudar desde GDDRAM / Encender toda la pantalla
 *   0xA6 / 0xA7     Normal / Invertir display
 *   0x20 + 1 byte   Set Memory Addressing Mode
 *   0x21 + 2 bytes  Set Column Address (horizontal/vertical mode)
 *   0x22 + 2 bytes  Set Page Address   (horizontal/vertical mode)
 *   0xB0–0xB7       Set Page Address   (page mode)
 *   0x00–0x0F       Set Lower Column   (page mode)
 *   0x10–0x1F       Set Higher Column  (page mode)
 *   0xD3 + 1 byte   Set Display Offset  (ignorado)
 *   0x40–0x7F       Set Display Start Line
 *   0x81 + 1 byte   Set Contrast (ignorado)
 *   0x8D + 1 byte   Charge Pump (ignorado)
 *   0xA8 + 1 byte   Set Multiplex Ratio (ignorado)
 *   0xD5 / 0xD9 / 0xDA / 0xDB + 1 byte  — configuración hardware (ignorados)
 */

const COLS   = 128;
const PAGES  = 8;
const ROWS   = PAGES * 8; // 64

// Modos de direccionamiento GDDRAM
const ADDR_MODE_HORIZONTAL = 0x00;
const ADDR_MODE_VERTICAL   = 0x01;
const ADDR_MODE_PAGE       = 0x02;

export class SSD1306Driver {
  /**
   * @param {HTMLElement} element — Instancia del Web Component wokwi-ssd1306
   */
  constructor(element) {
    this.element = element;

    // GDDRAM: 8 páginas × 128 columnas
    this._gddram = new Uint8Array(PAGES * COLS);

    // ── Estado del protocolo ──────────────────────────────────────────────────
    this._dc        = true;   // D/C pin: true = datos, false = comando
    this._cmd       = -1;     // Último comando recibido
    this._paramLeft = 0;      // Parámetros que faltan para el comando en curso

    // ── Modo de direccionamiento ──────────────────────────────────────────────
    this._addrMode  = ADDR_MODE_PAGE;   // Adafruit v1 usa page, v2 usa horizontal
    this._col       = 0;
    this._page      = 0;
    this._colStart  = 0;   // Rango para modo horizontal/vertical
    this._colEnd    = COLS - 1;
    this._pageStart = 0;
    this._pageEnd   = PAGES - 1;

    // ── Estado visual ─────────────────────────────────────────────────────────
    this._displayOn   = false;
    this._inverted    = false;
    this._entireOn    = false;  // 0xA5: encender todos los píxeles
    this._dirty       = false;
  }

  // ── SPIDeviceHandler interface ────────────────────────────────────────────────

  /** Actualiza el estado del pin D/C. Llamado por partBehaviors via registerPinListener. */
  setDC(value) {
    this._dc = !!value;
  }

  /** CS → LOW */
  onSelect() {
    // Nada especial al inicio de transacción
  }

  /** CS → HIGH: flush al elemento visual si hay cambios */
  onDeselect() {
    if (this._dirty) this._render();
  }

  /** Recibe un byte SPI (MOSI). Retorna 0xFF (MISO idle high). */
  onByte(value) {
    if (!this._dc) {
      this._handleCommand(value);
    } else {
      this._handleGDDRAMData(value);
    }
    return 0xFF;
  }

  // ── Máquina de estados de comandos ──────────────────────────────────────────

  _handleCommand(byte) {
    // Si hay parámetros pendientes del comando anterior, consumirlos
    if (this._paramLeft > 0) {
      this._applyParam(byte);
      return;
    }

    // Nuevo comando
    this._cmd = byte;

    // Comandos de un solo byte (sin parámetros)
    if (byte === 0xAE) { this._displayOn = false; return; }
    if (byte === 0xAF) { this._displayOn = true;  this._dirty = true; return; }
    if (byte === 0xA4) { this._entireOn  = false; this._dirty = true; return; }
    if (byte === 0xA5) { this._entireOn  = true;  this._dirty = true; return; }
    if (byte === 0xA6) { this._inverted  = false; this._dirty = true; return; }
    if (byte === 0xA7) { this._inverted  = true;  this._dirty = true; return; }

    // Set Page Start Address (page mode): 0xB0–0xB7
    if (byte >= 0xB0 && byte <= 0xB7) {
      this._page = byte & 0x07;
      return;
    }

    // Set Lower Column Address (page mode): 0x00–0x0F
    if (byte <= 0x0F) {
      this._col = (this._col & 0xF0) | (byte & 0x0F);
      return;
    }

    // Set Higher Column Address (page mode): 0x10–0x1F
    if (byte >= 0x10 && byte <= 0x1F) {
      this._col = (this._col & 0x0F) | ((byte & 0x0F) << 4);
      return;
    }

    // Set Display Start Line: 0x40–0x7F
    if (byte >= 0x40 && byte <= 0x7F) {
      // Ignoramos scroll de pantalla
      return;
    }

    // Comandos con 1 parámetro
    const oneParam = [0x81, 0x8D, 0xA8, 0xD3, 0xD5, 0xD8, 0xD9, 0xDA, 0xDB, 0xD6];
    if (oneParam.includes(byte)) {
      this._paramLeft = 1;
      return;
    }

    // 0x20 — Set Memory Addressing Mode (1 parámetro)
    if (byte === 0x20) { this._paramLeft = 1; return; }

    // 0x21 — Set Column Address (2 parámetros: col_start, col_end)
    if (byte === 0x21) { this._paramLeft = 2; return; }

    // 0x22 — Set Page Address (2 parámetros: page_start, page_end)
    if (byte === 0x22) { this._paramLeft = 2; return; }
  }

  _applyParam(byte) {
    this._paramLeft--;

    switch (this._cmd) {
      case 0x20: // Memory Addressing Mode
        this._addrMode = byte & 0x03;
        if (this._addrMode === ADDR_MODE_HORIZONTAL ||
            this._addrMode === ADDR_MODE_VERTICAL) {
          // Reset cursor al inicio de la ventana
          this._col  = this._colStart;
          this._page = this._pageStart;
        }
        break;

      case 0x21: // Set Column Address
        if (this._paramLeft === 1) {
          // Primer parámetro: start
          this._colStart = byte & 0x7F;
          this._col      = this._colStart;
        } else {
          // Segundo parámetro: end
          this._colEnd = byte & 0x7F;
        }
        break;

      case 0x22: // Set Page Address
        if (this._paramLeft === 1) {
          this._pageStart = byte & 0x07;
          this._page      = this._pageStart;
        } else {
          this._pageEnd = byte & 0x07;
        }
        break;

      // Todos los demás parámetros se ignoran (contrast, charge pump, etc.)
    }
  }

  // ── Escritura de datos al GDDRAM ─────────────────────────────────────────────

  _handleGDDRAMData(byte) {
    if (this._page >= PAGES || this._col >= COLS) return;

    this._gddram[this._page * COLS + this._col] = byte;
    this._dirty = true;

    // Avanzar cursor según modo de direccionamiento
    this._advanceCursor();
  }

  _advanceCursor() {
    switch (this._addrMode) {
      case ADDR_MODE_HORIZONTAL:
        this._col++;
        if (this._col > this._colEnd) {
          this._col = this._colStart;
          this._page++;
          if (this._page > this._pageEnd) {
            this._page = this._pageStart;
          }
        }
        break;

      case ADDR_MODE_VERTICAL:
        this._page++;
        if (this._page > this._pageEnd) {
          this._page = this._pageStart;
          this._col++;
          if (this._col > this._colEnd) {
            this._col = this._colStart;
          }
        }
        break;

      case ADDR_MODE_PAGE:
      default:
        // Solo avanza columna; página se cambia con comando 0xBx
        this._col++;
        if (this._col >= COLS) this._col = 0;
        break;
    }
  }

  // ── Render al elemento wokwi-ssd1306 ─────────────────────────────────────────

  _render() {
    const imgData = this.element.imageData;
    if (!imgData) return;

    const data = imgData.data;
    const on  = this._inverted ? 0   : 255;
    const off = this._inverted ? 255 : 0;

    if (this._entireOn) {
      // 0xA5: todos los píxeles encendidos
      data.fill(0);
      for (let i = 0; i < data.length; i += 4) {
        data[i] = data[i + 1] = data[i + 2] = on;
        data[i + 3] = 255;
      }
    } else {
      for (let row = 0; row < ROWS; row++) {
        const page = row >> 3;
        const bit  = row & 7;
        for (let col = 0; col < COLS; col++) {
          const lit = (this._gddram[page * COLS + col] >> bit) & 1;
          const idx = (row * COLS + col) * 4;
          const lum = lit ? on : off;
          data[idx]     = lum;
          data[idx + 1] = lum;
          data[idx + 2] = lum;
          data[idx + 3] = 255;
        }
      }
    }

    this.element.redraw();
    this._dirty = false;
  }

  /** Reiniciar al estado power-on. */
  reset() {
    this._gddram.fill(0);
    this._col  = 0;
    this._page = 0;
    this._colStart  = 0; this._colEnd  = COLS  - 1;
    this._pageStart = 0; this._pageEnd = PAGES - 1;
    this._addrMode  = ADDR_MODE_PAGE;
    this._displayOn = false;
    this._inverted  = false;
    this._entireOn  = false;
    this._dirty     = true;
    this._render();
  }
}

/**
 * ============================================================
 * SSD1306I2CAdapter — Slave I²C para el SSD1306
 * ============================================================
 *
 * Implementa la interfaz I2CSlaveHandler (onWrite / onRead / onStop)
 * y traduce el protocolo I²C del SSD1306 a llamadas en SSD1306Driver.
 *
 * Protocolo I²C del SSD1306 (tras el byte de dirección del slave):
 *   1er byte = byte de control:
 *     bit 7 (Co): 0 = stream — todos los bytes siguientes son cmd/dato
 *                 1 = single — cada byte de dato va precedido de su propio byte de control
 *     bit 6 (D/C#): 0 = command, 1 = GDDRAM data
 *
 * Adafruit_SSD1306 siempre usa:
 *   0x00 → comando en stream   (Co=0, D/C#=0)
 *   0x40 → datos en stream     (Co=0, D/C#=1)
 *   0x80 → comando single-byte (Co=1, D/C#=0)
 *   0xC0 → dato single-byte    (Co=1, D/C#=1)
 */
export class SSD1306I2CAdapter {
  /**
   * @param {HTMLElement} element — Instancia del Web Component wokwi-ssd1306
   */
  constructor(element) {
    this._driver = new SSD1306Driver(element);
    this._controlPending = true; // El siguiente byte tras START+addr es el byte de control
    this._dc = false;            // D/C# actual: false=command, true=data
    this._co = false;            // Co actual: false=stream, true=single-byte
  }

  /**
   * Recibe un byte del master (escritura I²C).
   * @param {number} byte
   * @returns {boolean} true=ACK
   */
  onWrite(byte) {
    if (this._controlPending) {
      // Byte de control: extraer Co y D/C#
      this._dc = (byte & 0x40) !== 0; // bit 6
      this._co = (byte & 0x80) !== 0; // bit 7
      this._controlPending = false;
      return true;
    }
    // Byte de dato o comando
    this._driver.setDC(this._dc);
    if (this._dc) {
      this._driver._handleGDDRAMData(byte);
    } else {
      this._driver._handleCommand(byte);
    }
    // En modo single (Co=1) el próximo byte requiere un nuevo byte de control
    if (this._co) {
      this._controlPending = true;
    }
    return true;
  }

  /** El master lee del SSD1306 (generalmente no se usa, retorna idle). */
  onRead() {
    return 0xFF;
  }

  /** Condición STOP: resetear estado de parseo y hacer flush al elemento visual. */
  onStop() {
    this._controlPending = true;
    this._co = false;
    if (this._driver._dirty) {
      this._driver._render();
    }
  }
}
