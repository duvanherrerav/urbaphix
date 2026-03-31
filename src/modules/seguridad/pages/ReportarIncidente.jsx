import { useState } from 'react';
import { crearIncidente } from '../services/seguridadService';
import toast from 'react-hot-toast';

export default function ReportarIncidente({ user }) {

  const [form, setForm] = useState({
    descripcion: '',
    nivel: 'bajo'
  });

  const handleSubmit = async () => {
    const { error } = await crearIncidente(form, user);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success('Incidente reportado');
    setForm({ descripcion: '', nivel: 'bajo' });
  };

  return (
    <div>
      <h2>Reportar incidente</h2>

      <input
        placeholder="Descripción"
        value={form.descripcion}
        onChange={e => setForm({ ...form, descripcion: e.target.value })}
      />

      <select value={form.nivel} onChange={e => setForm({ ...form, nivel: e.target.value })}>
        <option value="bajo">Bajo</option>
        <option value="medio">Medio</option>
        <option value="alto">Alto</option>
      </select>

      <button onClick={handleSubmit}>
        Reportar
      </button>
    </div>
  );
}