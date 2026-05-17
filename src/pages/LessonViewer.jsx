/*
 * ============================================================
 * LessonViewer.jsx - Visor de lecciones (página principal de estudio)
 * ============================================================
 * 
 * Layout de 3 columnas:
 * [Sidebar] [Contenido] [Navegación]
 * 
 * Sidebar: lista de módulos y lecciones (navegación del curso)
 * Contenido: markdown renderizado con syntax highlighting
 * Navegación: botones anterior/siguiente + marcar completada
 * 
 * Este es el componente más importante de la plataforma:
 * donde el estudiante pasa la mayor parte del tiempo.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate, Link } from 'react-router-dom';
import LocaleLink from '../components/LocaleLink';
import TranslationBanner from '../components/TranslationBanner';
import {
  ChevronLeft, ChevronRight, Menu, X, CheckCircle2,
  Circle, BookOpen, Code2, Loader2, Home, Clock, Youtube, Download, FolderCode, Cpu
} from 'lucide-react';
import api from '../lib/api';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { useTheme } from '../contexts/ThemeContext';
import YouTubePlayer from '../components/YouTubePlayer';
import CodeExplorer from '../components/CodeExplorer';
import SimulatorPanel from '../components/SimulatorPanel';
import TourTooltip from '../components/TourTooltip';
import { useTour } from '../hooks/useTour';

export default function LessonViewer() {
  const { t, i18n } = useTranslation();  const { courseSlug, moduleSlug, lessonSlug } = useParams();
  const navigate = useNavigate();
  const mainRef = useRef(null);
  const { theme } = useTheme();

  // ── Tour refs ──────────────────────────────────────────────────────────────
  const TOUR_STORAGE_KEY = 'viewer_tour_seen';
  const sidebarRef           = useRef(null);
  const progressBarRef       = useRef(null);
  const completeButtonRef    = useRef(null);
  const codeExplorerButtonRef = useRef(null);
  const downloadButtonRef    = useRef(null);
  const nextNavRef           = useRef(null);

  const [course, setCourse] = useState(null);
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [completedLessonIds, setCompletedLessonIds] = useState(new Set());

  // Code explorer: lista de archivos de código del módulo actual
  const [codeFiles, setCodeFiles] = useState([]);
  const [codeExplorerOpen, setCodeExplorerOpen] = useState(false);
  const [codeFilesLoaded, setCodeFilesLoaded] = useState(null); // moduleSlug que ya cargó

  // Simulador nativo (avr8js + circuito visual): para lecciones Arduino
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [simulatorCode, setSimulatorCode] = useState('');
  const simulatorButtonRef = useRef(null);

  // ── Tour: pasos y estado ───────────────────────────────────────────────────
  const tourSteps = useMemo(() => {
    if (!lesson) return [];
    const steps = [
      { ref: sidebarRef,         titleKey: 'tour.step1.title', bodyKey: 'tour.step1.body', placement: 'right'  },
      { ref: progressBarRef,     titleKey: 'tour.step2.title', bodyKey: 'tour.step2.body', placement: 'bottom' },
      { ref: completeButtonRef,  titleKey: 'tour.step3.title', bodyKey: 'tour.step3.body', placement: 'bottom' },
    ];
    if (codeFiles.length > 0) {
      steps.push({ ref: codeExplorerButtonRef, titleKey: 'tour.step4.title', bodyKey: 'tour.step4.body', placement: 'bottom' });
    }
    if (lesson.lesson_type === 'code') {
      steps.push({ ref: downloadButtonRef, titleKey: 'tour.step5.title', bodyKey: 'tour.step5.body', placement: 'bottom' });
    }
    steps.push({ ref: nextNavRef, titleKey: 'tour.step6.title', bodyKey: 'tour.step6.body', placement: 'top' });
    return steps;
  }, [lesson?.id, lesson?.lesson_type, codeFiles.length]);

  const tour = useTour(TOUR_STORAGE_KEY, tourSteps);

  // Cargar estructura del curso + progreso del usuario
  useEffect(() => {
    const fetchCourse = async () => {
      try {
        const lang = i18n.language?.startsWith('en') ? 'en' : 'es';
        const { data } = await api.get(`/courses/${courseSlug}?lang=${lang}`);
        console.log('Course data loaded:', data);
        setCourse(data);
        // Si el usuario está inscrito, cargar sus lecciones completadas
        if (data.is_enrolled) {
          try {
            const { data: prog } = await api.get(`/progress/course/${data.id}`);
            setCompletedLessonIds(new Set(prog.completed_lesson_ids || []));
          } catch (_) {
            // Sin inscripción activa o no autenticado: progreso vacío
          }
        }
      } catch (err) {
        console.error('Error loading course:', err);
      }
    };
    fetchCourse();
  }, [courseSlug, i18n.language]);

  // Cargar contenido de la lección
  useEffect(() => {
    const fetchLesson = async () => {
      try {
        setLoading(true);
        setError(null);
        const lang = i18n.language?.startsWith('en') ? 'en' : 'es';
        const { data } = await api.get(
          `/content/${courseSlug}/${moduleSlug}/${lessonSlug}?lang=${lang}`
        );
        setLesson(data);
        // Sincronizar estado de completado desde el set local
        setIsCompleted(completedLessonIds.has(data.id));
      } catch (err) {
        const msg = err.response?.data?.detail || err.message || 'Error desconocido';
        setError(msg);
        console.error('Error loading lesson:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLesson();
  }, [courseSlug, moduleSlug, lessonSlug, i18n.language]);

  // Sincronizar isCompleted si cambia la lección o el set de completadas
  useEffect(() => {
    if (lesson) setIsCompleted(completedLessonIds.has(lesson.id));
  }, [lesson?.id, completedLessonIds]);

  // Scroll al inicio del área de contenido al navegar entre lecciones
  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [courseSlug, moduleSlug, lessonSlug]);

  // Cargar archivos de código del módulo actual (para el CodeExplorer)
  useEffect(() => {
    // Solo cargar si cambió el módulo y no lo tenemos cacheado
    if (!courseSlug || !moduleSlug || codeFilesLoaded === moduleSlug) return;

    const fetchCodeFiles = async () => {
      try {
        const { data } = await api.get(
          `/content/${courseSlug}/${moduleSlug}/files`
        );
        setCodeFiles(data);
        setCodeFilesLoaded(moduleSlug);
      } catch (_) {
        // Módulo sin archivos de código o sin acceso: lista vacía
        setCodeFiles([]);
        setCodeFilesLoaded(moduleSlug);
      }
    };
    fetchCodeFiles();
  }, [courseSlug, moduleSlug, codeFilesLoaded]);

  // Cerrar explorador y resetear cache de archivos al cambiar de módulo/lección
  useEffect(() => {
    setCodeExplorerOpen(false);
    setSimulatorOpen(false);
    setSimulatorCode('');
  }, [lessonSlug]);

  useEffect(() => {
    setCodeFilesLoaded(null);
    setCodeFiles([]);
    setCodeExplorerOpen(false);
    setSimulatorOpen(false);
    setSimulatorCode('');
  }, [moduleSlug]);

  // Arrancar el tour la primera vez que se carga una lección
  useEffect(() => {
    if (lesson && !loading && tourSteps.length > 0 && !tour.seen && !tour.isActive) {
      const id = setTimeout(() => tour.start(), 600);
      return () => clearTimeout(id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson?.id, loading, tourSteps.length]);

  // En móvil, abrir el sidebar automáticamente en el paso 0 para mostrarlo
  useEffect(() => {
    if (tour.isActive && tour.step === 0) setSidebarOpen(true);
    if (tour.isActive && tour.step > 0)  setSidebarOpen(false);
  }, [tour.isActive, tour.step]);

  // Marcar como completada
  const handleToggleComplete = useCallback(async () => {
    if (!lesson) return;
    const newCompleted = !isCompleted;
    try {
      await api.post('/progress/complete', {
        lesson_id: lesson.id,
        is_completed: newCompleted,
      });
      setIsCompleted(newCompleted);
      // Actualizar el set local para reflejar cambio en sidebar y barra
      setCompletedLessonIds((prev) => {
        const next = new Set(prev);
        if (newCompleted) next.add(lesson.id);
        else next.delete(lesson.id);
        return next;
      });
    } catch (err) {
      console.error('Error updating progress:', err);
    }
  }, [lesson, isCompleted]);

  // Marcar la lección actual como completada al navegar al siguiente
  // No es un toggle: solo completa, nunca des-completa.
  // Fire-and-forget: no bloqueamos la navegación esperando la respuesta.
  const handleNextClick = useCallback(() => {
    if (!lesson || isCompleted) return; // ya estaba completada, nada que hacer
    api.post('/progress/complete', {
      lesson_id: lesson.id,
      is_completed: true,
    }).then(() => {
      setIsCompleted(true);
      setCompletedLessonIds((prev) => {
        const next = new Set(prev);
        next.add(lesson.id);
        return next;
      });
    }).catch((err) => {
      console.error('Error al marcar lección como completada:', err);
    });
  }, [lesson, isCompleted]);

  // Descargar el archivo fuente via endpoint server-side
  const handleDownload = useCallback(async () => {
    if (!lesson) return;
    try {
      const res = await api.get(
        `/content/${courseSlug}/${moduleSlug}/${lessonSlug}/download`,
        { responseType: 'blob' }
      );
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = lesson.filename || `${lesson.slug}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading file:', err);
    }
  }, [lesson, courseSlug, moduleSlug, lessonSlug]);

  // Detectar si el módulo tiene archivos .ino compilables
  const hasInoFiles = codeFiles.some(
    (f) => f.filename?.endsWith('.ino') || f.slug?.endsWith('.ino')
  );

  // Abrir simulador nativo: buscar primer .ino y cargar su contenido
  const handleOpenSimulator = useCallback(async () => {
    if (simulatorOpen) {
      setSimulatorOpen(false);
      return;
    }

    // Buscar primer archivo .ino en codeFiles
    const inoFile = codeFiles.find(
      (f) => f.filename?.endsWith('.ino') || f.slug?.endsWith('.ino')
    );

    if (inoFile) {
      try {
        // Cargar contenido del .ino via la API de contenido
        const { data } = await api.get(
          `/content/${courseSlug}/${moduleSlug}/${inoFile.slug}`
        );
        setSimulatorCode(data.content_raw || '');
      } catch (err) {
        console.error('Error cargando código para simulador:', err);
        // Fallback: usar content_raw de la lección actual si es código
        if (lesson?.content_raw && lesson?.language === 'cpp') {
          setSimulatorCode(lesson.content_raw);
        }
      }
    } else if (lesson?.content_raw) {
      // Si no hay .ino pero la lección tiene código, usarlo
      setSimulatorCode(lesson.content_raw);
    }

    setSimulatorOpen(true);
  }, [simulatorOpen, codeFiles, courseSlug, moduleSlug, lesson]);

  // Formatear tamaño de archivo para mostrar
  const formatSize = (bytes) => {
    if (!bytes) return null;
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  // Las lecciones de tipo 'code' son archivos fuente accesibles desde el
  // CodeExplorer; no deben aparecer en la navegación, progreso ni sidebar.
  const isLesson = (l) => l.lesson_type !== 'code';

  // Devuelve el título localizado: title_en si el idioma es inglés y existe,
  // si no, siempre cae a title (español).
  const locT = (obj) =>
    (i18n.language?.startsWith('en') && obj?.title_en) ? obj.title_en : obj?.title;

  // Calcular navegación (anterior/siguiente lección)
  const navigation = useCallback(() => {
    if (!course) return { prev: null, next: null };

    const allLessons = [];
    for (const mod of course.modules) {
      for (const les of mod.lessons) {
        if (!isLesson(les)) continue; // saltar archivos de código
        allLessons.push({
          ...les,
          moduleSlug: mod.slug,
          courseSlug: course.slug,
        });
      }
    }

    const currentIndex = allLessons.findIndex(
      (l) => l.slug === lessonSlug && l.moduleSlug === moduleSlug
    );

    return {
      prev: currentIndex > 0 ? allLessons[currentIndex - 1] : null,
      next: currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null,
    };
  }, [course, lessonSlug]);

  const { prev, next } = navigation();

  // Encontrar módulo actual
  const currentModule = course?.modules.find((m) => m.slug === moduleSlug);

  // Calcular progreso del curso para la barra y el sidebar
  const totalLessons = course?.modules.reduce(
    (acc, m) => acc + m.lessons.filter(isLesson).length, 0
  ) || 0;
  const progressPct = totalLessons > 0
    ? Math.round((completedLessonIds.size / totalLessons) * 100)
    : 0;

  return (
    <div className="h-screen bg-slate-50 dark:bg-dark-950 flex overflow-hidden">
      {/* ============================================================
       * SIDEBAR - Navegación del curso
       * ============================================================ */}
      <aside
        ref={sidebarRef}
        className={`fixed inset-y-0 left-0 z-40 w-80 bg-white dark:bg-dark-950 border-r border-slate-200 dark:border-dark-700
                    transform transition-transform duration-300
                    ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                    lg:translate-x-0 lg:static lg:flex-shrink-0 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto`}
      >
        {/* Header del sidebar */}
        <div className="sticky top-0 bg-white dark:bg-dark-900 border-b border-slate-200 dark:border-dark-700 p-4 z-10">
          <div className="flex items-center justify-between">
            <LocaleLink
              to={`/courses/${courseSlug}`}
              className="text-sm font-semibold text-slate-900 dark:text-slate-100 hover:text-primary-600 
                         transition-colors flex items-center gap-2"
            >
              <Home className="w-4 h-4" />
              <span className="truncate max-w-[180px]">{locT(course) || 'Cargando...'}</span>
            </LocaleLink>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-slate-500 dark:text-slate-400 p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Barra de progreso del curso en el sidebar */}
          {totalLessons > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                <span>Progreso del curso</span>
                <span className="font-medium text-accent-400">{progressPct}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-200 dark:bg-dark-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-accent-500 to-accent-400 rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1.5">
                {completedLessonIds.size} / {totalLessons} lecciones
              </p>
            </div>
          )}
        </div>

        {/* Lista de módulos y lecciones */}
        <nav className="p-4 space-y-4">
          {course?.modules.map((mod) => {
            const realLessons = mod.lessons.filter(isLesson);
            const modCompleted = realLessons.filter(
              (l) => completedLessonIds.has(l.id)
            ).length;
            const modTotal = realLessons.length;
            return (
              <div key={mod.id}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {locT(mod)}
                  </h4>
                  {modTotal > 0 && (
                    <span
                      className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                        modCompleted === modTotal
                          ? 'bg-accent-500/10 text-accent-400'
                          : 'bg-slate-100 dark:bg-dark-800 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {modCompleted}/{modTotal}
                    </span>
                  )}
                </div>
                <ul className="space-y-0.5">
                  {realLessons.map((les) => {
                    const isActive = les.slug === lessonSlug && mod.slug === moduleSlug;
                    const isDone = completedLessonIds.has(les.id);
                    return (
                      <li key={les.id}>
                        <LocaleLink
                          to={`/learn/${courseSlug}/${mod.slug}/${les.slug}`}
                          onClick={() => setSidebarOpen(false)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                                     transition-colors border-l-2 ${
                                       isActive
                                         ? 'bg-primary-500/10 text-primary-400 font-medium border-primary-500'
                                         : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-800 hover:text-slate-900 dark:hover:text-slate-100 border-transparent'
                                     }`}
                        >
                          {isDone ? (
                            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 text-accent-400" />
                          ) : les.lesson_type === 'theory' ? (
                            <BookOpen className="w-3.5 h-3.5 flex-shrink-0" />
                          ) : (
                            <Code2 className="w-3.5 h-3.5 flex-shrink-0" />
                          )}
                          <span className="truncate">{locT(les)}</span>
                        </LocaleLink>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Overlay para cerrar sidebar en móvil */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ============================================================
       * CONTENIDO PRINCIPAL
       * ============================================================ */}
      <main ref={mainRef} className="flex-1 min-w-0 overflow-y-auto">
        {/* Barra superior */}
        <div className="sticky top-0 z-20 bg-white dark:bg-dark-900/90 backdrop-blur-md border-b border-slate-200 dark:border-dark-700">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden text-slate-600 dark:text-slate-400 p-1"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{locT(currentModule)}</p>
                <h1 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  {lesson ? locT(lesson) : 'Cargando...'}
                  {lesson?.youtube_url && (
                    <Youtube className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                  )}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Tiempo estimado de lectura */}
              {lesson?.estimated_minutes && (
                <span className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <Clock className="w-3.5 h-3.5" />
                  {lesson.estimated_minutes} min
                </span>
              )}

              {/* Botón ver archivos del proyecto (solo si hay code files) */}
              {codeFiles.length > 0 && (
                <button
                  ref={codeExplorerButtonRef}
                  onClick={() => setCodeExplorerOpen(!codeExplorerOpen)}
                  title="Ver archivos del proyecto"
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs
                             font-medium transition-colors border ${
                               codeExplorerOpen
                                 ? 'bg-primary-500/15 text-primary-600 border-primary-500/30'
                                 : 'bg-slate-100 text-slate-600 border-slate-300 hover:border-primary-500/30 hover:text-primary-600'
                             }`}
                >
                  <FolderCode className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">
                    {codeExplorerOpen ? t('lessonViewer.hideFiles') : t('lessonViewer.viewFiles')}
                  </span>
                  <span className="text-[10px] opacity-60">{codeFiles.length}</span>
                </button>
              )}

              {/* Botón simulador — compilar + circuito visual + serial monitor */}
              {(hasInoFiles || lesson?.circuit_json) && (
                <button
                  ref={simulatorButtonRef}
                  onClick={handleOpenSimulator}
                  title="Compilar y simular Arduino"
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs
                             font-semibold transition-colors border ${
                               simulatorOpen
                                 ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                                 : 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                             }`}
                >
                  <Cpu className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">
                    {simulatorOpen ? 'Ocultar simulador' : 'Simular'}
                  </span>
                </button>
              )}

              {/* Metadata de archivo (solo lecciones de código) */}
              {lesson?.lesson_type === 'code' && lesson?.language && (
                <span className="hidden sm:flex items-center px-2 py-1 rounded text-xs
                               font-mono font-medium bg-primary-500/10 text-primary-400">
                  {lesson.language}
                </span>
              )}
              {lesson?.lesson_type === 'code' && lesson?.line_count && (
                <span className="hidden md:flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                  {lesson.line_count} lín
                </span>
              )}
              {lesson?.lesson_type === 'code' && formatSize(lesson?.size_bytes) && (
                <span className="hidden md:flex items-center gap-1 text-xs text-slate-400">
                  {formatSize(lesson.size_bytes)}
                </span>
              )}

              {/* Botón descargar (solo lecciones de código) */}
              {lesson?.lesson_type === 'code' && (
                <button
                  ref={downloadButtonRef}
                  onClick={handleDownload}
                  title={`Descargar ${lesson.filename || lesson.slug}`}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm
                             font-medium bg-slate-100 text-slate-600 border border-slate-300
                             hover:border-primary-500/30 hover:text-primary-600 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">{lesson.filename || 'Descargar'}</span>
                </button>
              )}

              {/* Botón completar */}
              <button
                ref={completeButtonRef}
                onClick={handleToggleComplete}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm
                           font-medium transition-colors ${
                             isCompleted
                               ? 'bg-accent-500/10 text-accent-400 border border-accent-500/30'
                               : 'bg-slate-100 text-slate-600 border border-slate-300 hover:border-accent-500/30'
                           }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <Circle className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">
                  {isCompleted ? t('lessonViewer.completed') : t('lessonViewer.markComplete')}
                </span>
              </button>
            </div>
          </div>

          {/* Línea de progreso del curso bajo el topbar */}
          {totalLessons > 0 && (
            <div ref={progressBarRef} className="h-0.5 bg-slate-100 dark:bg-dark-800">
              <div
                className="h-full bg-gradient-to-r from-accent-600 to-accent-400 transition-all duration-700"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          )}
        </div>

        {/* Explorador de código — fuera del max-w-4xl para usar todo el ancho del main */}
        {codeExplorerOpen && codeFiles.length > 0 && lesson && (
          <div className="px-4 sm:px-6 lg:px-8 pb-6">
            <CodeExplorer
              courseSlug={courseSlug}
              moduleSlug={moduleSlug}
              moduleTitle={currentModule?.title}
              codeFiles={codeFiles}
              onClose={() => setCodeExplorerOpen(false)}
            />
          </div>
        )}

        {/* Simulador Arduino (avr8js + circuito visual + compilación) */}
        {simulatorOpen && (
          <div className="px-4 sm:px-6 lg:px-8 pb-4">
            <SimulatorPanel
              key={lessonSlug}
              initialCode={simulatorCode}
              lessonTitle={lesson?.title || ''}
              circuitDefinition={lesson?.circuit_json || null}
              codeFiles={codeFiles}
              courseSlug={courseSlug}
              moduleSlug={moduleSlug}
              onClose={() => setSimulatorOpen(false)}
            />
          </div>
        )}

        {/* Contenido de la lección */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white dark:bg-dark-900 rounded-2xl shadow-sm ring-1 ring-slate-200 px-6 sm:px-10 py-8">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-20 space-y-3">
              <p className="text-red-500 font-medium">No se pudo cargar la lección</p>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-mono bg-slate-100 dark:bg-dark-800 px-4 py-2 rounded-lg inline-block">
                {error}
              </p>
            </div>
          ) : lesson ? (
            <div className="animate-fade-in">
              {/* Video de YouTube si la lección tiene uno configurado */}
              {lesson.youtube_url && (
                <YouTubePlayer url={lesson.youtube_url} className="mb-8" />
              )}

              {/* Banner si el contenido no está traducido al idioma de la URL */}
              <TranslationBanner isTranslated={lesson.content_language === i18n.language?.substring(0, 2)} />

              {/* Contenido teórico/markdown (siempre visible debajo) */}
              <MarkdownRenderer
                content={lesson.content_raw}
                assetsBaseUrl={`/api/content/${courseSlug}/${moduleSlug}/assets`}
                theme={theme}
                simulatorContext={{
                  courseSlug,
                  moduleSlug,
                  codeFiles,
                  lessonFilename: lesson.filename || '',
                  circuitJson: lesson.circuit_json || null,
                }}
              />
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-slate-400">No se pudo cargar la lección.</p>
            </div>
          )}

          {/* Navegación anterior/siguiente */}
          <div className="flex items-center justify-between mt-12 pt-8 border-t border-slate-200 dark:border-dark-700">
            {prev ? (
              <LocaleLink
                to={`/learn/${prev.courseSlug}/${prev.moduleSlug}/${prev.slug}`}
                className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-primary-600 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
                <div className="text-right">
                  <p className="text-xs text-slate-400">{t('lessonViewer.previous')}</p>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{locT(prev)}</p>
                </div>
              </LocaleLink>
            ) : (
              <div />
            )}

            {next ? (
              <LocaleLink
                ref={nextNavRef}
                to={`/learn/${next.courseSlug}/${next.moduleSlug}/${next.slug}`}
                onClick={handleNextClick}
                className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-primary-600 transition-colors"
              >
                <div className="text-left">
                  <p className="text-xs text-slate-400">{t('lessonViewer.next')}</p>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{locT(next)}</p>
                </div>
                <ChevronRight className="w-5 h-5" />
              </LocaleLink>
            ) : (
              <div />
            )}
          </div>
          </div>
        </div>
      </main>

      {/* ── Tour interactivo de onboarding ──────────────────────────────────── */}
      {tour.isActive && tourSteps[tour.step] && (
        <TourTooltip
          targetRef={tourSteps[tour.step].ref}
          title={t(tourSteps[tour.step].titleKey)}
          body={t(tourSteps[tour.step].bodyKey)}
          step={tour.step}
          total={tour.total}
          onNext={tour.next}
          onPrev={tour.prev}
          onSkip={tour.skip}
          isLast={tour.step === tour.total - 1}
          placement={tourSteps[tour.step].placement}
        />
      )}
    </div>
  );
}
