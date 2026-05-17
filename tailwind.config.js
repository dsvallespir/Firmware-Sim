/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // Clases generadas dinámicamente (desde arrays/objetos en JSX) que el
  // scanner de Tailwind JIT no puede detectar en template literals.
  // Se incluyen aquí para garantizar que se genere su CSS.
  safelist: [
    // Iconos y gradientes de featuredCourses en Landing.jsx
    'text-amber-400', 'from-amber-500/20', 'to-amber-600/5',
    'text-blue-400',  'from-blue-500/20',  'to-blue-600/5',
    'text-purple-400','from-purple-500/20','to-purple-600/5',
    'text-green-400', 'from-green-500/20', 'to-green-600/5',
    'text-red-400',   'from-red-500/20',   'to-red-600/5',
    'text-cyan-400',  'from-cyan-500/20',  'to-cyan-600/5',
    'text-yellow-400','from-yellow-500/20','to-yellow-600/5',
    // Badges de dificultad en CourseCard.jsx
    'bg-green-500/10', 'text-green-400', 'border-green-500/20',
    'bg-yellow-500/10','text-yellow-400','border-yellow-500/20',
    'bg-red-500/10',   'text-red-400',   'border-red-500/20',
  ],
  theme: {
    extend: {
      // Colores personalizados para la plataforma
      colors: {
        primary: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',  // Azul principal
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        accent: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',  // Verde acento (progreso, éxito)
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        dark: {
          50:  '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',  // Fondo oscuro principal
          950: '#020617',
        }
      },
      // Tipografía para código
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
