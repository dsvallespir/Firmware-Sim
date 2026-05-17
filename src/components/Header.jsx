/*
 * ============================================================
 * Header.jsx - Barra de navegación superior
 * ============================================================
 * 
 * Muestra:
 * - Logo y nombre de la plataforma
 * - Links de navegación: Cursos, Dashboard
 * - Botón de Login/Register o menú de usuario
 * 
 * Responsive: menú hamburguesa en móvil
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLocale } from '../hooks/useLocale';
import { Menu, X, LogOut, User, LayoutDashboard, ShieldCheck, Languages, Moon, Sun } from 'lucide-react';

export default function Header() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const { lang, localePath, switchLocalePath } = useLocale();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate(localePath('/'));
  };

  const toggleLanguage = () => {
    const next = lang === 'es' ? 'en' : 'es';
    navigate(switchLocalePath(next));
  };

  const currentLang = lang === 'es' ? 'ES' : 'EN';

  return (
    <header className="bg-white/90 dark:bg-dark-900/90 backdrop-blur-md border-b border-slate-200 dark:border-dark-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo */}
          <Link to={localePath('/')} className="flex items-center gap-2 group">
            <img
              src="/favicon.png"
              alt="Firmware Academy"
              className="h-9 w-auto"
            />
            <span className="text-lg font-bold text-slate-900 dark:text-slate-100 hidden sm:block">
              Firmware Academy
            </span>
          </Link>

          {/* Navegación desktop */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              to={localePath('/courses')}
              className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100 transition-colors font-medium"
            >
              {t('nav.courses')}
            </Link>
            {isAuthenticated && (
              <Link
                to={localePath('/dashboard')}
                className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100 transition-colors font-medium"
              >
                {t('nav.dashboard')}
              </Link>
            )}
            {user?.role === 'admin' && (
              <Link
                to={localePath('/admin')}
                className="flex items-center gap-1.5 text-purple-400 hover:text-purple-300 transition-colors font-medium"
              >
                <ShieldCheck className="w-4 h-4" />
                {t('nav.admin')}
              </Link>
            )}
          </nav>

          {/* Auth buttons + language toggle desktop */}
          <div className="hidden md:flex items-center gap-3">
            {/* Toggle de tema */}
            <button
              onClick={toggleTheme}
              className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors p-2 rounded-md hover:bg-slate-100 dark:hover:bg-dark-800"
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Toggle de idioma */}
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors text-sm font-medium px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-dark-800"
              title={currentLang === 'ES' ? 'Switch to English' : 'Cambiar a Español'}
            >
              <Languages className="w-4 h-4" />
              <span>{currentLang}</span>
            </button>

            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <Link
                  to={localePath('/dashboard')}
                  className="flex items-center gap-2 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100 transition-colors"
                >
                  <User className="w-4 h-4" />
                  <span className="text-sm font-medium">{user?.username}</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 transition-colors p-2"
                  title={t('nav.logout')}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <Link to={localePath('/login')} className="btn-secondary text-sm py-2 px-4">
                  {t('nav.login')}
                </Link>
                <Link to={localePath('/register')} className="btn-primary text-sm py-2 px-4">
                  {t('nav.register')}
                </Link>
              </>
            )}
          </div>

          {/* Menú hamburguesa móvil */}
          <button
            className="md:hidden text-slate-600 dark:text-slate-300 p-2"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Menú móvil */}
        {isMenuOpen && (
          <div className="md:hidden border-t border-slate-200 dark:border-dark-700 py-4 space-y-3 animate-fade-in">
            <Link
              to={localePath('/courses')}
              className="block text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100 font-medium py-2"
              onClick={() => setIsMenuOpen(false)}
            >
              {t('nav.courses')}
            </Link>
            {isAuthenticated ? (
              <>
                <Link
                  to={localePath('/dashboard')}
                  className="block text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100 font-medium py-2"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <LayoutDashboard className="w-4 h-4 inline mr-2" />
                  {t('nav.dashboard')}
                </Link>
                {user?.role === 'admin' && (
                  <Link
                    to={localePath('/admin')}
                    className="block text-purple-400 hover:text-purple-300 font-medium py-2"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <ShieldCheck className="w-4 h-4 inline mr-2" />
                    {t('nav.adminPanel')}
                  </Link>
                )}
                <button
                  onClick={() => { handleLogout(); setIsMenuOpen(false); }}
                  className="block text-red-400 font-medium py-2"
                >
                  <LogOut className="w-4 h-4 inline mr-2" />
                  {t('nav.logout')}
                </button>
              </>
            ) : (
              <>
                <Link
                  to={localePath('/login')}
                  className="block text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100 font-medium py-2"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {t('nav.login')}
                </Link>
                <Link
                  to={localePath('/register')}
                  className="block text-primary-600 font-semibold py-2"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {t('nav.register')}
                </Link>
              </>
            )}
            {/* Toggle de idioma en móvil */}
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors text-sm font-medium py-2"
            >
              <Languages className="w-4 h-4" />
              <span>{currentLang === 'ES' ? 'Switch to English' : 'Cambiar a Español'}</span>
            </button>
            {/* Toggle de tema en móvil */}
            <button
              onClick={toggleTheme}
              className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors text-sm font-medium py-2"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
