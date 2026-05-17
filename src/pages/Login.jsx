/*
 * ============================================================
 * Login.jsx - Página de inicio de sesión
 * ============================================================
 * 
 * Maneja estados de cuenta:
 * - Cuenta activa → login normal → dashboard
 * - Cuenta pendiente → login → redirige a /pending-verification
 * - Cuenta bloqueada/suspendida → muestra error específico
 * - Cuenta lockeada (intentos fallidos) → muestra error con timer
 */

import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import LocaleLink from '../components/LocaleLink';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useLocale } from '../hooks/useLocale';
import { Loader2, LogIn, AlertTriangle } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [loading, setLoading] = useState(false);

  const { localePath } = useLocale();
  // Redirigir a la página anterior después del login
  const from = location.state?.from?.pathname || localePath('/dashboard');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setWarning('');
    setLoading(true);

    try {
      const userData = await login(email, password);
      
      // Si la cuenta está pendiente de verificación, redirigir
      if (userData.account_status === 'pending_verification') {
        navigate(localePath('/pending-verification'), { replace: true, state: { email } });
      } else {
        navigate(from, { replace: true });
      }
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;

      if (status === 423) {
        setWarning(detail || t('login.errors.locked'));
      } else if (status === 403) {
        setError(detail || t('login.errors.suspended'));
      } else if (status === 429) {
        setWarning(t('login.errors.rateLimit'));
      } else {
        setError(detail || t('login.errors.generic'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/favicon.png" alt="Firmware Academy" className="h-12 w-auto mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('login.title')}</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">
            {t('login.subtitle')}
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

          {warning && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 
                           text-sm px-4 py-3 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{warning}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {t('login.email')}
            </label>
            <input
              type="email"
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {t('login.password')}
            </label>
            <input
              type="password"
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••"
              required
              minLength={8}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <LogIn className="w-5 h-5" />
            )}
            {t('login.submit')}
          </button>
        </form>

        <p className="text-center text-slate-500 dark:text-slate-400 text-sm mt-4">
          {t('login.noAccount')}{' '}
          <LocaleLink to="/register" className="text-primary-600 hover:text-primary-700 font-medium">
            {t('login.signUp')}
          </LocaleLink>
        </p>
      </div>
    </div>
  );
}
