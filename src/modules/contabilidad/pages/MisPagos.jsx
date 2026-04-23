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

export default function MisPagos({ usuarioApp }) {
  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [configPago, setConfigPago] = useState(null);
  const [archivo, setArchivo] = useState(null);

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
        setPagos([]);
        return;
      }

      const { data } = await supabase
        .from('pagos')
        .select('*')
        .eq('residente_id', residente.id)
        .order('created_at', { ascending: false });

      setPagos(data || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!usuarioApp) return;
    obtenerConfigPago();
    cargar();
  }, [usuarioApp]);

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
                  <span className={`app-badge ${p.estado === 'pendiente' ? 'app-badge-warning' : 'app-badge-success'} capitalize`}>{p.estado}</span>
                  {p.estado === 'pendiente' && <button onClick={pagar} className="app-btn-primary text-xs">Pagar</button>}
                </div>
                {p.estado === 'pendiente' && (
                  <div className="app-surface-muted space-y-2 border border-brand-primary/20">
                    <input type="file" onChange={(e) => setArchivo(e.target.files[0])} className="text-xs" />
                    <button onClick={() => subirComprobante(p.id)} className="app-btn-secondary text-xs w-full">Subir comprobante</button>
                  </div>
                )}
                {configPago?.tipo === 'manual' && <p className="text-xs text-app-text-secondary app-surface-muted">💡 Pago manual habilitado para este conjunto.</p>}
              </div>
            </div >
          </div>
        ))}
      </div >
    </div >
  );
}