/*
 * ============================================================
 * ili9341Driver.js — Driver SPI para el controlador TFT ILI9341 (240×320)
 * ============================================================
 *
 * Emula el protocolo SPI del controlador de pantalla ILI9341 usado en
 * módulos TFT de 2.8" (240×320 píxeles, color RGB565).
 *
 * Compatible con las librerías Arduino:
 *   - Adafruit_ILI9341
 *   - TFT_eSPI (en modo ILI9341)
 *
 * Protocolo SPI:
 *   - Pin D/C (Data/Command): LOW = byte de comando, HIGH = byte de dato
 *   - CS LOW  → inicio de transacción
 *   - CS HIGH → fin de transacción, flush del framebuffer al canvas
 *
 * Comandos implementados:
 *   0x01  SWRESET  — Reset (limpia framebuffer)
 *   0x11  SLPOUT   — Sleep Out (habilita display)
 *   0x28  DISPOFF  — Display OFF
 *   0x29  DISPON   — Display ON
 *   0x2A  CASET    — Column Address Set (4 bytes: x0_hi x0_lo x1_hi x1_lo)
 *   0x2B  PASET    — Page Address Set   (4 bytes: y0_hi y0_lo y1_hi y1_lo)
 *   0x2C  RAMWR    — RAM Write (stream de píxeles RGB565, 2 bytes/pixel)
 *   0x36  MADCTL   — Memory Access Control (orientación)
 *   0x3A  COLMOD   — Color mode (solo RGB565 soportado)
 *
 * Notas de rendimiento:
 *   - El framebuffer (Uint8ClampedArray, 240×320×4 = 307 200 bytes) vive en memoria.
 *   - putImageData solo se llama en onDeselect() → una vez por transacción completa.
 *   - Un fillScreen típico envía 153 600 bytes en un burst: toda la escritura es
 *     O(1) por byte en el JS heap; la llamada a putImageData es O(n_píxeles) pero
 *     ocurre fuera del bucle RAF y no bloquea la simulación.
 *
 * MADCTL / orientación:
 *   - MV (bit 5): intercambia filas y columnas → modo landscape
 *   - MX (bit 6): invierte orden de columnas
 *   - MY (bit 7): invierte orden de filas
 *   - Solo se aplica a la escritura de píxeles RAMWR; CASET/PASET usan las
 *     coordenadas lógicas (ya giradas) tal como las manda el sketch.
 *   - El canvas del elemento wokwi-ili9341 es siempre 240×320 px físicos.
 *     En landscape (MV=1) los píxeles se transponen al escribir al framebuffer.
 */

const PHYS_W = 240;  // Ancho físico del panel
const PHYS_H = 320;  // Alto físico del panel

// ── Comandos ILI9341 ─────────────────────────────────────────────────────────
const CMD_SWRESET = 0x01;
const CMD_SLPOUT  = 0x11;
const CMD_DISPOFF = 0x28;
const CMD_DISPON  = 0x29;
const CMD_CASET   = 0x2A;
const CMD_PASET   = 0x2B;
const CMD_RAMWR   = 0x2C;
const CMD_MADCTL  = 0x36;
const CMD_COLMOD  = 0x3A;

// MADCTL bits
const MADCTL_MY = 0x80;
const MADCTL_MX = 0x40;
const MADCTL_MV = 0x20;

/**
 * Convierte un píxel RGB565 (2 bytes big-endian) a RGBA de 8 bits.
 * @param {number} hi  - Byte alto (bits 15-8)
 * @param {number} lo  - Byte bajo (bits 7-0)
 * @param {Uint8ClampedArray} buf
 * @param {number} offset - Índice en buf (múltiplo de 4)
 */
function writeRgb565(hi, lo, buf, offset) {
  const r5 = (hi >> 3) & 0x1F;
  const g6 = ((hi & 0x07) << 3) | (lo >> 5);
  const b5 = lo & 0x1F;
  buf[offset]     = (r5 << 3) | (r5 >> 2);   // 5-bit → 8-bit
  buf[offset + 1] = (g6 << 2) | (g6 >> 4);   // 6-bit → 8-bit
  buf[offset + 2] = (b5 << 3) | (b5 >> 2);   // 5-bit → 8-bit
  // buf[offset + 3] = 255  — alpha ya inicializado
}

export class ILI9341Driver {
  /**
   * @param {HTMLElement} element — Instancia del Web Component wokwi-ili9341
   */
  constructor(element) {
    this.element = element;

    // Framebuffer RGBA (240×320) — alpha siempre 255
    this._fb = new Uint8ClampedArray(PHYS_W * PHYS_H * 4);
    for (let i = 3; i < this._fb.length; i += 4) this._fb[i] = 255;

    // Canvas 2D context (dentro del shadow DOM del elemento)
    this._ctx     = null;
    this._imgData = null;
    this._initCanvas();

    // ── Estado del protocolo ──────────────────────────────────────────────────
    this._dc         = true;   // D/C: true = datos, false = comando
    this._cmd        = -1;     // Comando activo
    this._paramBuf   = [];     // Parámetros acumulados para el comando actual

    // ── Ventana de dirección (CASET/PASET) ────────────────────────────────────
    this._colStart = 0;
    this._colEnd   = PHYS_W - 1;
    this._rowStart = 0;
    this._rowEnd   = PHYS_H - 1;

    // ── Cursor de escritura RAMWR ─────────────────────────────────────────────
    this._writeX   = 0;
    this._writeY   = 0;
    this._ramHi    = null;   // Primer byte del par RGB565

    // ── MADCTL ────────────────────────────────────────────────────────────────
    this._madctl = 0x00;     // Portrait por defecto

    this._dirty = false;
  }

  // ── Canvas init ─────────────────────────────────────────────────────────────

  _initCanvas() {
    const tryInit = () => {
      const canvas = this.element.canvas;
      if (!canvas) return false;
      this._ctx     = canvas.getContext('2d');
      this._imgData = this._ctx.createImageData(PHYS_W, PHYS_H);
      return true;
    };

    if (!tryInit()) {
      this.element.addEventListener('canvas-ready', () => {
        if (tryInit()) this._flush();
      }, { once: true });
    }
  }

  // ── SPIDeviceHandler interface ───────────────────────────────────────────────

  /** Actualiza el estado del pin D/C. Llamado por partBehaviors via registerPinListener. */
  setDC(value) {
    this._dc = !!value;
  }

  /** CS → LOW */
  onSelect() {
    this._paramBuf = [];
    this._ramHi    = null;
  }

  /** CS → HIGH: flush del framebuffer al canvas */
  onDeselect() {
    this._paramBuf = [];
    if (this._dirty) this._flush();
  }

  /** Recibe un byte SPI (MOSI). Retorna byte MISO (siempre 0xFF). */
  onByte(value) {
    if (!this._dc) {
      this._handleCommand(value);
    } else {
      this._handleData(value);
    }
    return 0xFF;
  }

  // ── Decodificador de comandos ────────────────────────────────────────────────

  _handleCommand(cmd) {
    this._cmd      = cmd;
    this._paramBuf = [];

    switch (cmd) {
      case CMD_SWRESET:
        this._softReset();
        break;
      case CMD_SLPOUT:
      case CMD_DISPON:
        // Sin acción visual adicional
        break;
      case CMD_DISPOFF:
        // Podría oscurecer el canvas, pero lo omitimos por simplicidad
        break;
      case CMD_RAMWR:
        // Iniciar escritura: cursor al inicio de la ventana
        this._writeX = this._colStart;
        this._writeY = this._rowStart;
        this._ramHi  = null;
        break;
    }
  }

  _handleData(value) {
    this._paramBuf.push(value);
    const p = this._paramBuf;

    switch (this._cmd) {

      case CMD_CASET:
        if (p.length === 4) {
          this._colStart = Math.min(((p[0] << 8) | p[1]), PHYS_W - 1);
          this._colEnd   = Math.min(((p[2] << 8) | p[3]), PHYS_W - 1);
        }
        break;

      case CMD_PASET:
        if (p.length === 4) {
          this._rowStart = Math.min(((p[0] << 8) | p[1]), PHYS_H - 1);
          this._rowEnd   = Math.min(((p[2] << 8) | p[3]), PHYS_H - 1);
        }
        break;

      case CMD_MADCTL:
        if (p.length === 1) {
          this._madctl = value;
        }
        break;

      case CMD_COLMOD:
        // Solo RGB565 (0x55) soportado — ignorar otros modos
        break;

      case CMD_RAMWR:
        // Dos bytes por píxel (RGB565, big-endian)
        if (this._ramHi === null) {
          this._ramHi = value;
        } else {
          this._writePixel(this._writeX, this._writeY, this._ramHi, value);
          this._ramHi = null;

          // Avanzar cursor dentro de la ventana
          this._writeX++;
          if (this._writeX > this._colEnd) {
            this._writeX = this._colStart;
            this._writeY++;
            if (this._writeY > this._rowEnd) {
              this._writeY = this._rowStart; // wrap (raro pero posible)
            }
          }
        }
        break;
    }
  }

  // ── Escritura de píxeles ─────────────────────────────────────────────────────

  _writePixel(lx, ly, hi, lo) {
    // Aplicar MADCTL: transformar coordenadas lógicas → físicas
    let px = lx;
    let py = ly;

    const mv = (this._madctl & MADCTL_MV) !== 0;
    const mx = (this._madctl & MADCTL_MX) !== 0;
    const my = (this._madctl & MADCTL_MY) !== 0;

    if (mv) {
      // Landscape: intercambiar ejes
      px = ly;
      py = lx;
    }

    if (mx) px = PHYS_W - 1 - px;
    if (my) py = PHYS_H - 1 - py;

    if (px < 0 || px >= PHYS_W || py < 0 || py >= PHYS_H) return;

    writeRgb565(hi, lo, this._fb, (py * PHYS_W + px) * 4);
    this._dirty = true;
  }

  // ── Flush ────────────────────────────────────────────────────────────────────

  _flush() {
    if (!this._ctx || !this._imgData) return;
    this._imgData.data.set(this._fb);
    this._ctx.putImageData(this._imgData, 0, 0);
    this._dirty = false;
  }

  // ── Utilidades ───────────────────────────────────────────────────────────────

  _softReset() {
    this._fb.fill(0);
    for (let i = 3; i < this._fb.length; i += 4) this._fb[i] = 255;
    this._colStart = 0; this._colEnd = PHYS_W - 1;
    this._rowStart = 0; this._rowEnd = PHYS_H - 1;
    this._writeX = 0; this._writeY = 0;
    this._ramHi  = null;
    this._dirty  = true;
  }

  /** Reiniciar al estado power-on (usado en sim.reset si se reutiliza el driver). */
  reset() {
    this._softReset();
    this._flush();
  }
}
