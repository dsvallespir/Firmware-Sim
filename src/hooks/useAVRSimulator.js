/*
 * ============================================================
 * useAVRSimulator.js - Hook de simulación AVR con avr8js
 * ============================================================
 *
 * Encapsula toda la lógica de emulación ATmega328P (Arduino Uno)
 * en un hook reutilizable de React.
 *
 * Características:
 * - CPU a 16MHz con requestAnimationFrame (~60fps)
 * - Timer0/Timer1/Timer2 (millis(), delay(), PWM)
 * - USART (Serial.print / Serial.read)
 * - GPIO ports B, C, D
 * - ADC (analogRead)
 * - Callbacks para serial data y pin changes
 *
 * Uso:
 *   const sim = useAVRSimulator();
 *   sim.loadHex(hexString);
 *   sim.start();
 *   // sim.serialOutput tiene la salida del Serial
 *   // sim.serialWrite("hello") envía datos al Serial
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  CPU,
  AVRTimer,
  timer0Config,
  timer1Config,
  timer2Config,
  AVRUSART,
  usart0Config,
  AVRIOPort,
  portBConfig,
  portCConfig,
  portDConfig,
  avrInstruction,
  AVRADC,
  adcConfig,
  AVRTWI,
  twiConfig,
  AVRSPI,
  spiConfig,
} from 'avr8js';
import { I2CBus } from '../utils/i2cBus';
import { SpiBus } from '../utils/spiBus';
import { hexToUint8Array } from '../utils/hexParser';

const CPU_HZ = 16_000_000; // 16 MHz
const CYCLES_PER_MS = CPU_HZ / 1000;
const MAX_DELTA_MS = 50; // Cap para evitar burst después de tab inactiva

export default function useAVRSimulator() {
  const [isRunning, setIsRunning] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [serialOutput, setSerialOutput] = useState('');
  const [baudRate, setBaudRate] = useState(0);
  const [pinStates, setPinStates] = useState({});
  const [speed, setSpeed] = useState(1.0);
  const [cycleCount, setCycleCount] = useState(0);

  // Refs internos (no causan re-render)
  const cpuRef = useRef(null);
  const programRef = useRef(null);
  const usartRef = useRef(null);
  const portBRef = useRef(null);
  const portCRef = useRef(null);
  const portDRef = useRef(null);
  const adcRef = useRef(null);
  const twiRef = useRef(null);
  const i2cBusRef = useRef(null);
  const spiRef = useRef(null);
  const spiBusRef = useRef(null);
  const peripheralsRef = useRef([]);
  const runningRef = useRef(false);
  const pinListenersRef = useRef(new Set());
  const animFrameRef = useRef(null);
  const speedRef = useRef(1.0);
  const serialBufferRef = useRef('');
  const pinStatesRef = useRef({});
  const scheduledPinChangesRef = useRef([]); // [{atCycles, pin, value}] — sorted asc

  // Flush serial buffer al estado React periódicamente
  const flushTimerRef = useRef(null);

  useEffect(() => {
    flushTimerRef.current = setInterval(() => {
      if (serialBufferRef.current.length > 0) {
        // Capturar y limpiar el buffer AHORA (sincrónicamente)
        // para evitar race conditions con React 18 batching
        const chunk = serialBufferRef.current;
        serialBufferRef.current = '';
        setSerialOutput(prev => {
          const updated = prev + chunk;
          // Limitar a 50KB para no explotar el DOM
          if (updated.length > 50000) {
            return updated.slice(-40000);
          }
          return updated;
        });
      }
    }, 100); // flush cada 100ms

    return () => {
      if (flushTimerRef.current) clearInterval(flushTimerRef.current);
    };
  }, []);

  // Sincronizar speed ref
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  /**
   * Cargar un programa desde Intel HEX
   */
  const loadHex = useCallback((hexContent) => {
    // Parar simulación si estaba corriendo
    if (runningRef.current) {
      runningRef.current = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      setIsRunning(false);
    }

    try {
      const bytes = hexToUint8Array(hexContent);
      const progWords = 16384; // ATmega328P: 32KB = 16384 words
      const sramBytes = 8192;

      const program = new Uint16Array(progWords);
      for (let i = 0; i < bytes.length; i += 2) {
        program[i >> 1] = (bytes[i] || 0) | ((bytes[i + 1] || 0) << 8);
      }

      programRef.current = program;

      // Inicializar CPU y periféricos
      _initCPU(program, sramBytes);

      setIsLoaded(true);
      setSerialOutput('');
      serialBufferRef.current = '';
      setPinStates({});
      pinStatesRef.current = {};
      setCycleCount(0);

      console.log(`[AVR] Programa cargado: ${bytes.length} bytes, ${program.length} words`);
      return true;
    } catch (err) {
      console.error('[AVR] Error cargando hex:', err);
      return false;
    }
  }, []);

  /**
   * Inicializar CPU con periféricos
   */
  const _initCPU = useCallback((program, sramBytes) => {
    scheduledPinChangesRef.current = [];
    const cpu = new CPU(program, sramBytes);
    cpuRef.current = cpu;

    // Timers
    const timer0 = new AVRTimer(cpu, timer0Config);
    const timer1 = new AVRTimer(cpu, timer1Config);
    const timer2 = new AVRTimer(cpu, timer2Config);

    // USART (Serial)
    const usart = new AVRUSART(cpu, usart0Config, CPU_HZ);
    usartRef.current = usart;

    let serialByteCount = 0;
    usart.onByteTransmit = (value) => {
      const char = String.fromCharCode(value);
      serialBufferRef.current += char;
      if (serialByteCount === 0) {
        console.log('[AVR-USART] Primer byte transmitido');
      }
      serialByteCount++;
    };

    usart.onConfigurationChange = () => {
      if (usart.baudRate > 0) {
        setBaudRate(usart.baudRate);
      }
    };

    // GPIO Ports
    const portB = new AVRIOPort(cpu, portBConfig);
    const portC = new AVRIOPort(cpu, portCConfig);
    const portD = new AVRIOPort(cpu, portDConfig);
    portBRef.current = portB;
    portCRef.current = portC;
    portDRef.current = portD;

    // ADC
    const adc = new AVRADC(cpu, adcConfig);
    adcRef.current = adc;

    // firePinChange: inyecta bordes sintéticos en el sistema de listeners de pines.
    // Tanto AVRSPI (SCK/MOSI) como AVRTWI (SDA/SCL) controlan sus pines directamente
    // sin pasar por portB/portC.addListener. Sin esto esos pines son invisibles
    // para el Analizador Lógico y el modo Sonda.
    const firePinChange = (pin, value, cycles) => {
      pinStatesRef.current[pin] = value ? 1 : 0;
      for (const listener of pinListenersRef.current) {
        listener(pin, value ? 1 : 0, cycles);
      }
    };

    // TWI / I²C
    const twi = new AVRTWI(cpu, twiConfig, CPU_HZ);
    twiRef.current = twi;
    const bus = new I2CBus(twi, { cpu, firePinChange });
    i2cBusRef.current = bus;

    // SPI
    const spi = new AVRSPI(cpu, spiConfig, CPU_HZ);
    spiRef.current = spi;
    const spiBus = new SpiBus(spi, { cpu, firePinChange });
    spiBusRef.current = spiBus;

    // Pin listeners
    let lastPortB = 0, lastPortC = 0, lastPortD = 0;

    portB.addListener((value) => {
      if (value !== lastPortB) {
        const changes = {};
        for (let bit = 0; bit < 8; bit++) {
          const pin = 8 + bit;
          const state = (value & (1 << bit)) !== 0;
          const oldState = (lastPortB & (1 << bit)) !== 0;
          if (state !== oldState) {
            changes[pin] = state;
            pinStatesRef.current[pin] = state;
          }
        }
        lastPortB = value;
        if (Object.keys(changes).length > 0) {
          setPinStates(prev => ({ ...prev, ...changes }));
          // Notificar listeners externos (CircuitView)
          for (const listener of pinListenersRef.current) {
            for (const [pin, val] of Object.entries(changes)) {
              listener(Number(pin), val, cpu.cycles);
            }
          }
        }
      }
    });

    portC.addListener((value) => {
      if (value !== lastPortC) {
        const changes = {};
        for (let bit = 0; bit < 8; bit++) {
          const pin = 14 + bit;
          const state = (value & (1 << bit)) !== 0;
          const oldState = (lastPortC & (1 << bit)) !== 0;
          if (state !== oldState) {
            changes[pin] = state;
            pinStatesRef.current[pin] = state;
          }
        }
        lastPortC = value;
        if (Object.keys(changes).length > 0) {
          setPinStates(prev => ({ ...prev, ...changes }));
          for (const listener of pinListenersRef.current) {
            for (const [pin, val] of Object.entries(changes)) {
              listener(Number(pin), val, cpu.cycles);
            }
          }
        }
      }
    });

    portD.addListener((value) => {
      if (value !== lastPortD) {
        const changes = {};
        for (let bit = 0; bit < 8; bit++) {
          const pin = bit;
          const state = (value & (1 << bit)) !== 0;
          const oldState = (lastPortD & (1 << bit)) !== 0;
          if (state !== oldState) {
            changes[pin] = state;
            pinStatesRef.current[pin] = state;
          }
        }
        lastPortD = value;
        if (Object.keys(changes).length > 0) {
          setPinStates(prev => ({ ...prev, ...changes }));
          for (const listener of pinListenersRef.current) {
            for (const [pin, val] of Object.entries(changes)) {
              listener(Number(pin), val, cpu.cycles);
            }
          }
        }
      }
    });

    peripheralsRef.current = [timer0, timer1, timer2, usart, adc, twi, spi];
  }, []);

  /**
   * Iniciar simulación
   */
  const start = useCallback(() => {
    if (runningRef.current || !cpuRef.current) return;

    runningRef.current = true;
    setIsRunning(true);
    console.log('[AVR] Simulación iniciada');

    // Se inicializa en null; el primer frame se usa solo para capturar el timestamp
    let lastTimestamp = null;

    const execute = (timestamp) => {
      if (!runningRef.current || !cpuRef.current) return;

      // Primer frame: solo capturar timestamp base, no ejecutar ciclos
      if (lastTimestamp === null) {
        lastTimestamp = timestamp;
        animFrameRef.current = requestAnimationFrame(execute);
        return;
      }

      const rawDelta = timestamp - lastTimestamp;
      const deltaMs = Math.min(rawDelta, MAX_DELTA_MS);
      lastTimestamp = timestamp;

      // Calcular ciclos objetivo y ejecutar hasta alcanzarlos
      // (contamos por cpu.cycles, no por iteraciones — igual que el demo oficial de avr8js)
      const cyclesToRun = Math.floor(CYCLES_PER_MS * deltaMs * speedRef.current);

      try {
        const cpu = cpuRef.current;
        const targetCycles = cpu.cycles + cyclesToRun;

        // Apply scheduled pin changes (ECHO pulses, DHT22 bits, etc.) due by `now`
        const applyScheduled = () => {
          const sc = scheduledPinChangesRef.current;
          if (!sc.length) return;
          const now = cpu.cycles;
          let i = 0;
          while (i < sc.length && sc[i].atCycles <= now) {
            const { pin, value: v } = sc[i];
            if      (pin >= 0  && pin <= 7 ) portDRef.current?.setPin(pin,       v ? 1 : 0);
            else if (pin >= 8  && pin <= 13) portBRef.current?.setPin(pin - 8,   v ? 1 : 0);
            else if (pin >= 14 && pin <= 19) portCRef.current?.setPin(pin - 14,  v ? 1 : 0);
            i++;
          }
          if (i > 0) scheduledPinChangesRef.current = sc.slice(i);
        };

        let nextCheck = cpu.cycles + 100; // check every ~6.25 µs
        while (cpu.cycles < targetCycles) {
          avrInstruction(cpu);
          cpu.tick();
          if (cpu.cycles >= nextCheck) {
            nextCheck += 100;
            if (scheduledPinChangesRef.current.length > 0) applyScheduled();
          }
        }
        applyScheduled(); // final pass for any remaining
        setCycleCount(cpu.cycles);
      } catch (error) {
        console.error('[AVR] Error de simulación:', error);
        runningRef.current = false;
        setIsRunning(false);
        return;
      }

      animFrameRef.current = requestAnimationFrame(execute);
    };

    animFrameRef.current = requestAnimationFrame(execute);
  }, []);

  /**
   * Pausar simulación
   */
  const stop = useCallback(() => {
    runningRef.current = false;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setIsRunning(false);
    console.log('[AVR] Simulación pausada');
  }, []);

  /**
   * Reset: recargar programa y reiniciar CPU
   */
  const reset = useCallback(() => {
    stop();
    // Limpiar slaves I²C y devices SPI antes de reinicializar la CPU
    i2cBusRef.current?.clear();
    spiBusRef.current?.clear();
    if (programRef.current) {
      _initCPU(programRef.current, 8192);
      setSerialOutput('');
      serialBufferRef.current = '';
      setPinStates({});
      pinStatesRef.current = {};
      setCycleCount(0);
      setBaudRate(0);
      console.log('[AVR] CPU reseteada');
    }
  }, [stop, _initCPU]);

  /**
   * Enviar texto al Serial del simulador (como si el usuario escribiera en Serial Monitor)
   */
  const serialWrite = useCallback((text) => {
    if (!usartRef.current) return;
    for (let i = 0; i < text.length; i++) {
      usartRef.current.writeByte(text.charCodeAt(i));
    }
  }, []);

  /**
   * Limpiar output serial
   */
  const clearSerial = useCallback(() => {
    setSerialOutput('');
    serialBufferRef.current = '';
  }, []);

  /**
   * Cambiar velocidad de simulación
   */
  const changeSpeed = useCallback((newSpeed) => {
    const clamped = Math.max(0.1, Math.min(10.0, newSpeed));
    setSpeed(clamped);
    speedRef.current = clamped;
  }, []);

  /**
   * Setear estado de un pin externo (botón presionado, etc.)
   */
  const setPinState = useCallback((arduinoPin, state) => {
    if (arduinoPin >= 0 && arduinoPin <= 7 && portDRef.current) {
      portDRef.current.setPin(arduinoPin, state);
    } else if (arduinoPin >= 8 && arduinoPin <= 13 && portBRef.current) {
      portBRef.current.setPin(arduinoPin - 8, state);
    } else if (arduinoPin >= 14 && arduinoPin <= 19 && portCRef.current) {
      portCRef.current.setPin(arduinoPin - 14, state);
    }
  }, []);

  /**
   * Inyectar valor ADC en un canal analógico (para potenciómetros, sensores).
   * @param {number} arduinoPin - Pin analógico (14=A0, 15=A1, ..., 19=A5)
   * @param {number} value - Valor ADC 0-1023
   */
  const setAnalogValue = useCallback((arduinoPin, value) => {
    if (!adcRef.current || !cpuRef.current) return;
    // Pines analógicos: A0=14 → canal 0, A5=19 → canal 5
    const channel = arduinoPin >= 14 ? arduinoPin - 14 : arduinoPin;
    if (channel >= 0 && channel <= 5) {
      // Escribir valor en el registro ADC del CPU
      // El AVRADC de avr8js lee de channelValues
      if (adcRef.current.channelValues) {
        adcRef.current.channelValues[channel] = value / 1023; // avr8js espera 0.0-1.0
      }
    }
  }, []);

  /**
   * Programar un cambio de pin futuro (para sensores: ECHO pulse, DHT22 bits, etc.).
   * @param {number} pin          - Arduino pin (0-19)
   * @param {number} delayMicros  - Microsegundos desde ahora
   * @param {0|1}    value        - Nuevo estado
   */
  const schedulePinChange = useCallback((pin, delayMicros, value) => {
    if (!cpuRef.current) return;
    const atCycles = cpuRef.current.cycles + Math.round(delayMicros * (CPU_HZ / 1_000_000));
    const item = { atCycles, pin, value: value ? 1 : 0 };
    // Insert maintaining sorted order
    const sc = scheduledPinChangesRef.current;
    let idx = sc.length;
    for (let i = sc.length - 1; i >= 0; i--) {
      if (sc[i].atCycles <= atCycles) { idx = i + 1; break; }
      idx = i;
    }
    sc.splice(idx, 0, item);
  }, []);

  /**
   * Registrar un listener de cambios de pin.
   * @param {function(number, boolean): void} listener - callback(pinNumber, value)
   * @returns {function} unregister function
   */
  const registerPinListener = useCallback((listener) => {
    pinListenersRef.current.add(listener);
    return () => pinListenersRef.current.delete(listener);
  }, []);

  // ---------------------------------------------------------------------------
  // Debugger — step & snapshot
  // ---------------------------------------------------------------------------

  /**
   * Leer el estado actual del CPU como un objeto plano (sin ejecutar nada).
   * Retorna null si el CPU no está inicializado.
   */
  const getCpuSnapshot = useCallback(() => {
    const cpu = cpuRef.current;
    if (!cpu) return null;
    const regs = Array.from({ length: 32 }, (_, i) => cpu.data[i]);
    const X = (cpu.data[27] << 8) | cpu.data[26];
    const Y = (cpu.data[29] << 8) | cpu.data[28];
    const Z = (cpu.data[31] << 8) | cpu.data[30];
    return {
      regs,
      pc:     cpu.pc,
      pcByte: cpu.pc * 2,
      sp:     cpu.SP,
      sreg:   cpu.SREG,
      cycles: cpu.cycles,
      X, Y, Z,
    };
  }, []);

  /**
   * Ejecutar una sola instrucción AVR (step-over) y retornar el nuevo snapshot.
   * Pausa la simulación continua si estaba corriendo.
   * Retorna null si el CPU no está cargado.
   */
  const step = useCallback(() => {
    // Asegurarse de que la simulación continua está detenida
    if (runningRef.current) {
      runningRef.current = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      setIsRunning(false);
    }

    const cpu = cpuRef.current;
    if (!cpu) return null;

    try {
      avrInstruction(cpu);
      cpu.tick();
      setCycleCount(cpu.cycles);

      // Notificar pin listeners (el tick puede haber cambiado puertos)
      for (const listener of pinListenersRef.current) {
        // Los port listeners se activan automáticamente via addListener en portB/C/D
        // No necesitamos iterar manualmente aquí — avr8js los llama en cpu.tick()
      }
    } catch (err) {
      console.error('[AVR step] Error:', err);
    }

    return getCpuSnapshot();
  }, [getCpuSnapshot]);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      runningRef.current = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      pinListenersRef.current.clear();
    };
  }, []);

  return {
    // Estado
    isRunning,
    isLoaded,
    serialOutput,
    baudRate,
    pinStates,
    speed,
    cycleCount,

    // Acciones
    loadHex,
    start,
    stop,
    reset,
    serialWrite,
    clearSerial,
    changeSpeed,
    setPinState,
    setAnalogValue,
    schedulePinChange,
    registerPinListener,

    // Debugger
    step,
    getCpuSnapshot,

    // I²C
    i2cBus: i2cBusRef,

    // SPI
    spiBus: spiBusRef,
  };
}

