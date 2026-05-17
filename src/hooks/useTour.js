/**
 * useTour.js — Hook para el tutorial interactivo de onboarding
 *
 * Gestiona el estado del tour (paso activo, activo/inactivo) y persiste
 * la bandera "ya visto" en localStorage para no repetirlo.
 *
 * Uso:
 *   const tour = useTour('viewer_tour_seen', steps);
 *   tour.isActive    → bool
 *   tour.step        → número de paso actual (0-based)
 *   tour.total       → total de pasos
 *   tour.next()      → avanzar
 *   tour.prev()      → retroceder
 *   tour.skip()      → cerrar y marcar visto
 *   tour.reset()     → forzar que vuelva a aparecer (dev/testing)
 */
import { useState, useCallback, useEffect } from 'react';

export function useTour(storageKey, steps = []) {
  const seen = localStorage.getItem(storageKey) === '1';
  const [isActive, setIsActive] = useState(false);
  const [step, setStep] = useState(0);

  // Activar el tour una vez que se llama a start()
  const start = useCallback(() => {
    if (steps.length === 0) return;
    setStep(0);
    setIsActive(true);
  }, [steps.length]);

  const finish = useCallback(() => {
    setIsActive(false);
    localStorage.setItem(storageKey, '1');
  }, [storageKey]);

  const next = useCallback(() => {
    setStep(s => {
      const next = s + 1;
      if (next >= steps.length) {
        setIsActive(false);
        localStorage.setItem(storageKey, '1');
        return s;
      }
      return next;
    });
  }, [steps.length, storageKey]);

  const prev = useCallback(() => {
    setStep(s => Math.max(0, s - 1));
  }, []);

  const skip = useCallback(() => {
    finish();
  }, [finish]);

  const reset = useCallback(() => {
    localStorage.removeItem(storageKey);
    setStep(0);
    setIsActive(true);
  }, [storageKey]);

  return { isActive, step, total: steps.length, start, next, prev, skip, finish, reset, seen };
}
