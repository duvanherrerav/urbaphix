import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../services/supabaseClient';

const formatFechaBogota = (value) => {
  if (!value) return '-';
  const raw = String(value).trim().replace(' ', 'T');
  const hasZone = /Z$|[+-]\d{2}:\d{2}$/.test(raw);
  const parsed = new Date(hasZone ? raw : `${raw}Z`);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleDateString('es-CO', { timeZone: 'America/Bogota' });
};
const getEstadoProcesoPago = (pago) => {
  if (pago?.estado === 'pagado') return { key: 'pagado', label: 'Aprobado', badge: 'app-badge-success' };
  if (pago?.estado === 'rechazado') return { key: 'rechazado', label: 'Rechazado', badge: 'app-badge-error' };
  if (pago?.comprobante_url) return { key: 'en_revision', label: 'En revisión', badge: 'app-badge-info' };
  return { key: 'pendiente', label: 'Pendiente de pago', badge: 'app-badge-warning' };
};

export default function MisPagos({ usuarioApp }) {
  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [configPago, setConfigPago] = useState(null);
  const [archivo, setArchivo] = useState(null);
  const [residenteId, setResidenteId] = useState(null);

  const ordenarPagosDesc = (rows = []) =>
    [...rows].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

  async function obtenerConfigPago() {
    const { data } = await supabase
      .from('config_pagos')
      .select('*')
      .eq('conjunto_id', usuarioApp.conjunto_id)
      .eq('activo', true)
      .maybeSingle();
    setConfigPago(data);
  }

  async function cargar() {
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

      setPagos(ordenarPagosDesc(data || []));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!usuarioApp) return;
    obtenerConfigPago();
    cargar();
  }, [usuarioApp]);

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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [residenteId]);

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
    if (!archivo) return alert('Selecciona un archivo');

    const nombreArchivo = `${pagoId}_${String(archivo.name || 'comprobante').replace(/\s+/g, '_')}`;
    const { error } = await supabase.storage.from('comprobantes').upload(nombreArchivo, archivo);
    if (error) return alert('Error subiendo archivo');

    const { data: urlData } = supabase.storage.from('comprobantes').getPublicUrl(nombreArchivo);
    const { error: errorUpdate } = await supabase
      .from('pagos')
      .update({ comprobante_url: urlData.publicUrl })
      .eq('id', pagoId);
    if (errorUpdate) return alert('Error guardando comprobante');

    alert('📤 Comprobante subido correctamente');
    setArchivo(null);
    cargar();
  };

  const resumen = useMemo(() => ({
    pendientes: pagos.filter((p) => p.estado === 'pendiente').length,
    pagados: pagos.filter((p) => p.estado === 'pagado').length,
    pendienteValor: pagos.filter((p) => p.estado === 'pendiente').reduce((a, p) => a + Number(p.valor || 0), 0)
  }), [pagos]);

  return (
    <div className="space-y-4">
      <div className="app-surface-primary p-5">
        <h2 className="text-2xl font-bold">Mis pagos 💰</h2>
        <p className="text-sm text-app-text-secondary mt-1">Estado de cobros, valor por pagar y acciones por comprobante.</p>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
          <div className="app-surface-muted"><span className="text-app-text-secondary">Pendientes</span><p className="text-lg font-semibold text-state-warning">{resumen.pendientes}</p></div>
          <div className="app-surface-muted"><span className="text-app-text-secondary">Pagados</span><p className="text-lg font-semibold text-state-success">{resumen.pagados}</p></div>
          <div className="app-surface-muted"><span className="text-app-text-secondary">Saldo pendiente</span><p className="text-lg font-semibold">${resumen.pendienteValor.toLocaleString('es-CO')}</p></div>
        </div>
      </div>

      {loading && <p className="text-app-text-secondary">Cargando pagos...</p>}
      {!loading && pagos.length === 0 && <div className="app-surface-primary p-4 text-center text-app-text-secondary">No tienes pagos registrados.</div>}

      <div className="space-y-3">
        {pagos.map((p) => (
          <div key={p.id} className="app-surface-primary p-4">
            {(() => {
              const estadoProceso = getEstadoProcesoPago(p);
              const timeline = [
                { key: 'pendiente', label: 'Generado' },
                { key: 'en_revision', label: 'Comprobante enviado' },
                { key: 'pagado', label: 'Aprobado' }
              ];
              const statusOrder = { pendiente: 0, en_revision: 1, pagado: 2, rechazado: 1 };
              return (
                <>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <span className={`app-badge ${estadoProceso.badge}`}>{estadoProceso.label}</span>
                    {p.estado === 'rechazado' && <span className="text-xs text-state-error">Actualiza comprobante para revalidación</span>}
                  </div>
                  <div className="mb-3 grid grid-cols-3 gap-2 text-[11px]">
                    {timeline.map((step, idx) => {
                      const current = statusOrder[estadoProceso.key] ?? 0;
                      const isActive = idx <= current;
                      return (
                        <div key={step.key} className={`rounded-lg px-2 py-1 text-center ${isActive ? 'bg-brand-primary/20 text-app-text-primary' : 'bg-app-bg text-app-text-secondary'}`}>
                          {step.label}
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              <div className="space-y-1">
                <p className="font-semibold text-app-text-primary">{p.concepto}</p>
                <p className="text-xs text-app-text-secondary">Generado: {formatFechaBogota(p.created_at)}</p>
                {p.comprobante_url && <a href={p.comprobante_url} target="_blank" rel="noreferrer" className="text-xs text-brand-secondary">Ver comprobante 📄</a>}
              </div>

              <div className="lg:w-80 space-y-3">
                <div className="app-surface-muted flex items-center justify-between">
                  <span className="text-xs text-app-text-secondary">Valor</span>
                  <span className="font-bold text-lg">${Number(p.valor || 0).toLocaleString('es-CO')}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className={`app-badge ${getEstadoProcesoPago(p).badge}`}>{getEstadoProcesoPago(p).label}</span>
                  {p.estado === 'pendiente' && <button onClick={pagar} className="app-btn-primary text-xs">Pagar</button>}
                </div>
                {(p.estado === 'pendiente' || p.estado === 'rechazado') && (
                  <div className="app-surface-muted space-y-2 border border-brand-primary/20 p-2">
                    <p className="text-xs text-app-text-secondary">
                      Comprobante: {p.comprobante_url ? 'enviado, pendiente revisión' : 'pendiente por adjuntar'}
                    </p>
                    <input type="file" onChange={(e) => setArchivo(e.target.files[0])} className="text-xs" />
                    <button onClick={() => subirComprobante(p.id)} className="app-btn-secondary text-xs w-full">
                      {p.comprobante_url ? 'Reemplazar comprobante' : 'Subir comprobante'}
                    </button>
                  </div>
                )}
                {configPago?.tipo === 'manual' && <p className="text-xs text-app-text-secondary app-surface-muted">💡 Pago manual habilitado para este conjunto.</p>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
