import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
    cambiarEstadoReserva,
    crearBloqueo,
    crearRecursoComun,
    getRecursosComunes,
    listarBloqueos,
    listarEventosReserva,
    listarReservas,
    subscribeReservasConjunto,
    eliminarBloqueo
} from '../services/reservasService';

export default function PanelReservasAdmin({ usuarioApp }) {
    const [reservas, setReservas] = useState([]);
    const [recursos, setRecursos] = useState([]);
    const [bloqueos, setBloqueos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [eventosPorReserva, setEventosPorReserva] = useState({});
    const [bloqueoForm, setBloqueoForm] = useState({ recurso_id: '', fecha: '', hora_inicio: '', hora_fin: '', motivo: '' });
    const [recursoForm, setRecursoForm] = useState({ nombre: '', tipo: 'salon_social', descripcion: '', capacidad: '' });

    const cargar = async () => {
        if (!usuarioApp?.conjunto_id) return;
        setLoading(true);

        const [reservasResp, recursosResp, bloqueosResp] = await Promise.all([
            listarReservas({ conjunto_id: usuarioApp.conjunto_id, limit: 300 }),
            getRecursosComunes(usuarioApp.conjunto_id),
            listarBloqueos({ conjunto_id: usuarioApp.conjunto_id })
        ]);

        setLoading(false);

        if (!reservasResp.ok) return toast.error(reservasResp.error);
        if (!recursosResp.ok) toast.error(recursosResp.error);
        if (!bloqueosResp.ok) toast.error(bloqueosResp.error);

        setReservas(reservasResp.data || []);
        setRecursos(recursosResp.data || []);
        setBloqueos(bloqueosResp.data || []);
    };

    useEffect(() => {
        cargar();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [usuarioApp?.conjunto_id]);

    useEffect(() => {
        if (!usuarioApp?.conjunto_id) return undefined;
        return subscribeReservasConjunto(usuarioApp.conjunto_id, () => {
            cargar();
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [usuarioApp?.conjunto_id]);

    const actualizarEstado = async (id, estado) => {
        const resp = await cambiarEstadoReserva({
            reserva_id: id,
            estado,
            usuario_id: usuarioApp.id,
            usuario_rol: usuarioApp.rol_id,
            detalle: `Gestión admin: ${estado}`
        });
        if (!resp.ok) return toast.error(resp.error);
        toast.success(`Reserva ${estado}`);
        cargar();
    };

    const verBitacora = async (reservaId) => {
        const resp = await listarEventosReserva(reservaId);
        if (!resp.ok) return toast.error(resp.error);
        setEventosPorReserva((prev) => ({ ...prev, [reservaId]: resp.data || [] }));
    };



    const crearRecurso = async () => {
        if (!recursoForm.nombre || !recursoForm.tipo) return toast.error('Nombre y tipo son obligatorios');

        const resp = await crearRecursoComun({
            conjunto_id: usuarioApp.conjunto_id,
            nombre: recursoForm.nombre.trim(),
            tipo: recursoForm.tipo,
            descripcion: recursoForm.descripcion?.trim() || null,
            capacidad: recursoForm.capacidad ? Number(recursoForm.capacidad) : null
        });

        if (!resp.ok) return toast.error(resp.error);
        toast.success('Recurso creado');
        setRecursoForm({ nombre: '', tipo: 'salon_social', descripcion: '', capacidad: '' });
        cargar();
    };

    const crearBloqueoAdmin = async () => {
        if (!bloqueoForm.recurso_id || !bloqueoForm.fecha || !bloqueoForm.hora_inicio || !bloqueoForm.hora_fin || !bloqueoForm.motivo) {
            return toast.error('Completa recurso, horario y motivo del bloqueo');
        }

        const fecha_inicio = `${bloqueoForm.fecha}T${bloqueoForm.hora_inicio}:00`;
        const fecha_fin = `${bloqueoForm.fecha}T${bloqueoForm.hora_fin}:00`;

        if (bloqueoForm.hora_fin <= bloqueoForm.hora_inicio) {
            return toast.error('La hora fin del bloqueo debe ser mayor');
        }

        const resp = await crearBloqueo({
            conjunto_id: usuarioApp.conjunto_id,
            recurso_id: bloqueoForm.recurso_id,
            fecha_inicio,
            fecha_fin,
            motivo: bloqueoForm.motivo,
            creado_por: usuarioApp.id
        });

        if (!resp.ok) return toast.error(resp.error);
        toast.success('Bloqueo creado');
        setBloqueoForm({ recurso_id: '', fecha: '', hora_inicio: '', hora_fin: '', motivo: '' });
        cargar();
    };

    const borrarBloqueo = async (id) => {
        const ok = window.confirm('¿Eliminar bloqueo?');
        if (!ok) return;
        const resp = await eliminarBloqueo(id);
        if (!resp.ok) return toast.error(resp.error);
        toast.success('Bloqueo eliminado');
        cargar();
    };

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-2xl p-5 shadow space-y-3">
                <h2 className="text-2xl font-bold">Panel reservas (admin) 🧩</h2>
                {loading && <p className="text-sm text-gray-500">Cargando...</p>}
                {reservas.map((r) => (
                    <div key={r.id} className="border rounded-xl p-3 space-y-2">
                        <p className="font-medium">{r.recursos_comunes?.nombre || 'Recurso'} · {r.estado}</p>
                        <p className="text-sm text-gray-500">{new Date(r.fecha_inicio).toLocaleString()} → {new Date(r.fecha_fin).toLocaleString()}</p>
                        <p className="text-sm text-gray-500">Residente ID: {r.residente_id}</p>
                        {r.estado === 'solicitada' && (
                            <div className="flex gap-2 mt-2">
                                <button className="bg-emerald-600 text-white px-3 py-1 rounded" onClick={() => actualizarEstado(r.id, 'aprobada')}>Aprobar</button>
                                <button className="bg-red-600 text-white px-3 py-1 rounded" onClick={() => actualizarEstado(r.id, 'rechazada')}>Rechazar</button>
                            </div>
                        )}
                        <button className="text-sm underline" onClick={() => verBitacora(r.id)}>Ver bitácora</button>
                        {eventosPorReserva[r.id]?.length > 0 && (
                            <ul className="text-xs text-gray-600 list-disc pl-4">
                                {eventosPorReserva[r.id].map((ev) => (
                                    <li key={ev.id}>{ev.accion} · {new Date(ev.created_at).toLocaleString()} · {ev.detalle || 'Sin detalle'}</li>
                                ))}
                            </ul>
                        )}
                    </div>
                ))}
                {reservas.length === 0 && <p className="text-sm text-gray-500">Sin reservas registradas.</p>}
            </div>


            <div className="bg-white rounded-2xl p-5 shadow space-y-3">
                <h3 className="text-lg font-semibold">Registrar recurso común</h3>
                <div className="grid md:grid-cols-2 gap-3">
                    <input className="border rounded-lg px-3 py-2" placeholder="Nombre recurso" value={recursoForm.nombre} onChange={(e) => setRecursoForm((s) => ({ ...s, nombre: e.target.value }))} />
                    <select className="border rounded-lg px-3 py-2" value={recursoForm.tipo} onChange={(e) => setRecursoForm((s) => ({ ...s, tipo: e.target.value }))}>
                        <option value="salon_social">Salón social</option>
                        <option value="cancha">Cancha</option>
                        <option value="bbq">BBQ</option>
                        <option value="logistica">Logística</option>
                        <option value="enseres">Enseres</option>
                        <option value="gimnasio">Gimnasio</option>
                        <option value="generica">Genérica</option>
                    </select>
                    <input className="border rounded-lg px-3 py-2" placeholder="Capacidad (opcional)" value={recursoForm.capacidad} onChange={(e) => setRecursoForm((s) => ({ ...s, capacidad: e.target.value }))} />
                    <input className="border rounded-lg px-3 py-2" placeholder="Descripción (opcional)" value={recursoForm.descripcion} onChange={(e) => setRecursoForm((s) => ({ ...s, descripcion: e.target.value }))} />
                </div>
                <button className="bg-indigo-700 text-white px-3 py-2 rounded" onClick={crearRecurso}>Crear recurso</button>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow space-y-3">
                <h3 className="text-lg font-semibold">Bloqueos operativos</h3>
                <div className="grid md:grid-cols-2 gap-3">
                    <select className="border rounded-lg px-3 py-2" value={bloqueoForm.recurso_id} onChange={(e) => setBloqueoForm((s) => ({ ...s, recurso_id: e.target.value }))}>
                        <option value="">Selecciona recurso</option>
                        {recursos.map((r) => <option key={r.id} value={r.id}>{r.nombre} · {r.tipo}</option>)}
                    </select>
                    <input type="date" className="border rounded-lg px-3 py-2" value={bloqueoForm.fecha} onChange={(e) => setBloqueoForm((s) => ({ ...s, fecha: e.target.value }))} />
                    <input type="time" className="border rounded-lg px-3 py-2" value={bloqueoForm.hora_inicio} onChange={(e) => setBloqueoForm((s) => ({ ...s, hora_inicio: e.target.value }))} />
                    <input type="time" className="border rounded-lg px-3 py-2" value={bloqueoForm.hora_fin} onChange={(e) => setBloqueoForm((s) => ({ ...s, hora_fin: e.target.value }))} />
                    <input className="border rounded-lg px-3 py-2 md:col-span-2" placeholder="Motivo" value={bloqueoForm.motivo} onChange={(e) => setBloqueoForm((s) => ({ ...s, motivo: e.target.value }))} />
                </div>
                <button className="bg-slate-800 text-white px-3 py-2 rounded" onClick={crearBloqueoAdmin}>Crear bloqueo</button>
                <div className="space-y-2">
                    {bloqueos.map((b) => (
                        <div key={b.id} className="border rounded p-2 flex items-center justify-between">
                            <p className="text-sm">{b.recursos_comunes?.nombre || b.recurso_id} · {new Date(b.fecha_inicio).toLocaleString()} → {new Date(b.fecha_fin).toLocaleString()} · {b.motivo}</p>
                            <button className="text-xs border rounded px-2 py-1" onClick={() => borrarBloqueo(b.id)}>Eliminar</button>
                        </div>
                    ))}
                    {bloqueos.length === 0 && <p className="text-sm text-gray-500">No hay bloqueos registrados.</p>}
                </div>
            </div>
        </div>
    );
}
