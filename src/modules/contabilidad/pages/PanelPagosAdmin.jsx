import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../services/supabaseClient';
import { getTipoPagoLabel } from '../utils/pagosLabels';
import { ESTADOS_PAGO, getDiasMoraPago, getEstadoPagoKey, getEstadoPagoUi, obtenerEstadoFinancieroReal } from '../utils/pagosEstados';
import { formatFechaBogota } from '../../../utils/dateFormatters';

export default function PanelPagosAdmin({ usuarioApp }) {
    const PREVIEW_LIMIT = 3;
    const MODAL_PAGE_SIZE = 8;
    const CAUSALES_ECONOMICAS = ['no asistió', 'daño', 'tiempo excedido', 'depósito retenido'];
    const ESTADOS_BANDEJA = [
        { key: ESTADOS_PAGO.VENCIDO, label: 'Vencidos', badge: 'app-badge-error', titleClass: 'text-state-error' },
        { key: ESTADOS_PAGO.EN_REVISION, label: 'En revisión', badge: 'app-badge-info', titleClass: 'text-brand-secondary' },
        { key: ESTADOS_PAGO.RECHAZADO, label: 'Rechazados', badge: 'app-badge-error', titleClass: 'text-state-error' },
        { key: ESTADOS_PAGO.PENDIENTE, label: 'Pendientes sin soporte', badge: 'app-badge-warning', titleClass: 'text-state-warning' },
        { key: ESTADOS_PAGO.PAGADO, label: 'Aprobados', badge: 'app-badge-success', titleClass: 'text-state-success' }
    ];
    const [pagos, setPagos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filtroTorre, setFiltroTorre] = useState('');
    const [busquedaApto, setBusquedaApto] = useState('');
    const [bandejaActiva, setBandejaActiva] = useState(ESTADOS_PAGO.VENCIDO);
    const [panelAmpliadoOpen, setPanelAmpliadoOpen] = useState(false);
    const [busquedaPanel, setBusquedaPanel] = useState('');
    const [paginaPanel, setPaginaPanel] = useState(1);
    const [causalDraft, setCausalDraft] = useState({});
    const [impactoDraft, setImpactoDraft] = useState({});
    const conjuntoId = usuarioApp?.conjunto_id;

    const cargarPagos = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('pagos')
            .select(`
        *,
        tipo_pago,
        residentes (
          id,
          usuario_id,
          apartamentos (
            numero,
            torres!fk_apartamento_torre ( nombre )
          ),
          usuarios_app ( nombre )
        )
      `)
            .eq('conjunto_id', conjuntoId)
            .order('created_at', { ascending: false });

        setLoading(false);
        if (error) return;

        const pagosFormateados = (data || []).map((p) => ({
            ...p,
            nombre: p.residentes?.usuarios_app?.nombre || 'Residente',
            apartamento: p.residentes?.apartamentos?.numero || '-',
            torre: p.residentes?.apartamentos?.torres?.nombre || '-'
        }));

        setPagos(pagosFormateados);
    }, [conjuntoId]);

    useEffect(() => {
        if (!conjuntoId) return undefined;
        const timer = setTimeout(() => {
            cargarPagos();
        }, 0);
        return () => clearTimeout(timer);
    }, [conjuntoId, cargarPagos]);

    const aprobarPago = async (pago) => {
        const tieneComprobante = Boolean(String(pago?.comprobante_url || '').trim());
        if (!tieneComprobante) {
            alert('No se puede aprobar hasta que el residente adjunte comprobante');
            return;
        }

        const { error } = await supabase
            .from('pagos')
            .update({
                estado: ESTADOS_PAGO.PAGADO,
                fecha_pago: new Date().toISOString(),
                motivo_rechazo: null,
                fecha_rechazo: null,
                rechazado_por: null
            })
            .eq('id', pago.id)
            .eq('conjunto_id', conjuntoId);
        if (error) return alert('Error al aprobar pago');

        const usuarioId = pago?.residentes?.usuario_id;
        if (usuarioId) {
            await supabase.from('notificaciones').insert([{ usuario_id: usuarioId, tipo: 'pago_aprobado', titulo: 'Pago aprobado', mensaje: `Tu pago de ${pago.valor} fue aprobado` }]);
        }

        alert('✅ Pago aprobado');
        cargarPagos();
    };

    const rechazarPago = async (pago) => {
        const tieneComprobante = Boolean(String(pago?.comprobante_url || '').trim());
        if (!tieneComprobante) {
            alert('No se puede rechazar un pago sin comprobante adjunto');
            return;
        }

        const motivo = window.prompt('Motivo del rechazo para el residente');
        if (motivo === null) return;

        const motivoLimpio = motivo.trim();
        if (!motivoLimpio) {
            alert('Escribe una observación para que el residente pueda corregir el soporte.');
            return;
        }

        const { error } = await supabase
            .from('pagos')
            .update({
                estado: ESTADOS_PAGO.RECHAZADO,
                motivo_rechazo: motivoLimpio,
                fecha_rechazo: new Date().toISOString(),
                rechazado_por: usuarioApp?.id || null
            })
            .eq('id', pago.id)
            .eq('conjunto_id', conjuntoId);
        if (error) return alert('Error al rechazar comprobante');

        const usuarioId = pago?.residentes?.usuario_id;
        if (usuarioId) {
            await supabase.from('notificaciones').insert([{
                usuario_id: usuarioId,
                tipo: 'pago_rechazado',
                titulo: 'Comprobante rechazado',
                mensaje: `Tu comprobante de pago fue rechazado. Observación: ${motivoLimpio}`
            }]);
        }

        alert('Comprobante rechazado. El residente podrá reemplazarlo.');
        cargarPagos();
    };

    const torres = useMemo(() => [...new Set(pagos.map((p) => p.torre).filter(Boolean))], [pagos]);
    const pagosFiltrados = useMemo(() => pagos.filter((p) => {
        const cumpleTorre = filtroTorre ? p.torre === filtroTorre : true;
        const cumpleApto = busquedaApto ? p.apartamento?.toString().includes(busquedaApto) : true;
        return cumpleTorre && cumpleApto;
    }), [pagos, filtroTorre, busquedaApto]);

    const resumen = useMemo(() => ({
        total: pagosFiltrados.length,
        pendientes: pagosFiltrados.filter((p) => obtenerEstadoFinancieroReal(p) === ESTADOS_PAGO.PENDIENTE).length,
        vencidos: pagosFiltrados.filter((p) => obtenerEstadoFinancieroReal(p) === ESTADOS_PAGO.VENCIDO).length,
        enRevision: pagosFiltrados.filter((p) => obtenerEstadoFinancieroReal(p) === ESTADOS_PAGO.EN_REVISION).length,
        pagados: pagosFiltrados.filter((p) => obtenerEstadoFinancieroReal(p) === ESTADOS_PAGO.PAGADO).length,
        rechazados: pagosFiltrados.filter((p) => obtenerEstadoFinancieroReal(p) === ESTADOS_PAGO.RECHAZADO).length,
        cartera: pagosFiltrados
            .filter((p) => [ESTADOS_PAGO.PENDIENTE, ESTADOS_PAGO.VENCIDO, ESTADOS_PAGO.EN_REVISION, ESTADOS_PAGO.RECHAZADO].includes(obtenerEstadoFinancieroReal(p)))
            .reduce((acc, p) => acc + Number(p.valor || 0), 0)
    }), [pagosFiltrados]);
    const pagosAgrupados = useMemo(() => ({
        [ESTADOS_PAGO.VENCIDO]: pagosFiltrados.filter((p) => obtenerEstadoFinancieroReal(p) === ESTADOS_PAGO.VENCIDO)
            .sort((a, b) => getDiasMoraPago(b) - getDiasMoraPago(a)),
        [ESTADOS_PAGO.EN_REVISION]: pagosFiltrados.filter((p) => obtenerEstadoFinancieroReal(p) === ESTADOS_PAGO.EN_REVISION),
        [ESTADOS_PAGO.RECHAZADO]: pagosFiltrados.filter((p) => obtenerEstadoFinancieroReal(p) === ESTADOS_PAGO.RECHAZADO),
        [ESTADOS_PAGO.PENDIENTE]: pagosFiltrados.filter((p) => obtenerEstadoFinancieroReal(p) === ESTADOS_PAGO.PENDIENTE),
        [ESTADOS_PAGO.PAGADO]: pagosFiltrados.filter((p) => obtenerEstadoFinancieroReal(p) === ESTADOS_PAGO.PAGADO)
    }), [pagosFiltrados]);

    const renderTarjetaPago = (pago, expandida = false) => {
        const tieneComprobante = Boolean(String(pago.comprobante_url || '').trim());
        const estadoKey = getEstadoPagoKey(pago.estado);
        const estadoReal = obtenerEstadoFinancieroReal(pago);
        const estadoUi = getEstadoPagoUi(pago);
        const diasMora = getDiasMoraPago(pago);
        const esPendiente = estadoReal === ESTADOS_PAGO.PENDIENTE;
        const esVencido = estadoReal === ESTADOS_PAGO.VENCIDO;
        const esEnRevision = estadoReal === ESTADOS_PAGO.EN_REVISION;
        const esRechazado = estadoReal === ESTADOS_PAGO.RECHAZADO;
        const puedeAprobar = (esEnRevision || esPendiente || esVencido) && tieneComprobante;
        const puedeRechazar = (esEnRevision || esPendiente || esVencido) && tieneComprobante;
        const requiereComprobante = (esEnRevision || esPendiente || esVencido) && !tieneComprobante;
        const motivoRechazo = String(pago.motivo_rechazo || '').trim();
        const bordeEstado = esVencido
            ? 'border-state-error/60 shadow-[0_0_22px_rgba(239,68,68,0.14)]'
            : esEnRevision
                ? 'border-brand-secondary/45'
                : esPendiente
                    ? 'border-state-warning/35'
                    : esRechazado
                        ? 'border-state-error/35'
                        : 'border-app-border';

        return (
            <article key={pago.id} className={`rounded-xl border bg-app-bg px-4 py-3 shadow-[0_12px_30px_rgba(2,6,23,0.34)] ${bordeEstado}`}>
                <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
                    <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-base">{pago.nombre}</p>
                            <span className={`app-badge ${estadoUi.badge}`}>{estadoUi.label}</span>
                            <span className="app-badge app-badge-info">Radicado {String(pago.id || '-').slice(0, 8)}</span>
                        </div>

                        <div className="grid gap-1 text-xs text-app-text-secondary sm:grid-cols-2">
                            <p><span className="text-app-text-primary/90">Ubicación:</span> Torre {pago.torre} · Apto {pago.apartamento}</p>
                            <p><span className="text-app-text-primary/90">Concepto:</span> {pago.concepto || '-'}</p>
                            <p><span className="text-app-text-primary/90">Creación:</span> {formatFechaBogota(pago.created_at)}</p>
                            <p><span className="text-app-text-primary/90">Fecha de pago:</span> {formatFechaBogota(pago.fecha_pago)}</p>
                            <p><span className="text-app-text-primary/90">Vencimiento:</span> {formatFechaBogota(pago.fecha_vencimiento)}</p>
                            {esVencido && <p><span className="text-app-text-primary/90">Mora:</span> {diasMora} día(s)</p>}
                            <p><span className="text-app-text-primary/90">Tipo:</span> {getTipoPagoLabel(pago.tipo_pago)}</p>
                            <p><span className="text-app-text-primary/90">Comprobante:</span> {tieneComprobante ? 'Adjunto para validar' : 'Sin soporte'}</p>
                            {estadoKey === ESTADOS_PAGO.RECHAZADO && motivoRechazo && <p><span className="text-app-text-primary/90">Motivo rechazo:</span> {motivoRechazo}</p>}
                        </div>

                        {tieneComprobante && (
                            <a href={pago.comprobante_url} target="_blank" rel="noreferrer" className="inline-flex text-xs text-brand-secondary hover:text-brand-primary">
                                Ver comprobante 📄
                            </a>
                        )}
                    </div>

                    <div className="md:text-right">
                        <p className="text-[11px] uppercase tracking-wide text-app-text-secondary">Valor registrado</p>
                        <p className="font-bold text-2xl text-app-text-primary">${Number(pago.valor || 0).toLocaleString('es-CO')}</p>
                    </div>
                </div>

                {(esPendiente || esVencido || esEnRevision || esRechazado) && (
                    <div className="mt-3 space-y-2">
                        {expandida && (esPendiente || esVencido || esEnRevision) && (
                            <div className="app-surface-primary p-2 border border-brand-primary/20">
                                <p className="text-xs text-app-text-secondary mb-1">Causal económica (preparación UI)</p>
                                <div className="flex flex-wrap gap-1">
                                    {CAUSALES_ECONOMICAS.map((causal) => (
                                        <button
                                            key={causal}
                                            type="button"
                                            onClick={() => setCausalDraft((prev) => ({ ...prev, [pago.id]: causal }))}
                                            className={`app-btn text-[11px] ${causalDraft[pago.id] === causal ? 'app-btn-secondary' : 'app-btn-ghost'}`}
                                        >
                                            {causal}
                                        </button>
                                    ))}
                                </div>
                                <input
                                    className="app-input mt-2 text-xs"
                                    placeholder="Impacto económico estimado (placeholder)"
                                    value={impactoDraft[pago.id] || ''}
                                    onChange={(e) => setImpactoDraft((prev) => ({ ...prev, [pago.id]: e.target.value }))}
                                />
                                <p className="text-[11px] text-app-text-secondary mt-1">Referencia visual, aún sin persistencia backend.</p>
                            </div>
                        )}
                        <div className="space-y-1 text-right">
                            {esVencido && (
                                <p className="text-[11px] text-state-error">Pago vencido: {diasMora} día(s) de mora administrativa.</p>
                            )}
                            {requiereComprobante && (
                                <p className="text-[11px] text-state-warning">Pendiente sin soporte: no se puede aprobar hasta que el residente adjunte comprobante.</p>
                            )}
                            {esEnRevision && tieneComprobante && (
                                <p className="text-[11px] text-brand-secondary">Comprobante en revisión: listo para validación administrativa.</p>
                            )}
                            {estadoKey === ESTADOS_PAGO.RECHAZADO && motivoRechazo && (
                                <p className="text-[11px] text-state-error">Rechazado: {motivoRechazo}</p>
                            )}
                            {estadoKey !== ESTADOS_PAGO.RECHAZADO && (
                                <div className="flex flex-wrap justify-end gap-2">
                                    <button
                                        className="app-btn-secondary text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                                        onClick={() => aprobarPago(pago)}
                                        disabled={!puedeAprobar}
                                        title={!puedeAprobar ? 'Pendiente de comprobante' : 'Aprobar pago'}
                                    >
                                        Aprobar pago
                                    </button>
                                    <button
                                        className="app-btn-ghost text-xs text-state-error disabled:opacity-50 disabled:cursor-not-allowed"
                                        onClick={() => rechazarPago(pago)}
                                        disabled={!puedeRechazar}
                                        title={!puedeRechazar ? 'Pendiente de comprobante' : 'Rechazar comprobante'}
                                    >
                                        Rechazar comprobante
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </article>
        );
    };

    const pagosBandejaActiva = useMemo(() => pagosAgrupados[bandejaActiva] || [], [pagosAgrupados, bandejaActiva]);
    const bandejaSeleccionada = ESTADOS_BANDEJA.find((b) => b.key === bandejaActiva) || ESTADOS_BANDEJA[0];
    const pagosBandejaPreview = pagosBandejaActiva.slice(0, PREVIEW_LIMIT);
    const textoBotonVerTodos = `Ver todos los ${bandejaSeleccionada.label.toLowerCase()}`;
    const pagosPanelFiltrados = useMemo(() => {
        const termino = busquedaPanel.trim().toLowerCase();
        if (!termino) return pagosBandejaActiva;
        return pagosBandejaActiva.filter((p) => {
            const radicado = String(p.id || '').slice(0, 8).toLowerCase();
            const nombre = String(p.nombre || '').toLowerCase();
            const apto = String(p.apartamento || '').toLowerCase();
            const concepto = String(p.concepto || '').toLowerCase();
            return radicado.includes(termino) || nombre.includes(termino) || apto.includes(termino) || concepto.includes(termino);
        });
    }, [pagosBandejaActiva, busquedaPanel]);
    const totalPaginasPanel = Math.max(1, Math.ceil(pagosPanelFiltrados.length / MODAL_PAGE_SIZE));
    const paginaPanelActual = Math.min(paginaPanel, totalPaginasPanel);
    const pagosPanelPaginados = useMemo(() => {
        const desde = (paginaPanelActual - 1) * MODAL_PAGE_SIZE;
        return pagosPanelFiltrados.slice(desde, desde + MODAL_PAGE_SIZE);
    }, [pagosPanelFiltrados, paginaPanelActual]);

    return (
        <div className="app-surface-primary p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="text-xl font-bold">Gestión de pagos</h3>
                    <p className="text-sm text-app-text-secondary">Resumen general de cartera y bandejas operativas para aprobación administrativa.</p>
                </div>
                <button className="app-btn-ghost text-xs" onClick={cargarPagos}>Actualizar panel</button>
            </div>

            <div>
                <p className="text-xs uppercase tracking-wide text-app-text-secondary mb-2">Resumen general</p>
                <div className="grid grid-cols-2 md:grid-cols-7 gap-2 text-xs">
                    <div className="rounded-xl border border-app-border bg-app-bg px-3 py-3"><span className="text-app-text-secondary">Registros</span><p className="text-xl font-semibold mt-1">{resumen.total}</p></div>
                    <div className="rounded-xl border border-state-warning/35 bg-app-bg px-3 py-3"><span className="text-app-text-secondary">Sin soporte</span><p className="text-xl font-semibold mt-1 text-state-warning">{resumen.pendientes}</p></div>
                    <div className="rounded-xl border border-state-error/45 bg-state-error/10 px-3 py-3"><span className="text-app-text-secondary">Vencidos</span><p className="text-xl font-semibold mt-1 text-state-error">{resumen.vencidos}</p></div>
                    <div className="rounded-xl border border-brand-secondary/35 bg-app-bg px-3 py-3"><span className="text-app-text-secondary">En revisión</span><p className="text-xl font-semibold mt-1 text-brand-secondary">{resumen.enRevision}</p></div>
                    <div className="rounded-xl border border-state-success/35 bg-app-bg px-3 py-3"><span className="text-app-text-secondary">Pagados</span><p className="text-xl font-semibold mt-1 text-state-success">{resumen.pagados}</p></div>
                    <div className="rounded-xl border border-state-error/35 bg-app-bg px-3 py-3"><span className="text-app-text-secondary">Rechazados</span><p className="text-xl font-semibold mt-1 text-state-error">{resumen.rechazados}</p></div>
                    <div className="rounded-xl border border-brand-primary/35 bg-app-bg px-3 py-3"><span className="text-app-text-secondary">Cartera total</span><p className="text-xl font-semibold mt-1">${resumen.cartera.toLocaleString('es-CO')}</p></div>
                </div>
            </div>

            <div className="app-surface-muted p-3 grid md:grid-cols-3 gap-2">
                <select className="app-input" value={filtroTorre} onChange={(e) => setFiltroTorre(e.target.value)}>
                    <option value="">Todas las torres</option>
                    {torres.map((torre) => <option key={torre} value={torre}>{torre}</option>)}
                </select>
                <input className="app-input" placeholder="Buscar apto" value={busquedaApto} onChange={(e) => setBusquedaApto(e.target.value)} />
                <div className="text-xs text-app-text-secondary flex items-center">Aplicando filtros en tiempo real</div>
            </div>

            {loading && <p className="text-sm text-app-text-secondary">Cargando pagos...</p>}
            {!loading && pagosFiltrados.length === 0 && <p className="text-sm text-app-text-secondary">Sin resultados para filtros actuales.</p>}

            <div className="space-y-3">
                <div className="app-surface-muted p-2 flex flex-wrap gap-2">
                    {ESTADOS_BANDEJA.map((bandeja) => (
                        <button
                            key={bandeja.key}
                            type="button"
                            onClick={() => {
                                setBandejaActiva(bandeja.key);
                                setPaginaPanel(1);
                                setBusquedaPanel('');
                            }}
                            className={`app-btn text-xs ${bandejaActiva === bandeja.key ? 'app-btn-secondary' : 'app-btn-ghost'}`}
                        >
                            {bandeja.label}
                            <span className={`ml-2 app-badge ${bandeja.badge}`}>{pagosAgrupados[bandeja.key]?.length || 0}</span>
                        </button>
                    ))}
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <h4 className={`font-semibold ${bandejaSeleccionada.titleClass}`}>Bandeja: {bandejaSeleccionada.label}</h4>
                        <span className="text-xs text-app-text-secondary">{pagosBandejaActiva.length} registros</span>
                    </div>
                    {pagosBandejaActiva.length === 0 && <p className="text-xs text-app-text-secondary">Sin pagos para esta bandeja.</p>}
                    <div className="space-y-2">
                        {pagosBandejaPreview.map((pago) => renderTarjetaPago(pago, false))}
                    </div>
                    {pagosBandejaActiva.length > PREVIEW_LIMIT && (
                        <button
                            type="button"
                            className="app-btn-ghost text-xs"
                            onClick={() => {
                                setBusquedaPanel('');
                                setPaginaPanel(1);
                                setPanelAmpliadoOpen(true);
                            }}
                        >
                            {textoBotonVerTodos} ({pagosBandejaActiva.length})
                        </button>
                    )}
                </div>
            </div>

            {panelAmpliadoOpen && (
                <div className="fixed inset-0 bg-app-bg/85 backdrop-blur-sm z-50 p-4 flex items-center justify-center">
                    <div className="app-surface-primary w-full max-w-5xl p-4 space-y-4 border border-brand-primary/20 shadow-2xl">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h4 className={`font-semibold text-lg ${bandejaSeleccionada.titleClass}`}>Panel ampliado: {bandejaSeleccionada.label}</h4>
                                <p className="text-xs text-app-text-secondary">{pagosBandejaActiva.length} registros en la bandeja activa</p>
                            </div>
                            <button type="button" className="app-btn-ghost text-xs" onClick={() => setPanelAmpliadoOpen(false)}>
                                Cerrar
                            </button>
                        </div>

                        <div className="app-surface-muted p-2 md:grid md:grid-cols-[1fr_auto] gap-2">
                            <input
                                className="app-input"
                                placeholder="Buscar por residente, apto, concepto o radicado"
                                value={busquedaPanel}
                                onChange={(e) => {
                                    setBusquedaPanel(e.target.value);
                                    setPaginaPanel(1);
                                }}
                            />
                            <div className="text-xs text-app-text-secondary flex items-center justify-end">
                                {pagosPanelFiltrados.length} resultado(s)
                            </div>
                        </div>

                        <div className="space-y-2 max-h-[68vh] overflow-y-auto pr-1 app-scrollbar">
                            {pagosPanelPaginados.length === 0 && <p className="text-xs text-app-text-secondary">Sin resultados en esta búsqueda.</p>}
                            {pagosPanelPaginados.map((pago) => renderTarjetaPago(pago, true))}
                        </div>

                        {pagosPanelFiltrados.length > MODAL_PAGE_SIZE && (
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-app-text-secondary">
                                    Página {paginaPanelActual} de {totalPaginasPanel}
                                </span>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        className="app-btn-ghost text-xs disabled:opacity-40"
                                        disabled={paginaPanelActual === 1}
                                        onClick={() => setPaginaPanel((prev) => Math.max(1, prev - 1))}
                                    >
                                        Anterior
                                    </button>
                                    <button
                                        type="button"
                                        className="app-btn-ghost text-xs disabled:opacity-40"
                                        disabled={paginaPanelActual === totalPaginasPanel}
                                        onClick={() => setPaginaPanel((prev) => Math.min(totalPaginasPanel, prev + 1))}
                                    >
                                        Siguiente
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}