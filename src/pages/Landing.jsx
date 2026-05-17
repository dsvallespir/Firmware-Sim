/*
 * ============================================================
 * Landing.jsx - Página principal de la plataforma
 * ============================================================
 * 
 * Secciones:
 * 1. Hero: título, subtítulo, CTA
 * 2. Propuesta de valor: por qué esta plataforma
 * 3. Cursos destacados: preview de 3-4 cursos
 * 4. Tecnologías: logos/iconos de las tecnologías
 * 5. CTA final
 */

import { Link } from 'react-router-dom';
import LocaleLink from '../components/LocaleLink';
import { useTranslation } from 'react-i18next';
import {
  Cpu, Network, Eye, Wifi, Microchip, Monitor,
  Code2, Zap, BookOpen, Users, Trophy, ArrowRight,
  Terminal, GitBranch
} from 'lucide-react';

// Tech stack badges — displayed in the hero
const techStack = [
  { name: 'ESP32',   color: 'text-green-400  border-green-500/40'  },
  { name: 'STM32',   color: 'text-red-400    border-red-500/40'    },
  { name: 'FPGA',    color: 'text-cyan-400   border-cyan-500/40'   },
  { name: 'Linux',   color: 'text-yellow-400 border-yellow-500/40' },
  { name: 'RPi',     color: 'text-pink-400   border-pink-500/40'   },
  { name: 'C / C++', color: 'text-blue-400   border-blue-500/40'   },
  { name: 'Python',  color: 'text-violet-400 border-violet-500/40' },
];

// Bloque de código decorativo en el hero (visible solo en desktop)
function HeroCodeBlock() {
  return (
    <div className="bg-slate-950 rounded-lg border border-slate-700/50 overflow-hidden
                    font-mono shadow-2xl shadow-slate-950/80">
      {/* Window chrome */}
      <div className="flex items-center gap-1.5 px-4 py-3 bg-slate-800/60 border-b border-slate-700/50">
        <div className="w-3 h-3 rounded-full bg-red-500/80" />
        <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
        <div className="w-3 h-3 rounded-full bg-green-500/80" />
        <span className="ml-3 text-slate-400 text-xs">esp32_main.c</span>
      </div>
      {/* Code body */}
      <div className="p-4 text-xs lg:text-sm leading-6 select-none">
        <div><span className="text-slate-500 dark:text-slate-400">{'// ESP32 · FreeRTOS blink task'}</span></div>
        <div><span className="text-violet-400">#include</span> <span className="text-amber-300">{'"freertos/FreeRTOS.h"'}</span></div>
        <div><span className="text-violet-400">#include</span> <span className="text-amber-300">{'"freertos/task.h"'}</span></div>
        <div><span className="text-violet-400">#include</span> <span className="text-amber-300">{'"driver/gpio.h"'}</span></div>
        <div><span className="text-violet-400">#include</span> <span className="text-amber-300">{'"esp_log.h"'}</span></div>
        <div>&nbsp;</div>
        <div><span className="text-violet-400">#define</span> <span className="text-emerald-400">LED_PIN</span>  <span className="text-emerald-400">GPIO_NUM_2</span></div>
        <div>&nbsp;</div>
        <div>
          <span className="text-blue-400">static void </span>
          <span className="text-sky-300">led_task</span>
          <span className="text-slate-300">{'(void *arg) {'}</span>
        </div>
        <div>
          <span className="text-slate-300">&nbsp;&nbsp;</span>
          <span className="text-sky-300">gpio_set_direction</span>
          <span className="text-slate-300">{'('}</span>
          <span className="text-emerald-400">LED_PIN</span>
          <span className="text-slate-300">{', '}</span>
          <span className="text-emerald-400">GPIO_MODE_OUTPUT</span>
          <span className="text-slate-300">{');'}</span>
        </div>
        <div>
          <span className="text-slate-300">&nbsp;&nbsp;</span>
          <span className="text-blue-400">for </span>
          <span className="text-slate-300">{'(;;) {'}</span>
        </div>
        <div>
          <span className="text-slate-300">&nbsp;&nbsp;&nbsp;&nbsp;</span>
          <span className="text-sky-300">gpio_set_level</span>
          <span className="text-slate-300">{'('}</span>
          <span className="text-emerald-400">LED_PIN</span>
          <span className="text-slate-300">{', '}</span>
          <span className="text-orange-300">1</span>
          <span className="text-slate-300">{'); '}</span>
          <span className="text-sky-300">vTaskDelay</span>
          <span className="text-slate-300">{'(pdMS_TO_TICKS('}</span>
          <span className="text-orange-300">500</span>
          <span className="text-slate-300">{'));'}</span>
        </div>
        <div>
          <span className="text-slate-300">&nbsp;&nbsp;&nbsp;&nbsp;</span>
          <span className="text-sky-300">gpio_set_level</span>
          <span className="text-slate-300">{'('}</span>
          <span className="text-emerald-400">LED_PIN</span>
          <span className="text-slate-300">{', '}</span>
          <span className="text-orange-300">0</span>
          <span className="text-slate-300">{'); '}</span>
          <span className="text-sky-300">vTaskDelay</span>
          <span className="text-slate-300">{'(pdMS_TO_TICKS('}</span>
          <span className="text-orange-300">500</span>
          <span className="text-slate-300">{'));'}</span>
        </div>
        <div><span className="text-slate-300">{'  }'}</span></div>
        <div><span className="text-slate-300">{'}'}</span></div>
        <div>&nbsp;</div>
        <div>
          <span className="text-blue-400">void </span>
          <span className="text-sky-300">app_main</span>
          <span className="text-slate-300">{'(void) {'}</span>
        </div>
        <div>
          <span className="text-slate-300">&nbsp;&nbsp;</span>
          <span className="text-sky-300">xTaskCreate</span>
          <span className="text-slate-300">{'(led_task, '}</span>
          <span className="text-amber-300">{'"led"'}</span>
          <span className="text-slate-300">{', 2048, NULL, 5, NULL);'}</span>
        </div>
        <div><span className="text-slate-300">{'}'}</span></div>
        <div className="mt-2 flex items-center gap-1">
          <span className="text-slate-400">$</span>
          <span className="inline-block w-2 h-4 bg-primary-400 opacity-70 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

// Cursos destacados para la landing
// Los colores usan `color` prop (Lucide) y style inline (gradiente)
// para evitar problemas de detección dinámica del JIT de Tailwind.
const featuredCourses = [
  {
    slug: 'blockchain-cpp',
    titleKey: 'Blockchain en C/C++',
    descriptionKey: 'Criptografía, networking P2P, consenso. Construye una blockchain real.',
    icon: GitBranch,
    iconColor: '#fbbf24',
    gradient: 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(217,119,6,0.04) 100%)',
  },
  {
    slug: 'tcp-ip-linux-c',
    titleKey: 'TCP/IP en Linux con C',
    descriptionKey: 'Sockets, epoll, IPC, shared memory, zero-copy, kernel modules.',
    icon: Network,
    iconColor: '#60a5fa',
    gradient: 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(37,99,235,0.04) 100%)',
  },
  {
    slug: 'computer-vision',
    titleKey: 'Computer Vision',
    descriptionKey: 'OpenCV + PyTorch. Desde filtros básicos hasta YOLO y visión 3D.',
    icon: Eye,
    iconColor: '#c084fc',
    gradient: 'linear-gradient(135deg, rgba(168,85,247,0.15) 0%, rgba(147,51,234,0.04) 100%)',
  },
  {
    slug: 'esp32-firmware',
    titleKey: 'ESP32 Firmware IoT',
    descriptionKey: 'ESP-IDF, FreeRTOS, WiFi, MQTT, sensores. 22 módulos progresivos.',
    icon: Wifi,
    iconColor: '#4ade80',
    gradient: 'linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(22,163,74,0.04) 100%)',
  },
  {
    slug: 'stm32-firmware',
    titleKey: 'STM32 Firmware',
    descriptionKey: 'De C a firmware engineer: HAL, FreeRTOS, drivers, DSP.',
    icon: Microchip,
    iconColor: '#f87171',
    gradient: 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(220,38,38,0.04) 100%)',
  },
  {
    slug: 'fpga-vhdl',
    titleKey: 'FPGA con VHDL',
    descriptionKey: 'Tang Nano 20K: lógica combinacional, FSM, UART, VGA, SPI.',
    icon: Cpu,
    iconColor: '#22d3ee',
    gradient: 'linear-gradient(135deg, rgba(6,182,212,0.15) 0%, rgba(8,145,178,0.04) 100%)',
  },
];

export default function Landing() {
  const { t } = useTranslation();

  // Propuesta de valor — keys i18n
  const features = [
    { icon: Terminal, titleKey: 'features.realCode.title', descKey: 'features.realCode.desc' },
    { icon: Zap,      titleKey: 'features.fromZero.title', descKey: 'features.fromZero.desc' },
    { icon: BookOpen, titleKey: 'features.understand.title', descKey: 'features.understand.desc' },
    { icon: Code2,    titleKey: 'features.systems.title', descKey: 'features.systems.desc' },
  ];

  return (
    <div>
      {/* ============================================================
       * HERO SECTION
       * ============================================================ */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900" />
        {/* Graph-paper grid overlay */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2230%22%20height%3D%2230%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cpath%20d%3D%22M%2030%200%20L%200%200%200%2030%22%20fill%3D%22none%22%20stroke%3D%22white%22%20stroke-width%3D%220.5%22/%3E%3C/svg%3E')] opacity-20" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* ---- LEFT: título, subtítulo, tech tags, CTAs, stats ---- */}
            <div className="text-center lg:text-left">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 bg-primary-500/10 border border-primary-500/20
                             text-primary-300 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
                <Zap className="w-4 h-4" />
                {t('landing.badge')}
              </div>

              {/* Título principal */}
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white mb-6 leading-tight">
                {t('landing.hero.title1')}{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-300 to-cyan-300">
                  {t('landing.hero.title2')}
                </span>
                <br />
                {t('landing.hero.title3')}
              </h1>

              {/* Subtítulo */}
              <p className="text-lg md:text-xl text-slate-300 mb-6 max-w-xl leading-relaxed">
                {t('landing.hero.subtitle')}
              </p>

              {/* Tech stack badges */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 mb-8">
                {techStack.map(({ name, color }) => (
                  <span
                    key={name}
                    className={`font-mono text-xs px-2.5 py-1 rounded border bg-white/5 ${color}`}
                  >
                    {name}
                  </span>
                ))}
              </div>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                <LocaleLink to="/courses" className="btn-primary text-lg py-3 px-8 flex items-center gap-2">
                  {t('landing.hero.ctaCourses')}
                  <ArrowRight className="w-5 h-5" />
                </LocaleLink>
                <LocaleLink to="/register" className="btn-secondary text-lg py-3 px-8">
                  {t('landing.hero.ctaRegister')}
                </LocaleLink>
              </div>

              {/* Stats */}
              <div className="flex items-center justify-center lg:justify-start gap-8 mt-12 text-slate-300">
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">7</div>
                  <div className="text-sm">{t('landing.stats.courses')}</div>
                </div>
                <div className="w-px h-10 bg-white dark:bg-dark-900/20" />
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">100+</div>
                  <div className="text-sm">{t('landing.stats.modules')}</div>
                </div>
                <div className="w-px h-10 bg-white dark:bg-dark-900/20" />
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">500+</div>
                  <div className="text-sm">{t('landing.stats.hours')}</div>
                </div>
              </div>
            </div>

            {/* ---- RIGHT: bloque de código fake (desktop only) ---- */}
            <div className="hidden lg:block">
              <HeroCodeBlock />
            </div>

          </div>
        </div>
      </section>

      {/* ============================================================
       * PROPUESTA DE VALOR
       * ============================================================ */}
      <section className="py-20 bg-slate-100 dark:bg-dark-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              {t('landing.whyTitle')}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
              {t('landing.whySubtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => (
              <div key={feature.titleKey} className="card p-6 text-center">
                <div className="w-12 h-12 bg-primary-500/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <feature.icon className="w-6 h-6 text-primary-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  {t(feature.titleKey)}
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                  {t(feature.descKey)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
       * CURSOS DESTACADOS
       * ============================================================ */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              {t('landing.coursesTitle')}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
              {t('landing.coursesSubtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredCourses.map((course) => {
              // Extraer a variable con mayúscula para que React lo trate como componente
              const Icon = course.icon;
              return (
                <LocaleLink
                  key={course.slug}
                  to={`/courses/${course.slug}`}
                  className="group"
                >
                  <div
                    className="card p-6 h-full group-hover:-translate-y-1 transition-all duration-300"
                    style={{ background: course.gradient }}
                  >
                    <Icon size={40} color={course.iconColor} className="mb-4" />
                    <h3 className="text-lg font-semibold text-slate-900 mb-2
                                  group-hover:text-primary-600 transition-colors">
                      {course.titleKey}
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">
                      {course.descriptionKey}
                    </p>
                    <div className="mt-4 flex items-center text-primary-600 text-sm font-medium">
                      {t('landing.viewCourse')}
                      <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </LocaleLink>
              );
            })}
          </div>

          <div className="text-center mt-10">
            <LocaleLink to="/courses" className="btn-primary inline-flex items-center gap-2">
              {t('landing.viewAllCourses')}
              <ArrowRight className="w-4 h-4" />
            </LocaleLink>
          </div>
        </div>
      </section>

      {/* ============================================================
       * CTA FINAL
       * ============================================================ */}
      <section className="py-20 bg-primary-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            {t('landing.ctaTitle')}
          </h2>
          <p className="text-primary-100 text-lg mb-8 max-w-2xl mx-auto">
            {t('landing.ctaSubtitle')}
          </p>
          <LocaleLink to="/register" className="btn-primary text-lg py-3 px-8 inline-flex items-center gap-2">
            {t('landing.ctaButton')}
            <ArrowRight className="w-5 h-5" />
          </LocaleLink>
        </div>
      </section>
    </div>
  );
}
