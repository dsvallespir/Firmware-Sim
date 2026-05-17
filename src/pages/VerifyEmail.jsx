/*
 * ============================================================
 * VerifyEmail.jsx - Verificación de email desde enlace
 * ============================================================
 * 
 * Maneja la URL: /verify-email?token=xxx
 * 
 * Flujo:
 * 1. Extrae el token de los query params
 * 2. Llama a POST /auth/verify-email con el token
 * 3. Muestra éxito o error
 * 4. En caso de éxito, redirige a login
 */

import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import LocaleLink from '../components/LocaleLink';
import { useTranslation } from 'react-i18next';
import api from '../lib/api';
import { CheckCircle2, XCircle, Loader2, GraduationCap } from 'lucide-react';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { t } = useTranslation();

  const [status, setStatus] = useState('verifying'); // verifying | success | error | no-token
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('no-token');
      setMessage(t('verifyEmail.error.noToken'));
      return;
    }

    const verify = async () => {
      try {
        const { data } = await api.post('/auth/verify-email', { token });
        setStatus('success');
        setMessage(data.message || t('verifyEmail.success.title'));
      } catch (err) {
        setStatus('error');
        const detail = err.response?.data?.detail;
        if (typeof detail === 'string') {
          setMessage(detail);
        } else {
          setMessage(t('verifyEmail.error.expired'));
        }
      }
    };

    verify();
  }, [token]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="card p-8">
          {/* Verificando */}
          {status === 'verifying' && (
            <>
              <Loader2 className="w-16 h-16 text-primary-500 mx-auto mb-4 animate-spin" />
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                {t('verifyEmail.verifying.title')}
              </h1>
              <p className="text-slate-500 dark:text-slate-400">
                {t('verifyEmail.verifying.body')}
              </p>
            </>
          )}

          {/* Éxito */}
          {status === 'success' && (
            <>
              <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                {t('verifyEmail.success.title')}
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mb-6">{message}</p>
              <LocaleLink
                to="/login"
                className="btn-primary inline-flex items-center gap-2"
              >
                <GraduationCap className="w-5 h-5" />
                {t('verifyEmail.success.button')}
              </LocaleLink>
            </>
          )}

          {/* Error */}
          {(status === 'error' || status === 'no-token') && (
            <>
              <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-dark-50 mb-2">
                {t('verifyEmail.error.title')}
              </h1>
              <p className="text-dark-300 mb-6">{message}</p>
              <div className="space-y-3">
                <LocaleLink
                  to="/login"
                  className="btn-primary inline-flex items-center gap-2"
                >
                  {t('verifyEmail.error.login')}
                </LocaleLink>
                <p className="text-dark-500 text-sm">
                  {t('verifyEmail.error.hint')}{' '}
                  <LocaleLink
                    to="/pending-verification"
                    className="text-primary-400 hover:text-primary-300"
                  >
                    {t('verifyEmail.error.hintLink')}
                  </LocaleLink>.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
