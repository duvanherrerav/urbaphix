import React, { useState } from 'react';
import { registrarPaquete } from '../services/paquetesService';

export default function RegistrarPaquete({ user }) {

    const [form, setForm] = useState({
        residente_id: '',
        descripcion: ''
    });

    const handleSubmit = async () => {
        await registrarPaquete(form, user);
        alert('Paquete registrado');
    };

    return (
        <div>
            <input
                placeholder="ID Residente"
                onChange={e => setForm({ ...form, residente_id: e.target.value })}
            />

            <input
                placeholder="Descripción"
                onChange={e => setForm({ ...form, descripcion: e.target.value })}
            />

            <button onClick={handleSubmit}>
                Registrar
            </button>

            <button onClick={() => entregarPaquete(p.id, user)}>
                Entregar
            </button>
        </div>
    );
}