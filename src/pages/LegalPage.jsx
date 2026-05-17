/*
 * ============================================================
 * LegalPage.jsx - Página genérica para documentos legales
 * ============================================================
 * 
 * Renderiza documentos legales (Términos, Privacidad, Cookies)
 * obtenidos del backend en formato Markdown.
 * 
 * Props via route params:
 *   docType: "terms" | "privacy" | "cookies"
 * 
 * Usa el MarkdownRenderer existente para renderizar el contenido.
 */

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, FileText, Shield, Cookie } from 'lucide-react';
import api from '../lib/api';
import MarkdownRenderer from '../components/MarkdownRenderer';

const DOC_CONFIG = {
  terms: {
    icon: FileText,
    fallbackTitle: 'Términos y Condiciones',
  },
  privacy: {
    icon: Shield,
    fallbackTitle: 'Política de Privacidad',
  },
  cookies: {
    icon: Cookie,
    fallbackTitle: 'Política de Cookies',
  },
};

export default function LegalPage({ docType: propDocType }) {
  const params = useParams();
  const docType = propDocType || params.docType;
  const config = DOC_CONFIG[docType] || DOC_CONFIG.terms;

  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDocument = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get(`/legal/documents/${docType}`);
        setDocument(data);
      } catch (err) {
        setError('No se pudo cargar el documento. Intenta de nuevo más tarde.');
      } finally {
        setLoading(false);
      }
    };

    if (docType) fetchDocument();
  }, [docType]);

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
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const Icon = config.icon;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Icon className="w-8 h-8 text-primary-500" />
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
          {document?.title || config.fallbackTitle}
        </h1>
      </div>

      {/* Versión y fecha */}
      {document?.version && (
        <p className="text-slate-400 text-sm mb-8">
          Versión {document.version} · Última actualización:{' '}
          {document.last_updated
            ? new Date(document.last_updated).toLocaleDateString('es-AR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })
            : 'N/A'}
        </p>
      )}

      {/* Contenido Markdown */}
      <div className="card p-6 sm:p-8">
        <div className="markdown-content prose-legal">
          <MarkdownRenderer content={document?.content || ''} />
        </div>
      </div>
    </div>
  );
}
