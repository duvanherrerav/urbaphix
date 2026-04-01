import { useEffect, useState } from 'react';
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
    vieneVehiculo: false,
    placa: ''
  });
  const [tiposDocumento, setTiposDocumento] = useState(TIPOS_DOCUMENTO_FALLBACK);
  const [loading, setLoading] = useState(false);
  const [qrPayload, setQrPayload] = useState(null);

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

  const crearVisita = async () => {
    if (!form.nombre || !form.documento || !form.fecha || !form.tipo_documento) {
      toast('Completa los campos obligatorios ⚠️');
      return;
    }

    setLoading(true);
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
      placa: form.vieneVehiculo ? form.placa : null,
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
    setForm({ nombre: '', tipo_documento: 'CC', documento: '', fecha: '', vieneVehiculo: false, placa: '' });
  };

  const copiarCodigo = async () => {
    if (!qrPayload) return;
    await navigator.clipboard.writeText(qrPayload);
    toast.success('Código QR copiado');
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

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.vieneVehiculo}
          onChange={(e) => setForm({ ...form, vieneVehiculo: e.target.checked })}
        />
        Viene en vehículo
      </label>

      {form.vieneVehiculo && (
        <input
          className="border rounded-lg px-3 py-2 w-full md:w-1/2"
          placeholder="Placa (ABC123)"
          value={form.placa}
          onChange={(e) => setForm({ ...form, placa: e.target.value.toUpperCase() })}
        />
      )}

      <button
        onClick={crearVisita}
        disabled={loading}
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
      >
        {loading ? 'Creando...' : 'Crear visita y generar QR'}
      </button>

      {qrPayload && (
        <div className="border rounded-xl p-4 bg-slate-50 space-y-3">
          <h3 className="font-semibold">QR validable en portería 🔐</h3>
          <p className="text-xs text-gray-500">Portería puede validar este QR escaneando o pegando el código manual.</p>
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <QRCodeCanvas value={qrPayload} size={180} />
            <div className="space-y-2">
              <button className="w-full border rounded-lg px-3 py-2 text-sm" onClick={copiarCodigo}>Copiar código de validación</button>
              <button className="w-full bg-emerald-600 text-white rounded-lg px-3 py-2 text-sm" onClick={compartirQR}>Compartir QR</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}