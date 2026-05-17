/*
 * ============================================================
 * LocaleRedirect.jsx - Redirect raíz → /:lang/
 * ============================================================
 *
 * Cuando el usuario visita /, detecta su idioma preferido
 * y lo redirige a /es/ o /en/.
 */

import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGS, DEFAULT_LANG } from '../hooks/useLocale';

export default function LocaleRedirect() {
  const { i18n } = useTranslation();

  // i18n ya detectó el idioma (localStorage → navigator → fallback)
  const detected = i18n.language?.substring(0, 2);
  const lang = SUPPORTED_LANGS.includes(detected) ? detected : DEFAULT_LANG;

  return <Navigate to={`/${lang}/`} replace />;
}
