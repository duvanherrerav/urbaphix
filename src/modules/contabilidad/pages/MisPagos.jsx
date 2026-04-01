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
      const { data: residente } = await supabase
        .from('residentes')
        .select('id')
        .eq('usuario_id', usuarioApp.id)
        .maybeSingle();

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
    <div>

      <h2 className="text-xl font-bold mb-4">
        Mis pagos 💰
      </h2>

      {loading && (
        <p className="text-gray-500">Cargando pagos...</p>
      )}

      {!loading && pagos.length === 0 && (
        <div className="bg-white p-4 rounded-xl shadow text-center text-gray-500">
          No tienes pagos registrados
        </div>
      )}

      <div className="space-y-4">

        {pagos.map(p => {

          const estadoColor =
            p.estado === 'pendiente'
              ? 'text-yellow-600 bg-yellow-100'
              : 'text-green-600 bg-green-100';

          return (
            <div
              key={p.id}
              className="bg-white p-4 rounded-xl shadow flex justify-between items-center"
            >

              {/* INFO */}
              <div>
                <p className="font-semibold">
                  {p.concepto}
                </p>

                <p className="text-sm text-gray-500">
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

                <span className={`text-xs px-2 py-1 rounded-full ${estadoColor}`}>
                  {p.estado}
                </span>

                {/* 🔥 BOTÓN PAGAR */}
                {p.estado === 'pendiente' && (
                  <button
                    onClick={pagar}
                    className="mt-2 bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1 rounded-lg"
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
                      className="mt-1 bg-purple-600 hover:bg-purple-700 text-white text-xs px-3 py-1 rounded-lg"
                    >
                      Subir comprobante
                    </button>

                  </div>
                )}

                {/* 🔥 INFO MANUAL */}
                {configPago?.tipo === 'manual' && (
                  <p className="text-xs text-gray-500 mt-2">
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
