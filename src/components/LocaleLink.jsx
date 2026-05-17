/*
 * ============================================================
 * LocaleLink.jsx - Link con prefijo de idioma automático
 * ============================================================
 *
 * Drop-in replacement para <Link>:
 *   <LocaleLink to="/courses">  →  <Link to="/es/courses">
 *
 * Si `to` ya incluye el prefijo de idioma, no lo duplica.
 * Pasa todas las props adicionales al <Link> subyacente.
 */

import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { useLocale } from '../hooks/useLocale';

const LocaleLink = forwardRef(function LocaleLink({ to, children, ...props }, ref) {
  const { localePath } = useLocale();

  // If 'to' is an object (like { pathname, state }), handle it
  if (typeof to === 'object' && to !== null) {
    const prefixed = to.pathname ? { ...to, pathname: localePath(to.pathname) } : to;
    return <Link ref={ref} to={prefixed} {...props}>{children}</Link>;
  }

  // Skip prefixing for anchors (#), external links, or already-prefixed paths
  if (typeof to === 'string' && (to.startsWith('#') || to.startsWith('http') || /^\/(es|en)\//.test(to))) {
    return <Link ref={ref} to={to} {...props}>{children}</Link>;
  }

  return <Link ref={ref} to={localePath(to)} {...props}>{children}</Link>;
});

export default LocaleLink;
