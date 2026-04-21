import { useState } from 'react';
import { crearIncidente } from '../services/seguridadService';
import toast from 'react-hot-toast';

export default function ReportarIncidente({ user }) {

  const [form, setForm] = useState({
    descripcion: '',
    nivel: 'bajo',
    tipo: 'seguridad',
    ubicacion: ''
  });
  const [loading, setLoading] = useState(false);

  const etiquetasNivel = {
    bajo: '🟢 Bajo',
    medio: '🟠 Medio',
    alto: '🔴 Alto'
  };

  const handleSubmit = async () => {
    if (!form.descripcion.trim()) {
      toast.error('Describe el incidente');
      return;
    }

    setLoading(true);
    const payload = {
      descripcion: `[${form.tipo}] ${form.ubicacion ? `(${form.ubicacion}) ` : ''}${form.descripcion.trim()}`,
      nivel: form.nivel
    };

    const { error } = await crearIncidente(payload, user);
    if (error) {
      toast.error(error);
      setLoading(false);
      return;
    }
    toast.success('Incidente reportado');
    setForm({ descripcion: '', nivel: 'bajo', tipo: 'seguridad', ubicacion: '' });
    setLoading(false);
  };

  return (
    <div className="bg-app-bg-alt rounded-xl shadow p-6 space-y-4 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold">Reportar incidente 🚨</h2>
        <p className="text-sm text-app-text-secondary">Registra novedades de seguridad para trazabilidad y gestión administrativa.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-app-text-secondary">Tipo de incidente</label>
          <select
            className="app-input mt-1"
            value={form.tipo}
            onChange={e => setForm({ ...form, tipo: e.target.value })}
          >
            <option value="seguridad">Seguridad</option>
            <option value="convivencia">Convivencia</option>
            <option value="infraestructura">Infraestructura</option>
            <option value="acceso">Acceso/portería</option>
          </select>
        </div>

        <div>
          <label className="text-xs text-app-text-secondary">Ubicación</label>
          <input
            className="app-input mt-1"
            placeholder="Ej: Torre 2 - Lobby"
            value={form.ubicacion}
            onChange={e => setForm({ ...form, ubicacion: e.target.value })}
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-app-text-secondary">Descripción</label>
        <textarea
          className="w-full border rounded-lg px-3 py-2 mt-1 min-h-28"
          placeholder="Describe qué pasó, quién estuvo involucrado y si hubo evidencia."
          value={form.descripcion}
          onChange={e => setForm({ ...form, descripcion: e.target.value })}
        />
      </div>

      <div>
        <label className="text-xs text-app-text-secondary">Nivel de prioridad</label>
        <div className="flex gap-2 mt-2">
          {['bajo', 'medio', 'alto'].map((nivel) => (
            <button
              key={nivel}
              type="button"
              onClick={() => setForm({ ...form, nivel })}
              className={`px-3 py-1.5 rounded-full text-sm border ${form.nivel === nivel ? 'bg-app-bg text-white' : 'bg-app-bg-alt'}`}
            >
              {etiquetasNivel[nivel]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? 'Enviando...' : 'Reportar incidente'}
        </button>
      </div>
    </div>
  );
}