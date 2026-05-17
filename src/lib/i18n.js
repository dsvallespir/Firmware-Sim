/*
 * ============================================================
 * i18n.js - Configuración de internacionalización
 * ============================================================
 *
 * Idiomas soportados: es (español), en (inglés)
 *
 * Prioridad de detección:
 *   1. localStorage (preferencia guardada por el usuario)
 *   2. navigator.language (idioma del navegador)
 *   3. Fallback: 'es'
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import es from '../locales/es.json';
import en from '../locales/en.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: es },
      en: { translation: en },
    },
    fallbackLng: 'es',
    supportedLngs: ['es', 'en'],
    detection: {
      order: ['path', 'localStorage', 'navigator'],
      lookupFromPathIndex: 0,          // first segment: /es/… or /en/…
      lookupLocalStorage: 'fa_locale',
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false, // React ya escapa
    },
  });

export default i18n;
