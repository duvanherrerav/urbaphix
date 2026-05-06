import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../services/supabaseClient';
import PagoCard from '../components/residente/PagoCard';
import PagoEmptyState from '../components/residente/PagoEmptyState';
import PagosResumenCards from '../components/residente/PagosResumenCards';

const getEstadoProcesoPago = (pago) => {
  if (pago?.estado === 'pagado') return { key: 'pagado', label: 'Pago aprobado', badge: 'app-badge-success' };
  if (pago?.comprobante_url) return { key: 'en_revision', label: 'Comprobante en revisión', badge: 'app-badge-info' };
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
    if (!archivo) {
      alert('Selecciona un archivo');
      return false;
    }

    const nombreArchivo = `${pagoId}_${String(archivo.name || 'comprobante').replace(/\s+/g, '_')}`;
    const { error } = await supabase.storage.from('comprobantes').upload(nombreArchivo, archivo);
    if (error) {
      alert('Error subiendo archivo');
      return false;
    }

    const { data: urlData } = supabase.storage.from('comprobantes').getPublicUrl(nombreArchivo);
    const { error: errorUpdate } = await supabase
      .from('pagos')
      .update({ comprobante_url: urlData.publicUrl })
      .eq('id', pagoId);
    if (errorUpdate) {
      alert('Error guardando comprobante');
      return false;
    }

    alert('📤 Comprobante subido correctamente');
    setArchivo(null);
    cargar();
    return true;
  };

  const resumen = useMemo(() => ({
    pendientes: pagos.filter((p) => p.estado === 'pendiente').length,
    pagados: pagos.filter((p) => p.estado === 'pagado').length,
    pendienteValor: pagos.filter((p) => p.estado === 'pendiente').reduce((a, p) => a + Number(p.valor || 0), 0)
  }), [pagos]);

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

          <div className="grid gap-3">
            {pagos.map((p) => (
              <PagoCard
                key={p.id}
                pago={p}
                estadoProceso={getEstadoProcesoPago(p)}
                configPago={configPago}
                onPagar={pagar}
                onArchivoChange={(e) => setArchivo(e.target.files[0])}
                onSubirComprobante={() => subirComprobante(p.id)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
