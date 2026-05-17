/*
 * ============================================================
 * WokwiElement.jsx — Wrapper React para wokwi custom elements
 * ============================================================
 *
 * Renderiza cualquier <wokwi-*> web component dentro de React.
 * Los wokwi-elements (MIT, v1.9.2) son Lit-based Web Components
 * que se crean via document.createElement() y se sincronizan
 * con props de React manualmente.
 *
 * Responsabilidades:
 * 1. Crear el custom element y montarlo en un contenedor div
 * 2. Sincronizar props de React → propiedades del DOM element
 * 3. Extraer pinInfo del web component (posiciones de pines)
 * 4. Reenviar eventos del componente al padre
 * 5. Montar/desmontar limpiamente
 *
 * Las librerías wokwi-elements deben importarse una vez para
 * registrar los custom elements en el browser.
 */

import { useEffect, useRef, useCallback } from 'react';

// Importar wokwi-elements una sola vez para registrar custom elements
// Esto registra todos los <wokwi-*> tags en el CustomElementRegistry
let elementsLoaded = false;
async function ensureElementsLoaded() {
  if (elementsLoaded) return;
  elementsLoaded = true;
  try {
    await import('@wokwi/elements');
  } catch (e) {
    console.warn('[WokwiElement] Failed to load @wokwi/elements:', e);
    elementsLoaded = false;
  }
}

// Llamar al import al cargar el módulo
ensureElementsLoaded();

/**
 * Extraer pinInfo de un web component wokwi.
 * Los wokwi-elements exponen .pinInfo de forma async
 * (el Shadow DOM debe estar listo). Hacemos polling.
 */
function pollPinInfo(element, callback, maxAttempts = 20, interval = 100) {
  let attempts = 0;
  const timer = setInterval(() => {
    attempts++;
    const pins = element.pinInfo;
    if (pins && pins.length > 0) {
      clearInterval(timer);
      callback(pins);
    } else if (attempts >= maxAttempts) {
      clearInterval(timer);
      // Algunos componentes (resistor) no tienen pinInfo visible
    }
  }, interval);
  return () => clearInterval(timer);
}

/**
 * WokwiElement — Renderiza un web component wokwi-* dentro de React.
 *
 * @param {object} props
 * @param {string} props.tag        - Nombre del custom element (ej: 'wokwi-led')
 * @param {object} props.properties - Props a sincronizar con el DOM element
 * @param {function} props.onPinInfo - Callback con array de pin positions
 * @param {function} props.onReady   - Callback cuando el elemento está montado
 * @param {function} props.onEvent   - Callback para eventos del componente
 * @param {string} props.className  - CSS classes para el contenedor
 * @param {object} props.style      - Estilos inline para el contenedor
 */
export default function WokwiElement({
  tag,
  properties = {},
  onPinInfo,
  onReady,
  onEvent,
  className = '',
  style = {},
}) {
  const containerRef = useRef(null);
  const elementRef = useRef(null);
  const cleanupRef = useRef(null);
  const mountedRef = useRef(false);

  // Crear y montar el custom element
  useEffect(() => {
    if (!containerRef.current || mountedRef.current) return;

    const el = document.createElement(tag);
    el.style.display = 'block';

    // Limpiar contenedor (StrictMode puede llamar 2 veces)
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(el);
    elementRef.current = el;
    mountedRef.current = true;

    // Extraer pinInfo cuando esté listo
    if (onPinInfo) {
      cleanupRef.current = pollPinInfo(el, onPinInfo);
    }

    // Notificar que el elemento está listo
    if (onReady) {
      // Dar tiempo al Shadow DOM para renderizar
      requestAnimationFrame(() => {
        onReady(el);
      });
    }

    return () => {
      if (cleanupRef.current) cleanupRef.current();
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      elementRef.current = null;
      mountedRef.current = false;
    };
  }, [tag]); // Solo recrear si cambia el tag

  // Sincronizar properties → DOM element
  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;

    for (const [key, value] of Object.entries(properties)) {
      if (value !== undefined && value !== null) {
        // Preferir property assignment sobre setAttribute
        // Los Lit elements usan propiedades reactivas
        try {
          el[key] = value;
        } catch {
          el.setAttribute(key, String(value));
        }
      }
    }
  }, [properties]);

  // Manejar eventos del componente
  useEffect(() => {
    const el = elementRef.current;
    if (!el || !onEvent) return;

    // Eventos comunes de wokwi-elements
    const events = [
      'button-press', 'button-release',       // pushbutton
      'input', 'change',                        // potentiometer, slider
      'rotate-cw', 'rotate-ccw',               // rotary encoder
      'analog-value-change',                     // generic analog
    ];

    const handler = (e) => {
      onEvent(e.type, e.detail, el);
    };

    events.forEach(evt => el.addEventListener(evt, handler));

    return () => {
      events.forEach(evt => el.removeEventListener(evt, handler));
    };
  }, [onEvent]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={style}
    />
  );
}

/**
 * Hook para acceder al DOM element imperatively.
 * Útil para setear propiedades desde partBehaviors.
 */
export function useWokwiElementRef() {
  const ref = useRef(null);
  const setElement = useCallback((el) => {
    ref.current = el;
  }, []);
  return [ref, setElement];
}
