/*
 * ============================================================
 * PaymentSuccess.jsx - Confirmación de pago (Mercado Pago)
 * ============================================================
 *
 * Flujo:
 * 1. MP redirige aquí con query params: ?payment_id=xxx&external_reference=UUID&...
 * 2. Llama GET /api/payments/confirm?payment_id=xxx para confirmar
 * 3. Muestra resultado según el estado del pago
 * 4. Si /confirm falla, hace polling a GET /api/payments/status/{order_id}
 *
 * También maneja el caso de volver manualmente (sin query params)
 * usando el order_id guardado en sessionStorage.
 */

import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import LocaleLink from '../components/LocaleLink';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle2, ArrowRight, Loader2, AlertCircle, Clock, XCircle
} from 'lucide-react';
import api from '../lib/api';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const paymentId = searchParams.get('payment_id') || searchParams.get('collection_id');
    const orderId = searchParams.get('external_reference') || sessionStorage.getItem('pending_order_id');

    if (paymentId) {
      api
        .get(`/payments/confirm?payment_id=${paymentId}`)
        .then(({ data }) => {
          setResult(data);
          setLoading(false);
          if (data.enrolled) {
            sessionStorage.removeItem('pending_order_id');
          }
        })
        .catch((err) => {
          console.error('Error al confirmar pago:', err);
          if (orderId) {
            pollStatus(orderId);
          } else {
            setError(err.response?.data?.detail || 'Error al verificar el pago');
            setLoading(false);
          }
        });
    } else if (orderId) {
      pollStatus(orderId);
    } else {
      setLoading(false);
    }
  }, [searchParams]);

  const pollStatus = async (orderId) => {
    try {
      const { data } = await api.get(`/payments/status/${orderId}`);
      setResult({
        status: data.status,
        enrolled: data.status === 'paid',
        course_slug: data.course_slug,
        order_id: data.order_id,
      });
      if (data.status === 'paid') {
        sessionStorage.removeItem('pending_order_id');
      }
    } catch (err) {
      console.error('Error polling status:', err);
      setError('No se pudo verificar el estado del pago');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">{t('payment.verifying')}</p>
        </div>
      </div>
    );
  }

  if (result?.enrolled || result?.status === 'paid') {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <CheckCircle2 className="w-16 h-16 text-accent-400 mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-4">
            {t('payment.success.title')}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            {t('payment.success.body')}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {result.course_slug ? (
              <LocaleLink
                to={`/courses/${result.course_slug}`}
                className="btn-primary flex items-center gap-2"
              >
                {t('payment.success.goToCourse')}
                <ArrowRight className="w-4 h-4" />
              </LocaleLink>
            ) : (
              <LocaleLink to="/dashboard" className="btn-primary flex items-center gap-2">
                {t('payment.success.goToDashboard')}
                <ArrowRight className="w-4 h-4" />
              </LocaleLink>
            )}
            <LocaleLink to="/courses" className="btn-secondary">
              {t('payment.success.moreCourses')}
            </LocaleLink>
          </div>
        </div>
      </div>
    );
  }

  if (result?.status === 'pending') {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-6">
            <Clock className="w-8 h-8 text-yellow-400" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-4">
            {t('payment.pending.title')}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            {t('payment.pending.body')}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <LocaleLink to="/dashboard" className="btn-primary flex items-center gap-2">
              {t('payment.goToDashboard')}
              <ArrowRight className="w-4 h-4" />
            </LocaleLink>
            <LocaleLink to="/courses" className="btn-secondary">
              {t('payment.moreCourses')}
            </LocaleLink>
          </div>
        </div>
      </div>
    );
  }

  if (result?.status === 'failed') {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <XCircle className="w-16 h-16 text-red-400 mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-4">
            {t('payment.failed.title')}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            {t('payment.failed.body')}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <LocaleLink to="/courses" className="btn-primary">
              {t('payment.failed.retry')}
            </LocaleLink>
            <LocaleLink to="/" className="btn-secondary">
              {t('payment.failed.backHome')}
            </LocaleLink>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        {error ? (
          <>
            <AlertCircle className="w-16 h-16 text-yellow-400 mx-auto mb-6" />
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              {t('payment.noInfo.verificationPending')}
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mb-2">{error}</p>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
              {t('payment.noInfo.verificationBody')}
            </p>
          </>
        ) : (
          <>
            <AlertCircle className="w-16 h-16 text-slate-400 mx-auto mb-6" />
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              {t('payment.noInfo.title')}
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              {t('payment.noInfo.body')}
            </p>
          </>
        )}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <LocaleLink to="/dashboard" className="btn-primary flex items-center gap-2">
            {t('payment.goToDashboard')}
            <ArrowRight className="w-4 h-4" />
          </LocaleLink>
          <LocaleLink to="/courses" className="btn-secondary">
            {t('payment.viewCourses')}
          </LocaleLink>
        </div>
      </div>
    </div>
  );
}
