/*
 * ============================================================
 * YouTubePlayer.jsx - Embed responsivo de YouTube
 * ============================================================
 *
 * Extrae el video ID de múltiples formatos de URL:
 *   - https://www.youtube.com/watch?v=VIDEO_ID
 *   - https://youtu.be/VIDEO_ID
 *   - https://www.youtube.com/embed/VIDEO_ID
 *   - https://youtube.com/shorts/VIDEO_ID
 *
 * El embed usa parámetros para minimizar distracciones:
 *   rel=0            → sin sugerencias de otros canales al terminar
 *   modestbranding=1 → logo de YouTube más discreto
 *   color=white      → barra de progreso blanca (más elegante)
 *
 * Uso en MarkdownRenderer:
 *   Si un link es una URL de YouTube "sola" (texto == URL),
 *   se reemplaza por este player automáticamente.
 *
 * Uso en LessonViewer:
 *   Si lesson.youtube_url está presente, se muestra el player
 *   encima del contenido markdown de la lección.
 */

/**
 * Extrae el video ID de una URL de YouTube.
 * Soporta: watch?v=, youtu.be/, /embed/, /shorts/
 *
 * @param {string} url - URL de YouTube
 * @returns {string|null} - video ID o null si no es válida
 */
export function extractYouTubeId(url) {
  if (!url) return null;
  try {
    const u = new URL(url);

    // https://youtu.be/VIDEO_ID
    if (u.hostname === 'youtu.be') {
      return u.pathname.slice(1).split('/')[0] || null;
    }

    if (u.hostname === 'www.youtube.com' || u.hostname === 'youtube.com') {
      // https://youtube.com/shorts/VIDEO_ID
      if (u.pathname.startsWith('/shorts/')) {
        return u.pathname.split('/')[2] || null;
      }

      // https://youtube.com/embed/VIDEO_ID
      if (u.pathname.startsWith('/embed/')) {
        return u.pathname.split('/')[2] || null;
      }

      // https://youtube.com/watch?v=VIDEO_ID
      const v = u.searchParams.get('v');
      if (v) return v;
    }
  } catch (_) {
    // URL inválida, no es YouTube
  }
  return null;
}

/**
 * Verifica si una URL es de YouTube.
 *
 * @param {string} url
 * @returns {boolean}
 */
export function isYouTubeUrl(url) {
  if (!url) return false;
  return (
    url.includes('youtube.com/watch') ||
    url.includes('youtu.be/') ||
    url.includes('youtube.com/embed/') ||
    url.includes('youtube.com/shorts/')
  );
}

/**
 * Componente de embed de YouTube responsivo (ratio 16:9).
 *
 * @param {object} props
 * @param {string} props.url       - URL de YouTube
 * @param {string} props.className - Clases extra opcionales
 */
export default function YouTubePlayer({ url, className = '' }) {
  const videoId = extractYouTubeId(url);
  if (!videoId) return null;

  return (
    <div
      className={`yt-embed-wrapper relative w-full rounded-xl overflow-hidden
                  border border-dark-700 shadow-lg my-4 ${className}`}
      style={{ paddingBottom: '56.25%' /* ratio 16:9 */ }}
    >
      <iframe
        src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&color=white`}
        title="Video del curso"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        loading="lazy"
        className="absolute inset-0 w-full h-full border-0"
      />
    </div>
  );
}
