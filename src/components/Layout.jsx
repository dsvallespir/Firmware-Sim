/*
 * ============================================================
 * Layout.jsx - Layout principal con Header y Footer
 * ============================================================
 * 
 * Envuelve las páginas con:
 * - Header: logo, navegación, botón login/perfil
 * - Outlet: contenido de la página actual (React Router)
 * - Footer: links, copyright
 */

import { Outlet } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import CookieBanner from './CookieBanner';

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-dark-950 text-slate-900 dark:text-slate-200 transition-colors duration-200">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <CookieBanner />
    </div>
  );
}
