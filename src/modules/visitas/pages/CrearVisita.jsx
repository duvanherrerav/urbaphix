import { useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import toast from 'react-hot-toast';
import { supabase } from '../../../services/supabaseClient';
import { crearVisita as crearVisitaService } from '../services/visitasService';

const TIPOS_DOCUMENTO_FALLBACK = [
  { codigo: 'CC', nombre: 'Cédula de ciudadanía' },
  { codigo: 'CE', nombre: 'Cédula de extranjería' },
  { codigo: 'TI', nombre: 'Tarjeta de identidad' },
  { codigo: 'PAS', nombre: 'Pasaporte' }
];

export default function CrearVisita({ usuarioApp }) {
  const [form, setForm] = useState({
    nombre: '',
    tipo_documento: 'CC',
    documento: '',
    fecha: '',
    tipoVehiculo: '',
    placa: ''
  });
  const [tiposDocumento, setTiposDocumento] = useState(TIPOS_DOCUMENTO_FALLBACK);
  const [loading, setLoading] = useState(false);
  const [qrPayload, setQrPayload] = useState(null);
  const [residenteId, setResidenteId] = useState(null);
  const [historial, setHistorial] = useState([]);
  const qrWrapRef = useRef(null);

  useEffect(() => {
    const cargarTipos = async () => {
      const { data, error } = await supabase
        .from('tipos_documento')
        .select('codigo, nombre')
        .eq('activo', true)
        .order('nombre', { ascending: true });

      if (!error && data?.length) setTiposDocumento(data);
    };
    cargarTipos();
  }, []);

  const cargarHistorial = async (rid) => {
    const { data } = await supabase
      .from('registro_visitas')
      .select(`
        id, fecha_visita, estado, qr_code, created_at,
        visitantes!inner(id, residente_id, nombre, tipo_documento, documento, placa, tipo_vehiculo)
      `)
      .eq('visitantes.residente_id', rid)
      .order('created_at', { ascending: false })
      .limit(20);
    const mapped = (data || []).map((row) => ({
      id: row.id,
      fecha_visita: row.fecha_visita,
      estado: row.estado,
      qr_code: row.qr_code,
      created_at: row.created_at,
      nombre_visitante: row.visitantes?.nombre,
      tipo_documento: row.visitantes?.tipo_documento,
      documento: row.visitantes?.documento,
      placa: row.visitantes?.placa,
      tipo_vehiculo: row.visitantes?.tipo_vehiculo
    }));
    setHistorial(mapped);
  };

  useEffect(() => {
    const init = async () => {
      const { data: authData } = await supabase.auth.getUser();
      const { data: residente } = await supabase
        .from('residentes')
        .select('id')
        .eq('usuario_id', authData?.user?.id)
        .single();
      if (residente?.id) {
        setResidenteId(residente.id);
        cargarHistorial(residente.id);
      }
    };
    init();
  }, []);

  const validacionPlaca = useMemo(() => {
    if (!form.tipoVehiculo) return { ok: true, mensaje: '' };
    const placa = String(form.placa || '').toUpperCase();
    if (form.tipoVehiculo === 'carro') {
      const ok = /^[A-Z]{3}[0-9]{3}$/.test(placa);
      return { ok, mensaje: 'Para carro usa formato ABC123' };
    }
    if (form.tipoVehiculo === 'moto') {
      const ok = /^[A-Z]{3}[0-9]{2}[A-Z]?$/.test(placa);
      return { ok, mensaje: 'Para moto usa formato ABC12 o ABC12D' };
    }
    return { ok: true, mensaje: '' };
  }, [form.tipoVehiculo, form.placa]);

  const crearVisita = async () => {
    if (!form.nombre || !form.documento || !form.fecha || !form.tipo_documento) {
      toast('Completa los campos obligatorios ⚠️');
      return;
    }

    setLoading(true);
    if (form.tipoVehiculo && !validacionPlaca.ok) {
      toast.error(validacionPlaca.mensaje);
      setLoading(false);
      return;
    }

    const { data: authData } = await supabase.auth.getUser();
    const { data: residente } = await supabase
      .from('residentes')
      .select('id, apartamento_id')
      .eq('usuario_id', authData?.user?.id)
      .single();

    if (!residente?.id) {
      toast.error('No tienes residente asociado');
      setLoading(false);
      return;
    }

    const { ok, visita, qr_code, error } = await crearVisitaService({
      residente_id: residente.id,
      apartamento_id: residente.apartamento_id,
      nombre: form.nombre,
      tipo_documento: form.tipo_documento,
      documento: form.documento,
      tipo_vehiculo: form.tipoVehiculo || null,
      placa: form.tipoVehiculo ? form.placa : null,
      fecha: form.fecha
    }, authData?.user);

    setLoading(false);
    if (!ok || !visita) {
      toast.error(error || 'No se pudo crear la visita');
      return;
    }

    const payload = JSON.stringify({ visita_id: visita.id, qr_code, conjunto_id: usuarioApp.conjunto_id });
    setQrPayload(payload);
    toast.success('Visita creada. QR listo para compartir ✅');
    setForm({ nombre: '', tipo_documento: 'CC', documento: '', fecha: '', tipoVehiculo: '', placa: '' });
    if (residenteId) cargarHistorial(residenteId);
  };

  const compartirQR = async () => {
    if (!qrPayload) return;
    const texto = `Te comparto tu acceso de visita Urbaphix:\n${qrPayload}`;

    if (navigator.share) {
      await navigator.share({ title: 'QR de visita', text: texto });
      return;
    }
    await navigator.clipboard.writeText(texto);
    toast.success('Compartir no disponible. Código copiado.');
  };

  const compartirImagenQR = async () => {
    const canvas = qrWrapRef.current?.querySelector('canvas');
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/png');
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], 'qr-visita.png', { type: 'image/png' });

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title: 'QR visita', files: [file] });
      return;
    }
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'qr-visita.png';
    a.click();
    toast.success('Imagen QR descargada');
  };

  const setQRDesdeHistorial = (item) => {
    const payload = JSON.stringify({ visita_id: item.id, qr_code: item.qr_code, conjunto_id: usuarioApp.conjunto_id });
    setQrPayload(payload);
  };

  const reutilizarVisita = (item) => {
    setForm({
      nombre: item.nombre_visitante || '',
      tipo_documento: item.tipo_documento || 'CC',
      documento: item.documento || '',
      fecha: new Date().toISOString().split('T')[0],
      tipoVehiculo: item.tipo_vehiculo || '',
      placa: item.placa || ''
    });
    toast('Datos cargados. Solo ajusta fecha/placa y crea nueva visita.');
  };

  const visitantesFrecuentes = useMemo(() => {
    const map = new Map();
    historial.forEach((item) => {
      const key = `${item.tipo_documento || ''}-${item.documento || ''}`;
      if (!map.has(key)) map.set(key, item);
    });
    return Array.from(map.values());
  }, [historial]);

  return (
    <div className="bg-white rounded-2xl shadow p-5 space-y-4 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold">Solicitar visita 🚶‍♂️</h2>
        <p className="text-sm text-gray-500">Registra tu visita y comparte el QR para ingreso en portería.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <input
          className="border rounded-lg px-3 py-2"
          placeholder="Nombre visitante"
          value={form.nombre}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
        />

        <select
          className="border rounded-lg px-3 py-2"
          value={form.tipo_documento}
          onChange={(e) => setForm({ ...form, tipo_documento: e.target.value })}
        >
          {tiposDocumento.map((item) => (
            <option key={item.codigo} value={item.codigo}>{item.nombre}</option>
          ))}
        </select>

        <input
          className="border rounded-lg px-3 py-2"
          placeholder="Documento"
          value={form.documento}
          onChange={(e) => setForm({ ...form, documento: e.target.value })}
        />

        <input
          type="date"
          className="border rounded-lg px-3 py-2"
          value={form.fecha}
          onChange={(e) => setForm({ ...form, fecha: e.target.value })}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-3 items-start">
        <select
          className="border rounded-lg px-3 py-2 w-full"
          value={form.tipoVehiculo}
          onChange={(e) => setForm({ ...form, tipoVehiculo: e.target.value, placa: '' })}
        >
          <option value="">Sin vehículo</option>
          <option value="carro">Carro</option>
          <option value="moto">Moto</option>
        </select>

        {form.tipoVehiculo && (
          <input
            className="border rounded-lg px-3 py-2 w-full"
            placeholder={form.tipoVehiculo === 'carro' ? 'Placa carro (ABC123)' : 'Placa moto (ABC12 o ABC12D)'}
            value={form.placa}
            maxLength={6}
            onChange={(e) => setForm({ ...form, placa: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
          />
        )}
        {form.tipoVehiculo && form.placa && !validacionPlaca.ok && (
          <p className="text-xs text-red-600">{validacionPlaca.mensaje}</p>
        )}
      </div>

      <button
        onClick={crearVisita}
        disabled={loading}
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg w-full"
      >
        {loading ? 'Creando...' : 'Crear visita y generar QR'}
      </button>

      {qrPayload && (
        <div ref={qrWrapRef} className="border rounded-xl p-4 bg-slate-50 space-y-3">
          <h3 className="font-semibold">QR validable en portería 🔐</h3>
          <p className="text-xs text-gray-500">Portería puede validar este QR escaneando o pegando el código manual.</p>
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <QRCodeCanvas value={qrPayload} size={180} />
            <div className="space-y-2">
              <button className="w-full bg-emerald-600 text-white rounded-lg px-3 py-2 text-sm" onClick={compartirImagenQR}>Compartir QR</button>
              <button className="w-full bg-slate-900 text-white rounded-lg px-3 py-2 text-sm" onClick={compartirQR}>Copiar código de validación</button>
            </div>
          </div>
        </div>
      )}

      <div className="border rounded-xl p-4">
        <h3 className="font-semibold mb-2">Visitantes frecuentes</h3>
        <div className="space-y-2 max-h-72 overflow-auto">
          {visitantesFrecuentes.map((item) => (
            <div key={item.id} className="border rounded-lg p-3 text-sm">
              <p className="font-medium">{item.nombre_visitante} · {item.documento}</p>
              <p className="text-gray-500">Fecha visita: {item.fecha_visita} · Estado: {item.estado}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {item.estado === 'pendiente' && (
                  <button className="px-2 py-1 border rounded" onClick={() => setQRDesdeHistorial(item)}>Reenviar QR</button>
                )}
                <button className="px-2 py-1 border rounded" onClick={() => reutilizarVisita(item)}>Reutilizar datos</button>
              </div>
            </div>
          ))}
          {visitantesFrecuentes.length === 0 && <p className="text-sm text-gray-500">Aún no hay visitas registradas.</p>}
        </div>
      </div>
    </div>
  );
}