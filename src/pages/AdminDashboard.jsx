/*
 * ============================================================
 * AdminDashboard.jsx - Panel de Administración
 * ============================================================
 *
 * Tabs:
 *  1. Overview    → KPIs, revenue por mes, top cursos
 *  2. Alumnos     → tabla de usuarios, editar rol/estado
 *  3. Cursos      → editar precios, publicar/despublicar
 *  4. Packs       → crear y editar bundles de cursos con descuento
 *  5. Inscripciones → historial de pagos y accesos
 */

import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import {
  BarChart3, Users, BookOpen, DollarSign, TrendingUp,
  Package, ShoppingCart, Search, ChevronDown, ChevronUp,
  Edit2, Check, X, Plus, Trash2, Eye, EyeOff, RefreshCw, RotateCcw,
  AlertCircle, Star, FolderOpen, FileText,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt$ = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n ?? 0);

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

const BADGE_ROLE = {
  admin: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
  student: 'bg-slate-100 text-slate-600 border border-slate-300',
};
const BADGE_STATUS = {
  completed: 'bg-accent-500/20 text-accent-400 border border-accent-500/30',
  pending: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  rejected: 'bg-red-500/20 text-red-400 border border-red-500/30',
  refunded: 'bg-slate-100 text-slate-500 border border-slate-200',
};

// ─── Componente de KPI Card ────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, color = 'primary' }) {
  const colors = {
    primary: 'from-primary-500/20 to-primary-600/5 border-primary-500/20 text-primary-400',
    accent:  'from-accent-500/20  to-accent-600/5  border-accent-500/20  text-accent-400',
    yellow:  'from-yellow-500/20  to-yellow-600/5  border-yellow-500/20  text-yellow-400',
    purple:  'from-purple-500/20  to-purple-600/5  border-purple-500/20  text-purple-400',
  };
  return (
    <div className={`bg-gradient-to-br ${colors[color]} border rounded-xl p-5 flex items-start gap-4`}>
      <div className={`p-2 rounded-lg bg-white/80`}>
        <Icon className={`w-6 h-6 ${colors[color].split(' ')[3]}`} />
      </div>
      <div>
        <p className="text-slate-600 dark:text-slate-400 text-sm">{label}</p>
        <p className="text-slate-900 dark:text-slate-100 text-2xl font-bold">{value}</p>
        {sub && <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Tab: Overview ────────────────────────────────────────────────────────────

function TabOverview() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/admin/stats')
      .then(r => setStats(r.data))
      .catch(() => setError('No se pudieron cargar las métricas'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;

  return (
    <div className="space-y-8">
      {/* KPIs principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Users}       label="Usuarios totales"     value={stats.total_users}        sub={`${stats.new_users_this_month} nuevos este mes`}     color="primary" />
        <KpiCard icon={BookOpen}    label="Cursos publicados"    value={stats.published_courses}  sub={`de ${stats.total_courses} total`}                   color="accent"  />
        <KpiCard icon={ShoppingCart}label="Inscripciones"        value={stats.total_enrollments}  sub={`${stats.enrollments_this_month} este mes`}           color="yellow"  />
        <KpiCard icon={DollarSign}  label="Revenue total"        value={fmt$(stats.total_revenue)} sub={`${fmt$(stats.revenue_this_month)} este mes`}        color="purple"  />
      </div>

      {/* Revenue por mes */}
      {stats.revenue_by_month.length > 0 && (
        <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl p-6">
          <h3 className="text-slate-800 dark:text-slate-100 font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary-600" /> Revenue por mes
          </h3>
          <div className="flex items-end gap-3 h-32">
            {stats.revenue_by_month.map(m => {
              const maxRevenue = Math.max(...stats.revenue_by_month.map(x => x.revenue));
              const pct = maxRevenue > 0 ? (m.revenue / maxRevenue) * 100 : 0;
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-slate-500 dark:text-slate-400 text-xs">{fmt$(m.revenue)}</span>
                  <div
                    className="w-full bg-primary-500/80 rounded-t-sm transition-all"
                    style={{ height: `${Math.max(pct, 4)}%` }}
                  />
                  <span className="text-slate-400 text-xs">{m.month.slice(5)}/{m.month.slice(2, 4)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top cursos */}
      <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl p-6">
        <h3 className="text-slate-800 dark:text-slate-100 font-semibold mb-4 flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-400" /> Top cursos
        </h3>
        <div className="space-y-3">
          {stats.top_courses.map((c, i) => (
            <div key={c.id} className="flex items-center gap-3">
              <span className="text-slate-400 text-sm w-5 text-right">{i + 1}.</span>
              <div className="flex-1 min-w-0">
                <p className="text-slate-700 dark:text-slate-300 text-sm truncate">{c.title}</p>
              </div>
              <span className="text-accent-400 text-sm font-medium">{c.enrollments} alumnos</span>
              <span className="text-slate-500 dark:text-slate-400 text-sm w-24 text-right">{fmt$(c.revenue)}</span>
            </div>
          ))}
          {stats.top_courses.length === 0 && (
            <p className="text-slate-400 text-sm text-center py-4">Sin datos de ventas aún</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Alumnos ─────────────────────────────────────────────────────────────

function TabAlumnos() {
  const [data, setData] = useState({ total: 0, users: [] });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (roleFilter) params.set('role', roleFilter);
      const r = await api.get(`/admin/users?${params}`);
      setData(r.data);
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter]);

  useEffect(() => { load(); }, [load]);

  const startEdit = (u) => {
    setEditId(u.id);
    setEditData({ role: u.role, is_active: u.is_active, username: u.username });
  };

  const cancelEdit = () => { setEditId(null); setEditData({}); };

  const saveEdit = async (userId) => {
    setSaving(true);
    try {
      await api.patch(`/admin/users/${userId}`, editData);
      setEditId(null);
      setEditData({});
      await load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="input-field pl-9 w-full text-sm"
            placeholder="Buscar por email o nombre..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input-field text-sm"
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
        >
          <option value="">Todos los roles</option>
          <option value="student">Estudiante</option>
          <option value="admin">Admin</option>
        </select>
        <button onClick={load} className="btn-secondary flex items-center gap-2 text-sm py-2 px-4">
          <RefreshCw className="w-4 h-4" /> Refrescar
        </button>
      </div>

      {/* Tabla */}
      <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-dark-700 flex items-center justify-between">
          <span className="text-slate-700 dark:text-slate-300 text-sm">{data.total} usuarios</span>
        </div>
        {loading ? <div className="p-8 flex justify-center"><Spinner /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-dark-700">
                  <th className="text-left text-slate-500 dark:text-slate-400 font-medium px-4 py-3">ID</th>
                  <th className="text-left text-slate-500 dark:text-slate-400 font-medium px-4 py-3">Email / Nombre</th>
                  <th className="text-left text-slate-500 dark:text-slate-400 font-medium px-4 py-3">Rol</th>
                  <th className="text-left text-slate-500 dark:text-slate-400 font-medium px-4 py-3">Estado</th>
                  <th className="text-left text-slate-500 dark:text-slate-400 font-medium px-4 py-3">Cursos</th>
                  <th className="text-left text-slate-500 dark:text-slate-400 font-medium px-4 py-3">Desde</th>
                  <th className="text-right text-slate-500 dark:text-slate-400 font-medium px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map(u => (
                  <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50 dark:hover:bg-dark-800 dark:bg-dark-950 transition-colors">
                    <td className="px-4 py-3 text-slate-400">#{u.id}</td>
                    <td className="px-4 py-3">
                      {editId === u.id ? (
                        <input
                          className="input-field text-sm py-1 px-2 w-full"
                          value={editData.username}
                          onChange={e => setEditData(d => ({ ...d, username: e.target.value }))}
                        />
                      ) : (
                        <div>
                          <p className="text-slate-800">{u.username}</p>
                          <p className="text-slate-400 text-xs">{u.email}</p>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editId === u.id ? (
                        <select
                          className="input-field text-sm py-1 px-2"
                          value={editData.role}
                          onChange={e => setEditData(d => ({ ...d, role: e.target.value }))}
                        >
                          <option value="student">Estudiante</option>
                          <option value="admin">Admin</option>
                        </select>
                      ) : (
                        <span className={`px-2 py-0.5 rounded-full text-xs ${BADGE_ROLE[u.role]}`}>{u.role}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editId === u.id ? (
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            className="rounded"
                            checked={editData.is_active}
                            onChange={e => setEditData(d => ({ ...d, is_active: e.target.checked }))}
                          />
                          <span className="text-slate-600 dark:text-slate-400 text-xs">Activo</span>
                        </label>
                      ) : (
                        <span className={`px-2 py-0.5 rounded-full text-xs ${u.is_active
                          ? 'bg-accent-500/20 text-accent-400 border border-accent-500/30'
                          : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                          {u.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{u.enrolled_courses}</td>
                    <td className="px-4 py-3 text-slate-400">{fmtDate(u.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      {editId === u.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => saveEdit(u.id)}
                            disabled={saving}
                            className="p-1.5 rounded bg-accent-500/20 hover:bg-accent-500/40 text-accent-400 transition-colors"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-1.5 rounded bg-slate-100 dark:bg-dark-800 hover:bg-slate-200 text-slate-600 dark:text-slate-400 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(u)}
                          className="p-1.5 rounded bg-slate-100 dark:bg-dark-800 hover:bg-primary-500/20 hover:text-primary-600 text-slate-500 dark:text-slate-400 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {data.users.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-slate-400 py-8">No hay usuarios</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Crear Curso ─────────────────────────────────────────────────────────────

const LANGUAGE_OPTIONS = ['C', 'C/C++', 'C++/Python', 'Python', 'C (ESP-IDF)', 'VHDL', 'Otro'];
const DIFFICULTY_OPTIONS = [
  { value: 'beginner',     label: 'Principiante' },
  { value: 'intermediate', label: 'Intermedio'   },
  { value: 'advanced',     label: 'Avanzado'     },
];

function CreateCoursePanel({ onSuccess, onCancel }) {
  const [form, setForm] = useState({
    title: '', slug: '', description: '', short_description: '',
    language: 'C/C++', difficulty: 'intermediate',
    estimated_hours: '', price: '0', price_usd: '0',
    source_path: '', image_url: '', is_published: true,
  });
  const [folders, setFolders]           = useState([]);
  const [preview, setPreview]           = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState(null);

  // Cargar lista de carpetas disponibles
  useEffect(() => {
    api.get('/admin/folders').then(r => setFolders(r.data)).catch(() => {});
  }, []);

  // Auto-slug desde título (sin acentos)
  const makeSlug = (title) =>
    title.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

  const handleTitleChange = (val) =>
    setForm(f => ({ ...f, title: val, slug: makeSlug(val) }));

  // Preview automático al elegir carpeta
  const handleFolderChange = async (path) => {
    setForm(f => ({ ...f, source_path: path }));
    setPreview(null);
    if (!path) return;
    setPreviewLoading(true);
    try {
      const r = await api.get(`/admin/courses/preview-folder?source_path=${encodeURIComponent(path)}`);
      setPreview(r.data);
    } catch {
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        price: parseFloat(form.price) || 0,
        price_usd: parseFloat(form.price_usd) || 0,
        estimated_hours: form.estimated_hours ? parseInt(form.estimated_hours) : null,
      };
      const r = await api.post('/admin/courses/create-and-scan', payload);
      onSuccess(r.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al crear el curso');
    } finally {
      setSaving(false);
    }
  };

  const canSubmit = form.title && form.slug && form.source_path && form.short_description;

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white dark:bg-dark-900 border border-primary-300 rounded-xl p-6 space-y-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-slate-800 dark:text-slate-100 font-semibold text-lg flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-primary-600" />
          Nuevo Curso
        </h4>
        <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600 dark:text-slate-400 p-1 transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* Título + Slug */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-slate-600 dark:text-slate-400 text-sm mb-1">
            Título <span className="text-red-400">*</span>
          </label>
          <input
            required
            className="input-field w-full text-sm"
            placeholder="Ej: DSP con Python y C++"
            value={form.title}
            onChange={e => handleTitleChange(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-slate-600 dark:text-slate-400 text-sm mb-1">
            Slug (URL) <span className="text-red-400">*</span>
          </label>
          <input
            required
            className="input-field w-full text-sm font-mono"
            placeholder="dsp-python-cpp"
            value={form.slug}
            onChange={set('slug')}
          />
          <p className="text-slate-400 text-xs mt-1">URL: /courses/{form.slug || '...'}</p>
        </div>

        {/* Selector de carpeta */}
        <div>
          <label className="block text-slate-600 dark:text-slate-400 text-sm mb-1">
            Carpeta del curso <span className="text-red-400">*</span>
          </label>
          <select
            required
            className="input-field w-full text-sm"
            value={form.source_path}
            onChange={e => handleFolderChange(e.target.value)}
          >
            <option value="">— Seleccioná una carpeta —</option>
            {folders.map(folder => (
              <option key={folder.name} value={folder.name} disabled={folder.in_use}>
                {folder.name}{folder.in_use ? '  ✓ ya en uso' : ''}
              </option>
            ))}
          </select>
          <p className="text-slate-400 text-xs mt-1">Relativa a CONTENT_BASE_PATH</p>
        </div>
      </div>

      {/* Preview de la carpeta */}
      {form.source_path && (
        <div className="bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-dark-700 rounded-lg p-4">
          {previewLoading ? (
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm">
              <div className="animate-spin w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full" />
              Analizando carpeta...
            </div>
          ) : preview ? (
            <div>
              <p className="text-slate-600 dark:text-slate-400 text-sm font-medium mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary-600" />
                <span className="font-mono text-primary-600">{preview.source_path}/</span>
                <span className="text-slate-400">→ {preview.module_count} módulos detectados</span>
              </p>
              <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
                {preview.modules.map(m => (
                  <div key={m.name} className="flex items-center justify-between text-xs px-3 py-1.5 rounded bg-slate-100 dark:bg-dark-800">
                    <span className="text-slate-600 dark:text-slate-400 font-mono">{m.name}</span>
                    <span className="text-slate-400">{m.lesson_count} lección{m.lesson_count !== 1 ? 'es' : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-slate-400 text-sm">No se encontraron módulos en esta carpeta.</p>
          )}
        </div>
      )}

      {/* Descripción corta */}
      <div>
        <label className="block text-slate-600 dark:text-slate-400 text-sm mb-1">
          Descripción corta <span className="text-red-400">*</span>
        </label>
        <input
          required
          className="input-field w-full text-sm"
          placeholder="Resumen para la tarjeta del catálogo (máx 500 caracteres)"
          maxLength={500}
          value={form.short_description}
          onChange={set('short_description')}
        />
        <p className="text-slate-400 text-xs mt-1">{form.short_description.length}/500</p>
      </div>

      {/* Descripción completa */}
      <div>
        <label className="block text-slate-600 dark:text-slate-400 text-sm mb-1">Descripción completa</label>
        <textarea
          className="input-field w-full text-sm resize-none"
          rows={4}
          placeholder="Qué aprenderá el alumno, tecnologías, módulos principales..."
          value={form.description}
          onChange={set('description')}
        />
      </div>

      {/* Metadata: lenguaje, dificultad, horas, precio ARS, precio USD */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div>
          <label className="block text-slate-600 dark:text-slate-400 text-sm mb-1">Lenguaje</label>
          <select className="input-field w-full text-sm" value={form.language} onChange={set('language')}>
            {LANGUAGE_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-slate-600 dark:text-slate-400 text-sm mb-1">Dificultad</label>
          <select className="input-field w-full text-sm" value={form.difficulty} onChange={set('difficulty')}>
            {DIFFICULTY_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-slate-600 dark:text-slate-400 text-sm mb-1">Horas est.</label>
          <input
            type="number" min="1" max="500"
            className="input-field w-full text-sm"
            placeholder="40"
            value={form.estimated_hours}
            onChange={set('estimated_hours')}
          />
        </div>
        <div>
          <label className="block text-slate-600 dark:text-slate-400 text-sm mb-1">Precio ARS</label>
          <div className="flex items-center gap-1">
            <span className="text-slate-500 dark:text-slate-400 text-sm">$</span>
            <input
              type="number" min="0" step="0.01"
              className="input-field w-full text-sm"
              placeholder="49999"
              value={form.price}
              onChange={set('price')}
            />
          </div>
        </div>
        <div>
          <label className="block text-slate-600 dark:text-slate-400 text-sm mb-1">Precio USD</label>
          <div className="flex items-center gap-1">
            <span className="text-slate-500 dark:text-slate-400 text-sm">$</span>
            <input
              type="number" min="0" step="0.01"
              className="input-field w-full text-sm"
              placeholder="49.99"
              value={form.price_usd}
              onChange={set('price_usd')}
            />
          </div>
        </div>
      </div>

      {/* Imagen + Publicado */}
      <div className="flex flex-col sm:flex-row gap-4 items-start">
        <div className="flex-1">
          <label className="block text-slate-600 dark:text-slate-400 text-sm mb-1">URL de imagen (opcional)</label>
          <input
            className="input-field w-full text-sm"
            placeholder="/images/courses/mi-curso.png"
            value={form.image_url}
            onChange={set('image_url')}
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer pt-6">
          <input
            type="checkbox"
            checked={form.is_published}
            onChange={e => setForm(f => ({ ...f, is_published: e.target.checked }))}
          />
          <span className="text-slate-600 dark:text-slate-400 text-sm">Publicar inmediatamente</span>
        </label>
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-3 pt-2 border-t border-slate-200 dark:border-dark-700">
        <button
          type="submit"
          disabled={saving || !canSubmit}
          className="btn-primary flex items-center gap-2 text-sm py-2.5 px-6 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Creando...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              Crear curso y escanear módulos
            </>
          )}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary text-sm py-2.5 px-4">
          Cancelar
        </button>
        {preview && preview.module_count > 0 && (
          <span className="text-slate-400 text-xs ml-auto">
            Se crearán {preview.module_count} módulos
          </span>
        )}
      </div>
    </form>
  );
}


// ─── EditCoursePanel ──────────────────────────────────────────────────────────

function EditCoursePanel({ course, onSuccess, onCancel }) {
  const EMPTY = {
    title: '', slug: '', description: '', short_description: '',
    title_en: '', description_en: '', short_description_en: '', ls_checkout_url: '',
    price: 0, price_usd: 0,
  };
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (course) {
      setForm({
        title: course.title ?? '',
        slug: course.slug ?? '',
        description: course.description ?? '',
        short_description: course.short_description ?? '',
        title_en: course.title_en ?? '',
        description_en: course.description_en ?? '',
        short_description_en: course.short_description_en ?? '',
        ls_checkout_url: course.ls_checkout_url ?? '',
        price: course.price ?? 0,
        price_usd: course.price_usd ?? 0,
      });
      setErr(null);
    }
  }, [course]);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    setErr(null);
    try {
      const payload = {
        title: form.title || undefined,
        slug: form.slug || undefined,
        description: form.description || undefined,
        short_description: form.short_description || undefined,
        title_en: form.title_en || undefined,
        description_en: form.description_en || undefined,
        short_description_en: form.short_description_en || undefined,
        ls_checkout_url: form.ls_checkout_url || undefined,
        price: parseFloat(form.price) || 0,
        price_usd: parseFloat(form.price_usd) || 0,
      };
      await api.patch(`/admin/courses/${course.id}`, payload);
      onSuccess();
    } catch (e) {
      setErr(e.response?.data?.detail || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const Field = ({ label, k, textarea = false, rows = 3, placeholder = '' }) => (
    <div>
      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{label}</label>
      {textarea
        ? <textarea
            rows={rows}
            className="input-field text-sm w-full resize-y"
            value={form[k]}
            onChange={set(k)}
            placeholder={placeholder}
          />
        : <input
            className="input-field text-sm w-full"
            value={form[k]}
            onChange={set(k)}
            placeholder={placeholder}
          />
      }
    </div>
  );

  return (
    <div className="bg-white dark:bg-dark-900 border border-primary-500/30 rounded-xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-slate-800 dark:text-slate-100 font-semibold">Editar curso</h3>
        <button onClick={onCancel} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-dark-800 text-slate-500">
          <X className="w-4 h-4" />
        </button>
      </div>

      {err && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded px-3 py-2">{err}</p>}

      {/* Bloque ES */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Español</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Título (ES)" k="title" placeholder="Mi curso" />
          <div>
            <Field label="Slug (URL)" k="slug" placeholder="mi-curso" />
            <p className="text-slate-400 text-xs mt-1">URL: /courses/{form.slug || '…'}</p>
          </div>
          <div className="md:col-span-2">
            <Field label="Descripción corta (ES)" k="short_description" textarea rows={2} />
            <p className="text-slate-400 text-xs mt-1">{(form.short_description || '').length}/500</p>
          </div>
          <div className="md:col-span-2">
            <Field label="Descripción completa (ES)" k="description" textarea rows={4} />
          </div>
        </div>
      </div>

      {/* Bloque EN */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">English</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Field label="Title (EN)" k="title_en" placeholder="My course" />
          </div>
          <div className="md:col-span-2">
            <Field label="Short description (EN)" k="short_description_en" textarea rows={2} />
          </div>
          <div className="md:col-span-2">
            <Field label="Full description (EN)" k="description_en" textarea rows={4} />
          </div>
        </div>
      </div>

      {/* Precios + checkout */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Precios y checkout</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Precio ARS</label>
            <input type="number" step="0.01" min="0" className="input-field text-sm w-full"
              value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Precio USD</label>
            <input type="number" step="0.01" min="0" className="input-field text-sm w-full"
              value={form.price_usd} onChange={e => setForm(f => ({ ...f, price_usd: e.target.value }))} />
          </div>
          <div>
            <Field label="LemonSqueezy checkout URL" k="ls_checkout_url" placeholder="https://..." />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200 dark:border-dark-700">
        <button onClick={onCancel} className="text-sm px-4 py-2 rounded-lg bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 transition-colors">
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-500 disabled:opacity-50 transition-colors"
        >
          {saving ? <Spinner /> : <Check className="w-4 h-4" />}
          Guardar cambios
        </button>
      </div>
    </div>
  );
}

// ─── Tab: Cursos ──────────────────────────────────────────────────────────────

function TabCursos() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editCourse, setEditCourse] = useState(null);
  const [msg, setMsg] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [rescanConfirmId, setRescanConfirmId] = useState(null);
  const [rescanningId, setRescanningId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/admin/courses');
      setCourses(r.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleEditSuccess = async () => {
    setEditCourse(null);
    setMsg({ type: 'ok', text: 'Curso actualizado ✓' });
    await load();
  };

  const togglePublish = async (c) => {
    await api.patch(`/admin/courses/${c.id}`, { is_published: !c.is_published });
    await load();
  };

  const handleCreateSuccess = (newCourse) => {
    setShowCreate(false);
    setMsg({
      type: 'ok',
      text: `Curso "${newCourse.title}" creado con ${newCourse.module_count} módulos ✓`,
    });
    load();
  };

  const handleRescan = async (courseId, courseTitle) => {
    setRescanningId(courseId);
    setRescanConfirmId(null);
    setMsg(null);
    try {
      const r = await api.post(`/admin/courses/${courseId}/rescan`);
      setMsg({
        type: 'ok',
        text: `"${courseTitle}" re-escaneado: ${r.data.module_count} módulos creados. ⚠️ ${r.data.warning}`,
      });
      await load();
    } catch (e) {
      setMsg({ type: 'err', text: e.response?.data?.detail || 'Error al re-escanear' });
    } finally {
      setRescanningId(null);
    }
  };

  return (
    <div className="space-y-5">
      {msg && (
        <div className={`px-4 py-3 rounded-lg text-sm ${msg.type === 'ok'
          ? 'bg-accent-500/20 text-accent-300 border border-accent-500/30'
          : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
          {msg.text}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-slate-500 dark:text-slate-400 text-sm">{courses.length} cursos en total</p>
        <button
          onClick={() => { setShowCreate(s => !s); setMsg(null); setEditCourse(null); }}
          className={`flex items-center gap-2 text-sm py-2 px-4 rounded-lg transition-colors font-medium ${
            showCreate
              ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              : 'bg-primary-600 text-white hover:bg-primary-500'
          }`}
        >
          {showCreate
            ? <><X className="w-4 h-4" /> Cancelar</>
            : <><Plus className="w-4 h-4" /> Nuevo Curso</>
          }
        </button>
      </div>

      {/* Panel de creación */}
      {showCreate && (
        <CreateCoursePanel
          onSuccess={handleCreateSuccess}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {/* Panel de edición */}
      {editCourse && (
        <EditCoursePanel
          course={editCourse}
          onSuccess={handleEditSuccess}
          onCancel={() => setEditCourse(null)}
        />
      )}

      <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-dark-700 flex items-center justify-between">
          <span className="text-slate-700 dark:text-slate-300 text-sm">{courses.length} cursos</span>
          <button onClick={load} className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-300 text-sm transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Refrescar
          </button>
        </div>
        {loading ? <div className="p-8 flex justify-center"><Spinner /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-dark-700">
                  <th className="text-left text-slate-500 dark:text-slate-400 font-medium px-4 py-3">Curso</th>
                  <th className="text-left text-slate-500 dark:text-slate-400 font-medium px-4 py-3">Precio ARS / USD</th>
                  <th className="text-left text-slate-500 dark:text-slate-400 font-medium px-4 py-3">Publicado</th>
                  <th className="text-left text-slate-500 dark:text-slate-400 font-medium px-4 py-3">Inscriptos</th>
                  <th className="text-left text-slate-500 dark:text-slate-400 font-medium px-4 py-3">Revenue</th>
                  <th className="text-right text-slate-500 dark:text-slate-400 font-medium px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {courses.map(c => (
                  <tr key={c.id} className={`border-b border-slate-100 hover:bg-slate-50 dark:hover:bg-dark-800 dark:bg-dark-950 transition-colors ${editCourse?.id === c.id ? 'bg-primary-50 dark:bg-primary-900/10' : ''}`}>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-slate-800 dark:text-slate-100 font-medium">{c.title}</p>
                        <p className="text-slate-400 text-xs">{c.slug} · {c.language} · {c.difficulty}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-primary-600 font-semibold text-sm">{fmt$(c.price)} <span className="text-slate-400 font-normal text-xs">ARS</span></span>
                        <span className="text-slate-500 dark:text-slate-400 text-xs">USD {(c.price_usd ?? 0).toFixed(2)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => togglePublish(c)}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${c.is_published
                          ? 'bg-accent-500/20 text-accent-400 hover:bg-red-500/20 hover:text-red-400'
                          : 'bg-slate-100 text-slate-500 hover:bg-accent-500/20 hover:text-accent-400'}`}
                      >
                        {c.is_published ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        {c.is_published ? 'Publicado' : 'Oculto'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{c.enrollments}</td>
                    <td className="px-4 py-3 text-accent-400 font-medium">{fmt$(c.revenue)}</td>
                    <td className="px-4 py-3 text-right">
                      {rescanConfirmId === c.id ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="text-xs text-amber-400 mr-1">¿Resetear progreso?</span>
                          <button
                            onClick={() => handleRescan(c.id, c.title)}
                            className="p-1.5 rounded bg-red-500/20 hover:bg-red-500/40 text-red-400 transition-colors"
                            title="Confirmar re-escaneo"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setRescanConfirmId(null)}
                            className="p-1.5 rounded bg-slate-100 dark:bg-dark-800 hover:bg-slate-200 text-slate-600 dark:text-slate-400 transition-colors"
                            title="Cancelar"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => { setEditCourse(c); setShowCreate(false); setMsg(null); }}
                            className={`p-1.5 rounded transition-colors ${editCourse?.id === c.id
                              ? 'bg-primary-500/20 text-primary-400'
                              : 'bg-slate-100 dark:bg-dark-800 hover:bg-primary-500/20 hover:text-primary-600 text-slate-500 dark:text-slate-400'}`}
                            title="Editar curso"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { setRescanConfirmId(c.id); setEditCourse(null); }}
                            disabled={rescanningId === c.id}
                            className="p-1.5 rounded bg-slate-100 dark:bg-dark-800 hover:bg-amber-500/20 hover:text-amber-400 text-slate-500 dark:text-slate-400 transition-colors disabled:opacity-40"
                            title="Re-escanear módulos desde el filesystem"
                          >
                            {rescanningId === c.id
                              ? <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                              : <RotateCcw className="w-4 h-4" />}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Packs ───────────────────────────────────────────────────────────────

function TabPacks() {
  const [packs, setPacks] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editPack, setEditPack] = useState(null);
  const [form, setForm] = useState({ name: '', slug: '', description: '', discount_percent: 0, is_active: true, courses: [] });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [pr, cr] = await Promise.all([
        api.get('/admin/packs'),
        api.get('/admin/courses'),
      ]);
      setPacks(pr.data);
      setCourses(cr.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const autoSlug = (name) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const handleNameChange = (val) => {
    setForm(f => ({ ...f, name: val, slug: editPack ? f.slug : autoSlug(val) }));
  };

  const toggleCourse = (courseId) => {
    setForm(f => {
      const exists = f.courses.find(c => c.course_id === courseId);
      if (exists) return { ...f, courses: f.courses.filter(c => c.course_id !== courseId) };
      return { ...f, courses: [...f.courses, { course_id: courseId, order: f.courses.length }] };
    });
  };

  const startNew = () => {
    setEditPack(null);
    setForm({ name: '', slug: '', description: '', discount_percent: 0, is_active: true, courses: [] });
    setShowForm(true);
  };

  const startEdit = (p) => {
    setEditPack(p);
    setForm({
      name: p.name,
      slug: p.slug,
      description: p.description,
      discount_percent: p.discount_percent,
      is_active: p.is_active,
      courses: p.courses.map(c => ({ course_id: c.course_id, order: c.order })),
    });
    setShowForm(true);
  };

  const handleDelete = async (packId) => {
    if (!confirm('¿Eliminar este pack?')) return;
    await api.delete(`/admin/packs/${packId}`);
    await load();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      if (editPack) {
        await api.patch(`/admin/packs/${editPack.id}`, form);
        setMsg({ type: 'ok', text: 'Pack actualizado ✓' });
      } else {
        await api.post('/admin/packs', form);
        setMsg({ type: 'ok', text: 'Pack creado ✓' });
      }
      setShowForm(false);
      await load();
    } catch (err) {
      setMsg({ type: 'err', text: err.response?.data?.detail || 'Error al guardar' });
    } finally {
      setSaving(false);
    }
  };

  // Calcular precio preview
  const previewOriginal = form.courses.reduce((acc, fc) => {
    const c = courses.find(x => x.id === fc.course_id);
    return acc + (c?.price ?? 0);
  }, 0);
  const previewFinal = previewOriginal * (1 - form.discount_percent / 100);

  return (
    <div className="space-y-5">
      {msg && (
        <div className={`px-4 py-3 rounded-lg text-sm ${msg.type === 'ok'
          ? 'bg-accent-500/20 text-accent-300 border border-accent-500/30'
          : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
          {msg.text}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-slate-700 dark:text-slate-300 font-semibold">{packs.length} packs configurados</h3>
        <button onClick={startNew} className="btn-primary flex items-center gap-2 text-sm py-2 px-4">
          <Plus className="w-4 h-4" /> Nuevo Pack
        </button>
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl p-6 space-y-5">
          <h4 className="text-slate-800 dark:text-slate-100 font-semibold">{editPack ? 'Editar Pack' : 'Crear Pack'}</h4>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 text-sm mb-1">Nombre</label>
                <input
                  required
                  className="input-field w-full text-sm"
                  placeholder="Pack Embedded Full-Stack"
                  value={form.name}
                  onChange={e => handleNameChange(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-400 text-sm mb-1">Slug</label>
                <input
                  required
                  className="input-field w-full text-sm font-mono"
                  placeholder="pack-embedded-full-stack"
                  value={form.slug}
                  onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="block text-slate-600 dark:text-slate-400 text-sm mb-1">Descripción</label>
              <textarea
                className="input-field w-full text-sm resize-none"
                rows={2}
                placeholder="Ahorrá X% comprando estos cursos juntos..."
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-6">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 text-sm mb-1">Descuento (%)</label>
                <input
                  type="number"
                  min="0"
                  max="80"
                  step="1"
                  className="input-field w-28 text-sm"
                  value={form.discount_percent}
                  onChange={e => setForm(f => ({ ...f, discount_percent: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer mt-5">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                />
                <span className="text-slate-600 dark:text-slate-400 text-sm">Pack activo</span>
              </label>
              {previewOriginal > 0 && (
                <div className="mt-5 text-sm">
                  <span className="text-slate-400 line-through mr-2">{fmt$(previewOriginal)}</span>
                  <span className="text-accent-400 font-bold">{fmt$(previewFinal)}</span>
                </div>
              )}
            </div>

            {/* Selector de cursos */}
            <div>
              <label className="block text-slate-600 dark:text-slate-400 text-sm mb-2">Cursos incluidos</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                {courses.map(c => {
                  const selected = !!form.courses.find(fc => fc.course_id === c.id);
                  return (
                    <label key={c.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selected
                      ? 'border-primary-500/50 bg-primary-500/10'
                      : 'border-slate-200 bg-white hover:border-slate-400'}`}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleCourse(c.id)}
                        className="hidden"
                      />
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${selected ? 'bg-primary-500 border-primary-500' : 'border-slate-300'}`}>
                        {selected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-700 dark:text-slate-300 text-xs truncate">{c.title}</p>
                        <p className="text-primary-600 text-xs">{fmt$(c.price)}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button type="submit" disabled={saving} className="btn-primary text-sm py-2 px-6">
                {saving ? 'Guardando...' : editPack ? 'Actualizar' : 'Crear Pack'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary text-sm py-2 px-4">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de packs */}
      {loading ? <div className="p-8 flex justify-center"><Spinner /></div> : (
        <div className="grid gap-4">
          {packs.map(p => (
            <div key={p.id} className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h4 className="text-slate-800 dark:text-slate-100 font-semibold">{p.name}</h4>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${p.is_active
                      ? 'bg-accent-500/20 text-accent-400 border border-accent-500/30'
                      : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                      {p.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                    <span className="text-yellow-400 text-sm font-medium">-{p.discount_percent}%</span>
                    <span className="text-slate-400 text-xs line-through">{fmt$(p.original_price)}</span>
                    <span className="text-accent-400 font-bold">{fmt$(p.final_price)}</span>
                  </div>
                  {p.description && <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{p.description}</p>}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {p.courses.map(c => (
                      <span key={c.course_id} className="px-2 py-0.5 bg-slate-100 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded text-xs text-slate-600 dark:text-slate-400">
                        {c.title}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => startEdit(p)}
                    className="p-2 rounded bg-slate-100 dark:bg-dark-800 hover:bg-primary-500/20 hover:text-primary-600 text-slate-500 dark:text-slate-400 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="p-2 rounded bg-slate-100 dark:bg-dark-800 hover:bg-red-500/20 hover:text-red-400 text-slate-500 dark:text-slate-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {packs.length === 0 && !showForm && (
            <div className="text-center py-12 text-slate-400">
              <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No hay packs creados. Creá el primero.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Inscripciones ───────────────────────────────────────────────────────

function TabInscripciones() {
  const [data, setData] = useState({ total: 0, enrollments: [] });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter) params.set('payment_status', statusFilter);
      const r = await api.get(`/admin/enrollments?${params}`);
      setData(r.data);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="input-field pl-9 w-full text-sm"
            placeholder="Buscar por email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input-field text-sm"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="">Todos los estados</option>
          <option value="completed">Completado</option>
          <option value="pending">Pendiente</option>
          <option value="rejected">Rechazado</option>
          <option value="refunded">Reembolsado</option>
        </select>
        <button onClick={load} className="btn-secondary flex items-center gap-2 text-sm py-2 px-4">
          <RefreshCw className="w-4 h-4" /> Refrescar
        </button>
      </div>

      <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-dark-700">
          <span className="text-slate-700 dark:text-slate-300 text-sm">{data.total} inscripciones</span>
        </div>
        {loading ? <div className="p-8 flex justify-center"><Spinner /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-dark-700">
                  <th className="text-left text-slate-500 dark:text-slate-400 font-medium px-4 py-3">ID</th>
                  <th className="text-left text-slate-500 dark:text-slate-400 font-medium px-4 py-3">Usuario</th>
                  <th className="text-left text-slate-500 dark:text-slate-400 font-medium px-4 py-3">Curso</th>
                  <th className="text-left text-slate-500 dark:text-slate-400 font-medium px-4 py-3">Estado</th>
                  <th className="text-left text-slate-500 dark:text-slate-400 font-medium px-4 py-3">Monto</th>
                  <th className="text-left text-slate-500 dark:text-slate-400 font-medium px-4 py-3">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {data.enrollments.map(e => (
                  <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50 dark:hover:bg-dark-800 dark:bg-dark-950 transition-colors">
                    <td className="px-4 py-3 text-slate-400">#{e.id}</td>
                    <td className="px-4 py-3">
                      <p className="text-slate-700 dark:text-slate-300">{e.user_username}</p>
                      <p className="text-slate-400 text-xs">{e.user_email}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 max-w-[200px] truncate">{e.course_title}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${BADGE_STATUS[e.payment_status] || 'bg-slate-100 text-slate-500'}`}>
                        {e.payment_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {e.amount_paid != null ? fmt$(e.amount_paid / 100) : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{fmtDate(e.enrolled_at)}</td>
                  </tr>
                ))}
                {data.enrollments.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-slate-400 py-8">Sin inscripciones</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helpers de UI ────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex justify-center py-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
    </div>
  );
}

function ErrorMsg({ msg }) {
  return (
    <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
      <AlertCircle className="w-4 h-4 shrink-0" />
      {msg}
    </div>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',       label: 'Overview',       icon: BarChart3     },
  { id: 'alumnos',        label: 'Alumnos',         icon: Users         },
  { id: 'cursos',         label: 'Cursos',          icon: BookOpen      },
  { id: 'packs',          label: 'Packs',           icon: Package       },
  { id: 'inscripciones',  label: 'Inscripciones',   icon: ShoppingCart  },
];

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-dark-950 pt-8 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Panel de Administración</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Gestión de usuarios, cursos, packs y métricas</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl p-1 mb-8 overflow-x-auto">
          {TABS.map(t => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-1 justify-center ${active
                  ? 'bg-primary-600 text-white shadow-lg'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Contenido */}
        {activeTab === 'overview'       && <TabOverview />}
        {activeTab === 'alumnos'        && <TabAlumnos />}
        {activeTab === 'cursos'         && <TabCursos />}
        {activeTab === 'packs'          && <TabPacks />}
        {activeTab === 'inscripciones'  && <TabInscripciones />}
      </div>
    </div>
  );
}
