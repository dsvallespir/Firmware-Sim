/*
 * ============================================================
 * CookieBanner.jsx - Banner de consentimiento de cookies
 * ============================================================
 * 
 * Muestra un banner informativo sobre el uso de cookies/localStorage
 * en la primera visita del usuario.
 * 
 * Comportamiento:
 * - Se muestra solo si no hay consentimiento previo en localStorage
 * - Al aceptar, guarda "cookie_consent" = "accepted" con timestamp
 * - Al rechazar, guarda "cookie_consent" = "rejected"
 * - No bloquea la navegación (banner informativo, no bloqueante)
 * 
 * Cumplimiento: Informar al usuario sobre el uso de almacenamiento
 * local según buenas prácticas y normativa argentina.
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import LocaleLink from './LocaleLink';
import { Cookie, X } from 'lucide-react';

const CONSENT_KEY = 'cookie_consent';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Mostrar solo si no hay decisión previa
    const consent = localStorage.getItem(CONSENT_KEY);
    if (!consent) {
      // Pequeño delay para no competir con el render inicial
      const timer = setTimeout(() => setVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(
      CONSENT_KEY,
      JSON.stringify({ status: 'accepted', timestamp: new Date().toISOString() })
    );
    setVisible(false);
  };

  const handleReject = () => {
    localStorage.setItem(
      CONSENT_KEY,
      JSON.stringify({ status: 'rejected', timestamp: new Date().toISOString() })
    );
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6 animate-slide-up">
      <div className="max-w-4xl mx-auto bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl shadow-2xl p-4 sm:p-6">
        <div className="flex items-start gap-4">
          {/* Ícono */}
          <Cookie className="w-6 h-6 text-primary-500 flex-shrink-0 mt-0.5" />

          {/* Contenido */}
          <div className="flex-1 min-w-0">
            <h3 className="text-slate-800 font-semibold text-sm mb-1">
              Uso de Cookies y Almacenamiento Local
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
              Este sitio utiliza almacenamiento local (localStorage) para mantener
              tu sesión activa y mejorar tu experiencia de navegación. No utilizamos
              cookies de seguimiento de terceros.{' '}
              <LocaleLink
                to="/cookies"
                className="text-primary-600 hover:text-primary-700 underline"
              >
                Más información
              </LocaleLink>
            </p>
          </div>

          {/* Botón cerrar (mobile) */}
          <button
            onClick={handleReject}
            className="sm:hidden text-slate-400 hover:text-slate-600 dark:text-slate-400 p-1"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Botones */}
        <div className="flex items-center justify-end gap-3 mt-4">
          <button
            onClick={handleReject}
            className="hidden sm:inline-flex text-slate-500 hover:text-slate-700 text-sm 
                       px-4 py-2 rounded-lg transition-colors"
          >
            Rechazar
          </button>
          <button
            onClick={handleAccept}
            className="btn-primary text-sm px-6 py-2"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}
