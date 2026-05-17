/*
 * ============================================================
 * CourseCard.jsx - Tarjeta de curso para el catálogo
 * ============================================================
 * 
 * Muestra un resumen del curso:
 * - Imagen de portada
 * - Título y descripción corta
 * - Badges: lenguaje, dificultad
 * - Precio
 * - Conteo de módulos y lecciones
 */

import { Link } from 'react-router-dom';
import LocaleLink from './LocaleLink';
import { useTranslation } from 'react-i18next';
import { BookOpen, Clock, Signal, Code2 } from 'lucide-react';

// Mapeo de dificultad a colores (opaque para contraste WCAG AA)
const difficultyColors = {
  beginner:     'text-emerald-700 bg-emerald-100',
  intermediate: 'text-amber-700   bg-amber-100',
  advanced:     'text-red-700     bg-red-100',
};

// Mapeo de cursos a colores de borde para variedad visual
const courseColors = {
  'blockchain-cpp': 'border-t-amber-500',
  'tcp-ip-linux-c': 'border-t-blue-500',
  'computer-vision': 'border-t-purple-500',
  'esp32-firmware': 'border-t-green-500',
  'stm32-firmware': 'border-t-red-500',
  'raspberry-pi-systems': 'border-t-pink-500',
  'fpga-vhdl': 'border-t-cyan-500',
};

export default function CourseCard({ course }) {
  const { t } = useTranslation();
  const difficultyColor = difficultyColors[course.difficulty] || difficultyColors.intermediate;
  const borderColor = courseColors[course.slug] || 'border-t-primary-500';

  return (
    <LocaleLink to={`/courses/${course.slug}`} className="group">
      <div className={`card border-t-4 ${borderColor} h-full flex flex-col 
                       group-hover:shadow-lg group-hover:shadow-primary-500/5
                       group-hover:-translate-y-1 transition-all duration-300`}>
        
        {/* Imagen de portada (placeholder gradient si no hay imagen) */}
        <div className="h-48 bg-gradient-to-br from-slate-100 to-slate-200 relative overflow-hidden">
          {course.image_url ? (
            <img
              src={course.image_url}
              alt={course.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Code2 className="w-16 h-16 text-slate-300" />
            </div>
          )}
          {/* Badge de precio */}
          <div className="absolute top-3 right-3 bg-slate-900/90 backdrop-blur-sm
                         text-white font-bold font-mono px-3 py-1 rounded text-sm">
            {course.price > 0
              ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(course.price)
              : t('courseCard.free')}
          </div>
        </div>

        {/* Contenido */}
        <div className="p-5 flex flex-col flex-1">
          {/* Badges */}
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${difficultyColor}`}>
              {t(`catalog.difficulty.${course.difficulty}`)}
            </span>
            <span className="text-xs font-medium px-2 py-1 rounded-full text-primary-600 bg-primary-600/10">
              {course.language}
            </span>
          </div>

          {/* Título */}
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2 
                         group-hover:text-primary-600 transition-colors line-clamp-2">
            {course.title}
          </h3>

          {/* Descripción */}
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-4 flex-1 line-clamp-3">
            {course.short_description}
          </p>

          {/* Estadísticas */}
          <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400 text-xs border-t border-slate-200 dark:border-dark-700 pt-3">
            <span className="flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5" />
              {course.module_count} {t('courseCard.modules')}
            </span>
            <span className="flex items-center gap-1">
              <Signal className="w-3.5 h-3.5" />
              {course.lesson_count} {t('courseCard.lessons')}
            </span>
            {course.estimated_hours && (
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {course.estimated_hours}h
              </span>
            )}
          </div>
        </div>
      </div>
    </LocaleLink>
  );
}
