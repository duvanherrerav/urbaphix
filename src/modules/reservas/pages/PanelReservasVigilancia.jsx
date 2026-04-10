import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { cambiarEstadoReserva, listarReservas, subscribeReservasConjunto } from '../services/reservasService';

export default function PanelReservasVigilancia({ usuarioApp }) {
    const [reservas, setReservas] = useState([]);
    const [filtroEstado, setFiltroEstado] = useState('operativas');

    const cargar = async () => {
        if (!usuarioApp?.conjunto_id) return;

        const estados = filtroEstado === 'operativas'
            ? ['aprobada', 'en_curso']
            : ['aprobada', 'en_curso', 'finalizada', 'no_show'];

        const resp = await listarReservas({
            conjunto_id: usuarioApp.conjunto_id,
            estados,
            limit: 250
        });

        if (!resp.ok) return toast.error(resp.error);
        setReservas(resp.data || []);
    };

    useEffect(() => {
        cargar();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [usuarioApp?.conjunto_id, filtroEstado]);

    useEffect(() => {
        if (!usuarioApp?.conjunto_id) return undefined;
        return subscribeReservasConjunto(usuarioApp.conjunto_id, () => {
            cargar();
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [usuarioApp?.conjunto_id, filtroEstado]);

    const actualizar = async (id, estado, detalle) => {
        const resp = await cambiarEstadoReserva({
            reserva_id: id,
            estado,
            usuario_id: usuarioApp.id,
            usuario_rol: usuarioApp.rol_id,
            detalle
        });

        if (!resp.ok) return toast.error(resp.error);
        toast.success(`Reserva ${estado}`);
        cargar();
    };

    return (
        <div className="bg-white rounded-2xl p-5 shadow space-y-3">
            <div className="flex items-center justify-between gap-2">
                <h2 className="text-2xl font-bold">Panel reservas (vigilancia) 🛡️</h2>
                <select className="border rounded px-2 py-1 text-sm" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
                    <option value="operativas">Operativas</option>
                    <option value="historico">Histórico corto</option>
                </select>
            </div>

            {reservas.map((r) => (
                <div key={r.id} className="border rounded-xl p-3 space-y-2">
                    <p className="font-medium">{r.recursos_comunes?.nombre || 'Recurso'} · {r.estado}</p>
                    <p className="text-sm text-gray-500">{new Date(r.fecha_inicio).toLocaleString()} → {new Date(r.fecha_fin).toLocaleString()}</p>
                    <p className="text-sm text-gray-500">Residente ID: {r.residente_id}</p>

                    {r.estado === 'aprobada' && (
                        <button className="mt-2 bg-blue-600 text-white px-3 py-1 rounded" onClick={() => actualizar(r.id, 'en_curso', 'Check-in por vigilancia')}>
                            Check-in
                        </button>
                    )}

                    {r.estado === 'en_curso' && (
                        <div className="flex flex-wrap gap-2 mt-2">
                            <button className="bg-emerald-600 text-white px-3 py-1 rounded" onClick={() => actualizar(r.id, 'finalizada', 'Checkout por vigilancia')}>
                                Finalizar
                            </button>
                            <button className="bg-amber-600 text-white px-3 py-1 rounded" onClick={() => actualizar(r.id, 'no_show', 'Marcada como no_show por vigilancia')}>
                                No show
                            </button>
                        </div>
                    )}
                </div>
            ))}
            {reservas.length === 0 && <p className="text-sm text-gray-500">No hay reservas en operación.</p>}
        </div>
    );
}
