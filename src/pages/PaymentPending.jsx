/*
 * ============================================================
 * PaymentPending.jsx - Pago pendiente con polling automático
 * ============================================================
 *
 * MP redirige aquí cuando el pago queda en estado "pending" o "in_process".
 * Esto ocurre con pagos en efectivo, transferencias, o revisiones de MP.
 *
 * Flujo:
 * 1. Si hay payment_id → llama /confirm para notificar al backend
 * 2. Si hay order_id (external_reference o sessionStorage) → polling
 * 3. Polling cada 5s por 2 minutos a GET /api/payments/status/{order_id}
 * 4. Si estado pasa a "paid" → muestra éxito con link al curso
 * 5. Si timeout → muestra mensaje de "te notificaremos"
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import LocaleLink from '../components/LocaleLink';
import { useTranslation } from 'react-i18next';
import { Clock, ArrowRight, Mail, CheckCircle2, Loader2 } from 'lucide-react';
import api from '../lib/api';
import { useLocale } from '../hooks/useLocale';

const POLL_INTERVAL_MS = 5000;
const MAX_POLLS = 24;

export default function PaymentPending() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { localePath } = useLocale();
  const [orderId, setOrderId] = useState(null);
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const [courseSlug, setCourseSlug] = useState(null);
  const [pollingDone, setPollingDone] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    const paymentId = searchParams.get('payment_id') || searchParams.get('collection_id');
    const oid = searchParams.get('external_reference') || sessionStorage.getItem('pending_order_id');

    // Notificar al backend sobre el pago (one-time)
    if (paymentId) {
      api.get(`/payments/confirm?payment_id=${paymentId}`).catch(() => {});
    }

    if (oid) {
      setOrderId(oid);
    }
  }, [searchParams]);

  const checkStatus = useCallback(async () => {
    if (!orderId) return;

    try {
      const { data } = await api.get(`/payments/status/${orderId}`);

      if (data.status === 'paid') {
        setPaymentCompleted(true);
        setCourseSlug(data.course_slug);
        sessionStorage.removeItem('pending_order_id');
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        return;
      }

      if (data.status === 'failed') {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        navigate(localePath('/payment/failure'));
        return;
      }
    } catch (err) {
      // Ignorar errores de polling (red, auth)
    }

    setPollCount((prev) => {
      const next = prev + 1;
      if (next >= MAX_POLLS) {
        setPollingDone(true);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
      return next;
    });
  }, [orderId, navigate]);

  // Iniciar polling cuando tenemos orderId
  useEffect(() => {
    if (!orderId || paymentCompleted) return;

    // Check inmediato
    checkStatus();

    intervalRef.current = setInterval(checkStatus, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [orderId, paymentCompleted, checkStatus]);

  // --- Estado: Pago completado durante el polling ---
  if (paymentCompleted) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <CheckCircle2 className="w-16 h-16 text-accent-400 mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-dark-50 mb-4">
            {t('payment.pending.credited.title')}
          </h1>
          <p className="text-dark-300 mb-6">
            {t('payment.pending.credited.body')}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {courseSlug ? (
              <LocaleLink
                to={`/courses/${courseSlug}`}
                className="btn-primary flex items-center gap-2"
              >
                Ir al Curso
                <ArrowRight className="w-4 h-4" />
              </LocaleLink>
            ) : (
              <LocaleLink to="/dashboard" className="btn-primary flex items-center gap-2">
                Ir al Dashboard
                <ArrowRight className="w-4 h-4" />
              </LocaleLink>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- Estado: Default (pago pendiente, polling activo o terminado) ---
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-6">
          <Clock className="w-8 h-8 text-yellow-400" />
        </div>
        <h1 className="text-3xl font-bold text-dark-50 mb-4">
          {t('payment.pending.pendingTitle')}
        </h1>
        <p className="text-dark-300 mb-2">
          {t('payment.pending.pendingBody')}
        </p>
        <p className="text-dark-400 text-sm mb-6">
          {t('payment.pending.cashNote')}
        </p>

        {/* Indicador de polling */}
        {orderId && !pollingDone && (
          <div className="bg-dark-800 border border-dark-700 rounded-lg p-4 mb-6">
            <p className="text-dark-300 text-sm flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary-400" />
              {t('payment.pending.checking')}
            </p>
          </div>
        )}

        {pollingDone && (
          <div className="bg-dark-800 border border-dark-700 rounded-lg p-4 mb-6 text-left">
            <p className="text-dark-300 text-sm flex items-start gap-2">
              <Mail className="w-4 h-4 mt-0.5 text-primary-400 shrink-0" />
              {t('payment.pending.emailNote')}
            </p>
          </div>
        )}

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
