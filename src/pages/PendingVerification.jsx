/*
 * ============================================================
 * PendingVerification.jsx - Pantalla de verificación pendiente
 * ============================================================
 * 
 * Se muestra cuando un usuario logueado tiene account_status
 * "pending_verification". Ofrece:
 * - Información sobre la verificación pendiente
 * - Botón para reenviar email de verificación
 * - Cooldown visual entre reenvíos (60 segundos)
 */

import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useLocale } from '../hooks/useLocale';
import { Mail, RefreshCw, Loader2, CheckCircle2, LogOut } from 'lucide-react';

export default function PendingVerification() {
  const { user, resendVerification, refreshUser, logout, isVerified } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { localePath } = useLocale();
  const displayEmail = user?.email || location.state?.email || '';

  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(''); // success | error
  const [cooldown, setCooldown] = useState(0);

  // Si ya está verificado, redirigir al dashboard
  useEffect(() => {
    if (isVerified) {
      navigate(localePath('/dashboard'), { replace: true });
    }
  }, [isVerified, localePath, navigate]);

  // Temporizador de cooldown
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((c) => c - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Verificar periódicamente si el usuario ya verificó
  useEffect(() => {
    const interval = setInterval(async () => {
      const updated = await refreshUser();
      if (updated?.account_status === 'active') {
        navigate(localePath('/dashboard'), { replace: true });
      }
    }, 10000); // Cada 10 segundos
    return () => clearInterval(interval);
  }, [refreshUser, navigate]);

  const handleResend = useCallback(async () => {
    if (!user?.email || cooldown > 0) return;

    setSending(true);
    setMessage('');
    try {
      const data = await resendVerification(user.email);
      setMessage(data.message || 'Email de verificación reenviado.');
      setMessageType('success');
      setCooldown(60); // Cooldown de 60 segundos
    } catch (err) {
      const detail = err.response?.data?.detail;
      setMessage(typeof detail === 'string' ? detail : 'No se pudo reenviar el email.');
      setMessageType('error');
      // Si el error es de rate limit, activar cooldown
      if (err.response?.status === 429) {
        setCooldown(60);
      }
    } finally {
      setSending(false);
    }
  }, [user, cooldown, resendVerification]);

  const handleLogout = () => {
    logout();
    navigate(localePath('/login'), { replace: true });
  };

  if (!user || !user.email) {
    return null; // ProtectedRoute maneja la redirección
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-lg text-center">
        <div className="card p-8">
          <Mail className="w-16 h-16 text-primary-500 mx-auto mb-4" />
          
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            {t('pendingVerification.title')}
          </h1>
          
          <p className="text-slate-600 dark:text-slate-400 mb-2">
            {t('pendingVerification.body', { email: displayEmail })}
          </p>
          
          <p className="text-slate-400 text-sm mb-6">
            {t('pendingVerification.note')}
          </p>

          {/* Instrucciones */}
          <div className="bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-700 rounded-lg p-4 text-sm text-slate-600 dark:text-slate-400 mb-6 text-left">
            <p className="flex items-start gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-primary-500 mt-0.5 flex-shrink-0" />
              <span>{t('pendingVerification.instructions.check')}</span>
            </p>
            <p className="flex items-start gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-primary-500 mt-0.5 flex-shrink-0" />
              <span>{t('pendingVerification.instructions.click')}</span>
            </p>
            <p className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary-500 mt-0.5 flex-shrink-0" />
              <span>{t('pendingVerification.instructions.expires')}</span>
            </p>
          </div>

          {/* Mensajes de feedback */}
          {message && (
            <div
              className={`text-sm px-4 py-3 rounded-lg mb-4 ${
                messageType === 'success'
                  ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                  : 'bg-red-500/10 border border-red-500/20 text-red-400'
              }`}
            >
              {message}
            </div>
          )}

          {/* Botón reenviar */}
          <div className="space-y-3">
            <button
              onClick={handleResend}
              disabled={sending || cooldown > 0}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {sending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <RefreshCw className="w-5 h-5" />
              )}
              {cooldown > 0
                ? t('pendingVerification.resendIn', { count: cooldown })
                : t('pendingVerification.resend')}
            </button>

            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 text-slate-500
                        hover:text-slate-700 dark:text-slate-300 transition-colors text-sm py-2"
            >
              <LogOut className="w-4 h-4" />
              {t('pendingVerification.logout')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
