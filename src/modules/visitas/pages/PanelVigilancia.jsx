import { useEffect, useMemo, useState } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import toast from 'react-hot-toast';
import { supabase } from '../../../services/supabaseClient';
import { calcularSLA, getOfflineQueue, obtenerSeguridadConsolidada, registrarBitacora, syncOfflineQueue } from '../services/porteriaService';

const toBogotaTimestamp = () => new Date().toLocaleString('sv-SE', { timeZone: 'America/Bogota' }).replace(' ', ' ');
const toDateOnly = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Bogota' });
const normalizeEstado = (estado) => {
    const value = String(estado || '').trim().toLowerCase();
    if (value.includes('pend')) return 'pendiente';
    if (value.includes('ingres') || value.includes('curso')) return 'ingresado';
    if (value.includes('sal') || value.includes('final')) return 'salido';
    return value;
};
const normalizeFecha = (fecha) => String(fecha || '').slice(0, 10);
const formatDateLabel = (value) => {
    if (!value) return 'Sin fecha';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: 'short', year: 'numeric' });
};
const formatDateTimeLabel = (value) => {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleString('es-CO', {
        timeZone: 'America/Bogota',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
};
const formatUbicacion = (torre, apartamento) => {
    if (!torre || !apartamento) return 'Ubicación no disponible';
    const torreLabel = /^torre\b/i.test(String(torre).trim()) ? String(torre).trim() : `Torre ${String(torre).trim()}`;
    return `${torreLabel} y Apto: ${apartamento}`;
};
const minutesDiff = (value) => {
    if (!value) return 0;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 0;
    return Math.max(0, Math.floor((Date.now() - parsed.getTime()) / 60000));
};

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
            let conjuntoId = usuarioApp?.conjunto_id;
            if (!conjuntoId) {
                const { data: authData } = await supabase.auth.getUser();
                const { data: usuarioDb } = await supabase
                    .from('usuarios_app')
                    .select('conjunto_id')
                    .eq('id', authData?.user?.id)
                    .single();
                conjuntoId = usuarioDb?.conjunto_id || null;
            }
            if (!conjuntoId) return;
            setLoading(true);

            const [registroResp, seguridadResp] = await Promise.all([
                supabase
                    .from('registro_visitas')
                    .select(`
                        id, visitante_id, fecha_visita, estado, qr_code, hora_ingreso, hora_salida, created_at, apartamento_id,
                        apartamentos (
                            id,
                            numero,
                            torres (
                                nombre
                            )
                        )
                    `)
                    .eq('conjunto_id', conjuntoId)
                    .order('fecha_visita', { ascending: false }),
                obtenerSeguridadConsolidada(conjuntoId)
            ]);

            if (!mounted) return;
            if (registroResp.error) {
                toast.error('No se pudo cargar el registro de visitas');
                setLoading(false);
                return;
            }

            const registros = registroResp.data || [];
            const { data: residentes } = await supabase
                .from('residentes')
                .select('id')
                .eq('conjunto_id', conjuntoId);
            const idsResidentes = (residentes || []).map((r) => r.id);
            const { data: visitantesConjunto } = idsResidentes.length
                ? await supabase
                    .from('visitantes')
                    .select('id')
                    .in('residente_id', idsResidentes)
                : { data: [] };

            const idsVisitantesConjunto = (visitantesConjunto || []).map((v) => v.id);
            const { data: registrosFallback } = idsVisitantesConjunto.length
                ? await supabase
                    .from('registro_visitas')
                    .select(`
                        id, visitante_id, fecha_visita, estado, qr_code, hora_ingreso, hora_salida, created_at, apartamento_id,
                        apartamentos (
                            id,
                            numero,
                            torres (
                                nombre
                            )
                        )
                    `)
                    .in('visitante_id', idsVisitantesConjunto)
                    .order('fecha_visita', { ascending: false })
                : { data: [] };

            const dedupe = new Map();
            [...registros, ...(registrosFallback || [])].forEach((row) => {
                if (row?.id) dedupe.set(row.id, row);
            });
            const registrosUsables = Array.from(dedupe.values());
            const visitanteIds = [...new Set(registrosUsables.map((r) => r.visitante_id).filter(Boolean))];
            const { data: visitantesData } = visitanteIds.length
                ? await supabase.from('visitantes').select('id, nombre, documento, placa').in('id', visitanteIds)
                : { data: [] };
            const visitantesMap = new Map((visitantesData || []).map((v) => [v.id, v]));

            const mappedRegistro = registrosUsables.map((v) => {
                const visitante = visitantesMap.get(v.visitante_id);
                return {
                    id: v.id,
                    fecha_visita: normalizeFecha(v.fecha_visita),
                    estado: v.estado,
                    estado_normalizado: normalizeEstado(v.estado),
                    qr_code: v.qr_code,
                    hora_ingreso: v.hora_ingreso,
                    hora_salida: v.hora_salida,
                    created_at: v.created_at,
                    nombre_visitante: visitante?.nombre,
                    documento: visitante?.documento,
                    placa: visitante?.placa,
                    torre: v.apartamentos?.torres?.nombre || null,
                    apartamento: v.apartamentos?.numero || null,
                    ubicacion: formatUbicacion(v.apartamentos?.torres?.nombre, v.apartamentos?.numero)
                };
            });
            setVisitas(mappedRegistro);
            setSeguridad(seguridadResp);
            const cola = getOfflineQueue();
            setOfflinePendientes(Array.isArray(cola) ? cola.length : 0);
            setLoading(false);
        };

        cargar();

        const channel = supabase
            .channel(`registro-visitas-vigilancia-${usuarioApp?.conjunto_id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'registro_visitas' }, cargar)
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

        setVisitas((prev) => prev.map((v) => (v.id === visitaObjetivo.id ? { ...v, estado: 'ingresado', estado_normalizado: 'ingresado', hora_ingreso: timestamp } : v)));
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

        setVisitas((prev) => prev.map((v) => (v.id === id ? { ...v, estado: 'salido', estado_normalizado: 'salido', hora_salida: timestamp } : v)));
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
                || String(v.placa || '').toLowerCase().includes(term)
                || String(v.ubicacion || '').toLowerCase().includes(term);

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
    const alertas = useMemo(() => {
        const pendientesCriticos = visitas.filter((v) => v.estado_normalizado === 'pendiente' && minutesDiff(v.created_at) >= 30).length;
        const enCursoProlongados = visitas.filter((v) => v.estado_normalizado === 'ingresado' && !v.hora_salida && minutesDiff(v.hora_ingreso || v.created_at) >= 180).length;
        return { pendientesCriticos, enCursoProlongados };
    }, [visitas]);
    const sla = calcularSLA(visitas);

    return (
        <div className="app-surface-primary rounded-2xl shadow p-5 space-y-4 relative">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xl font-bold">Control Visitas 👮‍♂️</h2>
                <div className="flex gap-2 text-xs">
                    <button className={`px-3 py-1 rounded-full border ${vista === 'pendientes' ? 'bg-[#F59E0B1F] text-state-warning border-state-warning/40' : 'bg-app-bg border-app-border text-app-text-secondary'}`} onClick={() => { setVista('pendientes'); setPagina(1); }}>Pendientes ({resumen.pendientes})</button>
                    <button className={`px-3 py-1 rounded-full border ${vista === 'ingresadas' ? 'bg-[#38BDF826] text-state-info border-state-info/40' : 'bg-app-bg border-app-border text-app-text-secondary'}`} onClick={() => { setVista('ingresadas'); setPagina(1); }}>En curso ({resumen.ingresadas})</button>
                    <button className={`px-3 py-1 rounded-full border ${vista === 'hoy' ? 'bg-brand-primary/20 text-brand-secondary border-brand-primary/40' : 'bg-app-bg border-app-border text-app-text-secondary'}`} onClick={() => { setVista('hoy'); setPagina(1); }}>Hoy</button>
                    <button className={`px-3 py-1 rounded-full border ${vista === 'finalizadas' ? 'bg-[#22C55E26] text-state-success border-state-success/40' : 'bg-app-bg border-app-border text-app-text-secondary'}`} onClick={() => { setVista('finalizadas'); setPagina(1); }}>Finalizadas</button>
                </div>
            </div>

            <div className="app-surface-muted p-3 grid md:grid-cols-4 gap-2 text-sm">
                <div className="rounded-lg app-surface-muted px-3 py-2"><b>SLA promedio:</b> {sla.promedioMinutos} min</div>
                <div className="rounded-lg app-surface-muted px-3 py-2"><b>Demoras &gt;15m:</b> {sla.demoras}</div>
                <div className="rounded-lg app-surface-muted px-3 py-2"><b>Offline pendiente:</b> {offlinePendientes}</div>
                <button className="rounded-lg app-btn-ghost text-xs" onClick={async () => {
                    const result = await syncOfflineQueue(usuarioApp);
                    const cola = getOfflineQueue();
                    setOfflinePendientes(Array.isArray(cola) ? cola.length : 0);
                    toast.success(`Sincronizados ${result.processed}, fallidos ${result.failed}`);
                }}>Sincronizar contingencia</button>
            </div>

            <div className="grid md:grid-cols-2 gap-2 text-sm">
                <div className="app-surface-muted p-3 border border-state-warning/30">
                    <p className="font-semibold text-state-warning">⚠️ Pendientes críticos (&gt;30 min): {alertas.pendientesCriticos}</p>
                    <p className="text-xs text-app-text-secondary mt-1">Priorizar validación QR para reducir espera en portería.</p>
                </div>
                <div className="app-surface-muted p-3 border border-state-info/30">
                    <p className="font-semibold text-state-info">🕒 En curso prolongadas (&gt;180 min): {alertas.enCursoProlongados}</p>
                    <p className="text-xs text-app-text-secondary mt-1">Verificar salidas pendientes y registrar cierre operativo.</p>
                </div>
            </div>

            <div className="grid md:grid-cols-5 gap-2 text-xs app-surface-muted p-3">
                <div className="rounded-lg border border-app-border bg-app-bg px-3 py-2"><b>Incidentes hoy:</b> {seguridad.incidentesHoy}</div>
                <div className="rounded-lg border border-app-border bg-app-bg px-3 py-2"><b>Paquetes pendientes:</b> {seguridad.paquetesPendientes}</div>
                <div className="rounded-lg border border-app-border bg-app-bg px-3 py-2"><b>Turno mañana:</b> {seguridad.porTurno.mañana}</div>
                <div className="rounded-lg border border-app-border bg-app-bg px-3 py-2"><b>Turno tarde:</b> {seguridad.porTurno.tarde}</div>
                <div className="rounded-lg border border-app-border bg-app-bg px-3 py-2"><b>Turno noche:</b> {seguridad.porTurno.noche}</div>
            </div>

            <input
                className="app-input"
                placeholder="Buscar por nombre, documento, placa o torre/apto"
                value={busqueda}
                onChange={(e) => {
                    setBusqueda(e.target.value);
                    setPagina(1);
                }}
            />

            {loading && <p className="text-sm text-app-text-secondary">Cargando visitas...</p>}
            {!loading && filtradas.length === 0 && <p className="text-sm text-app-text-secondary">No hay visitas para esta vista.</p>}

            <div className="space-y-3">
                {filtradasPaginadas.map((v) => (
                    <div key={v.id} className={`app-surface-muted p-4 border rounded-xl ${v.estado_normalizado === 'pendiente' && minutesDiff(v.created_at) >= 30 ? 'border-state-warning/60' : 'border-app-border/70'}`}>
                        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-3">
                            <div className="space-y-2 min-w-0">
                                <p className="text-base font-bold text-app-text-primary truncate">{v.nombre_visitante || 'Visitante sin nombre'}</p>
                                <div className="flex flex-wrap gap-2 text-xs">
                                    <span className="px-2 py-1 rounded-full border border-brand-primary/40 bg-brand-primary/15 text-brand-secondary">
                                        {v.ubicacion}
                                    </span>
                                    <span className="px-2 py-1 rounded-full border border-app-border bg-app-bg text-app-text-secondary">
                                        Documento: {v.documento || 'No registra'}
                                    </span>
                                    <span className="px-2 py-1 rounded-full border border-app-border bg-app-bg text-app-text-secondary">
                                        Placa: {v.placa || 'No registra'}
                                    </span>
                                </div>
                                <div className="grid sm:grid-cols-2 gap-2 text-xs text-app-text-secondary">
                                    <p><b>Fecha visita:</b> {formatDateLabel(v.fecha_visita)}</p>
                                    <p><b>Creado:</b> {toDateOnly() === v.fecha_visita ? 'Hoy' : formatDateLabel(v.created_at)} · Espera: {minutesDiff(v.created_at)} min</p>
                                    <p><b>Ingreso:</b> {formatDateTimeLabel(v.hora_ingreso)}</p>
                                    <p><b>Salida:</b> {formatDateTimeLabel(v.hora_salida)}</p>
                                </div>
                            </div>
                            <div className="space-y-2 text-sm md:text-right shrink-0">
                                <span className={`inline-flex px-2.5 py-1 rounded-full border text-xs font-semibold ${v.estado_normalizado === 'pendiente' ? 'text-state-warning border-state-warning/40 bg-state-warning/10' : v.estado_normalizado === 'ingresado' ? 'text-state-info border-state-info/40 bg-state-info/10' : 'text-state-success border-state-success/40 bg-state-success/10'}`}>
                                    Estado: {v.estado}
                                </span>
                                {v.estado_normalizado === 'pendiente' && minutesDiff(v.created_at) >= 30 && <p className="text-state-warning font-semibold text-xs">⚠️ Atención inmediata</p>}
                            </div>
                        </div>
                        <div className="mt-3 flex gap-2">
                            {v.estado_normalizado === 'pendiente' && (
                                <button className="app-btn-primary text-xs" onClick={() => setModalIngreso({ open: true, visita: v, manualQR: '' })}>
                                    Validar QR e ingresar
                                </button>
                            )}
                            {v.estado_normalizado === 'ingresado' && (
                                <button className="app-btn-secondary text-xs" onClick={() => registrarSalida(v.id)}>
                                    Registrar salida
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {filtradas.length > 0 && (
                <div className="flex items-center justify-between">
                    <p className="text-xs text-app-text-secondary">Página {paginaActual} de {totalPaginas}</p>
                    <div className="flex gap-2">
                        <button
                            className="app-btn-ghost text-xs disabled:opacity-40"
                            disabled={paginaActual === 1}
                            onClick={() => setPagina((p) => Math.max(1, p - 1))}
                        >
                            Anterior
                        </button>
                        <button
                            className="app-btn-ghost text-xs disabled:opacity-40"
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
                    className="fixed bottom-8 right-8 app-btn-secondary text-xs"
                    onClick={() => { setVista('pendientes'); setPagina(1); }}
                >
                    🔔 Ver pendientes ({resumen.pendientes})
                </button>
            )}

            {modalIngreso.open && modalIngreso.visita && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-app-bg-alt rounded-xl shadow-xl w-full max-w-md p-4 space-y-3 max-h-[92vh] overflow-y-auto">
                        <h3 className="font-semibold text-lg">Validar QR para ingreso</h3>
                        <p className="text-sm text-app-text-secondary">
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

                        <div className="text-xs text-app-text-secondary">Si la cámara falla, pega el QR manualmente:</div>
                        <input
                            className="app-input"
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
