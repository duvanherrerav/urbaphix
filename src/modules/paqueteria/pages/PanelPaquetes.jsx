import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { entregarPaquete as entregarPaqueteService, listarPaquetesConDetalle } from '../services/paquetesService';

export default function PanelPaquetes({ usuarioApp }) {
    const [paquetes, setPaquetes] = useState([]);
    const [filtroEstado, setFiltroEstado] = useState('pendiente');
    const [busqueda, setBusqueda] = useState('');
    const [loading, setLoading] = useState(false);

    const obtenerPaquetes = async () => {
        if (!usuarioApp?.conjunto_id) return;
        setLoading(true);
        const result = await listarPaquetesConDetalle({
            conjunto_id: usuarioApp.conjunto_id,
            estado: filtroEstado,
            busqueda
        });
        setLoading(false);

        if (!result.ok) {
            toast.error(result.error || 'No se pudo cargar paquetería');
            return;
        }
        setPaquetes(result.data || []);
    };

    useEffect(() => {
        obtenerPaquetes();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [usuarioApp?.conjunto_id, filtroEstado]);

    const entregables = useMemo(
        () => paquetes.filter((p) => p.estado === 'pendiente'),
        [paquetes]
    );
    const serviciosPendientes = useMemo(
        () => entregables.filter((p) => p.categoria === 'servicio_publico').length,
        [entregables]
    );

    const entregarPaquete = async (paquete) => {
        const confirmar = window.confirm(
            paquete.categoria === 'servicio_publico'
                ? `¿Confirmar entrega del servicio público "${paquete.descripcion_visible}"?`
                : `¿Confirmar entrega del paquete "${paquete.descripcion_visible}"?`
        );
        if (!confirmar) return;

        const result = await entregarPaqueteService(paquete.id);

        if (!result.ok) {
            toast.error(`No se pudo entregar: ${result.error}`);
            return;
        }

        toast.success(
            paquete.categoria === 'servicio_publico'
                ? 'Servicio público entregado al residente'
                : 'Paquete entregado'
        );
        obtenerPaquetes();
    };

    return (
        <div className="bg-white rounded-2xl shadow p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="text-2xl font-bold">Panel de paquetería (vigilancia) 📬</h2>
                    <p className="text-sm text-gray-500">Control de entregas, servicios públicos y trazabilidad de pendientes.</p>
                </div>
                <div className="text-sm bg-slate-50 border rounded-xl px-3 py-2">
                    <p><b>Pendientes:</b> {entregables.length}</p>
                    <p><b>Servicios públicos por reclamar:</b> {serviciosPendientes}</p>
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
                <button className={`px-3 py-1 rounded-full text-sm ${filtroEstado === 'pendiente' ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-700'}`} onClick={() => setFiltroEstado('pendiente')}>Pendientes</button>
                <button className={`px-3 py-1 rounded-full text-sm ${filtroEstado === 'entregado' ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-700'}`} onClick={() => setFiltroEstado('entregado')}>Entregados</button>
                <button className={`px-3 py-1 rounded-full text-sm ${filtroEstado === 'todos' ? 'bg-slate-900 text-white' : 'bg-slate-100'}`} onClick={() => setFiltroEstado('todos')}>Todos</button>
            </div>

            <div className="flex gap-2">
                <input
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="Buscar por descripción, torre o apartamento"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                />
                <button className="border rounded-lg px-3 py-2" onClick={obtenerPaquetes}>Buscar</button>
            </div>

            {loading && <p className="text-sm text-gray-500">Cargando paquetería...</p>}
            {!loading && paquetes.length === 0 && <p className="text-sm text-gray-500">No hay registros para este filtro.</p>}

            <div className="space-y-3">
                {paquetes.map((p) => (
                    <div key={p.id} className="border rounded-xl p-3 bg-white shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-medium">{p.descripcion_visible || 'Sin descripción'}</p>
                            <span className={`px-2 py-0.5 rounded-full text-xs ${
                                p.categoria === 'servicio_publico'
                                    ? 'bg-indigo-100 text-indigo-700'
                                    : 'bg-blue-100 text-blue-700'
                                }`}>
                                {p.categoria === 'servicio_publico' ? 'Servicio público' : 'Paquete'}
                            </span>
                        </div>
                        <p className="text-sm text-gray-600">
                            Torre: <b>{p.torre_nombre || '-'}</b> · Apto: <b>{p.apartamento_numero || '-'}</b>
                        </p>
                        <p className="text-sm text-gray-500">
                            Recibido: {p.fecha_recibido ? new Date(p.fecha_recibido).toLocaleString() : '-'}
                        </p>
                        {p.fecha_entrega && (
                            <p className="text-sm text-gray-500">
                                Entregado: {new Date(p.fecha_entrega).toLocaleString()}
                            </p>
                        )}
                        {p.estado === 'pendiente' && (
                            <button className="mt-2 bg-emerald-600 text-white px-3 py-1 rounded-lg" onClick={() => entregarPaquete(p)}>
                                Marcar como entregado
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}