/*
 * ============================================================
 * TranslationBanner.jsx - Banner para contenido sin traducción
 * ============================================================
 *
 * Muestra un aviso sutil cuando el usuario navega en /en/ pero
 * el contenido de la lección/curso solo está en español.
 *
 * Se usa dentro de LessonViewer y opcionalmente en CourseDetail.
 */

import { useLocale } from '../hooks/useLocale';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

/**
 * @param {object} props
 * @param {boolean} props.isTranslated - true si el contenido está disponible en el idioma actual
 */
export default function TranslationBanner({ isTranslated = false }) {
  const { lang } = useLocale();
  const { t } = useTranslation();

  // Solo mostrar en /en/ cuando el contenido NO está traducido
  if (lang === 'es' || isTranslated) return null;

  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-lg px-4 py-3 mb-6 flex items-start gap-3">
      <Globe className="w-5 h-5 text-amber-500 dark:text-amber-400 mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
          {t('translation.notAvailable', 'This content is not yet available in English')}
        </p>
        <p className="text-xs text-amber-600 dark:text-amber-400/80 mt-0.5">
          {t('translation.showingOriginal', 'Showing the original Spanish version. Translation is in progress.')}
        </p>
      </div>
    </div>
  );
}
