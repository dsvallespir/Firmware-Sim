/*
 * ============================================================
 * ProtectedRoute.jsx - Ruta protegida por autenticación
 * ============================================================
 * 
 * Verificaciones:
 * 1. Si el usuario no está autenticado → redirige a /login
 * 2. Si el usuario está autenticado pero no verificado → 
 *    redirige a /pending-verification
 * 3. Si está autenticado y verificado → renderiza la ruta
 * 
 * Mientras verifica el token, muestra un spinner de carga.
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLocale } from '../hooks/useLocale';

export default function ProtectedRoute() {
  const { isAuthenticated, isVerified, isLoading } = useAuth();
  const location = useLocation();
  const { localePath } = useLocale();

  // Mientras verificamos el token, mostramos spinner
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-950">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500" />
      </div>
    );
  }

  // Si no está autenticado, redirigir a login
  // Guardamos la ruta actual para redirigir de vuelta después del login
  if (!isAuthenticated) {
    return <Navigate to={localePath('/login')} state={{ from: location }} replace />;
  }

  // Si está autenticado pero no verificado, redirigir a verificación pendiente
  if (!isVerified) {
    return <Navigate to={localePath('/pending-verification')} replace />;
  }

  // Si está autenticado y verificado, renderizar la ruta hija
  return <Outlet />;
}
