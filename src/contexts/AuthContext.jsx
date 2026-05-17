/*
 * ============================================================
 * AuthContext.jsx - Contexto de Autenticación Global
 * ============================================================
 * 
 * Provee estado de autenticación a toda la aplicación:
 * - user: datos del usuario actual (o null)
 * - isAuthenticated: boolean
 * - isVerified: boolean (email verificado y cuenta activa)
 * - isLoading: true mientras verificamos el token al cargar
 * - login(): autenticar con email/password
 * - register(): crear cuenta (sin auto-login, requiere verificación)
 * - logout(): cerrar sesión
 * - resendVerification(): reenviar email de verificación
 * - refreshUser(): recargar datos del usuario desde /auth/me
 * 
 * Al montar la app, verifica si hay un token guardado en
 * localStorage y lo valida con GET /auth/me.
 * Si es válido, carga el usuario. Si no, limpia los tokens.
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../lib/api';

// Crear el contexto
const AuthContext = createContext(null);

/**
 * Provider que envuelve la app y provee estado de auth.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // ----------------------------------------------------------
  // Verificar token existente al montar la aplicación
  // ----------------------------------------------------------
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('access_token');
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const { data } = await api.get('/auth/me');
        setUser(data);
      } catch {
        // Token inválido → limpiar
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  // ----------------------------------------------------------
  // Login: autenticar y guardar tokens
  // ----------------------------------------------------------
  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });

    // Guardar tokens
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);

    // Cargar datos del usuario
    const userResponse = await api.get('/auth/me');
    setUser(userResponse.data);

    return userResponse.data;
  }, []);

  // ----------------------------------------------------------
  // Register: crear cuenta (ya NO auto-login)
  // El backend ahora devuelve un mensaje, no tokens.
  // El usuario debe verificar su email antes de loguearse.
  // ----------------------------------------------------------
  const register = useCallback(async (email, username, password, termsAccepted, privacyAccepted) => {
    const { data } = await api.post('/auth/register', {
      email,
      username,
      password,
      terms_accepted: termsAccepted,
      privacy_accepted: privacyAccepted,
    });

    // El backend retorna { message: "..." }
    // NO hay tokens — el usuario debe verificar email primero
    return data;
  }, []);

  // ----------------------------------------------------------
  // Resend Verification: reenviar email de verificación
  // ----------------------------------------------------------
  const resendVerification = useCallback(async (email) => {
    const { data } = await api.post('/auth/resend-verification', { email });
    return data;
  }, []);

  // ----------------------------------------------------------
  // Refresh User: recargar datos del usuario desde el backend
  // Útil después de verificar email para actualizar account_status
  // ----------------------------------------------------------
  const refreshUser = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser(data);
      return data;
    } catch {
      return null;
    }
  }, []);

  // ----------------------------------------------------------
  // Logout: limpiar tokens y estado
  // ----------------------------------------------------------
  const logout = useCallback(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
  }, []);

  // Determinar si el usuario tiene email verificado y cuenta activa
  const isVerified = user?.account_status === 'active';

  const value = {
    user,
    isAuthenticated: !!user,
    isVerified,
    isLoading,
    login,
    register,
    resendVerification,
    refreshUser,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook para acceder al contexto de autenticación.
 * 
 * Uso:
 *   const { user, login, logout, isAuthenticated, isVerified } = useAuth();
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
}
