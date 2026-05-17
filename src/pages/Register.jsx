/*
 * ============================================================
 * Register.jsx - Página de registro con verificación por email
 * ============================================================
 * 
 * Flujo:
 * 1. Usuario completa el formulario
 * 2. Backend crea cuenta en estado "pending_verification"
 * 3. Se envía email con link de verificación
 * 4. Se muestra pantalla de "Revisa tu email"
 * 
 * Ya NO auto-loguea al usuario tras el registro.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import LocaleLink from '../components/LocaleLink';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, UserPlus, Mail, CheckCircle2 } from 'lucide-react';

export default function Register() {
  const { register } = useAuth();
  const { t } = useTranslation();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Validación de contraseña en tiempo real
  const passwordChecks = {
    length: password.length >= 10,
    notEmail: password.length > 0 && password.toLowerCase() !== email.toLowerCase(),
    notUsername: password.length > 0 && password.toLowerCase() !== username.toLowerCase(),
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validar passwords
    if (password !== confirmPassword) {
      setError(t('register.errors.passwordMismatch'));
      return;
    }

    if (password.length < 10) {
      setError(t('register.errors.passwordLength'));
      return;
    }

    if (!termsAccepted || !privacyAccepted) {
      setError(t('register.errors.legalRequired'));
      return;
    }

    setLoading(true);
    try {
      await register(email, username, password, termsAccepted, privacyAccepted);
      setSuccess(true);
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        // Errores de validación Pydantic
        setError(detail.map(d => d.msg).join('. '));
      } else {
        setError(detail || t('register.errors.generic'));
      }
    } finally {
      setLoading(false);
    }
  };

  // Pantalla de éxito: verificar email
  if (success) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="card p-8">
            <Mail className="w-16 h-16 text-primary-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              {t('register.success.title')}
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              {t('register.success.body', { email })}{' '}
            </p>
            <div className="bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-700 rounded-lg p-4 text-sm text-slate-600 dark:text-slate-400 mb-6">
              <p className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary-500 mt-0.5 flex-shrink-0" />
                <span>{t('register.success.hint1')}</span>
              </p>
              <p className="flex items-start gap-2 mt-2">
                <CheckCircle2 className="w-4 h-4 text-primary-500 mt-0.5 flex-shrink-0" />
                <span>{t('register.success.hint2')}</span>
              </p>
            </div>
            <LocaleLink
              to="/login"
              className="btn-primary inline-flex items-center gap-2"
            >
              {t('register.success.goLogin')}
            </LocaleLink>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/favicon.png" alt="Firmware Academy" className="h-12 w-auto mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('register.title')}</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">
            {t('register.subtitle')}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 
                           text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {t('register.username')}
            </label>
            <input
              type="text"
              className="input-field"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="tu_nombre"
              required
              minLength={3}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {t('register.email')}
            </label>
            <input
              type="email"
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {t('register.password')}
            </label>
            <input
              type="password"
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••"
              required
              minLength={10}
            />
            {/* Indicadores de validación en tiempo real */}
            {password.length > 0 && (
              <div className="mt-2 space-y-1">
                <PasswordCheck ok={passwordChecks.length} text={t('register.passwordChecks.length')} />
                {email && <PasswordCheck ok={passwordChecks.notEmail} text={t('register.passwordChecks.notEmail')} />}
                {username && <PasswordCheck ok={passwordChecks.notUsername} text={t('register.passwordChecks.notUsername')} />}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {t('register.confirmPassword')}
            </label>
            <input
              type="password"
              className="input-field"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••••"
              required
              minLength={10}
            />
          </div>

          {/* Aceptación legal */}
          <div className="space-y-3 pt-2">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-slate-300 bg-white 
                           text-primary-500 focus:ring-primary-500 focus:ring-offset-0
                           focus:ring-2 cursor-pointer"
              />
              <span className="text-sm text-slate-600 dark:text-slate-400 group-hover:text-slate-800">
                {t('register.terms')}{' '}
                <LocaleLink
                  to="/terminos"
                  target="_blank"
                  className="text-primary-600 hover:text-primary-700 underline">
                  {t('register.termsLink')}
                </LocaleLink>
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={privacyAccepted}
                onChange={(e) => setPrivacyAccepted(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-slate-300 bg-white 
                           text-primary-500 focus:ring-primary-500 focus:ring-offset-0
                           focus:ring-2 cursor-pointer"
              />
              <span className="text-sm text-slate-600 dark:text-slate-400 group-hover:text-slate-800">
                {t('register.privacy')}{' '}
                <LocaleLink
                  to="/privacidad"
                  target="_blank"
                  className="text-primary-600 hover:text-primary-700 underline">
                  {t('register.privacyLink')}
                </LocaleLink>
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <UserPlus className="w-5 h-5" />
            )}
            {t('register.submit')}
          </button>
        </form>

        <p className="text-center text-slate-500 dark:text-slate-400 text-sm mt-4">
          {t('register.hasAccount')}{' '}
          <LocaleLink to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
            {t('register.signIn')}
          </LocaleLink>
        </p>
      </div>
    </div>
  );
}

/**
 * Mini componente para indicadores de validación de contraseña.
 */
function PasswordCheck({ ok, text }) {
  return (
    <p className={`text-xs flex items-center gap-1.5 ${ok ? 'text-green-400' : 'text-slate-400'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-green-400' : 'bg-slate-300'}`} />
      {text}
    </p>
  );
}
