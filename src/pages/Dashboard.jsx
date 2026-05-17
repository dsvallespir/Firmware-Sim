/*
 * ============================================================
 * Dashboard.jsx - Dashboard del estudiante
 * ============================================================
 * 
 * Muestra:
 * - Resumen de cursos inscritos con progreso
 * - Estadísticas generales
 * - Acceso rápido a la última lección
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import LocaleLink from '../components/LocaleLink';
import { useTranslation } from 'react-i18next';
import { BookOpen, Trophy, Clock, ArrowRight, Loader2 } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const [progress, setProgress] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [progressRes, statsRes] = await Promise.all([
          api.get('/progress/dashboard'),
          api.get('/users/stats'),
        ]);
        setProgress(progressRes.data);
        setStats(statsRes.data);
      } catch (err) {
        console.error('Error loading dashboard:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          {t('dashboard.greeting', { username: user?.username })}
        </h1>
        <p className="text-slate-500 dark:text-slate-400">
          {t('dashboard.subtitle')}
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-500/10 rounded-lg flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.enrolled_courses}</p>
                <p className="text-slate-500 dark:text-slate-400 text-sm">{t('dashboard.stats.enrolledCourses')}</p>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-accent-500/10 rounded-lg flex items-center justify-center">
                <Trophy className="w-5 h-5 text-accent-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.completed_lessons}</p>
                <p className="text-slate-500 dark:text-slate-400 text-sm">{t('dashboard.stats.completedLessons')}</p>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {new Date(stats.member_since).toLocaleDateString(i18n.language)}
                </p>
                <p className="text-slate-500 dark:text-slate-400 text-sm">{t('dashboard.stats.memberSince')}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mis Cursos */}
      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
        {t('dashboard.myCourses')}
      </h2>

      {progress.length === 0 ? (
        <div className="card p-8 text-center">
          <BookOpen className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            {t('dashboard.noCourses')}
          </p>
          <LocaleLink to="/courses" className="btn-primary inline-flex items-center gap-2">
            {t('dashboard.exploreCourses')}
            <ArrowRight className="w-4 h-4" />
          </LocaleLink>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {progress.map((item) => (
            <div key={item.course_id} className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-dark-50">{item.course_title}</h3>
                <span className="text-sm font-medium text-accent-400">
                  {item.progress_percentage}%
                </span>
              </div>

              {/* Barra de progreso */}
              <div className="w-full h-2 bg-dark-700 rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-gradient-to-r from-accent-500 to-accent-400 rounded-full transition-all duration-500"
                  style={{ width: `${item.progress_percentage}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-sm text-dark-400">
                <span>
                  {item.completed_lessons} / {item.total_lessons} {t('dashboard.lessons')}
                </span>
                <LocaleLink
                  to={`/courses/${item.course_slug}`}
                  className="text-primary-400 hover:text-primary-300 flex items-center gap-1"
                >
                  {t('dashboard.continue')}
                  <ArrowRight className="w-3.5 h-3.5" />
                </LocaleLink>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
