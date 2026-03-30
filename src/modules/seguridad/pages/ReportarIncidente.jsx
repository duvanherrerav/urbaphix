import React, { useState } from 'react';
import { crearIncidente } from '../services/seguridadService';

export default function ReportarIncidente({ user }) {

  const [form, setForm] = useState({
    descripcion: '',
    nivel: 'bajo'
  });

  const handleSubmit = async () => {
    await crearIncidente(form, user);
    alert('Incidente reportado');
  };

  return (
    <div>
      <h2>Reportar incidente</h2>

      <input
        placeholder="Descripción"
        onChange={e => setForm({...form, descripcion: e.target.value})}
      />

      <select onChange={e => setForm({...form, nivel: e.target.value})}>
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