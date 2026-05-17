/*
 * ============================================================
 * CourseDetail.jsx - Página de detalle de un curso
 * ============================================================
 * 
 * Muestra:
 * - Header con info del curso, precio, CTA
 * - Lista de módulos con lecciones (expandibles)
 * - Progreso si está inscrito
 * - Botón de compra / inscripción
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import LocaleLink from '../components/LocaleLink';
import { useTranslation } from 'react-i18next';
import {
  BookOpen, Clock, Signal, ChevronDown, ChevronRight,
  Lock, Play, CheckCircle2, ShoppingCart, Loader2, Cpu
} from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useLocale } from '../hooks/useLocale';
import { COURSE_HARDWARE } from '../data/courseHardware';

export default function CourseDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { t } = useTranslation();
  const { localePath } = useLocale();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedModules, setExpandedModules] = useState(new Set());
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    const fetchCourse = async () => {
      try {
        const { data } = await api.get(`/courses/${slug}`);
        setCourse(data);
        // Expandir el primer módulo por defecto
        if (data.modules?.length > 0) {
          setExpandedModules(new Set([data.modules[0].id]));
        }
      } catch (err) {
        console.error('Error loading course:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCourse();
  }, [slug]);

  const toggleModule = (moduleId) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  };

  const handlePurchase = async () => {
    if (!isAuthenticated) {
      navigate(localePath('/login'), { state: { from: { pathname: localePath(`/courses/${slug}`) } } });
      return;
    }

    try {
      setPurchasing(true);
      const { data } = await api.post('/payments/create-checkout', {
        course_id: course.id,
      });

      if (data.preference_id === 'free') {
        // Curso gratuito: recargar la página
        window.location.reload();
      } else {
        // Guardar order_id para tracking después del redirect
        if (data.order_id) {
          sessionStorage.setItem('pending_order_id', data.order_id);
        }
        // Lemon Squeezy: abrir overlay si disponible
        if (window.LemonSqueezy && data.checkout_url.includes('lemonsqueezy.com')) {
          window.LemonSqueezy.Url.Open(data.checkout_url);
        } else {
          // MercadoPago u otro: redirect clásico
          window.location.href = data.checkout_url;
        }
      }
    } catch (err) {
      console.error('Error creating checkout:', err);
      alert(err.response?.data?.detail || 'Error al procesar el pago');
    } finally {
      setPurchasing(false);
    }
  };

  // Se usa t() inline para las etiquetas de dificultad
  const getDifficultyLabel = (d) => t(`courseDetail.difficulty.${d}`) || d;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">{t('courseDetail.notFound')}</h1>
        <LocaleLink to="/courses" className="btn-primary">{t('courseDetail.viewCatalog')}</LocaleLink>
      </div>
    );
  }

  // Las lecciones tipo 'code' son archivos fuente del CodeExplorer, no lecciones navegables
  const isLesson = (l) => l.lesson_type !== 'code';

  const totalLessons = course.modules.reduce(
    (acc, m) => acc + m.lessons.filter(isLesson).length, 0
  );

  return (
    <div>
      {/* ============================================================
       * HEADER DEL CURSO
       * ============================================================ */}
      <section className="bg-gradient-to-b from-slate-50 dark:from-dark-900 to-white dark:to-dark-950 py-12 border-b border-slate-200 dark:border-dark-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Info del curso */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-medium px-2 py-1 rounded-full text-primary-600 bg-primary-600/10">
                  {course.language}
                </span>
                <span className="text-xs font-medium px-2 py-1 rounded-full text-yellow-400 bg-yellow-400/10">
                  {getDifficultyLabel(course.difficulty)}
                </span>
              </div>

              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-100 mb-4">
                {course.title}
              </h1>

              <p className="text-slate-600 dark:text-slate-400 text-lg mb-6 leading-relaxed">
                {course.description}
              </p>

              {/* Stats */}
              <div className="flex flex-wrap items-center gap-6 text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5" />
                  {course.modules.length} {t('courseDetail.modules')}
                </span>
                <span className="flex items-center gap-2">
                  <Signal className="w-5 h-5" />
                  {totalLessons} {t('courseDetail.lessons')}
                </span>
                {course.estimated_hours && (
                  <span className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    {course.estimated_hours} {t('courseDetail.hours')}
                  </span>
                )}
              </div>

              {/* Barra de progreso si está inscrito */}
              {course.is_enrolled && course.user_progress !== null && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-600 dark:text-slate-400">{t('courseDetail.yourProgress')}</span>
                    <span className="text-sm font-medium text-accent-400">
                      {course.user_progress}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-accent-500 to-accent-400 rounded-full transition-all duration-500"
                      style={{ width: `${course.user_progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Tarjeta de compra/acceso */}
            <div className="card p-6 h-fit lg:sticky lg:top-24">
              <div className="text-center mb-6">
                <div className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-1">
                  {course.price > 0
                    ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(course.price)
                    : t('courseDetail.free')}
                </div>
                {course.price > 0 && (
                  <p className="text-slate-500 dark:text-slate-400 text-sm">{t('courseDetail.lifelongAccess')}</p>
                )}
              </div>

              {course.is_enrolled ? (
                <LocaleLink
                  to={course.modules[0]?.lessons[0]
                    ? `/learn/${course.slug}/${course.modules[0].slug}/${course.modules[0].lessons[0].slug}`
                    : '#'
                  }
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <Play className="w-5 h-5" />
                  {t('courseDetail.continuelearning')}
                </LocaleLink>
              ) : (
                <button
                  onClick={handlePurchase}
                  disabled={purchasing}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  {purchasing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <ShoppingCart className="w-5 h-5" />
                  )}
                  {course.price > 0 ? t('courseDetail.buyNow') : t('courseDetail.enrollFree')}
                </button>
              )}

              <ul className="mt-6 space-y-3 text-sm text-slate-600 dark:text-slate-400">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-accent-400 flex-shrink-0" />
                  {t('courseDetail.features.progressiveModules', { count: course.modules.length })}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-accent-400 flex-shrink-0" />
                  {t('courseDetail.features.sourceCode')}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-accent-400 flex-shrink-0" />
                  {t('courseDetail.features.lifelongAccess')}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-accent-400 flex-shrink-0" />
                  {t('courseDetail.features.updates')}
                </li>
              </ul>
            </div>

            {/* ============================================================
             * HARDWARE NECESARIO (BOM)
             * ============================================================ */}
            {COURSE_HARDWARE[course.slug]?.length > 0 && (
              <div className="card p-6 mt-4">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-primary-600" />
                  {t('courseDetail.hardware.title')}
                </h3>
                <ul className="space-y-2">
                  {COURSE_HARDWARE[course.slug].map((item) => (
                    <li key={item.name} className="text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <span className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
                          <span className="mt-0.5">{item.icon}</span>
                          <span>
                            {item.name}
                            {item.note && (
                              <span className="block text-xs text-slate-400 mt-0.5">
                                {item.note}
                              </span>
                            )}
                          </span>
                        </span>
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary-600 hover:underline text-xs shrink-0 mt-0.5"
                          >
                            {t('courseDetail.hardware.buy')}
                          </a>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ============================================================
       * CONTENIDO DEL CURSO (Módulos y Lecciones)
       * ============================================================ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">
          {t('courseDetail.contentTitle')}
        </h2>

        <div className="space-y-3">
          {course.modules.map((module) => (
            <div key={module.id} className="card">
              {/* Header del módulo (clickeable para expandir) */}
              <button
                onClick={() => toggleModule(module.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-dark-800 dark:bg-dark-950 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {expandedModules.has(module.id) ? (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  )}
                  <div className="text-left">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                      {module.title}
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">
                      {t('courseDetail.lessonsCount', { count: module.lessons.filter(isLesson).length })}
                    </p>
                  </div>
                </div>
              </button>

              {/* Lista de lecciones (expandible) */}
              {expandedModules.has(module.id) && (
                <div className="border-t border-slate-200 dark:border-dark-700">
                  {module.lessons.filter(isLesson).map((lesson) => (
                    <div
                      key={lesson.id}
                      className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 last:border-0"
                    >
                      {/* Icono de estado */}
                      {lesson.is_preview || course.is_enrolled ? (
                        <Play className="w-4 h-4 text-primary-600 flex-shrink-0" />
                      ) : (
                        <Lock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      )}

                      {/* Info de la lección */}
                      <div className="flex-1">
                        {lesson.is_preview || course.is_enrolled ? (
                          <LocaleLink
                            to={`/learn/${course.slug}/${module.slug}/${lesson.slug}`}
                            className="text-slate-700 dark:text-slate-300 hover:text-primary-600 transition-colors text-sm"
                          >
                            {lesson.title}
                          </LocaleLink>
                        ) : (
                          <span className="text-slate-500 dark:text-slate-400 text-sm">
                            {lesson.title}
                          </span>
                        )}
                      </div>

                      {/* Badges */}
                      <div className="flex items-center gap-2">
                        {lesson.is_preview && (
                          <span className="text-xs text-accent-400 bg-accent-400/10 px-2 py-0.5 rounded">
                            {t('courseDetail.preview')}
                          </span>
                        )}
                        <span className="text-xs text-slate-400">
                          {lesson.lesson_type === 'theory' ? '📖' : '💻'}
                        </span>
                        {lesson.estimated_minutes && (
                          <span className="text-xs text-slate-400">
                            {lesson.estimated_minutes} min
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
