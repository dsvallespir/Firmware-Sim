/*
 * AdminRoute.jsx - Ruta protegida para administradores
 * Requiere: autenticación + role === 'admin'
 * Si no cumple, redirige a /dashboard o /login según corresponda
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLocale } from '../hooks/useLocale';

export default function AdminRoute() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const { localePath } = useLocale();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-950">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={localePath('/login')} state={{ from: location }} replace />;
  }

  if (user?.role !== 'admin') {
    return <Navigate to={localePath('/dashboard')} replace />;
  }

  return <Outlet />;
}
