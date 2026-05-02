import { useState } from 'react';
import { crearIncidente } from '../services/seguridadService';
import toast from 'react-hot-toast';

export default function ReportarIncidente({ user }) {
  const [form, setForm] = useState({
    descripcion: '',
    nivel: 'bajo',
    tipo: 'seguridad',
    ubicacion_texto: '',
    evidencia_url: '',
    impacto_economico: ''
  });
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const etiquetasNivel = { bajo: '🟢 Bajo', medio: '🟠 Medio', alto: '🔴 Alto' };
  const validateEvidenciaUrl = (value) => !value || /^https?:\/\//i.test(value);

  const getFieldClass = (field) => `app-input mt-1 ${fieldErrors[field] ? 'border border-state-error focus:ring-state-error' : ''}`;

  const handleSubmit = async () => {
    if (loading) return;

    const descripcion = form.descripcion.trim();
    const ubicacion = form.ubicacion_texto.trim();
    const tipo = form.tipo.trim();
    const nivel = form.nivel.trim();
    const evidencia = form.evidencia_url.trim();
    const errores = {};

    if (!descripcion) errores.descripcion = 'Requerido';
    else if (descripcion.length < 10) errores.descripcion = 'Mínimo 10 caracteres';
    if (!ubicacion) errores.ubicacion_texto = 'Requerido';
    if (!tipo) errores.tipo = 'Requerido';
    if (!nivel) errores.nivel = 'Requerido';
    if (!validateEvidenciaUrl(evidencia)) errores.evidencia_url = 'Debe iniciar con http:// o https://';

    if (Object.keys(errores).length > 0) {
      setFieldErrors(errores);
      return toast.error('Revisa los campos marcados en rojo.');
    }

    setFieldErrors({});
    setLoading(true);
    const payload = {
      descripcion,
      tipo,
      ubicacion_texto: ubicacion,
      nivel,
      evidencia_url: evidencia || null,
      impacto_economico: form.impacto_economico.trim() || null
    };

    const { error } = await crearIncidente(payload, user);
    setLoading(false);
    if (error) return toast.error(`No se pudo reportar el incidente: ${error}`);

    toast.success('Incidente reportado correctamente. Ya está disponible para gestión.');
    setForm({
      descripcion: '',
      nivel: 'bajo',
      tipo: 'seguridad',
      ubicacion_texto: '',
      evidencia_url: '',
      impacto_economico: ''
    });
  };

  return (
    <div className="app-surface-primary p-6 max-w-4xl mx-auto space-y-5">
      <div className="grid md:grid-cols-[1.4fr_1fr] gap-4 items-start">
        <div>
          <h2 className="text-2xl font-bold">Reportar incidente 🚨</h2>
          <p className="text-sm text-app-text-secondary mt-1">Registro operativo para trazabilidad administrativa y seguimiento por prioridad.</p>
        </div>
        <div className="app-surface-muted text-xs space-y-1">
          <p className="text-app-text-secondary">Prioridad actual</p>
          <p className="text-base font-semibold">{etiquetasNivel[form.nivel]}</p>
          <p className="text-app-text-secondary">Completa ubicación y descripción para agilizar respuesta.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-app-text-secondary">Tipo de incidente</label>
          <select className={getFieldClass('tipo')} value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
            <option value="seguridad">Seguridad</option>
            <option value="convivencia">Convivencia</option>
            <option value="infraestructura">Infraestructura</option>
            <option value="acceso">Acceso/portería</option>
          </select>
          {fieldErrors.tipo && <p className="text-xs text-state-error mt-1">{fieldErrors.tipo}</p>}
        </div>
        <div>
          <label className="text-xs text-app-text-secondary">¿Dónde ocurrió?</label>
          <input className={getFieldClass('ubicacion_texto')} placeholder="Ej: Torre 2 - Lobby" value={form.ubicacion_texto} onChange={e => setForm({ ...form, ubicacion_texto: e.target.value })} />
          {fieldErrors.ubicacion_texto && <p className="text-xs text-state-error mt-1">{fieldErrors.ubicacion_texto}</p>}
        </div>
      </div>

      <div>
        <label className="text-xs text-app-text-secondary">¿Qué ocurrió?</label>
        <textarea className={`${getFieldClass('descripcion')} min-h-36`} placeholder="Describe qué pasó, quién estuvo involucrado y si hubo evidencia." value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} />
        {fieldErrors.descripcion && <p className="text-xs text-state-error mt-1">{fieldErrors.descripcion}</p>}
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-app-text-secondary">Evidencia (opcional)</label>
          <textarea className={`${getFieldClass('evidencia_url')} min-h-24`} placeholder="URL de evidencia (opcional)" value={form.evidencia_url} onChange={e => setForm({ ...form, evidencia_url: e.target.value })} />
          {fieldErrors.evidencia_url && <p className="text-xs text-state-error mt-1">{fieldErrors.evidencia_url}</p>}
        </div>
        <div>
          <label className="text-xs text-app-text-secondary">Impacto económico estimado (opcional)</label>
          <input className="app-input mt-1" placeholder="Ej: 250000 COP o Sin estimación" value={form.impacto_economico} onChange={e => setForm({ ...form, impacto_economico: e.target.value })} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {['bajo', 'medio', 'alto'].map((nivel) => (
            <button key={nivel} type="button" onClick={() => setForm({ ...form, nivel })} className={`app-btn text-sm ${form.nivel === nivel ? 'app-btn-secondary' : 'app-btn-ghost'}`}>
              {etiquetasNivel[nivel]}
            </button>
          ))}
        </div>
        <button onClick={handleSubmit} disabled={loading} className="app-btn-primary min-w-44">
          {loading ? 'Reportando...' : 'Reportar incidente'}
        </button>
      </div>
    </div>
  );
}
