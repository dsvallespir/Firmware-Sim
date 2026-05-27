import { useState, useCallback } from 'react';
import { ESPLoader, Transport } from 'esptool-js';

export const useESP32Flasher = () => {
  const [device, setDevice] = useState(null);

  const connectDevice = useCallback(async () => {
    try {
      const authorizedPorts = await navigator.serial.getPorts();
      if (authorizedPorts.length > 0) {
        const nativePort = authorizedPorts[0];
        setDevice(nativePort);
        return nativePort;
      } else {
        console.log("No hay puertos guardados. Solicitando selección explícita...");
        const nativePort = await navigator.serial.requestPort();
        setDevice(nativePort);
        return nativePort;
      }
    } catch (error) {
      console.error("Error al inicializar el puerto serie:", error);
      return null;
    }
  }, []);

  const flashDevice = useCallback(async (binaryArrayBuffer, activeDevice = device) => {

    console.log("=== CONTROL EN EL HOOK ===");
    console.log("¿Qué tipo de dato llegó?:", typeof binaryArrayBuffer);
    console.log("¿Es ArrayBuffer?:", binaryArrayBuffer instanceof ArrayBuffer);
    console.log("Tamaño exacto que recibe el Hook:", binaryArrayBuffer?.byteLength);
    const targetDevice = activeDevice || device;
    
    if (!targetDevice) {
      throw new Error("No hay ningún dispositivo ESP32 seleccionado.");
    }

    // 1. DECLARAMOS LAS VARIABLES AFUERA DEL TRY
    // Esto asegura que el bloque 'finally' las pueda ver y limpiar pase lo que pase
    let transport = null;
    let esploader = null;
/*
    try {
      console.log("Inicializando instancias de transporte...");
      transport = new Transport(targetDevice);
      
      esploader = new ESPLoader({
        transport: transport,
        baudrate: 115200, // Velocidad base ultra estable para CH340
        terminal: {
          clean: () => console.clear(),
          writeLine: (msg) => console.log(`[Esptool]: ${msg}`),
          write: (msg) => console.log(msg),
        }
      });

      console.log("Iniciando secuencia automática de Handshake via main()...");
      console.log("💡 Si se queda en 'Connecting...', mantené presionado el botón BOOT.");
      
      // 2. main() maneja la apertura del puerto y el reset por hardware de forma nativa
      const chip = await esploader.main();
      console.log(`¡Conectado con éxito! Chip detectado: ${chip}`);
      
      // 3. Opciones de flasheo para el binario estándar de la App (.bin común de Arduino)
      const flashOptions = {
        fileArray: [{ 
          data: binaryArrayBuffer, 
          address: 0x10000 // Dirección de la partición de la App (Factory)
        }],
        flashSize: '4MB', // Tu chip WROOM-32D N4
        flashMode: 'dio',          
        flashFreq: '40mhz',
      };

      console.log("Escribiendo bloques de datos reales en la Flash (0x10000)...");
      await esploader.writeFlash(flashOptions);
      console.log("¡Flasheo completado con éxito en el silicio!");

      //await esploader.f
      // 4. Hard reset final para ejecutar la aplicación del alumno
      await transport.setRTS(true);
      await new Promise(resolve => setTimeout(resolve, 200));
      await transport.setRTS(false);

    }*/
    try {
      console.log("Inicializando instancias de transporte...");
      transport = new Transport(targetDevice);
      
      esploader = new ESPLoader({
        transport: transport,
        baudrate: 115200,      // Velocidad nativa súper estable para el CH340
        terminal: {
          clean: () => console.log("aca va el clear"),
          writeLine: (msg) => console.log(`[Esptool]: ${msg}`),
          write: (msg) => console.log(msg),
        }
      });

      console.log("Iniciando secuencia automática de Handshake...");
      
      // Asegurate de dejarlo limpio (sin el false)
      const chip = await esploader.main(); 
      console.log(`Chip detectado: ${chip}`);

      // 🚀 AGREGAMOS LA PROPIEDAD DE COMPRESIÓN ACÁ ADENTRO
      const flashOptions = {
        fileArray: [{ 
          data: new Uint8Array(binaryArrayBuffer), 
          address: 0x10000,
          compress: true // 🚀 CLAVE 1: Dentro del objeto del archivo
        }],
        flashSize: '4MB',
        flashMode: 'dio',
        flashFreq: '40mhz',
        compress: true  // 🚀 CLAVE 2: En la raíz de las opciones
      };

      console.log("Escribiendo bloques comprimidos de forma nativa en 0x10000...");
      await esploader.writeFlash(flashOptions);
      console.log("¡Flasheo completado con éxito en el silicio!");

      // 4. Hard reset por hardware (RTS/DTR) para arrancar la aplicación
      console.log("Reiniciando dispositivo...");
      await transport.setRTS(true);
      await new Promise(resolve => setTimeout(resolve, 200));
      await transport.setRTS(false);

    }   catch (err) {
      console.error("Error en la transferencia de comandos:", err);
      throw err;
    } finally {
      // 5. 🔥 LIMPIEZA ABSOLUTA Y SEGURA: Ahora 'transport' sí existe acá adentro
      if (transport) {
        console.log("Cerrando transporte de esptool-js y liberando puerto de forma efectiva...");
        try {
          await transport.disconnect(); 
          console.log("Puerto liberado e inmaculado.");
        } catch (closeError) {
          console.warn("Fallo crítico al cerrar el puerto físico:", closeError);
        }
      }
      // Pequeño tiempo muerto para que el kernel de Linux asimile el cierre antes de otra petición
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }, [device]);

  return { device, connectDevice, flashDevice };
};