/*
 * ============================================================
 * MarkdownRenderer.jsx - Renderizador de Markdown con LaTeX y código
 * ============================================================
 *
 * Capacidades:
 *  - LaTeX inline ($...$) y en bloque ($$...$$) via KaTeX
 *  - Syntax highlighting para C, C++, Python, VHDL, Bash, etc.
 *  - Botón copiar y botón compartir por bloque de código
 *  - Número de línea + label de lenguaje
 *  - Tablas GFM, HTML inline, imágenes lazy-load
 *
 * Pipeline de plugins:
 *   remark-gfm      → tablas, listas de tareas, strikethrough
 *   remark-math     → parsea $...$ y $$...$$ como nodos math
 *   rehype-raw      → permite HTML embebido en el markdown
 *   rehype-katex    → renderiza los nodos math a HTML KaTeX
 */

import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Copy, Check, Share2 } from 'lucide-react';
import { useState, useEffect, useRef, createContext, useContext } from 'react';
import api from '../lib/api';
import YouTubePlayer, { isYouTubeUrl } from './YouTubePlayer';
import SimulatorPanelEmbedded from './SimulatorPanelEmbedded';

// Contexto de tema para componentes internos (evita prop-drilling)
const RendererThemeCtx = createContext('light');

// ----------------------------------------------------------
// Remark plugin: GitHub Alerts sin dependencias externas
// Detecta > [!NOTE], > [!WARNING], > [!TIP], > [!IMPORTANT], > [!CAUTION]
// Marca el nodo blockquote con data-alert para renderizado especial
// ----------------------------------------------------------
function remarkGithubAlerts() {
  return function transformer(tree) {
    function walk(node) {
      if (node.type === 'blockquote') {
        const firstP = node.children?.[0];
        if (firstP?.type === 'paragraph') {
          const firstChild = firstP.children?.[0];
          if (firstChild?.type === 'text') {
            const match = firstChild.value.match(
              /^\[!(NOTE|WARNING|TIP|IMPORTANT|CAUTION)\]\s*/i
            );
            if (match) {
              const alertType = match[1].toUpperCase();
              node.data = node.data || {};
              node.data.hProperties = node.data.hProperties || {};
              node.data.hProperties['data-alert'] = alertType;
              // Eliminar el [!TYPE] del texto
              firstChild.value = firstChild.value
                .slice(match[0].length)
                .trimStart();
              if (!firstChild.value) firstP.children.shift();
              if (!firstP.children.length) node.children.shift();
            }
          }
        }
      }
      node.children?.forEach(walk);
    }
    walk(tree);
  };
}

// Configuración visual de cada tipo de alerta
const ALERT_CONFIG = {
  NOTE:      { icon: 'ℹ️',  label: 'Nota',        border: '#3b82f6', bg: 'rgba(59,130,246,0.08)'  },
  TIP:       { icon: '💡', label: 'Consejo',      border: '#22c55e', bg: 'rgba(34,197,94,0.08)'   },
  IMPORTANT: { icon: '❗', label: 'Importante',   border: '#a855f7', bg: 'rgba(168,85,247,0.08)' },
  WARNING:   { icon: '⚠️', label: 'Advertencia',  border: '#eab308', bg: 'rgba(234,179,8,0.08)'   },
  CAUTION:   { icon: '🔴', label: 'Precaución',   border: '#ef4444', bg: 'rgba(239,68,68,0.08)'   },
};

// ----------------------------------------------------------
// Mapeo de aliases → nombre de lenguaje para Prism
// ----------------------------------------------------------
const LANG_MAP = {
  c: 'c', h: 'c',
  cpp: 'cpp', 'c++': 'cpp', cc: 'cpp', hpp: 'cpp',
  python: 'python', py: 'python',
  vhdl: 'vhdl', vhd: 'vhdl',
  verilog: 'verilog', v: 'verilog',
  systemverilog: 'systemverilog', sv: 'systemverilog',
  bash: 'bash', sh: 'bash', shell: 'bash', zsh: 'bash',
  makefile: 'makefile', make: 'makefile',
  cmake: 'cmake',
  json: 'json',
  yaml: 'yaml', yml: 'yaml',
  toml: 'toml',
  rust: 'rust', rs: 'rust',
  javascript: 'javascript', js: 'javascript',
  typescript: 'typescript', ts: 'typescript',
  sql: 'sql',
  text: 'text', txt: 'text', plain: 'text',
};

// ----------------------------------------------------------
// Botón copiar
// ----------------------------------------------------------
function CopyButton({ code }) {
  const theme = useContext(RendererThemeCtx);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      title="Copiar código"
      className={`p-1.5 rounded-md transition-colors ${
        theme === 'light'
          ? 'bg-gray-200/80 hover:bg-gray-300 text-gray-500 hover:text-gray-800'
          : 'bg-dark-700/80 hover:bg-dark-600 text-dark-300 hover:text-dark-100'
      }`}
    >
      {copied
        ? <Check className="w-3.5 h-3.5 text-green-500" />
        : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// ----------------------------------------------------------
// Botón compartir (copia la URL actual + anchor al portapapeles)
// ----------------------------------------------------------
function ShareButton({ lang, code }) {
  const theme = useContext(RendererThemeCtx);
  const [shared, setShared] = useState(false);

  const handleShare = async () => {
    // Genera un snippet inline pequeño para compartir
    const snippet = `\`\`\`${lang}\n${code.slice(0, 300)}${code.length > 300 ? '\n...' : ''}\n\`\`\``;
    const url = window.location.href;
    await navigator.clipboard.writeText(`${url}\n\n${snippet}`);
    setShared(true);
    setTimeout(() => setShared(false), 2000);
  };

  return (
    <button
      onClick={handleShare}
      title="Copiar URL + snippet"
      className={`p-1.5 rounded-md transition-colors ${
        theme === 'light'
          ? 'bg-gray-200/80 hover:bg-gray-300 text-gray-500 hover:text-gray-800'
          : 'bg-dark-700/80 hover:bg-dark-600 text-dark-300 hover:text-dark-100'
      }`}
    >
      {shared
        ? <Check className="w-3.5 h-3.5 text-blue-400" />
        : <Share2 className="w-3.5 h-3.5" />}
    </button>
  );
}

// ----------------------------------------------------------
// Bloque de código con barra superior (lang + botones)
// ----------------------------------------------------------
function CodeBlock({ lang, code }) {
  const theme = useContext(RendererThemeCtx);
  const isLight = theme === 'light';
  const resolvedLang = LANG_MAP[lang?.toLowerCase()] || lang || 'text';

  // Etiquetas legibles para la barra superior
  const LANG_LABEL = {
    c: 'C', cpp: 'C++', python: 'Python', vhdl: 'VHDL',
    verilog: 'Verilog', systemverilog: 'SystemVerilog',
    bash: 'Bash', makefile: 'Makefile', cmake: 'CMake',
    json: 'JSON', yaml: 'YAML', toml: 'TOML',
    rust: 'Rust', javascript: 'JavaScript', typescript: 'TypeScript',
    sql: 'SQL', text: 'Text',
  };
  const label = LANG_LABEL[resolvedLang] || resolvedLang.toUpperCase();

  return (
    <div className={`my-5 rounded-xl overflow-hidden shadow-lg ${
      isLight ? 'border border-gray-200' : 'border border-dark-700'
    }`}>
      {/* ---- Barra superior ---- */}
      <div className={`flex items-center justify-between px-4 py-2 border-b ${
        isLight ? 'bg-gray-100 border-gray-200' : 'bg-dark-800 border-dark-700'
      }`}>
        {/* Puntos decorativos estilo macOS */}
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500/60" />
          <span className="w-3 h-3 rounded-full bg-yellow-500/60" />
          <span className="w-3 h-3 rounded-full bg-green-500/60" />
          <span className={`ml-3 text-xs font-mono select-none ${
            isLight ? 'text-gray-400' : 'text-dark-400'
          }`}>
            {label}
          </span>
        </div>
        {/* Botones acción */}
        <div className="flex items-center gap-1">
          <ShareButton lang={resolvedLang} code={code} />
          <CopyButton code={code} />
        </div>
      </div>

      {/* ---- Código ---- */}
      <SyntaxHighlighter
        style={isLight ? oneLight : atomDark}
        language={resolvedLang}
        PreTag="div"
        showLineNumbers={true}
        wrapLines={true}
        lineProps={() => ({
          style: { backgroundColor: 'none' }
        })}
        customStyle={{
          margin: 0,
          borderRadius: 0,
          padding: '1.25rem 1rem',
          fontSize: '0.85rem',
          lineHeight: '1.6',
          backgroundColor: isLight ? '#fafafa' : '#0d1117',
        }}
        lineNumberStyle={{
          minWidth: '2.8em',
          paddingRight: '1.2em',
          color: isLight ? '#9ca3af' : '#3d4f5e',
          userSelect: 'none',
          fontSize: '0.78rem',
        }}
        wrapLongLines={false}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

// ----------------------------------------------------------
// Componente principal
// ----------------------------------------------------------

/**
 * AuthImage: carga imágenes de /api/... usando Axios (con JWT).
 * Las etiquetas <img> nativas no envían cabeceras de autorización,
 * por lo que las imágenes protegidas devuelven 401. Este componente
 * descarga el blob con Axios y crea una Object URL temporal.
 */
function AuthImage({ src, alt, className, ...props }) {
  const theme = useContext(RendererThemeCtx);
  const isLight = theme === 'light';
  const [blobUrl, setBlobUrl] = useState(null);
  const [error, setError] = useState(false);
  const prevUrl = useRef(null);

  useEffect(() => {
    if (!src) return;

    // URLs externas o data: se usan directamente sin Axios
    if (!src.startsWith('/api/')) {
      setBlobUrl(src);
      return;
    }

    // api tiene baseURL='/api', así que quitamos ese prefijo del src
    // para que Axios no duplique: /api + /api/content/... → /api/api/content/...
    const apiPath = src.replace(/^\/api/, '');

    let cancelled = false;
    api.get(apiPath, { responseType: 'blob' })
      .then(({ data }) => {
        if (cancelled) return;
        const url = URL.createObjectURL(data);
        if (prevUrl.current) URL.revokeObjectURL(prevUrl.current);
        prevUrl.current = url;
        setBlobUrl(url);
      })
      .catch(() => {
        if (!cancelled) setError(true); // no reintentar con <img> nativo (causaría otro 401)
      });
    return () => { cancelled = true; };
  }, [src]);

  // Limpiar blob URL al desmontar
  useEffect(() => {
    return () => { if (prevUrl.current) URL.revokeObjectURL(prevUrl.current); };
  }, []);

  if (error) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs text-red-400 ${isLight ? 'bg-red-50' : 'bg-dark-800'} px-2 py-1 rounded ${className || ''}`}>
        ⚠ imagen no disponible
      </span>
    );
  }
  if (!blobUrl) {
    // Placeholder mientras carga
    return (
      <span className={`inline-block ${isLight ? 'bg-slate-200' : 'bg-dark-800'} rounded animate-pulse ${className || ''}`}
            style={{ minWidth: 120, minHeight: 40 }} />);
  }
  return <img src={blobUrl} alt={alt} className={className} {...props} />;
}

export default function MarkdownRenderer({ content, assetsBaseUrl = null, theme = 'light', simulatorContext = null }) {
  /**
   * Reescribe una ruta relativa de imagen usando assetsBaseUrl.
   * Las URLs absolutas (http/https), rutas raíz (/) y data URIs
   * se devuelven sin cambios.
   */
  function resolveAssetSrc(src) {
    if (!assetsBaseUrl || !src) return src;
    if (src.startsWith('http') || src.startsWith('/') || src.startsWith('data:')) return src;
    return `${assetsBaseUrl}/${src}`;
  }

  const isLight = theme === 'light';

  return (
    <RendererThemeCtx.Provider value={theme}>
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath, remarkGithubAlerts]}
        rehypePlugins={[rehypeRaw, rehypeKatex]}
        components={{
          // ---- Bloques de código ----------------------------------------
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const codeString = String(children).replace(/\n$/, '');

            if (!inline && match) {
              return <CodeBlock lang={match[1]} code={codeString} />;
            }

            // Bloques sin lenguaje explícito (``` sin etiqueta)
            if (!inline && !match && codeString.includes('\n')) {
              return <CodeBlock lang="text" code={codeString} />;
            }

            // Código inline `...`
            return (
              <code
                className={isLight
                  ? 'bg-slate-100 text-primary-700 px-1.5 py-0.5 rounded text-[0.85em] font-mono border border-slate-200'
                  : 'bg-dark-800 text-primary-300 px-1.5 py-0.5 rounded text-[0.85em] font-mono border border-dark-700'}
                {...props}
              >
                {children}
              </code>
            );
          },

          // ---- GitHub Alerts: > [!NOTE], > [!WARNING], etc. ---------------
          blockquote({ node, children, ...props }) {
            const alertType = node?.properties?.['data-alert'];
            if (alertType) {
              const cfg = ALERT_CONFIG[alertType] || ALERT_CONFIG.NOTE;
              return (
                <div
                  className="my-4 rounded-r-xl border-l-4 px-4 py-3 not-italic"
                  style={{ borderColor: cfg.border, background: cfg.bg }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span role="img" aria-label={cfg.label}>{cfg.icon}</span>
                    <span
                      className="text-sm font-semibold uppercase tracking-wide"
                      style={{ color: cfg.border }}
                    >
                      {cfg.label}
                    </span>
                  </div>
                  <div className={`${isLight ? 'text-slate-700' : 'text-dark-200'} [&>p]:mb-1 [&>p:last-child]:mb-0`}>
                    {children}
                  </div>
                </div>
              );
            }
            return (
              <blockquote
                className={isLight
                  ? 'border-l-4 border-primary-400 pl-4 py-1 my-4 bg-primary-50/60 rounded-r-lg italic text-slate-600'
                  : 'border-l-4 border-primary-500 pl-4 py-1 my-4 bg-dark-800/50 rounded-r-lg italic text-dark-300'}
                {...props}
              >
                {children}
              </blockquote>
            );
          },

          // ---- Tablas con scroll horizontal en móvil ----------------------
          table({ node, children, ...props }) {
            return (
              <div className={`overflow-x-auto my-4 rounded-lg ${
                isLight ? 'border border-slate-200' : 'border border-dark-700'
              }`}>
                <table className="min-w-full border-collapse" {...props}>
                  {children}
                </table>
              </div>
            );
          },

          // ---- Links: auto-embed YouTube + externos en nueva pestaña ------
          a({ node, href, children, ...props }) {
            // Auto-embed si la URL es de YouTube y el texto del link == URL
            // (link pegado directamente en el markdown sin texto alternativo)
            const childText = String(children).trim();
            if (
              isYouTubeUrl(href) &&
              (childText === href ||
                childText === href?.replace('https://', '') ||
                childText === '')
            ) {
              return <YouTubePlayer url={href} />;
            }

            const isExternal = href?.startsWith('http');
            return (
              <a
                href={href}
                target={isExternal ? '_blank' : undefined}
                rel={isExternal ? 'noopener noreferrer' : undefined}
                className="text-primary-400 hover:text-primary-300 underline underline-offset-2"
                {...props}
              >
                {children}
              </a>
            );
          },

          // ---- Imágenes con caption si tienen alt text --------------------
          img({ node, alt, src, ...props }) {
            const resolvedSrc = resolveAssetSrc(src);
            if (alt) {
              return (
                <figure className="my-4">
                  <AuthImage
                    src={resolvedSrc}
                    alt={alt}
                    className={isLight
                      ? 'max-w-full h-auto rounded-lg border border-slate-200 mx-auto block'
                      : 'max-w-full h-auto rounded-lg border border-dark-700 mx-auto block'}
                    {...props}
                  />
                  <figcaption className={isLight
                    ? 'text-center text-xs text-slate-400 mt-2 italic'
                    : 'text-center text-xs text-dark-400 mt-2 italic'}>
                    {alt}
                  </figcaption>
                </figure>
              );
            }
            return (
              <AuthImage
                src={resolvedSrc}
                alt=""
                className={isLight
                  ? 'max-w-full h-auto rounded-lg my-4 border border-slate-200'
                  : 'max-w-full h-auto rounded-lg my-4 border border-dark-700'}
                {...props}
              />
            );
          },
          // ---- <simulator> embebido en el markdown ---------------------
          // Uso en markdown:
          //   <simulator></simulator>                           (auto-detecta lección)
          //   <simulator lesson="03"></simulator>                (lección explícita)
          //   <simulator file="02_ejercicio_03.ino"></simulator> (archivo específico)
          // NOTA: react-markdown parsea <simulator> como inline y lo envuelve en <p>.
          // Para evitar que <section> quede dentro de <p> (HTML inválido), el
          // componente p detecta si alguno de sus hijos es el bloque simulator
          // y usa <div> en su lugar.
          p({ node, children, ...props }) {
            const hasBlockChild = node?.children?.some(
              (child) => child.type === 'element' && (
                child.tagName === 'simulator' ||
                child.tagName === 'img'
              )
            );
            if (hasBlockChild) {
              return <div {...props}>{children}</div>;
            }
            return (
              <p
                className={isLight ? 'text-slate-700 leading-relaxed' : 'text-dark-200 leading-relaxed'}
                {...props}
              >
                {children}
              </p>
            );
          },
          simulator({ node, lesson, file, 'read-only': readOnly, ...props }) {
            if (!simulatorContext) return null;
            const isReadOnly = readOnly === 'true' || readOnly === true;
            return (
              <SimulatorPanelEmbedded
                courseSlug={simulatorContext.courseSlug}
                moduleSlug={simulatorContext.moduleSlug}
                codeFiles={simulatorContext.codeFiles}
                lessonFilename={simulatorContext.lessonFilename}
                lessonNumber={lesson || null}
                file={file || null}
                circuitJson={simulatorContext.circuitJson}
                readOnly={isReadOnly}
              />
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
    </RendererThemeCtx.Provider>
  );
}
