/*
 * ============================================================
 * NotFound.jsx - Página 404
 * ============================================================
 */

import { Link } from 'react-router-dom';
import LocaleLink from '../components/LocaleLink';
import { useTranslation } from 'react-i18next';
import { Home } from 'lucide-react';

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-8xl font-bold text-slate-200 mb-4">404</h1>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
          {t('notFound.title')}
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mb-8">
          {t('notFound.body')}
        </p>
        <LocaleLink to="/" className="btn-primary inline-flex items-center gap-2">
          <Home className="w-4 h-4" />
          {t('notFound.backHome')}
        </LocaleLink>
      </div>
    </div>
  );
}
