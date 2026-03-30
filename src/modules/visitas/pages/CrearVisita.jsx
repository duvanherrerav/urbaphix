import { useState } from 'react';
import { supabase } from '../../../services/supabaseClient';
import { QRCodeCanvas } from 'qrcode.react';
import toast from 'react-hot-toast';

export default function CrearVisita({ usuarioApp }) {

  const [form, setForm] = useState({
    nombre: '',
    tipo_documento: '',
    documento: '',
    fecha: '',
    vieneVehiculo: false,
    placa: ''
  });

  const [qrValue, setQrValue] = useState(null);

  const crearVisita = async () => {

    if (!form.nombre || !form.documento || !form.fecha) {
      toast("Completa todos los campos ⚠️");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();

    // 🔥 Obtener residente
    const { data: residente } = await supabase
      .from('residentes')
      .select('*')
      .eq('usuario_id', userData.user.id)
      .single();

    if (!residente) {
      toast("No tienes residente asociado");
      return;
    }

    const { data, error } = await supabase
      .from('visitas')
      .insert([{
        conjunto_id: usuarioApp.conjunto_id,
        apartamento_id: residente.apartamento_id,
        residente_id: residente.id,

        nombre_visitante: form.nombre,
        tipo_documento: form.tipo_documento,
        documento: form.documento,
        placa: form.placa,

        fecha_visita: form.fecha,

        estado: 'pendiente'
      }])
      .select()
      .single();

    if (error) {
      console.log(error);
      toast.error("Error creando visita ❌");
    } else {

      const qrData = JSON.stringify({
        visita_id: data.id,
        conjunto_id: usuarioApp.conjunto_id
      });

      setQrValue(qrData);

      toast.success("Visita creada correctamente 🚀");

      setForm({
        nombre: '',
        tipo_documento: '',
        documento: '',
        fecha: '',
        vieneVehiculo: false,
        placa: ''
      });
    }
  };

  return (
    <div>
      <h2>Solicitar visita 🚶‍♂️🚗</h2>

      <input
        placeholder="Nombre visitante"
        value={form.nombre}
        onChange={e => setForm({ ...form, nombre: e.target.value })}
      />

      <br /><br />
      <input
        placeholder="Tipo Docuemnto"
        value={form.tipo_documento}
        onChange={e => setForm({ ...form, tipo_documento: e.target.value })}
      />

      <br /><br />

      <input
        placeholder="Documento"
        value={form.documento}
        onChange={e => setForm({ ...form, documento: e.target.value })}
      />

      <br /><br />

      <input
        type="date"
        value={form.fecha}
        onChange={e => setForm({ ...form, fecha: e.target.value })}
      />

      <br /><br />

      <label>
        <input
          type="checkbox"
          checked={form.vieneVehiculo}
          onChange={e => setForm({ ...form, vieneVehiculo: e.target.checked })}
        />
        Viene en vehículo
      </label>

      <br /><br />

      {form.vieneVehiculo && (
        <input
          placeholder="Placa"
          value={form.placa}
          onChange={e => setForm({ ...form, placa: e.target.value })}
        />
      )}

      <br /><br />

      <button onClick={crearVisita}>
        Crear visita
      </button>
      
      {qrValue && (
        <div style={{ marginTop: '20px' }}>
          <h3>QR de acceso 🔐</h3>
          <QRCodeCanvas value={qrValue} size={200} />
        </div>
      )}
    </div>
  );
}