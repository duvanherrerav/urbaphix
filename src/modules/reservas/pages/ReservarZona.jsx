import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
    cambiarEstadoReserva,
    crearReserva,
    getPerfilResidente,
    getRecursosComunes,
    listarBloqueos,
    listarDocumentosReserva,
    listarReservas,
    registrarDocumentoReserva,
    subscribeReservasConjunto
} from '../services/reservasService';

const toFechaISO = (fecha, hora) => `${fecha}T${hora}:00`;

const ESTADOS_FINALIZADOS = ['cancelada', 'rechazada', 'finalizada', 'no_show'];

export default function ReservarZona({ usuarioApp }) {
    const [recursos, setRecursos] = useState([]);
    const [perfilResidente, setPerfilResidente] = useState(null);
    const [reservas, setReservas] = useState([]);
    const [bloqueos, setBloqueos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [subiendoSoporteId, setSubiendoSoporteId] = useState(null);
    const [form, setForm] = useState({
        recurso_id: '',
        fecha: '',
        hora_inicio: '',
        hora_fin: '',
        tipo_reserva: 'recreativa',
        subtipo: '',
        motivo: '',
        observaciones: ''
    });

    const cargar = async () => {
        if (!usuarioApp?.id || !usuarioApp?.conjunto_id) return;

        const [recursosResp, perfilResp, bloqueosResp] = await Promise.all([
            getRecursosComunes(usuarioApp.conjunto_id),
            getPerfilResidente(usuarioApp.id),
            listarBloqueos({ conjunto_id: usuarioApp.conjunto_id })
        ]);

        if (!recursosResp.ok) toast.error(recursosResp.error);
        if (!perfilResp.ok) toast.error(perfilResp.error);
        if (!bloqueosResp.ok) toast.error(bloqueosResp.error);

        setRecursos(recursosResp.data || []);
        setPerfilResidente(perfilResp.data || null);
        setBloqueos(bloqueosResp.data || []);

        if (perfilResp.data?.id) {
            const reservasResp = await listarReservas({
                conjunto_id: usuarioApp.conjunto_id,
                residente_id: perfilResp.data.id,
                limit: 200
            });

            if (!reservasResp.ok) {
                toast.error(reservasResp.error);
            } else {
                const conSoportes = await Promise.all(
                    (reservasResp.data || []).map(async (reserva) => {
                        const docsResp = await listarDocumentosReserva(reserva.id);
                        return {
                            ...reserva,
                            documentos: docsResp.ok ? docsResp.data : []
                        };
                    })
                );
                setReservas(conSoportes);
            }
        }
    };

    useEffect(() => {
        cargar();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [usuarioApp?.id, usuarioApp?.conjunto_id]);

    useEffect(() => {
        if (!usuarioApp?.conjunto_id) return undefined;
        return subscribeReservasConjunto(usuarioApp.conjunto_id, () => {
            cargar();
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [usuarioApp?.conjunto_id]);

    const validarBloqueo = (recursoId, fechaInicio, fechaFin) => {
        return bloqueos.some((b) => {
            if (b.recurso_id !== recursoId) return false;
            const bInicio = new Date(b.fecha_inicio).getTime();
            const bFin = new Date(b.fecha_fin).getTime();
            const fInicio = new Date(fechaInicio).getTime();
            const fFin = new Date(fechaFin).getTime();
            return fInicio < bFin && fFin > bInicio;
        });
    };

    const crear = async () => {
        if (!perfilResidente?.id) return toast.error('No se encontró tu perfil de residente');
        if (!form.recurso_id || !form.fecha || !form.hora_inicio || !form.hora_fin) return toast.error('Completa fecha, horas y recurso');
        if (form.hora_fin <= form.hora_inicio) return toast.error('La hora fin debe ser mayor a hora inicio');

        const fecha_inicio = toFechaISO(form.fecha, form.hora_inicio);
        const fecha_fin = toFechaISO(form.fecha, form.hora_fin);

        if (validarBloqueo(form.recurso_id, fecha_inicio, fecha_fin)) {
            return toast.error('La franja elegida está bloqueada por administración');
        }

        setLoading(true);
        const result = await crearReserva({
            conjunto_id: usuarioApp.conjunto_id,
            recurso_id: form.recurso_id,
            residente_id: perfilResidente.id,
            apartamento_id: perfilResidente.apartamento_id,
            fecha_inicio,
            fecha_fin,
            tipo_reserva: form.tipo_reserva,
            subtipo: form.subtipo || null,
            motivo: form.motivo || null,
            observaciones: form.observaciones || null,
            metadata: {
                origen: 'app_residente',
                recurso_tipo: recursos.find((r) => r.id === form.recurso_id)?.tipo || null
            }
        });
        setLoading(false);

        if (!result.ok) return toast.error(result.error);

        toast.success('Solicitud de reserva creada');
        setForm((f) => ({
            ...f,
            fecha: '',
            hora_inicio: '',
            hora_fin: '',
            subtipo: '',
            motivo: '',
            observaciones: ''
        }));
        cargar();
    };

    const cancelar = async (reservaId) => {
        const ok = window.confirm('¿Cancelar esta reserva?');
        if (!ok) return;

        const resp = await cambiarEstadoReserva({
            reserva_id: reservaId,
            estado: 'cancelada',
            usuario_id: usuarioApp.id,
            usuario_rol: usuarioApp.rol_id,
            usuario_residente_id: perfilResidente?.id || null,
            detalle: 'Cancelación solicitada por residente'
        });

        if (!resp.ok) return toast.error(resp.error);
        toast.success('Reserva cancelada');
        cargar();
    };

    const adjuntarSoporte = async (reservaId, file) => {
        if (!file) return;

        const ruta_storage = `reservas/${reservaId}/${Date.now()}-${file.name}`;
        setSubiendoSoporteId(reservaId);
        const resp = await registrarDocumentoReserva({
            reserva_id: reservaId,
            conjunto_id: usuarioApp.conjunto_id,
            nombre_archivo: file.name,
            ruta_storage,
            tipo_documento: file.type || 'adjunto',
            subido_por: usuarioApp.id
        });
        setSubiendoSoporteId(null);

        if (!resp.ok) return toast.error(resp.error);
        toast.success('Soporte registrado');
        cargar();
    };

    const reservasActivas = useMemo(
        () => reservas.filter((r) => !ESTADOS_FINALIZADOS.includes(r.estado)),
        [reservas]
    );

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-2xl p-5 shadow space-y-3">
                <h2 className="text-2xl font-bold">Reservar zona común 🏟️</h2>
                <p className="text-sm text-gray-500">Solicita cancha, salón social, logística o préstamo de enseres.</p>
                <div className="grid md:grid-cols-2 gap-3">
                    <select className="border rounded-lg px-3 py-2" value={form.recurso_id} onChange={(e) => setForm({ ...form, recurso_id: e.target.value })}>
                        <option value="">Selecciona recurso</option>
                        {recursos.map((r) => <option key={r.id} value={r.id}>{r.nombre} · {r.tipo}</option>)}
                    </select>
                    <select className="border rounded-lg px-3 py-2" value={form.tipo_reserva} onChange={(e) => setForm({ ...form, tipo_reserva: e.target.value })}>
                        <option value="recreativa">Recreativa</option>
                        <option value="logistica">Logística</option>
                        <option value="prestamo">Préstamo</option>
                    </select>
                    <input type="date" className="border rounded-lg px-3 py-2" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
                    <input type="time" className="border rounded-lg px-3 py-2" value={form.hora_inicio} onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })} />
                    <input type="time" className="border rounded-lg px-3 py-2" value={form.hora_fin} onChange={(e) => setForm({ ...form, hora_fin: e.target.value })} />
                    <input className="border rounded-lg px-3 py-2" placeholder="Subtipo (opcional)" value={form.subtipo} onChange={(e) => setForm({ ...form, subtipo: e.target.value })} />
                    <input className="border rounded-lg px-3 py-2 md:col-span-2" placeholder="Motivo (opcional)" value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} />
                    <textarea className="border rounded-lg px-3 py-2 md:col-span-2" placeholder="Observaciones (opcional)" value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />
                </div>
                <button onClick={crear} disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded-lg">
                    {loading ? 'Creando...' : 'Crear solicitud'}
                </button>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow space-y-3">
                <h3 className="text-lg font-semibold">Mis reservas activas ({reservasActivas.length})</h3>
                {reservasActivas.map((r) => (
                    <div key={r.id} className="border rounded-xl p-3 space-y-2">
                        <p className="font-medium">{r.recursos_comunes?.nombre || 'Recurso'} · {r.estado}</p>
                        <p className="text-sm text-gray-500">{new Date(r.fecha_inicio).toLocaleString()} → {new Date(r.fecha_fin).toLocaleString()}</p>
                        <p className="text-sm text-gray-500">Tipo: {r.tipo_reserva}{r.subtipo ? ` · ${r.subtipo}` : ''}</p>
                        <p className="text-sm text-gray-500">Soportes: {r.documentos?.length || 0}</p>
                        <div className="flex flex-wrap gap-2">
                            {['solicitada', 'aprobada'].includes(r.estado) && (
                                <button className="border rounded px-2 py-1 text-sm" onClick={() => cancelar(r.id)}>Cancelar</button>
                            )}
                            <label className="border rounded px-2 py-1 text-sm cursor-pointer">
                                {subiendoSoporteId === r.id ? 'Subiendo...' : 'Adjuntar soporte'}
                                <input
                                    type="file"
                                    className="hidden"
                                    onChange={(e) => adjuntarSoporte(r.id, e.target.files?.[0])}
                                    disabled={subiendoSoporteId === r.id}
                                />
                            </label>
                        </div>
                    </div>
                ))}
                {reservasActivas.length === 0 && <p className="text-sm text-gray-500">No tienes reservas activas.</p>}
            </div>
        </div>
    );
}
