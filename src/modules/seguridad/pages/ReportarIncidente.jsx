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

  const etiquetasNivel = { bajo: '🟢 Bajo', medio: '🟠 Medio', alto: '🔴 Alto' };

  const handleSubmit = async () => {
    const descripcion = form.descripcion.trim();
    const ubicacion = form.ubicacion_texto.trim();
    const tipo = form.tipo.trim();
    const nivel = form.nivel.trim();

    if (!descripcion) return toast.error('Debes completar “¿Qué ocurrió?”.');
    if (descripcion.length < 10) return toast.error('La descripción debe tener al menos 10 caracteres.');
    if (!ubicacion) return toast.error('Debes completar “¿Dónde ocurrió?”.');
    if (!tipo) return toast.error('Debes seleccionar el tipo de incidente.');
    if (!nivel) return toast.error('Debes seleccionar el nivel de prioridad.');

    setLoading(true);
    const payload = {
      descripcion,
      tipo,
      ubicacion_texto: ubicacion,
      nivel,
      evidencia_url: form.evidencia_url.trim() || null,
      impacto_economico: form.impacto_economico.trim() || null
    };

    const { error } = await crearIncidente(payload, user);
    setLoading(false);
    if (error) return toast.error(error);

    toast.success('Incidente reportado');
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
          <select className="app-input mt-1" value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
            <option value="seguridad">Seguridad</option>
            <option value="convivencia">Convivencia</option>
            <option value="infraestructura">Infraestructura</option>
            <option value="acceso">Acceso/portería</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-app-text-secondary">¿Dónde ocurrió?</label>
          <input className="app-input mt-1" placeholder="Ej: Torre 2 - Lobby" value={form.ubicacion_texto} onChange={e => setForm({ ...form, ubicacion_texto: e.target.value })} />
        </div>
      </div>

      <div>
        <label className="text-xs text-app-text-secondary">¿Qué ocurrió?</label>
        <textarea className="app-input mt-1 min-h-36" placeholder="Describe qué pasó, quién estuvo involucrado y si hubo evidencia." value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} />
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-app-text-secondary">Evidencia (opcional)</label>
          <textarea className="app-input mt-1 min-h-24" placeholder="URL o referencia de evidencia" value={form.evidencia_url} onChange={e => setForm({ ...form, evidencia_url: e.target.value })} />
        </div>
        <div>
          <label className="text-xs text-app-text-secondary">Impacto económico estimado (opcional)</label>
          <input className="app-input mt-1" placeholder="Ej: 250000 COP (estimado)" value={form.impacto_economico} onChange={e => setForm({ ...form, impacto_economico: e.target.value })} />
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
          {loading ? 'Enviando...' : 'Reportar incidente'}
        </button>
      </div>
    </div>
  );
}
