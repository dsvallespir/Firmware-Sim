/*
 * ============================================================
 * ThemeContext.jsx - Contexto de tema (dark/light mode)
 * ============================================================
 *
 * Maneja:
 * - Preferencia de tema guardada en localStorage
 * - Sincronización de la clase 'dark' en <html>
 * - Dark mode como default
 *
 * Uso:
 *   const { theme, toggleTheme } = useTheme();
 */

import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

const STORAGE_KEY = 'fa_theme';

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    // Prioridad: localStorage > default 'dark'
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY) || 'dark';
    }
    return 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
