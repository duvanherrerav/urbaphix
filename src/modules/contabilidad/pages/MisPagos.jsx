import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../services/supabaseClient';
import PagoCard from '../components/residente/PagoCard';
import PagoEmptyState from '../components/residente/PagoEmptyState';
import PagosResumenCards from '../components/residente/PagosResumenCards';
import { EVENTOS_PAGO, adjuntarEventosAPagos, notificarAdminsPago, registrarPagoEvento } from '../services/pagosEventosService';
import { ESTADOS_PAGO, esPagoDeudaActiva, getEstadoPagoUi, obtenerEstadoFinancieroReal } from '../utils/pagosEstados';

const ordenarPagosDesc = (rows = []) =>
  [...rows].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

const HISTORIAL_PAGE_SIZE = 5;
const PRIORIDAD_ESTADO_PAGO = {
  [ESTADOS_PAGO.PENDIENTE]: 1,
  [ESTADOS_PAGO.VENCIDO]: 2,
  [ESTADOS_PAGO.EN_REVISION]: 3,
  [ESTADOS_PAGO.RECHAZADO]: 4,
  [ESTADOS_PAGO.PAGADO]: 5
};

export default function MisPagos({ usuarioApp }) {
  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [configPago, setConfigPago] = useState(null);
  const [archivo, setArchivo] = useState(null);
  const [residenteId, setResidenteId] = useState(null);
  const [historialCompletoOpen, setHistorialCompletoOpen] = useState(false);
  const [paginaHistorial, setPaginaHistorial] = useState(1);

  const obtenerConfigPago = useCallback(async () => {
    const { data } = await supabase
      .from('config_pagos')
      .select('*')
      .eq('conjunto_id', usuarioApp.conjunto_id)
      .eq('activo', true)
      .maybeSingle();
    setConfigPago(data);
  }, [usuarioApp?.conjunto_id]);

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      if (!usuarioApp?.id) return;

      const { data: residentesRows } = await supabase
        .from('residentes')
        .select('id')
        .eq('usuario_id', usuarioApp.id)
        .limit(1);
      const residente = residentesRows?.[0] || null;

      if (!residente) {
        setResidenteId(null);
        setPagos([]);
        return;
      }

      setResidenteId(residente.id);

      const { data } = await supabase
        .from('pagos')
        .select('*')
        .eq('residente_id', residente.id)
        .order('created_at', { ascending: false });

      const { pagos: pagosConEventos } = await adjuntarEventosAPagos(data || []);
      setPagos(ordenarPagosDesc(pagosConEventos));
    } finally {
      setLoading(false);
    }
  }, [usuarioApp?.id]);

  useEffect(() => {
    if (!usuarioApp) return;
    obtenerConfigPago();
    cargar();
  }, [cargar, obtenerConfigPago, usuarioApp]);

  useEffect(() => {
    if (!residenteId) return;

    const channel = supabase
      .channel(`mis-pagos-${residenteId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pagos',
          filter: `residente_id=eq.${residenteId}`
        },
        (payload) => {
          setPagos((prev) => {
            if (payload.eventType === 'DELETE') {
              return prev.filter((p) => p.id !== payload.old?.id);
            }

            const incoming = payload.new;
            if (!incoming?.id) return prev;

            const existingIndex = prev.findIndex((p) => p.id === incoming.id);
            const next = [...prev];

            if (existingIndex >= 0) {
              next[existingIndex] = { ...next[existingIndex], ...incoming };
            } else {
              next.push(incoming);
            }

            return ordenarPagosDesc(next);
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pagos_eventos',
          filter: `residente_id=eq.${residenteId}`
        },
        () => cargar()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [cargar, residenteId]);

  const pagar = () => {
    if (!configPago) return alert('No hay configuración de pagos');
    if (configPago.tipo === 'link') return window.open(configPago.url_pago, '_blank');
    if (configPago.tipo === 'manual') return alert(configPago.instrucciones);
    if (configPago.tipo === 'mixto') {
      window.open(configPago.url_pago, '_blank');
      alert(configPago.instrucciones);
    }
  };

  const subirComprobante = async (pagoId) => {
    if (!archivo) {
      alert('Selecciona un archivo');
      return false;
    }

    const pagoActual = pagos.find((pago) => pago.id === pagoId);
    const comprobanteAnterior = String(pagoActual?.comprobante_url || '').trim();
    const eventoComprobante = comprobanteAnterior ? EVENTOS_PAGO.COMPROBANTE_REEMPLAZADO : EVENTOS_PAGO.COMPROBANTE_SUBIDO;

    const nombreArchivo = `${pagoId}_${Date.now()}_${String(archivo.name || 'comprobante').replace(/\s+/g, '_')}`;
    const { error } = await supabase.storage.from('comprobantes').upload(nombreArchivo, archivo);
    if (error) {
      alert('Error subiendo archivo');
      return false;
    }

    const { data: urlData } = supabase.storage.from('comprobantes').getPublicUrl(nombreArchivo);
    const { error: errorUpdate } = await supabase
      .from('pagos')
      .update({
        comprobante_url: urlData.publicUrl,
        estado: ESTADOS_PAGO.EN_REVISION,
        motivo_rechazo: null,
        fecha_rechazo: null,
        rechazado_por: null
      })
      .eq('id', pagoId)
      .eq('residente_id', residenteId);
    if (errorUpdate) {
      alert('Error guardando comprobante');
      return false;
    }

    await registrarPagoEvento({
      pago: pagoActual || {
        id: pagoId,
        conjunto_id: usuarioApp?.conjunto_id,
        residente_id: residenteId
      },
      usuarioId: usuarioApp?.id,
      evento: eventoComprobante,
      estadoAnterior: pagoActual?.estado || null,
      estadoNuevo: ESTADOS_PAGO.EN_REVISION,
      mensaje: comprobanteAnterior
        ? 'El residente reemplazó el comprobante para una nueva revisión administrativa.'
        : 'El residente subió un comprobante para revisión administrativa.',
      metadata: { archivo: nombreArchivo }
    });

    await notificarAdminsPago({
      conjuntoId: usuarioApp?.conjunto_id,
      tipo: 'comprobante_subido',
      titulo: comprobanteAnterior ? 'Comprobante reemplazado' : 'Nuevo comprobante por revisar',
      mensaje: comprobanteAnterior
        ? 'Un residente reemplazó un comprobante rechazado o pendiente. Revisa la bandeja de pagos.'
        : 'Un residente subió un comprobante. Revisa la bandeja de pagos en revisión.'
    });

    alert('📤 Comprobante subido correctamente');
    setArchivo(null);
    cargar();
    return true;
  };

  useEffect(() => {
    setPaginaHistorial(1);
  }, [historialCompletoOpen, pagos.length]);

  const resumen = useMemo(() => ({
    pendientes: pagos.filter((p) => obtenerEstadoFinancieroReal(p) === ESTADOS_PAGO.PENDIENTE).length,
    vencidos: pagos.filter((p) => obtenerEstadoFinancieroReal(p) === ESTADOS_PAGO.VENCIDO).length,
    pagados: pagos.filter((p) => obtenerEstadoFinancieroReal(p) === ESTADOS_PAGO.PAGADO).length,
    pendienteValor: pagos.filter((p) => esPagoDeudaActiva(p)).reduce((a, p) => a + Number(p.valor || 0), 0)
  }), [pagos]);

  const pagosPriorizados = useMemo(() => [...pagos].sort((a, b) => {
    const prioridadA = PRIORIDAD_ESTADO_PAGO[obtenerEstadoFinancieroReal(a)] || 99;
    const prioridadB = PRIORIDAD_ESTADO_PAGO[obtenerEstadoFinancieroReal(b)] || 99;
    if (prioridadA !== prioridadB) return prioridadA - prioridadB;
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  }), [pagos]);

  const totalPaginasHistorial = Math.max(1, Math.ceil(pagosPriorizados.length / HISTORIAL_PAGE_SIZE));
  const paginaHistorialActual = Math.min(paginaHistorial, totalPaginasHistorial);
  const pagosVisibles = historialCompletoOpen
    ? pagosPriorizados.slice((paginaHistorialActual - 1) * HISTORIAL_PAGE_SIZE, paginaHistorialActual * HISTORIAL_PAGE_SIZE)
    : pagosPriorizados.slice(0, HISTORIAL_PAGE_SIZE);

  return (
    <div className="space-y-4">
      <header className="app-surface-primary p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-brand-secondary">Módulo financiero</p>
            <h2 className="mt-1 text-2xl font-black text-app-text-primary">Mis pagos 💰</h2>
            <p className="mt-1 max-w-2xl text-sm text-app-text-secondary">Consulta tus cobros, revisa el saldo pendiente y adjunta comprobantes para validación de la administración.</p>
          </div>
          <div className="rounded-2xl border border-brand-primary/25 bg-brand-primary/10 px-3 py-2 text-xs text-app-text-secondary">
            Información actualizada en tiempo real
          </div>
        </div>

        <div className="mt-4">
          <PagosResumenCards resumen={resumen} />
        </div>
      </header>

      {loading && (
        <div className="app-surface-primary p-5 text-sm text-app-text-secondary">
          Cargando pagos...
        </div>
      )}

      {!loading && pagos.length === 0 && <PagoEmptyState />}

      {!loading && pagos.length > 0 && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div>
              <h3 className="text-sm font-bold text-app-text-primary">Cobros registrados</h3>
              <p className="text-xs text-app-text-secondary">Ordenados del más reciente al más antiguo.</p>
            </div>
            <span className="app-badge app-badge-info text-[11px]">{pagos.length} cobro(s)</span>
          </div>

          <div className="rounded-2xl border border-app-border/70 bg-app-bg/45 p-2">
            <div className="max-h-[620px] space-y-3 overflow-y-auto pr-1 app-scrollbar">
              {pagosVisibles.map((p) => {
                const esHistoricoAprobado = obtenerEstadoFinancieroReal(p) === ESTADOS_PAGO.PAGADO;
                return (
                  <PagoCard
                    key={p.id}
                    pago={p}
                    estadoProceso={getEstadoPagoUi(p)}
                    configPago={configPago}
                    onPagar={pagar}
                    onArchivoChange={(e) => setArchivo(e.target.files[0])}
                    onSubirComprobante={() => subirComprobante(p.id)}
                    eventos={p.eventos || []}
                    compactHistorico={esHistoricoAprobado}
                  />
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-2xl border border-app-border/70 bg-app-bg-alt/60 px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between">
            <span className="text-app-text-secondary">
              {historialCompletoOpen
                ? `Página ${paginaHistorialActual} de ${totalPaginasHistorial} · ${pagos.length} registro(s) priorizados`
                : `Vista ejecutiva: ${Math.min(HISTORIAL_PAGE_SIZE, pagos.length)} de ${pagos.length} registro(s)`}
            </span>
            {historialCompletoOpen ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="app-btn-ghost text-xs disabled:opacity-40"
                  disabled={paginaHistorialActual === 1}
                  onClick={() => setPaginaHistorial((prev) => Math.max(1, prev - 1))}
                >
                  Anterior
                </button>
                <button
                  type="button"
                  className="app-btn-ghost text-xs disabled:opacity-40"
                  disabled={paginaHistorialActual === totalPaginasHistorial}
                  onClick={() => setPaginaHistorial((prev) => Math.min(totalPaginasHistorial, prev + 1))}
                >
                  Siguiente
                </button>
              </div>
            ) : pagos.length > HISTORIAL_PAGE_SIZE && (
              <button
                type="button"
                className="app-btn-secondary text-xs"
                onClick={() => setHistorialCompletoOpen(true)}
              >
                Ver historial completo
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
