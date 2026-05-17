/*
 * ============================================================
 * partBehaviors.js — Lógica de simulación por tipo de componente
 * ============================================================
 *
 * Conecta los pin states del CPU (avr8js) con las propiedades
 * visuales de los wokwi web components.
 *
 * Cada comportamiento define:
 *   - onPinChange(element, pinName, value, pwmValue)
 *       → actualiza propiedades visuales del componente
 *   - attachEvents(element, helpers)
 *       → conecta eventos de input del componente al simulador
 *       → retorna función de cleanup
 *
 * El CircuitView usa este registry para cablear automáticamente
 * la simulación con los componentes visuales.
 */

/**
 * @typedef {object} SimulatorHelpers
 * @property {function(number, number): void} setPinState - Inyectar estado digital
 * @property {function(number, number): void} setAnalogValue - Inyectar valor ADC (0-1023)
 * @property {function(string, string): number|null} getConnectedPin - Obtener Arduino pin# de una conexión
 */

/**
 * Generar la secuencia de eventos para la respuesta del protocolo DHT22.
 * Retorna [{delay: µs_desde_ahora, pin: arduinoPin, value: 0|1}], ordenados por delay.
 *
 * Formato de datos DHT22 (40 bits):
 *   [rhHi, rhLo, tHi(+sign), tLo, checksum]
 *   Humedad  = (rhHi<<8 | rhLo) / 10 %
 *   Temp     = ((tHi & 0x7F)<<8 | tLo) / 10 °C   (bit7 de tHi = signo negativo)
 */
function buildDHT22Response(dataPin, startDelayMicros, tempTimes10, humTimes10) {
  const events = [];
  const rh    = Math.max(0, Math.min(1000, humTimes10));
  const tRaw  = Math.max(-400, Math.min(1250, tempTimes10));
  const rhHi  = (rh >> 8) & 0xFF;
  const rhLo  = rh & 0xFF;
  const sign  = tRaw < 0 ? 0x80 : 0x00;
  const tAbs  = Math.abs(tRaw);
  const tHi   = ((tAbs >> 8) & 0x7F) | sign;
  const tLo   = tAbs & 0xFF;
  const cksum = (rhHi + rhLo + tHi + tLo) & 0xFF;
  const bytes = [rhHi, rhLo, tHi, tLo, cksum];

  let t = startDelayMicros;
  events.push({ delay: t, pin: dataPin, value: 0 }); t += 80;  // start LOW  80µs
  events.push({ delay: t, pin: dataPin, value: 1 }); t += 80;  // start HIGH 80µs

  for (const byte of bytes) {
    for (let bit = 7; bit >= 0; bit--) {
      const isOne = (byte >> bit) & 1;
      events.push({ delay: t, pin: dataPin, value: 0 }); t += 50;           // bit LOW  50µs
      events.push({ delay: t, pin: dataPin, value: 1 }); t += isOne ? 70 : 26; // bit HIGH
    }
  }
  events.push({ delay: t, pin: dataPin, value: 0 }); // end of transmission
  return events;
}

const partBehaviors = {
  // ─── LEDs ─────────────────────────────────────────────
  'wokwi-led': {
    onPinChange(element, pinName, value, pwmValue) {
      // wokwi-led requiere AMBOS: .value (master switch) Y .brightness > 0
      // .value = boolean on/off, .brightness = 0.0-1.0 (default 1.0)
      if (pwmValue !== undefined && pwmValue !== null) {
        // PWM: encender LED y ajustar brillo
        element.value = pwmValue > 0;
        element.brightness = pwmValue / 255;
      } else {
        // Digital: on/off (brightness queda en su default 1.0)
        if (pinName === 'A' || pinName === 'anode') {
          element.value = !!value;
        }
      }
    },
  },

  'wokwi-rgb-led': {
    onPinChange(element, pinName, value, pwmValue) {
      const brightness = pwmValue !== undefined ? pwmValue / 255 : (value ? 1.0 : 0);
      switch (pinName) {
        case 'R': element.redBrightness = brightness; break;
        case 'G': element.greenBrightness = brightness; break;
        case 'B': element.blueBrightness = brightness; break;
      }
    },
  },

  // ─── Botones ──────────────────────────────────────────
  'wokwi-pushbutton': {
    attachEvents(element, { setPinState, getConnectedPin }) {
      // Pushbutton conecta 1.l-2.l y 1.r-2.r cuando se presiona
      // Normalmente se conecta un lado a un pin digital y otro a GND
      // Con INPUT_PULLUP, el pin lee HIGH cuando suelto, LOW cuando presionado
      //
      // Wokwi pin names: '1.l', '2.l', '1.r', '2.r'
      const pin = getConnectedPin('1.l') ?? getConnectedPin('1.r')
                ?? getConnectedPin('2.l') ?? getConnectedPin('2.r');

      console.log('[pushbutton] pin resolution:', {
        '1.l': getConnectedPin('1.l'),
        '1.r': getConnectedPin('1.r'),
        '2.l': getConnectedPin('2.l'),
        '2.r': getConnectedPin('2.r'),
        resolved: pin,
      });

      if (pin === null || pin === undefined) {
        console.warn('[pushbutton] No Arduino pin found — button will not work');
        return null;
      }

      // Estado inicial: HIGH (pull-up, botón suelto)
      console.log(`[pushbutton] Setting initial state: pin ${pin} = HIGH`);
      setPinState(pin, 1);

      const onPress = () => {
        console.log(`[pushbutton] PRESS → pin ${pin} = LOW`);
        setPinState(pin, 0);   // LOW = presionado (pullup)
      };
      const onRelease = () => {
        console.log(`[pushbutton] RELEASE → pin ${pin} = HIGH`);
        setPinState(pin, 1);  // HIGH = suelto (pullup)
      };

      element.addEventListener('button-press', onPress);
      element.addEventListener('button-release', onRelease);

      return () => {
        element.removeEventListener('button-press', onPress);
        element.removeEventListener('button-release', onRelease);
      };
    },
  },

  'wokwi-pushbutton-6mm': {
    // Mismo comportamiento que pushbutton estándar
    attachEvents(element, helpers) {
      return partBehaviors['wokwi-pushbutton'].attachEvents(element, helpers);
    },
  },

  // ─── Switches ─────────────────────────────────────────
  'wokwi-slide-switch': {
    attachEvents(element, { setPinState, getConnectedPin }) {
      const pin = getConnectedPin('1') ?? getConnectedPin('2') ?? getConnectedPin('3');
      if (pin === null || pin === undefined) return null;

      const onChange = () => {
        const val = element.value;
        setPinState(pin, val ? 1 : 0);
      };

      element.addEventListener('change', onChange);
      return () => element.removeEventListener('change', onChange);
    },
  },

  // ─── Potenciómetro (ADC) ──────────────────────────────
  'wokwi-potentiometer': {
    attachEvents(element, { setAnalogValue, getConnectedPin }) {
      const pin = getConnectedPin('SIG') ?? getConnectedPin('W');
      if (pin === null || pin === undefined) return null;

      const onInput = (e) => {
        // wokwi-potentiometer emite value 0-1023 o 0.0-1.0 dependiendo versión
        const raw = e.detail ?? element.value ?? 0;
        const value = raw > 1 ? raw : Math.round(raw * 1023);
        setAnalogValue(pin, value);
      };

      element.addEventListener('input', onInput);
      return () => element.removeEventListener('input', onInput);
    },
  },

  'wokwi-slide-potentiometer': {
    attachEvents(element, helpers) {
      return partBehaviors['wokwi-potentiometer'].attachEvents(element, helpers);
    },
  },

  // ─── Servo ────────────────────────────────────────────
  'wokwi-servo': {
    onPinChange(element, pinName, value, pwmValue) {
      // El servo se controla con PWM: duty cycle mapea a ángulo
      // Arduino Servo library: 544µs = 0°, 2400µs = 180°
      if (pwmValue !== undefined) {
        // Mapear duty cycle (0-255) a ángulo (0-180)
        const angle = Math.round((pwmValue / 255) * 180);
        element.angle = angle;
      }
    },
  },

  // ─── Buzzer ───────────────────────────────────────────
  'wokwi-buzzer': {
    onPinChange(element, pinName, value) {
      element.hasSignal = value ? true : false;
    },
  },

  // ─── 7 Segmentos ─────────────────────────────────────
  'wokwi-7segment': {
    onPinChange(element, pinName, value) {
      // Los pines son: A, B, C, D, E, F, G, DP, COM
      // Cada segmento se enciende cuando su pin está en el estado correcto
      // (depende de si es cátodo o ánodo común)
      const segmentMap = { A: 'a', B: 'b', C: 'c', D: 'd', E: 'e', F: 'f', G: 'g', DP: 'dp' };
      const seg = segmentMap[pinName];
      if (seg) {
        element[`seg${seg.toUpperCase()}`] = value ? 1 : 0;
      }
    },
  },

  // ─── LCD 1602 (I2C) ──────────────────────────────────
  // El LCD I2C requiere emulación del bus I2C — fase futura
  // Por ahora solo como visual placeholder

  // ─── Resistencia (pasivo, sin lógica) ─────────────────
  'wokwi-resistor': {
    // No tiene comportamiento activo, es un componente pasivo
    // Solo se renderiza visualmente
  },

  // ─── Sensores con simulación completa ─────────────────

  /**
   * DHT22 — Temperatura y Humedad
   * Protocolo single-wire: host LOW → host HIGH (release) → DHT responde con 40 bits.
   * Pines Wokwi: SDA (datos), VCC, GND
   */
  'wokwi-dht22': {
    attachEvents(element, { getConnectedPin, registerPinListener, schedulePinChange, getSensorValue }) {
      const dataPin = getConnectedPin('SDA');
      if (dataPin === null || dataPin === undefined) return null;

      let armed = false;
      let lastScheduleMs = -Infinity;

      const onPinChange = (pin, value) => {
        if (pin !== dataPin) return;
        if (!value) {
          armed = true; // host puso DATA en LOW = inicio de comunicación
        } else if (armed) {
          armed = false;
          const now = Date.now();
          if (now - lastScheduleMs < 50) return; // debounce
          lastScheduleMs = now;
          const temp   = getSensorValue('temperature') ?? 25.0;
          const humi   = getSensorValue('humidity')    ?? 50.0;
          const events = buildDHT22Response(
            dataPin, 50,
            Math.round(temp * 10),
            Math.round(humi * 10),
          );
          for (const evt of events) schedulePinChange(evt.pin, evt.delay, evt.value);
        }
      };

      return registerPinListener(onPinChange);
    },
  },

  /**
   * HC-SR04 — Sensor ultrasónico de distancia
   * TRIG: pulso HIGH de 10 µs desde Arduino
   * ECHO: pulso HIGH proporcional a distancia (1 cm = 58.2 µs)
   */
  'wokwi-hc-sr04': {
    attachEvents(element, { getConnectedPin, registerPinListener, schedulePinChange, getSensorValue }) {
      const trigPin = getConnectedPin('TRIG');
      const echoPin = getConnectedPin('ECHO');
      if (trigPin === null || trigPin === undefined) return null;
      if (echoPin === null || echoPin === undefined) return null;

      let trigHigh = false;

      const onPinChange = (pin, value) => {
        if (pin !== trigPin) return;
        if (value) {
          trigHigh = true;
        } else if (trigHigh) {
          trigHigh = false;
          const distance     = getSensorValue('distance') ?? 20;   // cm
          const echoDuration = Math.round(distance * 58.2);         // µs
          schedulePinChange(echoPin, 500,                1);        // ECHO HIGH después de 500 µs
          schedulePinChange(echoPin, 500 + echoDuration, 0);        // ECHO LOW al terminar
        }
      };

      return registerPinListener(onPinChange);
    },
  },

  /**
   * PIR — Sensor de movimiento infrarrojo pasivo
   * OUT HIGH mientras haya movimiento (controlado via sensorConfig)
   */
  'wokwi-pir-motion-sensor': {
    attachEvents(element, { getConnectedPin, setPinState, getSensorValue }) {
      const outPin = getConnectedPin('OUT');
      if (outPin === null || outPin === undefined) return null;

      const id = setInterval(() => {
        const motion = getSensorValue('motion') ?? false;
        setPinState(outPin, motion ? 1 : 0);
      }, 30);

      return () => clearInterval(id);
    },
  },

  /**
   * NTC Thermistor — Temperatura analógica
   * Divisor resistivo: Vout = Vcc × Rref / (Rntc + Rref)
   * Steinhart-Hart simplificado: R = R25 × exp(B × (1/T − 1/T25))
   * B=3977, R25=10kΩ, Rref=10kΩ
   */
  'wokwi-ntc-temperature-sensor': {
    attachEvents(element, { getConnectedPin, setAnalogValue, getSensorValue }) {
      const sigPin = getConnectedPin('VCC') ?? getConnectedPin('SIG');
      if (sigPin === null || sigPin === undefined) return null;

      const B   = 3977;
      const R25 = 10_000;
      const T25 = 298.15; // K
      const Ref = 10_000; // resistencia de referencia del divisor

      const update = () => {
        const tempC = getSensorValue('temperature') ?? 25;
        const T     = tempC + 273.15;
        const Rntc  = R25 * Math.exp(B * (1 / T - 1 / T25));
        const ratio = Ref / (Rntc + Ref);
        setAnalogValue(sigPin, Math.round(ratio * 1023));
      };

      update();
      const id = setInterval(update, 50);
      return () => clearInterval(id);
    },
  },

  // ── LCD 1602 I²C ──────────────────────────────────────────────────────────
  // Usa el adaptador PCF8574 para comunicarse por I²C con el controlador HD44780.
  // Dirección I²C configurable mediante el atributo 'i2cAddress' de la pieza
  // (por defecto 0x27, el valor más común del módulo GY-LCD-V1).
  'wokwi-lcd1602': {
    async attachEvents(element, helpers) {
      const { registerI2CSlave, unregisterI2CSlave, getPartAttr } = helpers;
      if (!registerI2CSlave) {
        console.warn('[LCD1602] No hay bus I²C disponible (registerI2CSlave missing)');
        return null;
      }

      // Leer dirección I²C del atributo de la pieza (o usar 0x27 por defecto)
      const rawAddr = getPartAttr?.('i2cAddress') ?? '0x27';
      const addr = (parseInt(rawAddr, 16) || 0x27) & 0x7F;

      const { PCF8574LCD } = await import('./pcf8574Lcd.js');
      const slave = new PCF8574LCD(element, addr);
      registerI2CSlave(addr, slave);

      console.log(`[LCD1602] Registrado en bus I²C, dirección 0x${addr.toString(16).toUpperCase()}`);

      return () => {
        unregisterI2CSlave?.(addr);
        console.log('[LCD1602] Desregistrado del bus I²C');
      };
    },
  },

  // ── TFT ILI9341 (SPI, 240×320 px) ─────────────────────────────────────────
  // Protocolo SPI estándar: pin CS para selección, pin D/C para comando/dato.
  // Compatible con Adafruit_ILI9341 y TFT_eSPI.
  'wokwi-ili9341': {
    async attachEvents(element, helpers) {
      const { registerSpiDevice, unregisterSpiDevice, getConnectedPin, registerPinListener } = helpers;
      if (!registerSpiDevice) {
        console.warn('[ILI9341] No hay bus SPI disponible (registerSpiDevice missing)');
        return null;
      }

      const csPin = getConnectedPin('CS');
      const dcPin = getConnectedPin('D/C');

      const { ILI9341Driver } = await import('./ili9341Driver.js');
      const driver = new ILI9341Driver(element);

      // Escuchar cambios en el pin D/C para que el driver sepa si el byte siguiente
      // es un comando (D/C=LOW) o un dato de píxel (D/C=HIGH)
      let cleanupDC = null;
      if (dcPin != null && registerPinListener) {
        cleanupDC = registerPinListener((pin, value) => {
          if (pin === dcPin) driver.setDC(!!value);
        });
      }

      registerSpiDevice(csPin, driver);
      console.log(`[ILI9341] Registrado en bus SPI, CS=pin${csPin ?? 'N/A'}, D/C=pin${dcPin ?? 'N/A'}`);

      return () => {
        cleanupDC?.();
        unregisterSpiDevice?.(csPin);
        console.log('[ILI9341] Desregistrado del bus SPI');
      };
    },
  },

  // ── OLED SSD1306 (I²C o SPI, 128×64 px) ──────────────────────────────────
  // Detección automática de modo:
  //   I²C: pin DATA conectado a A4 (pin 18 / SDA) o CLK a A5 (pin 19 / SCL)
  //   SPI: cualquier otra configuración (con CS/DC en pines SPI)
  'wokwi-ssd1306': {
    async attachEvents(element, helpers) {
      const {
        registerSpiDevice, unregisterSpiDevice,
        registerI2CSlave, unregisterI2CSlave,
        getConnectedPin, registerPinListener, getPartAttr,
      } = helpers;

      const dataPin = getConnectedPin('DATA');
      const clkPin  = getConnectedPin('CLK');
      // Si DATA va a A4 (SDA=pin 18) o CLK va a A5 (SCL=pin 19) → modo I²C
      const isI2C = dataPin === 18 || clkPin === 19;

      if (isI2C) {
        if (!registerI2CSlave) {
          console.warn('[SSD1306] Modo I²C detectado pero registerI2CSlave no disponible');
          return null;
        }
        // Dirección I²C 0x3C por defecto (SA0=GND). Override con attr 'address'.
        const addrAttr = getPartAttr('address');
        const addr = addrAttr ? parseInt(addrAttr, 16) : 0x3C;
        const { SSD1306I2CAdapter } = await import('./ssd1306Driver.js');
        const adapter = new SSD1306I2CAdapter(element);
        registerI2CSlave(addr, adapter);
        console.log(`[SSD1306] Modo I²C — registrado en addr=0x${addr.toString(16).toUpperCase()}`);
        return () => {
          unregisterI2CSlave?.(addr);
          console.log('[SSD1306] Desregistrado del bus I²C');
        };
      }

      // ── Modo SPI (compatibilidad con sketches que usan SPI hardware/software) ──
      if (!registerSpiDevice) {
        console.warn('[SSD1306] No hay bus SPI disponible (registerSpiDevice missing)');
        return null;
      }

      const csPin = getConnectedPin('CS');
      const dcPin = getConnectedPin('DC');  // pin 'DC' en SSD1306

      const { SSD1306Driver } = await import('./ssd1306Driver.js');
      const driver = new SSD1306Driver(element);

      let cleanupDC = null;
      if (dcPin != null && registerPinListener) {
        cleanupDC = registerPinListener((pin, value) => {
          if (pin === dcPin) driver.setDC(!!value);
        });
      }

      registerSpiDevice(csPin, driver);
      console.log(`[SSD1306] Modo SPI — CS=pin${csPin ?? 'N/A'}, DC=pin${dcPin ?? 'N/A'}`);

      return () => {
        cleanupDC?.();
        unregisterSpiDevice?.(csPin);
        console.log('[SSD1306] Desregistrado del bus SPI');
      };
    },
  },

  // ── MicroSD Card (SPI) ─────────────────────────────────────────────────────
  // Stub SPI: registra el CS pin y responde con 0xFF a todos los bytes.
  // SD.begin() detectará error pero el sketch compilará y no crasheará.
  // Útil para sketches que usan SD opcionalmente o con manejo de errores.
  'wokwi-microsd-card': {
    attachEvents(element, { registerSpiDevice, unregisterSpiDevice, getConnectedPin }) {
      if (!registerSpiDevice) return null;
      const csPin = getConnectedPin('CS');

      const stub = {
        onByte:     () => 0xFF,
        onSelect:   () => {},
        onDeselect: () => {},
      };

      registerSpiDevice(csPin, stub);
      console.log(`[MicroSD] Stub SPI registrado, CS=pin${csPin ?? 'N/A'}`);

      return () => unregisterSpiDevice?.(csPin);
    },
  },

  // ── LCD 20×4 (I²C, mismo protocolo PCF8574 que el 1602) ──────────────────
  'wokwi-lcd2004': {
    attachEvents(element, helpers) {
      return partBehaviors['wokwi-lcd1602'].attachEvents(element, helpers);
    },
  },

  // ── LED Bar Graph (10 LEDs, pines A1–A10) ────────────────────────────────
  'wokwi-led-bar-graph': {
    onPinChange(element, pinName, value) {
      const m = pinName.match(/^A(\d+)$/);
      if (!m) return;
      const n = parseInt(m[1]);
      try {
        element[`led${n}`] = !!value;
      } catch (_) {
        const cur = element.leds ?? 0;
        element.leds = value ? (cur | (1 << (n - 1))) : (cur & ~(1 << (n - 1)));
      }
    },
  },

  // ── NeoPixel WS2812 individual ────────────────────────────────────────────
  // La decodificación exacta de color requiere acceso al reloj AVR (no
  // disponible en el pin listener). Se usa detección de actividad: el LED
  // se ilumina blanco cuando hay ráfagas de datos en DIN.
  'wokwi-neopixel': {
    attachEvents(element, { getConnectedPin, registerPinListener }) {
      const dataPin = getConnectedPin('DIN') ?? getConnectedPin('IN');
      if (dataPin == null) return null;
      let transitions = 0;
      let timer = null;
      const onPinChange = (pin) => {
        if (pin !== dataPin) return;
        transitions++;
        clearTimeout(timer);
        timer = setTimeout(() => {
          try {
            element.r = transitions > 10 ? 255 : 0;
            element.g = transitions > 10 ? 255 : 0;
            element.b = transitions > 10 ? 255 : 0;
          } catch (_) {}
          transitions = 0;
        }, 50);
      };
      return registerPinListener(onPinChange);
    },
  },

  // ── LED Ring (anillo NeoPixel) ────────────────────────────────────────────
  'wokwi-led-ring': {
    attachEvents(element, { getConnectedPin, registerPinListener }) {
      const dataPin = getConnectedPin('DIN') ?? getConnectedPin('IN');
      if (dataPin == null) return null;
      let transitions = 0;
      let timer = null;
      const onPinChange = (pin) => {
        if (pin !== dataPin) return;
        transitions++;
        clearTimeout(timer);
        timer = setTimeout(() => {
          const count = parseInt(element.leds ?? element.getAttribute?.('leds') ?? 12);
          try {
            element.pixels = Array(count).fill(transitions > 10 ? '#ffffff' : '#000000');
          } catch (_) {}
          transitions = 0;
        }, 50);
      };
      return registerPinListener(onPinChange);
    },
  },

  // ── NeoPixel Matrix ───────────────────────────────────────────────────────
  'wokwi-neopixel-matrix': {
    attachEvents(element, { getConnectedPin, registerPinListener }) {
      const dataPin = getConnectedPin('DIN') ?? getConnectedPin('IN');
      if (dataPin == null) return null;
      let transitions = 0;
      let timer = null;
      const onPinChange = (pin) => {
        if (pin !== dataPin) return;
        transitions++;
        clearTimeout(timer);
        timer = setTimeout(() => {
          const w = parseInt(element.width  ?? element.getAttribute?.('width')  ?? 8);
          const h = parseInt(element.height ?? element.getAttribute?.('height') ?? 8);
          try {
            element.pixels = Array(w * h).fill(transitions > 10 ? '#ffffff' : '#000000');
          } catch (_) {}
          transitions = 0;
        }, 50);
      };
      return registerPinListener(onPinChange);
    },
  },

  // ── Relé KS2E-M-DC5 ──────────────────────────────────────────────────────
  'wokwi-ks2e-m-dc5': {
    onPinChange(element, pinName, value) {
      if (pinName !== 'A1' && pinName !== 'A2') return;
      try { element.activated = !!value; } catch (_) {
        try { element.coilVoltage = value ? 5 : 0; } catch (_) {}
      }
    },
  },

  // ── Joystick Analógico ────────────────────────────────────────────────────
  'wokwi-analog-joystick': {
    attachEvents(element, { getConnectedPin, setPinState, setAnalogValue }) {
      const vrxPin = getConnectedPin('VRX') ?? getConnectedPin('XOUT');
      const vryPin = getConnectedPin('VRY') ?? getConnectedPin('YOUT');
      const swPin  = getConnectedPin('SW');

      if (vrxPin != null) setAnalogValue(vrxPin, 512);
      if (vryPin != null) setAnalogValue(vryPin, 512);
      if (swPin  != null) setPinState(swPin, 1);

      const onMove    = (e) => {
        const { x = 0.5, y = 0.5 } = e.detail ?? {};
        if (vrxPin != null) setAnalogValue(vrxPin, Math.round(x * 1023));
        if (vryPin != null) setAnalogValue(vryPin, Math.round(y * 1023));
      };
      const onPress   = () => { if (swPin != null) setPinState(swPin, 0); };
      const onRelease = () => { if (swPin != null) setPinState(swPin, 1); };

      element.addEventListener('move', onMove);
      element.addEventListener('button-press', onPress);
      element.addEventListener('button-release', onRelease);
      return () => {
        element.removeEventListener('move', onMove);
        element.removeEventListener('button-press', onPress);
        element.removeEventListener('button-release', onRelease);
      };
    },
  },

  // ── Encoder Rotativo KY-040 ───────────────────────────────────────────────
  // Genera la secuencia cuadratura CLK/DT para que el sketch detecte
  // dirección y velocidad de giro con la librería Encoder.
  'wokwi-ky-040': {
    attachEvents(element, { getConnectedPin, setPinState }) {
      const clkPin = getConnectedPin('CLK');
      const dtPin  = getConnectedPin('DT');
      const swPin  = getConnectedPin('SW');

      if (clkPin != null) setPinState(clkPin, 1);
      if (dtPin  != null) setPinState(dtPin,  1);
      if (swPin  != null) setPinState(swPin,  1);

      const onRotate = (e) => {
        const delta = e.detail ?? 0;
        const cw    = delta > 0;
        for (let i = 0; i < Math.abs(delta); i++) {
          if (cw) {
            // CW: DT cae primero, luego CLK
            if (dtPin  != null) setPinState(dtPin,  0);
            if (clkPin != null) setPinState(clkPin, 0);
            if (clkPin != null) setPinState(clkPin, 1);
            if (dtPin  != null) setPinState(dtPin,  1);
          } else {
            // CCW: CLK cae primero, luego DT
            if (clkPin != null) setPinState(clkPin, 0);
            if (dtPin  != null) setPinState(dtPin,  0);
            if (dtPin  != null) setPinState(dtPin,  1);
            if (clkPin != null) setPinState(clkPin, 1);
          }
        }
      };
      const onPress   = () => { if (swPin != null) setPinState(swPin, 0); };
      const onRelease = () => { if (swPin != null) setPinState(swPin, 1); };

      element.addEventListener('rotate', onRotate);
      element.addEventListener('button-press', onPress);
      element.addEventListener('button-release', onRelease);
      return () => {
        element.removeEventListener('rotate', onRotate);
        element.removeEventListener('button-press', onPress);
        element.removeEventListener('button-release', onRelease);
      };
    },
  },

  // ── DIP Switch 8 posiciones ───────────────────────────────────────────────
  'wokwi-dip-switch-8': {
    attachEvents(element, { getConnectedPin, setPinState }) {
      const pins = Array.from({ length: 8 }, (_, i) =>
        getConnectedPin(`${i + 1}L`) ?? getConnectedPin(`${i + 1}R`));
      pins.forEach(p => { if (p != null) setPinState(p, 1); }); // pull-up

      const onChange = (e) => {
        const { index, value } = e.detail ?? {};
        if (index == null) return;
        const pin = pins[index];
        if (pin != null) setPinState(pin, value ? 0 : 1); // active LOW
      };
      element.addEventListener('change', onChange);
      return () => element.removeEventListener('change', onChange);
    },
  },

  // ── Tilt Switch (inclinación) ─────────────────────────────────────────────
  'wokwi-tilt-switch': {
    attachEvents(element, { getConnectedPin, setPinState }) {
      const pin = getConnectedPin('1') ?? getConnectedPin('A') ?? getConnectedPin('2');
      if (pin == null) return null;
      setPinState(pin, 1); // abierto (pull-up)
      const onChange = () => {
        const closed = element.tilt ?? element.value ?? false;
        setPinState(pin, closed ? 0 : 1);
      };
      element.addEventListener('change', onChange);
      return () => element.removeEventListener('change', onChange);
    },
  },

  // ── Fotorresistencia LDR ──────────────────────────────────────────────────
  // Valor analógico leído de sensorConfig['light'] (0-100 %).
  'wokwi-photoresistor-sensor': {
    attachEvents(element, { getConnectedPin, setAnalogValue, getSensorValue }) {
      const pin = getConnectedPin('A') ?? getConnectedPin('AO') ?? getConnectedPin('SIG');
      if (pin == null) return null;
      const update = () => {
        const light = getSensorValue?.('light') ?? 50;
        setAnalogValue(pin, Math.round((light / 100) * 1023));
      };
      update();
      const id = setInterval(update, 50);
      return () => clearInterval(id);
    },
  },

  // ── Sensor de Sonido (grande y pequeño) ──────────────────────────────────
  // Valor leído de sensorConfig['sound'] (0-100). DO activo LOW cuando > 50.
  'wokwi-big-sound-sensor': {
    attachEvents(element, { getConnectedPin, setAnalogValue, setPinState, getSensorValue }) {
      const aoPin = getConnectedPin('A0') ?? getConnectedPin('AO');
      const doPin = getConnectedPin('D0') ?? getConnectedPin('DO');
      const update = () => {
        const sound = getSensorValue?.('sound') ?? 0;
        if (aoPin != null) setAnalogValue(aoPin, Math.round((sound / 100) * 1023));
        if (doPin != null) setPinState(doPin, sound > 50 ? 0 : 1);
      };
      update();
      const id = setInterval(update, 50);
      return () => clearInterval(id);
    },
  },
  'wokwi-small-sound-sensor': {
    attachEvents(element, helpers) {
      return partBehaviors['wokwi-big-sound-sensor'].attachEvents(element, helpers);
    },
  },

  // ── Sensor de Gas MQ-x ───────────────────────────────────────────────────
  // Valor leído de sensorConfig['gas'] (0-100 %). DO activo LOW cuando > 50.
  'wokwi-gas-sensor': {
    attachEvents(element, { getConnectedPin, setAnalogValue, setPinState, getSensorValue }) {
      const aPin = getConnectedPin('A') ?? getConnectedPin('AO');
      const dPin = getConnectedPin('D') ?? getConnectedPin('DO');
      const update = () => {
        const gas = getSensorValue?.('gas') ?? 0;
        if (aPin != null) setAnalogValue(aPin, Math.round((gas / 100) * 1023));
        if (dPin != null) setPinState(dPin, gas > 50 ? 0 : 1);
      };
      update();
      const id = setInterval(update, 100);
      return () => clearInterval(id);
    },
  },

  // ── Acelerómetro/Giróscopo MPU-6050 (I²C, 0x68/0x69) ────────────────────
  // Implementa el mapa de registros estándar.
  // accelX/Y/Z (g), gyroX/Y/Z (°/s), temperature (°C) desde sensorConfig.
  'wokwi-mpu6050': {
    attachEvents(element, { registerI2CSlave, unregisterI2CSlave, getPartAttr, getSensorValue }) {
      if (!registerI2CSlave) {
        console.warn('[MPU6050] No hay bus I²C disponible');
        return null;
      }
      const rawAddr = getPartAttr?.('i2cAddress') ?? '0x68';
      const addr    = (parseInt(rawAddr, 16) || 0x68) & 0x7F;

      const regs = new Uint8Array(128);
      regs[0x75] = 0x68; // WHO_AM_I
      regs[0x6B] = 0x40; // PWR_MGMT_1 (sleep on reset)

      function i16(v) { const n = Math.round(v) & 0xFFFF; return [(n >> 8) & 0xFF, n & 0xFF]; }
      function refresh() {
        const ax  = (getSensorValue?.('accelX')      ?? 0)  * 16384;
        const ay  = (getSensorValue?.('accelY')      ?? 0)  * 16384;
        const az  = (getSensorValue?.('accelZ')      ?? 1)  * 16384;
        const gx  = (getSensorValue?.('gyroX')       ?? 0)  * 131;
        const gy  = (getSensorValue?.('gyroY')       ?? 0)  * 131;
        const gz  = (getSensorValue?.('gyroZ')       ?? 0)  * 131;
        const tmp = ((getSensorValue?.('temperature') ?? 25) * 340) + 36053;
        const d   = [...i16(ax), ...i16(ay), ...i16(az), ...i16(tmp),
                     ...i16(gx), ...i16(gy), ...i16(gz)];
        for (let i = 0; i < d.length; i++) regs[0x3B + i] = d[i];
      }

      let ptr = 0; let phase = 'reg';
      const slave = {
        onStart()  { phase = 'reg'; },
        onStop()   {},
        onWrite(b) { if (phase === 'reg') { ptr = b & 0x7F; phase = 'data'; } else { regs[ptr++ & 0x7F] = b; } },
        onRead()   { refresh(); return regs[ptr++ & 0x7F]; },
      };

      registerI2CSlave(addr, slave);
      console.log(`[MPU6050] Registrado en bus I²C, dirección 0x${addr.toString(16).toUpperCase()}`);
      return () => unregisterI2CSlave?.(addr);
    },
  },

  // ── RTC DS1307 (I²C, 0x68) ───────────────────────────────────────────────
  // Retorna la hora del sistema del navegador en formato BCD.
  // Compatible con la librería RTClib de Adafruit.
  'wokwi-ds1307': {
    attachEvents(element, { registerI2CSlave, unregisterI2CSlave }) {
      if (!registerI2CSlave) {
        console.warn('[DS1307] No hay bus I²C disponible');
        return null;
      }
      const addr = 0x68;
      const bcd  = (n) => ((Math.floor(n / 10) << 4) | (n % 10)) & 0xFF;
      const snapshot = () => {
        const t = new Date();
        return [
          bcd(t.getSeconds()),        // 0x00
          bcd(t.getMinutes()),        // 0x01
          bcd(t.getHours()),          // 0x02 (24 h)
          bcd(t.getDay() || 7),       // 0x03 (1-7)
          bcd(t.getDate()),           // 0x04
          bcd(t.getMonth() + 1),      // 0x05
          bcd(t.getFullYear() % 100), // 0x06
          0x00,                       // 0x07 control
        ];
      };
      let ptr = 0; let phase = 'reg';
      const slave = {
        onStart()  { phase = 'reg'; },
        onStop()   {},
        onWrite(b) { if (phase === 'reg') { ptr = b & 0x3F; phase = 'data'; } },
        onRead()   { return snapshot()[ptr++ & 0x07] ?? 0; },
      };
      registerI2CSlave(addr, slave);
      console.log('[DS1307] Registrado en bus I²C, dirección 0x68');
      return () => unregisterI2CSlave?.(addr);
    },
  },

  // ── Celda de Carga HX711 ──────────────────────────────────────────────────
  // DOUT LOW = conversión lista. Cada flanco subida de PD_SCK desplaza un
  // bit (MSB first, 24 bits). Peso configurado en sensorConfig['weight'] (g).
  'wokwi-hx711': {
    attachEvents(element, { getConnectedPin, registerPinListener, setPinState, getSensorValue }) {
      const sckPin  = getConnectedPin('PD_SCK') ?? getConnectedPin('SCK');
      const doutPin = getConnectedPin('DOUT');
      if (sckPin == null || doutPin == null) return null;

      let bitIdx = 0; let dataWord = 0; let ready = false;

      const readyId = setInterval(() => {
        if (!ready) {
          const w   = getSensorValue?.('weight') ?? 0;
          const raw = Math.round(Math.max(-5000, Math.min(5000, w)) / 5000 * 0x7FFFFF);
          dataWord  = raw & 0xFFFFFF;
          bitIdx    = 0;
          ready     = true;
          setPinState(doutPin, 0); // DOUT LOW = listo
        }
      }, 100);

      const onPinChange = (pin, value) => {
        if (pin !== sckPin || !value || !ready) return;
        if (bitIdx < 24) {
          setPinState(doutPin, (dataWord >> (23 - bitIdx)) & 1);
          bitIdx++;
        } else {
          setPinState(doutPin, 1);
          ready = false;
        }
      };

      const unsub = registerPinListener(onPinChange);
      return () => {
        clearInterval(readyId);
        if (typeof unsub === 'function') unsub();
      };
    },
  },

  // ── Motor Paso a Paso (4 hilos, secuencia full-step) ─────────────────────
  // Decodifica la secuencia A+/A-/B+/B- y actualiza el ángulo del elemento
  // a razón de 1.8 °/paso (motor de 200 pasos/vuelta).
  'wokwi-stepper-motor': {
    onPinChange(element, pinName, value) {
      if (!element._sm) element._sm = { pins: {}, angle: 0, last: -1 };
      element._sm.pins[pinName] = !!value;
      const { 'A+': ap, 'A-': an, 'B+': bp, 'B-': bn } = element._sm.pins;
      const pat = (ap ? 1 : 0) | (an ? 2 : 0) | (bp ? 4 : 0) | (bn ? 8 : 0);
      if (pat === element._sm.last) return;
      element._sm.last = pat;
      const CW  = [0b0101, 0b0110, 0b1010, 0b1001];
      const CCW = [0b1001, 0b1010, 0b0110, 0b0101];
      if (CW.includes(pat))  element._sm.angle = (element._sm.angle + 1.8)        % 360;
      if (CCW.includes(pat)) element._sm.angle = (element._sm.angle - 1.8 + 360)  % 360;
      try { element.angle = element._sm.angle; } catch (_) {}
    },
  },

  // ── Motor Paso a Paso Biaxial ─────────────────────────────────────────────
  'wokwi-biaxial-stepper': {
    onPinChange(element, pinName, value) {
      partBehaviors['wokwi-stepper-motor'].onPinChange(element, pinName, value);
    },
  },

  // ── IR Receiver / IR Remote (stubs visuales) ──────────────────────────────
  // La simulación completa del protocolo NEC (38 kHz modulado) requiere
  // acceso al contador de ciclos del AVR — pendiente de soporte futuro.
  'wokwi-ir-receiver': { attachEvents() { return null; } },
  'wokwi-ir-remote':   { attachEvents() { return null; } },
};

/**
 * Obtener el comportamiento de simulación para un tipo de componente.
 * @param {string} componentType - Nombre del tag (ej: 'wokwi-led')
 * @returns {object|null} Comportamiento con onPinChange y/o attachEvents
 */
export function getBehavior(componentType) {
  return partBehaviors[componentType] || null;
}

/**
 * Verificar si un tipo de componente tiene comportamiento de output
 * (reacciona a cambios de pin del CPU).
 */
export function isOutputComponent(componentType) {
  const b = partBehaviors[componentType];
  return b && typeof b.onPinChange === 'function';
}

/**
 * Verificar si un tipo de componente tiene comportamiento de input
 * (genera eventos que afectan al CPU).
 */
export function isInputComponent(componentType) {
  const b = partBehaviors[componentType];
  return b && typeof b.attachEvents === 'function';
}

export default partBehaviors;
