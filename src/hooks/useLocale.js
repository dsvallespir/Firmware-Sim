/*
 * ============================================================
 * useLocale.js - Hook para navegación localizada por URL
 * ============================================================
 *
 * Lee el parámetro :lang de la URL y provee helpers:
 * - lang: idioma actual ('es' | 'en')
 * - localePath(path): prefija path con /:lang
 * - switchLocalePath(newLang): misma ruta con otro idioma
 *
 * Ejemplo:
 *   const { lang, localePath } = useLocale();
 *   <Link to={localePath('/courses')}>  →  /es/courses
 */

import { useParams, useLocation } from 'react-router-dom';

const SUPPORTED = ['es', 'en'];
const DEFAULT_LANG = 'es';

export function useLocale() {
  const { lang } = useParams();
  const location = useLocation();

  const resolvedLang = SUPPORTED.includes(lang) ? lang : DEFAULT_LANG;

  /** Prepend /:lang to a path.  localePath('/courses') → '/es/courses' */
  const localePath = (path) => {
    const clean = path.startsWith('/') ? path : `/${path}`;
    return `/${resolvedLang}${clean}`;
  };

  /** Return current path but with a different locale prefix */
  const switchLocalePath = (newLang) => {
    const pathWithoutLang = location.pathname.replace(/^\/(es|en)/, '');
    return `/${newLang}${pathWithoutLang || '/'}${location.search}`;
  };

  return { lang: resolvedLang, localePath, switchLocalePath };
}

export { SUPPORTED as SUPPORTED_LANGS, DEFAULT_LANG };
