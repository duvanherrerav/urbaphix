import React, { useState } from 'react';
import { registrarPaquete } from '../services/paquetesService';
import toast from 'react-hot-toast';

export default function RegistrarPaquete({ user }) {

    const [form, setForm] = useState({
        residente_id: '',
        descripcion: ''
    });

    const handleSubmit = async () => {
        const result = await registrarPaquete(form, user);

        if (!result.ok) {
            toast.error(`No se pudo registrar: ${result.error}`);
            return;
        }

        toast.success('Paquete registrado');
        setForm({ residente_id: '', descripcion: '' });
    };

    return (
        <div>
            <input
                placeholder="ID Residente"
                value={form.residente_id}
                onChange={e => setForm({ ...form, residente_id: e.target.value })}
            />

            <input
                placeholder="Descripción"
                value={form.descripcion}
                onChange={e => setForm({ ...form, descripcion: e.target.value })}
            />

            <button onClick={handleSubmit}>
                Registrar
            </button>
        </div>
    );
}
