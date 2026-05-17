/*
 * ============================================================
 * ContactPage.jsx - Página de contacto con datos del proveedor
 * ============================================================
 * 
 * Muestra información de contacto y datos fiscales del proveedor
 * obtenidos de /api/legal/config (fuente única de verdad).
 * 
 * Requerido por normativa argentina (Ley 24.240 / Res. 104/2005)
 * para plataformas de venta de productos digitales.
 */

import { useState, useEffect } from 'react';
import { Loader2, Mail, MapPin, Globe, Building2, Phone } from 'lucide-react';
import api from '../lib/api';

export default function ContactPage() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const { data } = await api.get('/legal/config');
        setConfig(data);
      } catch {
        setError('No se pudo cargar la información de contacto.');
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-10">
        <Building2 className="w-12 h-12 text-primary-500 mx-auto mb-4" />
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Contacto</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2">
          Información del proveedor y canales de comunicación
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Datos del proveedor */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            Datos del Proveedor
          </h2>
          <div className="space-y-3">
            <InfoRow
              icon={Building2}
              label="Razón Social"
              value={config.provider_legal_name}
            />
            <InfoRow
              icon={Building2}
              label="CUIT"
              value={config.provider_tax_id}
            />
            <InfoRow
              icon={MapPin}
              label="Domicilio"
              value={config.provider_address}
            />
            <InfoRow
              icon={Globe}
              label="Sitio Web"
              value={config.provider_website}
              href={config.provider_website}
            />
          </div>
        </div>

        {/* Canales de contacto */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            Canales de Contacto
          </h2>
          <div className="space-y-3">
            <InfoRow
              icon={Mail}
              label="Email General"
              value={config.provider_email}
              href={`mailto:${config.provider_email}`}
            />
            <InfoRow
              icon={Mail}
              label="Soporte"
              value={config.support_email}
              href={`mailto:${config.support_email}`}
            />
          </div>

          <div className="mt-6 p-4 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-700 rounded-lg">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Para consultas sobre facturación, reembolsos o ejercer tu
              derecho de arrepentimiento (Ley 24.240), escribí a{' '}
              <a
                href={`mailto:${config.support_email}`}
                className="text-primary-600 hover:text-primary-700"
              >
                {config.support_email}
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Información fiscal */}
      <div className="card p-6 mt-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">
          Información Fiscal
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="text-center p-4 bg-slate-50 dark:bg-dark-950 rounded-lg">
            <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">
              Moneda
            </p>
            <p className="text-slate-800 font-semibold text-lg">
              {config.prices_currency}
            </p>
          </div>
          <div className="text-center p-4 bg-slate-50 dark:bg-dark-950 rounded-lg">
            <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">
              Impuestos
            </p>
            <p className="text-slate-800 font-semibold text-lg">
              {config.prices_include_taxes ? 'Incluidos' : 'No incluidos'}
            </p>
          </div>
          <div className="text-center p-4 bg-slate-50 dark:bg-dark-950 rounded-lg">
            <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">
              Plazo de Arrepentimiento
            </p>
            <p className="text-slate-800 font-semibold text-lg">
              {config.withdrawal_period_days} días
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Fila de información con ícono, etiqueta y valor.
 */
function InfoRow({ icon: Icon, label, value, href }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-4 h-4 text-primary-500 mt-1 flex-shrink-0" />
      <div>
        <p className="text-dark-500 text-xs">{label}</p>
        {href ? (
          <a
            href={href}
            className="text-dark-200 text-sm hover:text-primary-400 transition-colors"
            target={href.startsWith('http') ? '_blank' : undefined}
            rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
          >
            {value}
          </a>
        ) : (
          <p className="text-dark-200 text-sm">{value}</p>
        )}
      </div>
    </div>
  );
}
