import { useEffect, useMemo, useState } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import toast from 'react-hot-toast';
import { supabase } from '../../../services/supabaseClient';
import { calcularSLA, getOfflineQueue, obtenerSeguridadConsolidada, registrarBitacora, syncOfflineQueue } from '../services/porteriaService';

const toBogotaTimestamp = () => new Date().toLocaleString('sv-SE', { timeZone: 'America/Bogota' }).replace(' ', ' ');
const toDateOnly = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Bogota' });
const normalizeEstado = (estado) => String(estado || '').trim().toLowerCase();

const parseQRCode = (text) => {
    try {
        const parsed = JSON.parse(text);
        if (parsed?.visita_id) return parsed;
    } catch {
        // fallback below
    }

    if (/^[0-9a-fA-F-]{8,}$/.test(text)) return { qr_code: text };
    return null;
};

export default function PanelVigilancia({ usuarioApp }) {

    const [visitas, setVisitas] = useState([]);
    const [loading, setLoading] = useState(false);
    const [busqueda, setBusqueda] = useState('');
    const [vista, setVista] = useState('pendientes');
    const [pagina, setPagina] = useState(1);
    const [seguridad, setSeguridad] = useState({ visitasHoy: 0, incidentesHoy: 0, paquetesPendientes: 0, porTurno: { mañana: 0, tarde: 0, noche: 0 } });
    const [offlinePendientes, setOfflinePendientes] = useState(0);

    const [modalIngreso, setModalIngreso] = useState({ open: false, visita: null, manualQR: '' });

    useEffect(() => {
        let mounted = true;

        const cargar = async () => {
            if (!usuarioApp?.conjunto_id) return;
            setLoading(true);
            const hace7dias = new Date();

            hace7dias.setDate(hace7dias.getDate() - 7);
            const fechaInicio = hace7dias.toLocaleDateString('sv-SE', { timeZone: 'America/Bogota' });

            const [registroResp, seguridadResp] = await Promise.all([
                supabase
                    .from('registro_visitas')
                    .select(`
                        id, conjunto_id, fecha_visita, estado, qr_code, hora_ingreso, hora_salida, created_at,
                        visitantes(nombre, documento, placa)
                    `)
                    .eq('conjunto_id', usuarioApp.conjunto_id)
                    .gte('fecha_visita', fechaInicio)
                    .order('fecha_visita', { ascending: false }),
                obtenerSeguridadConsolidada(usuarioApp.conjunto_id)
            ]);

            if (!mounted) return;
            if (registroResp.error) {
                toast.error('No se pudo cargar el panel de vigilancia');
                setLoading(false);
                return;
            }

            const mappedRegistro = (registroResp.data || []).map((v) => ({
                id: v.id,
                fecha_visita: v.fecha_visita,
                estado: v.estado,
                estado_normalizado: normalizeEstado(v.estado),
                qr_code: v.qr_code,
                hora_ingreso: v.hora_ingreso,
                hora_salida: v.hora_salida,
                created_at: v.created_at,
                nombre_visitante: v.visitantes?.nombre,
                documento: v.visitantes?.documento,
                placa: v.visitantes?.placa
            }));
            setVisitas(mappedRegistro);
            setSeguridad(seguridadResp);
            const cola = getOfflineQueue();
            setOfflinePendientes(Array.isArray(cola) ? cola.length : 0);
            setLoading(false);
        };

        cargar();

        const channel = supabase
            .channel(`registro-visitas-vigilancia-${usuarioApp?.conjunto_id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'registro_visitas', filter: `conjunto_id=eq.${usuarioApp?.conjunto_id}` }, cargar)
            .subscribe();

        return () => {
            mounted = false;
            supabase.removeChannel(channel);
        };
    }, [usuarioApp?.conjunto_id]);

    const finalizarIngresoConQR = async (rawValue) => {
        const parsed = parseQRCode(rawValue);
        if (!parsed || !modalIngreso.visita) {
            toast.error('QR inválido');
            return;
        }

        const { visita_id, qr_code } = parsed;
        const visitaObjetivo = modalIngreso.visita;

        if (visita_id && visita_id !== visitaObjetivo.id) {
            toast.error('El QR no corresponde a esta visita');
            return;
        }

        if (qr_code && visitaObjetivo.qr_code && qr_code !== visitaObjetivo.qr_code) {
            toast.error('QR no coincide con la visita seleccionada');
            return;
        }

        const timestamp = toBogotaTimestamp();
        const { error } = await supabase
            .from('registro_visitas')
            .update({ estado: 'ingresado', hora_ingreso: timestamp })
            .eq('id', visitaObjetivo.id);

        if (error) {
            toast.error('No fue posible registrar el ingreso');
            return;
        }

        setVisitas((prev) => prev.map((v) => (v.id === visitaObjetivo.id ? { ...v, estado: 'ingresado', hora_ingreso: timestamp } : v)));
        await registrarBitacora({
            usuarioApp,
            visitaId: visitaObjetivo.id,
            accion: 'dar_ingreso_qr_desde_panel',
            detalle: 'Ingreso validado desde modal de QR en panel vigilancia'
        });
        setModalIngreso({ open: false, visita: null, manualQR: '' });
        toast.success('Ingreso registrado por QR');
    };

    const registrarSalida = async (id) => {
        const timestamp = toBogotaTimestamp();
        const { error } = await supabase.from('registro_visitas').update({ estado: 'salido', hora_salida: timestamp }).eq('id', id);

        if (error) {
            toast.error('Error al registrar salida');
            return;
        }

        setVisitas((prev) => prev.map((v) => (v.id === id ? { ...v, estado: 'salido', hora_salida: timestamp } : v)));
        await registrarBitacora({ usuarioApp, visitaId: id, accion: 'registrar_salida', detalle: 'Salida registrada desde panel vigilancia' });
        toast.success('Salida registrada');
    };

    const filtradas = useMemo(() => {
        const term = busqueda.trim().toLowerCase();
        const hoy = toDateOnly();

        return visitas.filter((v) => {
            const matchBusq = !term
                || v.nombre_visitante?.toLowerCase().includes(term)
                || String(v.documento || '').toLowerCase().includes(term)
                || String(v.placa || '').toLowerCase().includes(term);

            if (!matchBusq) return false;

            if (vista === 'pendientes') return v.estado_normalizado === 'pendiente';
            if (vista === 'ingresadas') return v.estado_normalizado === 'ingresado';
            if (vista === 'hoy') return v.fecha_visita === hoy;
            if (vista === 'finalizadas') return v.estado_normalizado === 'salido';
            return true;
        });
    }, [visitas, busqueda, vista]);
    const PAGE_SIZE = 8;
    const totalPaginas = Math.max(1, Math.ceil(filtradas.length / PAGE_SIZE));
    const paginaActual = Math.min(pagina, totalPaginas);
    const filtradasPaginadas = filtradas.slice((paginaActual - 1) * PAGE_SIZE, paginaActual * PAGE_SIZE);

    const resumen = {
        pendientes: visitas.filter((v) => v.estado_normalizado === 'pendiente').length,
        ingresadas: visitas.filter((v) => v.estado_normalizado === 'ingresado').length,
        finalizadas: visitas.filter((v) => v.estado_normalizado === 'salido').length
    };
    const sla = calcularSLA(visitas);

    return (
        <div className="bg-white rounded-xl shadow p-4 space-y-4 relative">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xl font-bold">Control Visitas 👮‍♂️</h2>
                <div className="flex gap-2 text-xs">
                    <button className={`px-3 py-1 rounded-full ${vista === 'pendientes' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100'}`} onClick={() => { setVista('pendientes'); setPagina(1); }}>Pendientes ({resumen.pendientes})</button>
                    <button className={`px-3 py-1 rounded-full ${vista === 'ingresadas' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100'}`} onClick={() => { setVista('ingresadas'); setPagina(1); }}>En curso ({resumen.ingresadas})</button>
                    <button className={`px-3 py-1 rounded-full ${vista === 'hoy' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100'}`} onClick={() => { setVista('hoy'); setPagina(1); }}>Hoy</button>
                    <button className={`px-3 py-1 rounded-full ${vista === 'finalizadas' ? 'bg-green-100 text-green-700' : 'bg-gray-100'}`} onClick={() => { setVista('finalizadas'); setPagina(1); }}>Finalizadas</button>
                </div>
            </div>

            <div className="grid md:grid-cols-4 gap-2 text-sm">
                <div className="rounded-lg bg-indigo-50 px-3 py-2"><b>SLA promedio:</b> {sla.promedioMinutos} min</div>
                <div className="rounded-lg bg-red-50 px-3 py-2"><b>Demoras &gt;15m:</b> {sla.demoras}</div>
                <div className="rounded-lg bg-orange-50 px-3 py-2"><b>Offline pendiente:</b> {offlinePendientes}</div>
                <button className="rounded-lg border px-3 py-2 hover:bg-gray-50" onClick={async () => {
                    const result = await syncOfflineQueue(usuarioApp);
                    const cola = getOfflineQueue();
                    setOfflinePendientes(Array.isArray(cola) ? cola.length : 0);
                    toast.success(`Sincronizados ${result.processed}, fallidos ${result.failed}`);
                }}>Sincronizar contingencia</button>
            </div>

            <div className="grid md:grid-cols-5 gap-2 text-xs">
                <div className="rounded-lg bg-slate-100 px-3 py-2"><b>Incidentes hoy:</b> {seguridad.incidentesHoy}</div>
                <div className="rounded-lg bg-slate-100 px-3 py-2"><b>Paquetes pendientes:</b> {seguridad.paquetesPendientes}</div>
                <div className="rounded-lg bg-slate-100 px-3 py-2"><b>Turno mañana:</b> {seguridad.porTurno.mañana}</div>
                <div className="rounded-lg bg-slate-100 px-3 py-2"><b>Turno tarde:</b> {seguridad.porTurno.tarde}</div>
                <div className="rounded-lg bg-slate-100 px-3 py-2"><b>Turno noche:</b> {seguridad.porTurno.noche}</div>
            </div>

            <input
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="Buscar por nombre, documento o placa"
                value={busqueda}
                onChange={(e) => {
                    setBusqueda(e.target.value);
                    setPagina(1);
                }}
            />

            {loading && <p className="text-sm text-gray-500">Cargando visitas...</p>}
            {!loading && filtradas.length === 0 && <p className="text-sm text-gray-500">No hay visitas para esta vista.</p>}

            <div className="space-y-3">
                {filtradasPaginadas.map((v) => (
                    <div key={v.id} className="border rounded-xl p-3">
                        <div className="flex flex-col md:flex-row md:justify-between gap-2">
                            <div className="space-y-1 text-sm">
                                <p><b>Visitante:</b> {v.nombre_visitante}</p>
                                <p><b>Documento:</b> {v.documento}</p>
                                <p><b>Fecha visita:</b> {v.fecha_visita}</p>
                                <p><b>Placa:</b> {v.placa || 'No registra'}</p>
                            </div>
                            <div className="space-y-1 text-sm md:text-right">
                                <p><b>Estado:</b> <span className={v.estado_normalizado === 'pendiente' ? 'text-amber-600 font-semibold' : v.estado_normalizado === 'ingresado' ? 'text-blue-600 font-semibold' : 'text-green-600 font-semibold'}>{v.estado}</span></p>
                                {v.hora_ingreso && <p className="text-blue-600">⏱ Ingreso: {v.hora_ingreso}</p>}
                                {v.hora_salida && <p className="text-green-600">✅ Salida: {v.hora_salida}</p>}
                            </div>
                        </div>
                        <div className="mt-3 flex gap-2">
                            {v.estado_normalizado === 'pendiente' && (
                                <button className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700" onClick={() => setModalIngreso({ open: true, visita: v, manualQR: '' })}>
                                    Validar QR e ingresar
                                </button>
                            )}
                            {v.estado_normalizado === 'ingresado' && (
                                <button className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700" onClick={() => registrarSalida(v.id)}>
                                    Registrar salida
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {filtradas.length > 0 && (
                <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500">Página {paginaActual} de {totalPaginas}</p>
                    <div className="flex gap-2">
                        <button
                            className="px-3 py-1 border rounded text-sm disabled:opacity-40"
                            disabled={paginaActual === 1}
                            onClick={() => setPagina((p) => Math.max(1, p - 1))}
                        >
                            Anterior
                        </button>
                        <button
                            className="px-3 py-1 border rounded text-sm disabled:opacity-40"
                            disabled={paginaActual === totalPaginas}
                            onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                        >
                            Siguiente
                        </button>
                    </div>
                </div>
            )}

            {resumen.pendientes > 0 && vista !== 'pendientes' && (
                <button
                    className="fixed bottom-8 right-8 px-4 py-2 rounded-full bg-amber-500 text-white shadow-lg"
                    onClick={() => { setVista('pendientes'); setPagina(1); }}
                >
                    🔔 Ver pendientes ({resumen.pendientes})
                </button>
            )}

            {modalIngreso.open && modalIngreso.visita && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-4 space-y-3 max-h-[92vh] overflow-y-auto">
                        <h3 className="font-semibold text-lg">Validar QR para ingreso</h3>
                        <p className="text-sm text-gray-600">
                            Visitante: <b>{modalIngreso.visita.nombre_visitante}</b> · Doc: <b>{modalIngreso.visita.documento}</b>
                        </p>

                        <div className="rounded-lg overflow-hidden border h-64">
                            <Scanner
                                constraints={{ facingMode: 'environment' }}
                                styles={{ container: { width: '100%', height: '100%' }, video: { width: '100%', height: '100%', objectFit: 'cover' } }}
                                onScan={(result) => {
                                    if (result?.[0]?.rawValue) {
                                        finalizarIngresoConQR(result[0].rawValue);
                                    }
                                }}
                            />
                        </div>

                        <div className="text-xs text-gray-500">Si la cámara falla, pega el QR manualmente:</div>
                        <input
                            className="w-full border rounded-lg px-3 py-2 text-sm"
                            value={modalIngreso.manualQR}
                            onChange={(e) => setModalIngreso((prev) => ({ ...prev, manualQR: e.target.value }))}
                            placeholder='{"visita_id":"..."} o código QR'
                        />

                        <div className="flex justify-end gap-2">
                            <button className="px-3 py-2 rounded-lg border" onClick={() => setModalIngreso({ open: false, visita: null, manualQR: '' })}>
                                Cerrar
                            </button>
                            <button
                                className="px-3 py-2 rounded-lg bg-blue-600 text-white"
                                onClick={() => finalizarIngresoConQR(modalIngreso.manualQR)}
                            >
                                Validar manual
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}