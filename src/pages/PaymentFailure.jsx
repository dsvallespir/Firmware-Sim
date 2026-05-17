/*
 * ============================================================
 * PaymentFailure.jsx - Pago rechazado o fallido (Mercado Pago)
 * ============================================================
 *
 * MP redirige aquí cuando el pago es rechazado o el usuario cancela.
 * Query params: ?collection_status=rejected&status=rejected&...
 */

import { Link, useSearchParams } from 'react-router-dom';
import LocaleLink from '../components/LocaleLink';
import { useTranslation } from 'react-i18next';
import { XCircle, RotateCcw, ArrowLeft } from 'lucide-react';

const REJECTION_REASONS = {
  cc_rejected_bad_filled_card_number: 'Número de tarjeta incorrecto.',
  cc_rejected_bad_filled_date: 'Fecha de vencimiento incorrecta.',
  cc_rejected_bad_filled_other: 'Datos de la tarjeta incorrectos.',
  cc_rejected_bad_filled_security_code: 'Código de seguridad incorrecto.',
  cc_rejected_blacklist: 'La tarjeta fue rechazada.',
  cc_rejected_call_for_authorize: 'Debes autorizar el pago con tu banco.',
  cc_rejected_card_disabled: 'La tarjeta está deshabilitada.',
  cc_rejected_duplicated_payment: 'Pago duplicado detectado.',
  cc_rejected_high_risk: 'El pago fue rechazado por riesgo.',
  cc_rejected_insufficient_amount: 'Saldo insuficiente.',
  cc_rejected_invalid_installments: 'Las cuotas seleccionadas no son válidas.',
  cc_rejected_max_attempts: 'Superaste el límite de intentos.',
};

export default function PaymentFailure() {
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const statusDetail = searchParams.get('status_detail') || '';
  const reason = REJECTION_REASONS[statusDetail] || t('payment.failure.defaultReason');

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <XCircle className="w-16 h-16 text-red-400 mx-auto mb-6" />
        <h1 className="text-3xl font-bold text-dark-50 mb-4">
          {t('payment.failure.title')}
        </h1>
        <p className="text-dark-300 mb-2">{reason}</p>
        <p className="text-dark-400 text-sm mb-8">
          {t('payment.failure.retry')}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <LocaleLink to="/courses" className="btn-primary flex items-center gap-2">
            <RotateCcw className="w-4 h-4" />
            {t('payment.failure.retryButton')}
          </LocaleLink>
          <LocaleLink to="/" className="btn-secondary flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            {t('payment.failure.backHome')}
          </LocaleLink>
        </div>
      </div>
    </div>
  );
}
