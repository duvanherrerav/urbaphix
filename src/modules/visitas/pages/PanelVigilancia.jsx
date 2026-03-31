import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../../services/supabaseClient';

const toBogotaTimestamp = () => new Date().toLocaleString('sv-SE', { timeZone: 'America/Bogota' }).replace(' ', ' ');
const toDateOnly = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Bogota' });

export default function PanelVigilancia({ usuarioApp }) {

    const [visitas, setVisitas] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filtroEstado, setFiltroEstado] = useState('todos');
    const [busqueda, setBusqueda] = useState('');

    useEffect(() => {
        let mounted = true;

        const cargarVisitas = async () => {
            if (!usuarioApp?.conjunto_id) return;

            setLoading(true);

            const hoy = new Date();
            const hace7dias = new Date();
            hace7dias.setDate(hoy.getDate() - 7);
            const fechaInicio = hace7dias.toLocaleDateString('sv-SE', { timeZone: 'America/Bogota' });

            const { data, error } = await supabase
                .from('visitas')
                .select('*')
                .eq('conjunto_id', usuarioApp.conjunto_id)
                .gte('fecha_visita', fechaInicio)
                .order('fecha_visita', { ascending: false });

            if (!mounted) return;

            if (error) {
                console.error(error);
                toast.error('No se pudo cargar el control de visitas');
                setLoading(false);
                return;
            }

            setVisitas(data || []);
            setLoading(false);
        };

        cargarVisitas();

        const channel = supabase
            .channel(`visitas-vigilancia-${usuarioApp?.conjunto_id}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'visitas', filter: `conjunto_id=eq.${usuarioApp?.conjunto_id}` },
                () => cargarVisitas()
            )
            .subscribe();

        return () => {
            mounted = false;
            supabase.removeChannel(channel);
        };
    }, [usuarioApp?.conjunto_id]);

    const darIngreso = async (id) => {
        const { error } = await supabase
            .from('visitas')
            .update({
                estado: 'ingresado',
                hora_ingreso: toBogotaTimestamp()
            })
            .eq('id', id);

        if (error) {
            console.error(error);
            toast.error('Error al registrar ingreso');
            return;
        }

        setVisitas((prev) => prev.map((v) => (v.id === id ? { ...v, estado: 'ingresado', hora_ingreso: toBogotaTimestamp() } : v)));
        toast.success('Ingreso registrado');
    };

    const registrarSalida = async (id) => {
        const { error } = await supabase
            .from('visitas')
            .update({
                estado: 'salido',
                hora_salida: toBogotaTimestamp()
            })
            .eq('id', id);

        if (error) {
            console.error(error);
            toast.error('Error al registrar salida');
            return;
        }

        setVisitas((prev) => prev.map((v) => (v.id === id ? { ...v, estado: 'salido', hora_salida: toBogotaTimestamp() } : v)));
        toast.success('Salida registrada');
    };

    const visitasFiltradas = useMemo(() => {
        const termino = busqueda.trim().toLowerCase();

        return visitas.filter((v) => {
            const matchEstado = filtroEstado === 'todos' ? true : v.estado === filtroEstado;
            const matchBusqueda = !termino
                || v.nombre_visitante?.toLowerCase().includes(termino)
                || String(v.documento || '').toLowerCase().includes(termino)
                || String(v.placa || '').toLowerCase().includes(termino);

            return matchEstado && matchBusqueda;
        });
    }, [visitas, filtroEstado, busqueda]);

    const hoyBogota = toDateOnly();
    const resumen = {
        total: visitasFiltradas.length,
        pendientes: visitasFiltradas.filter((v) => v.estado === 'pendiente').length,
        enCurso: visitasFiltradas.filter((v) => v.estado === 'ingresado').length,
        finalizadas: visitasFiltradas.filter((v) => v.estado === 'salido').length,
        hoy: visitasFiltradas.filter((v) => v.fecha_visita === hoyBogota).length
    };

    return (
        <div className="bg-white rounded-xl shadow p-4 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <h2 className="text-xl font-bold">Control visitas 👮‍♂️</h2>
                <div className="text-xs text-gray-500">Actualizado automáticamente en tiempo real</div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                <div className="rounded-lg bg-gray-100 px-3 py-2"><b>Total:</b> {resumen.total}</div>
                <div className="rounded-lg bg-amber-50 px-3 py-2"><b>Pendientes:</b> {resumen.pendientes}</div>
                <div className="rounded-lg bg-blue-50 px-3 py-2"><b>Ingresadas:</b> {resumen.enCurso}</div>
                <div className="rounded-lg bg-green-50 px-3 py-2"><b>Finalizadas:</b> {resumen.finalizadas}</div>
                <div className="rounded-lg bg-purple-50 px-3 py-2"><b>Hoy:</b> {resumen.hoy}</div>
            </div>

            <div className="grid md:grid-cols-3 gap-2">
                <input
                    className="border rounded-lg px-3 py-2 text-sm"
                    placeholder="Buscar por nombre, documento o placa"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                />

                <select
                    className="border rounded-lg px-3 py-2 text-sm"
                    value={filtroEstado}
                    onChange={(e) => setFiltroEstado(e.target.value)}
                >
                    <option value="todos">Todos los estados</option>
                    <option value="pendiente">Pendiente</option>
                    <option value="ingresado">Ingresado</option>
                    <option value="salido">Finalizado</option>
                </select>

                <button
                    className="border rounded-lg px-3 py-2 text-sm hover:bg-gray-50"
                    onClick={() => {
                        setBusqueda('');
                        setFiltroEstado('todos');
                    }}
                >
                    Limpiar filtros
                </button>
            </div>

            {loading && <p className="text-sm text-gray-500">Cargando visitas...</p>}
            {!loading && visitasFiltradas.length === 0 && <p className="text-sm text-gray-500">No hay visitas para los filtros aplicados.</p>}

            <div className="space-y-3">
                {visitasFiltradas.map((v) => (
                    <div key={v.id} className="border rounded-xl p-3">
                        <div className="flex flex-col md:flex-row md:justify-between gap-2">
                            <div className="space-y-1 text-sm">
                                <p><b>Visitante:</b> {v.nombre_visitante}</p>
                                <p><b>Documento:</b> {v.documento}</p>
                                <p><b>Fecha visita:</b> {v.fecha_visita}</p>
                                <p><b>Placa:</b> {v.placa || 'No registra'}</p>
                            </div>

                            <div className="space-y-2 text-sm md:text-right">
                                <p>
                                    <b>Estado:</b>{' '}
                                    <span className={
                                        v.estado === 'pendiente' ? 'text-amber-600 font-semibold'
                                            : v.estado === 'ingresado' ? 'text-blue-600 font-semibold'
                                                : 'text-green-600 font-semibold'
                                    }>
                                        {v.estado}
                                    </span>
                                </p>

                                {v.hora_ingreso && <p className="text-blue-600">⏱ Ingreso: {v.hora_ingreso}</p>}
                                {v.hora_salida && <p className="text-green-600">✅ Salida: {v.hora_salida}</p>}
                            </div>
                        </div>

                        <div className="mt-3 flex gap-2">
                            {v.estado === 'pendiente' && (
                                <button
                                    className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
                                    onClick={() => darIngreso(v.id)}
                                >
                                    Dar ingreso
                                </button>
                            )}

                            {v.estado === 'ingresado' && (
                                <button
                                    className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700"
                                    onClick={() => registrarSalida(v.id)}
                                >
                                    Registrar salida
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
