/*
 * ============================================================
 * LocaleGuard.jsx - Sincroniza idioma de URL con i18next
 * ============================================================
 *
 * Se coloca como layout wrapper alrededor de las rutas /:lang/*.
 * Responsabilidades:
 * 1. Valida que :lang sea 'es' o 'en'
 * 2. Sincroniza i18n.language con el param de la URL
 * 3. Redirige a /es/ si el idioma no es válido
 */

import { useEffect } from 'react';
import { useParams, Outlet, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGS, DEFAULT_LANG } from '../hooks/useLocale';

export default function LocaleGuard() {
  const { lang } = useParams();
  const { i18n } = useTranslation();

  const isValid = SUPPORTED_LANGS.includes(lang);

  useEffect(() => {
    if (isValid && i18n.language !== lang) {
      i18n.changeLanguage(lang);
    }
  }, [lang, isValid, i18n]);

  if (!isValid) {
    return <Navigate to={`/${DEFAULT_LANG}/`} replace />;
  }

  return <Outlet />;
}
