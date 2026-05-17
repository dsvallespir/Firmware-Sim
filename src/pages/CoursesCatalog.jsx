/*
 * ============================================================
 * CoursesCatalog.jsx - Página de catálogo de cursos
 * ============================================================
 * 
 * Muestra todos los cursos publicados con:
 * - Filtros por dificultad y lenguaje
 * - Grid responsive de tarjetas CourseCard
 * - Estado de carga y error
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Filter } from 'lucide-react';
import api from '../lib/api';
import CourseCard from '../components/CourseCard';

export default function CoursesCatalog() {
  const { t } = useTranslation();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [languageFilter, setLanguageFilter] = useState('');

  // Cargar cursos al montar
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        setLoading(true);
        const params = {};
        if (difficultyFilter) params.difficulty = difficultyFilter;
        if (languageFilter) params.language = languageFilter;

        const { data } = await api.get('/courses/', { params });
        setCourses(data);
      } catch (err) {
        setError(t('catalog.error'));
        console.error('Error fetching courses:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, [difficultyFilter, languageFilter]);

  // Filtrar por término de búsqueda (client-side)
  const filteredCourses = courses.filter((course) =>
    course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    course.short_description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          {t('catalog.title')}
        </h1>
        <p className="text-slate-500 dark:text-slate-400">
          {t('catalog.subtitle')}
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        {/* Barra de búsqueda */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder={t('catalog.searchPlaceholder')}
            className="input-field pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Filtro de dificultad */}
        <select
          className="input-field w-full sm:w-48"
          value={difficultyFilter}
          onChange={(e) => setDifficultyFilter(e.target.value)}
        >
          <option value="">{t('catalog.allDifficulties')}</option>
          <option value="beginner">{t('catalog.difficulty.beginner')}</option>
          <option value="intermediate">{t('catalog.difficulty.intermediate')}</option>
          <option value="advanced">{t('catalog.difficulty.advanced')}</option>
        </select>

        {/* Filtro de lenguaje */}
        <select
          className="input-field w-full sm:w-48"
          value={languageFilter}
          onChange={(e) => setLanguageFilter(e.target.value)}
        >
          <option value="">{t('catalog.allLanguages')}</option>
          <option value="C">C</option>
          <option value="C/C++">C/C++</option>
          <option value="C++/Python">C++/Python</option>
          <option value="C (ESP-IDF)">C (ESP-IDF)</option>
          <option value="VHDL">VHDL</option>
        </select>
      </div>

      {/* Grid de cursos */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-48 bg-slate-200" />
              <div className="p-5 space-y-3">
                <div className="h-4 bg-slate-200 rounded w-3/4" />
                <div className="h-3 bg-slate-200 rounded w-full" />
                <div className="h-3 bg-slate-200 rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary"
          >
            {t('catalog.retry')}
          </button>
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="text-center py-12">
          <Filter className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-500 dark:text-slate-400">{t('catalog.noResults')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}
    </div>
  );
}
