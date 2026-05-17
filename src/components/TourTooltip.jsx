/**
 * TourTooltip.jsx — Tooltip de onboarding con efecto spotlight
 *
 * Renderiza un tooltip posicionado con `position: fixed` sobre el elemento
 * apuntado por `targetRef`. El overlay usa box-shadow para crear el efecto
 * spotlight sin librerías externas.
 *
 * Props:
 *   targetRef     — ref del elemento a destacar
 *   title         — título del paso
 *   body          — descripción del paso
 *   step          — índice 0-based del paso actual
 *   total         — total de pasos
 *   onNext        — callback al presionar Siguiente
 *   onPrev        — callback al presionar Anterior
 *   onSkip        — callback al omitir / finalizar
 *   isLast        — bool: si es el último paso, el botón dice "Finalizar"
 *   placement     — 'bottom' | 'top' | 'right' | 'left' (default: 'bottom')
 */
import { useEffect, useState, useRef } from 'react';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const PADDING = 10;   // px de padding alrededor del target
const TIP = 8;        // px de altura de la flecha

export default function TourTooltip({
  targetRef,
  title,
  body,
  step,
  total,
  onNext,
  onPrev,
  onSkip,
  isLast = false,
  placement = 'bottom',
}) {
  const { t } = useTranslation();
  const [rect, setRect] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const tooltipRef = useRef(null);

  // Recalcular posición cuando cambia el target o el tamaño de ventana
  useEffect(() => {
    const calculate = () => {
      const el = targetRef?.current;
      if (!el) return;

      // Scroll suave para que el target sea visible
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

      const r = el.getBoundingClientRect();
      setRect(r);

      const tw = tooltipRef.current?.offsetWidth  || 320;
      const th = tooltipRef.current?.offsetHeight || 160;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let top, left;

      if (placement === 'bottom') {
        top  = r.bottom + PADDING + TIP;
        left = r.left + r.width / 2 - tw / 2;
      } else if (placement === 'top') {
        top  = r.top - th - PADDING - TIP;
        left = r.left + r.width / 2 - tw / 2;
      } else if (placement === 'right') {
        top  = r.top + r.height / 2 - th / 2;
        left = r.right + PADDING + TIP;
      } else { // left
        top  = r.top + r.height / 2 - th / 2;
        left = r.left - tw - PADDING - TIP;
      }

      // Mantener dentro de la pantalla
      left = Math.max(12, Math.min(left, vw - tw - 12));
      top  = Math.max(12, Math.min(top,  vh - th - 12));

      setTooltipPos({ top, left });
    };

    // Pequeño delay para que el scroll termine antes de medir
    const id = setTimeout(calculate, 80);
    window.addEventListener('resize', calculate);
    return () => {
      clearTimeout(id);
      window.removeEventListener('resize', calculate);
    };
  }, [targetRef, placement, step]);

  // Spotlight: sombra masiva alrededor del rect del target
  const spotlightStyle = rect
    ? {
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        pointerEvents: 'none',
        boxShadow: `
          ${rect.left - PADDING}px          ${rect.top - PADDING}px            0 0 0 9999px rgba(0,0,0,0.60),
          inset ${-(rect.left - PADDING)}px ${-(rect.top - PADDING)}px       0 0 rgba(0,0,0,0),
          0 0 0 ${PADDING}px rgba(0,0,0,0)
        `,
        // Forma correcta: usar un clip-path de "hueco"
      }
    : {};

  // Arrow direction
  const arrowClass = {
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-primary-600 border-x-transparent border-t-transparent',
    top:    'top-full  left-1/2 -translate-x-1/2 border-t-primary-600 border-x-transparent border-b-transparent',
    right:  'right-full top-1/2 -translate-y-1/2 border-r-primary-600 border-y-transparent border-l-transparent',
    left:   'left-full  top-1/2 -translate-y-1/2 border-l-primary-600 border-y-transparent border-r-transparent',
  }[placement];

  if (!rect) return null;

  return (
    <>
      {/* Overlay oscuro con hueco spotlight */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9998,
          pointerEvents: 'all',
          background: 'transparent',
          // El recorte crea el efecto spotlight
          boxShadow: `0 0 0 9999px rgba(0,0,0,0.58)`,
          clipPath: `polygon(
            0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
            ${rect.left   - PADDING}px ${rect.top    - PADDING}px,
            ${rect.left   - PADDING}px ${rect.bottom + PADDING}px,
            ${rect.right  + PADDING}px ${rect.bottom + PADDING}px,
            ${rect.right  + PADDING}px ${rect.top    - PADDING}px,
            ${rect.left   - PADDING}px ${rect.top    - PADDING}px
          )`,
        }}
        onClick={onSkip}
        aria-hidden="true"
      />

      {/* Borde luminoso alrededor del elemento */}
      {rect && (
        <div
          style={{
            position: 'fixed',
            top:    rect.top    - PADDING,
            left:   rect.left   - PADDING,
            width:  rect.width  + PADDING * 2,
            height: rect.height + PADDING * 2,
            borderRadius: 8,
            border: '2px solid rgba(99,102,241,0.8)',
            boxShadow: '0 0 0 1px rgba(99,102,241,0.25), 0 0 16px 2px rgba(99,102,241,0.35)',
            zIndex: 9999,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        style={{
          position: 'fixed',
          top:  tooltipPos.top,
          left: tooltipPos.left,
          zIndex: 10000,
          width: 'min(320px, calc(100vw - 24px))',
        }}
        className="bg-white dark:bg-dark-900 rounded-xl shadow-2xl border border-primary-200 overflow-hidden"
        role="dialog"
        aria-modal="false"
        aria-label={title}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-500 px-4 py-3 flex items-center justify-between">
          <span className="text-white font-semibold text-sm">{title}</span>
          <div className="flex items-center gap-2">
            <span className="text-primary-200 text-xs">
              {t('tour.counter', { current: step + 1, total })}
            </span>
            <button
              onClick={onSkip}
              className="text-primary-200 hover:text-white transition-colors p-0.5 rounded"
              aria-label={t('tour.skip')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Cuerpo */}
        <div className="px-4 py-3">
          <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">{body}</p>
        </div>

        {/* Indicadores de paso */}
        <div className="flex items-center justify-center gap-1.5 pb-1">
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-300 ${
                i === step
                  ? 'w-4 h-1.5 bg-primary-500'
                  : 'w-1.5 h-1.5 bg-slate-200'
              }`}
            />
          ))}
        </div>

        {/* Footer con botones */}
        <div className="px-4 py-3 flex items-center justify-between border-t border-slate-100">
          <button
            onClick={onSkip}
            className="text-slate-400 hover:text-slate-600 dark:text-slate-400 text-xs transition-colors"
          >
            {t('tour.skip')}
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={onPrev}
                className="flex items-center gap-1 text-slate-500 hover:text-slate-700 text-sm
                           transition-colors px-2 py-1 rounded-lg hover:bg-slate-100 dark:bg-dark-800"
              >
                <ChevronLeft className="w-4 h-4" />
                {t('tour.prev')}
              </button>
            )}
            <button
              onClick={isLast ? onSkip : onNext}
              className="flex items-center gap-1 bg-primary-600 hover:bg-primary-500 text-white
                         text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              {isLast ? t('tour.finish') : t('tour.next')}
              {!isLast && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
