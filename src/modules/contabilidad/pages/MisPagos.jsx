import { useEffect, useState } from 'react';
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

  // 🔥 CONFIG PAGOS
  async function obtenerConfigPago() {

    const { data, error } = await supabase
      .from('config_pagos')
      .select('*')
      .eq('conjunto_id', usuarioApp.conjunto_id)
      .eq('activo', true)
      .maybeSingle();

    if (error) {
      console.log('Error config pago:', error);
      return;
    }

    setConfigPago(data);
  }

  // 🔥 REALTIME
  function suscribirse(residenteId) {

    const channel = supabase
      .channel('mis-pagos')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pagos',
          filter: `residente_id=eq.${residenteId}`
        },
        () => {
          cargar();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  // 🔥 CARGAR PAGOS
  async function cargar() {

    try {

      setLoading(true);

      if (!usuarioApp?.id) {
        setLoading(false);
        return;
      }

      // 🔥 OBTENER RESIDENTE
      const { data: residentesRows } = await supabase
        .from('residentes')
        .select('id')
        .eq('usuario_id', usuarioApp.id)
        .limit(1);
      const residente = residentesRows?.[0] || null;

      if (!residente) {
        setPagos([]);
        setLoading(false);
        return;
      }

      // 🔥 TRAER PAGOS
      const { data, error } = await supabase
        .from('pagos')
        .select('*')
        .eq('residente_id', residente.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.log(error);
        setLoading(false);
        return;
      }

      setPagos(data || []);
      setLoading(false);

      // 🔥 REALTIME
      suscribirse(residente.id);

    } catch (err) {
      console.log(err);
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!usuarioApp) return;
    const timer = setTimeout(() => {
      obtenerConfigPago();
      cargar();
    }, 0);
    return () => clearTimeout(timer);
  }, [usuarioApp]);

  // 🔥 PAGAR
  const pagar = () => {

    if (!configPago) {
      alert('No hay configuración de pagos');
      return;
    }

    if (configPago.tipo === 'link') {
      window.open(configPago.url_pago, '_blank');
      return;
    }

    if (configPago.tipo === 'manual') {
      alert(configPago.instrucciones);
      return;
    }

    if (configPago.tipo === 'mixto') {
      window.open(configPago.url_pago, '_blank');
      alert(configPago.instrucciones);
      return;
    }
  };

  // 🔥 SUBIR COMPROBANTE
  const subirComprobante = async (pagoId) => {

    if (!archivo) {
      alert('Selecciona un archivo');
      return;
    }

    const nombreArchivo = `${pagoId}_${String(archivo.name || 'comprobante').replace(/\s+/g, '_')}`;

    const { error } = await supabase.storage
      .from('comprobantes')
      .upload(nombreArchivo, archivo);

    if (error) {
      console.log(error);
      alert('Error subiendo archivo');
      return;
    }

    const { data: urlData } = supabase.storage
      .from('comprobantes')
      .getPublicUrl(nombreArchivo);

    const url = urlData.publicUrl;

    const { error: errorUpdate } = await supabase
      .from('pagos')
      .update({ comprobante_url: url })
      .eq('id', pagoId);

    if (errorUpdate) {
      console.log(errorUpdate);
      alert('Error guardando comprobante');
      return;
    }

    alert('📤 Comprobante subido correctamente');

    setArchivo(null);
    cargar();
  };

  return (
    <div className="space-y-4">

      <h2 className="text-xl font-bold mb-4">
        Mis pagos 💰
      </h2>

      {loading && (
        <p className="text-app-text-secondary">Cargando pagos...</p>
      )}

      {!loading && pagos.length === 0 && (
        <div className="app-surface-primary p-4 text-center text-app-text-secondary">
          No tienes pagos registrados
        </div>
      )}

      <div className="space-y-4">

        {pagos.map(p => {

          const estadoColor =
            p.estado === 'pendiente'
              ? 'app-badge-warning'
              : 'app-badge-success';

          return (
            <div
              key={p.id}
              className="app-surface-primary p-4 flex justify-between items-center"
            >

              {/* INFO */}
              <div>
                <p className="font-semibold">
                  {p.concepto}
                </p>

                <p className="text-sm text-app-text-secondary">
                  {formatFechaBogota(p.created_at)}
                </p>

                {/* 🔥 VER COMPROBANTE */}
                {p.comprobante_url && (
                  <a
                    href={p.comprobante_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-500 block mt-1"
                  >
                    Ver comprobante 📄
                  </a>
                )}
              </div>

              {/* VALOR */}
              <div className="text-right">

                <p className="font-bold text-lg">
                  ${p.valor?.toLocaleString()}
                </p>

                <span className={`text-xs px-2 py-1 rounded-full border ${estadoColor}`}>
                  {p.estado}
                </span>

                {/* 🔥 BOTÓN PAGAR */}
                {p.estado === 'pendiente' && (
                  <button
                    onClick={pagar}
                    className="mt-2 btn-primary text-xs px-3 py-1"
                  >
                    Pagar
                  </button>
                )}

                {/* 🔥 SUBIR COMPROBANTE */}
                {p.estado === 'pendiente' && (
                  <div className="mt-2">

                    <input
                      type="file"
                      onChange={(e) => setArchivo(e.target.files[0])}
                      className="text-xs"
                    />

                    <button
                      onClick={() => subirComprobante(p.id)}
                      className="mt-1 app-btn-secondary text-xs px-3 py-1"
                    >
                      Subir comprobante
                    </button>

                  </div>
                )}

                {/* 🔥 INFO MANUAL */}
                {configPago?.tipo === 'manual' && (
                  <p className="text-xs text-app-text-secondary mt-2">
                    💡 Pago manual disponible
                  </p>
                )}

              </div>

            </div>
          );
        })}

      </div>

    </div>
  );
}