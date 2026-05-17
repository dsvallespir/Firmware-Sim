/*
 * ============================================================
 * hexParser.js - Parser de Intel HEX a Uint8Array
 * ============================================================
 *
 * Convierte un archivo Intel HEX (salida de arduino-cli) a un
 * array de bytes que avr8js puede cargar como programa.
 *
 * Formato Intel HEX:
 *   :LLAAAATT[DD...]CC
 *   LL = largo de datos (hex)
 *   AAAA = dirección (hex)
 *   TT = tipo de registro (00=data, 01=EOF, 02=ext addr)
 *   DD = bytes de datos
 *   CC = checksum
 *
 * Referencia: https://en.wikipedia.org/wiki/Intel_HEX
 */

/**
 * Parsea un string Intel HEX y retorna un Uint8Array con el programa.
 *
 * @param {string} hexString - Contenido del archivo .hex
 * @returns {Uint8Array} - Bytes del programa
 */
export function hexToUint8Array(hexString) {
  const bytes = [];
  let baseAddress = 0;
  let maxAddress = 0;

  const lines = hexString.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith(':')) continue;

    const data = trimmed.slice(1); // quitar ':'

    // Parsear campos
    const byteCount = parseInt(data.slice(0, 2), 16);
    const address = parseInt(data.slice(2, 6), 16);
    const recordType = parseInt(data.slice(6, 8), 16);

    if (recordType === 0x00) {
      // Data record
      const fullAddress = baseAddress + address;
      for (let i = 0; i < byteCount; i++) {
        const byteVal = parseInt(data.slice(8 + i * 2, 10 + i * 2), 16);
        const addr = fullAddress + i;

        // Expandir el array si es necesario
        while (bytes.length <= addr) {
          bytes.push(0);
        }
        bytes[addr] = byteVal;

        if (addr > maxAddress) maxAddress = addr;
      }
    } else if (recordType === 0x01) {
      // End of file
      break;
    } else if (recordType === 0x02) {
      // Extended segment address
      baseAddress = parseInt(data.slice(8, 12), 16) << 4;
    } else if (recordType === 0x04) {
      // Extended linear address
      baseAddress = parseInt(data.slice(8, 12), 16) << 16;
    }
  }

  return new Uint8Array(bytes.slice(0, maxAddress + 1));
}

/**
 * Verifica si un string parece un archivo Intel HEX válido.
 *
 * @param {string} content - Contenido a verificar
 * @returns {boolean}
 */
export function isValidHex(content) {
  if (!content || typeof content !== 'string') return false;
  const lines = content.trim().split('\n');
  if (lines.length < 2) return false;
  // Al menos la primera línea debe empezar con ':'
  return lines[0].trim().startsWith(':');
}
