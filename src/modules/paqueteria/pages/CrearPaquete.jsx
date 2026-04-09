import { useEffect, useState } from 'react';
import { supabase } from '../../../services/supabaseClient';

export default function CrearPaquete({ usuarioApp }) {

  const [torres, setTorres] = useState([]);
  const [apartamentos, setApartamentos] = useState([]);

  const [torreSeleccionada, setTorreSeleccionada] = useState('');
  const [apartamentoSeleccionado, setApartamentoSeleccionado] = useState('');
  const [descripcion, setDescripcion] = useState('');

  const obtenerTorres = async (conjuntoId) => {
    if (!conjuntoId) return;

    const { data, error } = await supabase
      .from('torres')
      .select('*')
      .eq('conjunto_id', conjuntoId);

    if (error) {
      console.log('Error cargando torres:', error);
      return;
    }

    setTorres(data || []);
  };

  // 🔥 CARGAR TORRES
  useEffect(() => {
    if (!usuarioApp?.conjunto_id) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    obtenerTorres(usuarioApp.conjunto_id);
  }, [usuarioApp?.conjunto_id]);

  // 🔥 CARGAR APARTAMENTOS SEGÚN TORRE
  const obtenerApartamentos = async (torreId) => {

    const { data, error } = await supabase
      .from('apartamentos')
      .select('*')
      .eq('torre_id', torreId);

    if (error) {
      console.log('Error cargando apartamentos:', error);
      return;
    }

    setApartamentos(data || []);
  };

  // 🔥 CREAR PAQUETE
  const crearPaquete = async () => {

    if (!torreSeleccionada) {
      alert('Selecciona torre');
      return;
    }

    if (!apartamentoSeleccionado) {
      alert('Selecciona apartamento');
      return;
    }

    if (!descripcion) {
      alert('Ingresa una descripción');
      return;
    }

    // 🔥 1. BUSCAR RESIDENTE AUTOMÁTICO
    const { data: residente, error: errorResidente } = await supabase
      .from('residentes')
      .select('id, usuario_id')
      .eq('apartamento_id', apartamentoSeleccionado)
      .single();

    if (errorResidente || !residente) {
      console.log(errorResidente);
      alert('No hay residente en ese apartamento');
      return;
    }

    // 🔥 2. CREAR PAQUETE
    const { error } = await supabase
      .from('paquetes')
      .insert([{
        conjunto_id: usuarioApp.conjunto_id,
        apartamento_id: apartamentoSeleccionado,
        residente_id: residente.id,
        descripcion: descripcion,
        recibido_por: usuarioApp.id,
        estado: 'pendiente'
      }]);

    if (error) {
      console.log(error);
      alert('Error creando paquete');
      return;
    }

    // 🔥 3. CREAR NOTIFICACIÓN
    const { error: errorNotif } = await supabase
      .from('notificaciones')
      .insert([{
        usuario_id: residente.usuario_id,
        tipo: 'paquete',
        titulo: '📦 Nuevo paquete',
        mensaje: `Tienes un paquete (${descripcion}) en portería`
      }]);

    if (errorNotif) {
      console.log(errorNotif);
    }

    alert('📦 Paquete registrado');

    // 🔥 LIMPIAR FORMULARIO
    setDescripcion('');
    setApartamentoSeleccionado('');
    setTorreSeleccionada('');
    setApartamentos([]);
  };

  return (
    <div>
      <h2>Registrar paquete 📦</h2>

      {/* 🔥 TORRE */}
      <select
        value={torreSeleccionada}
        onChange={(e) => {
          setTorreSeleccionada(e.target.value);
          setApartamentoSeleccionado('');
          obtenerApartamentos(e.target.value);
        }}
      >
        <option value="">Selecciona torre</option>
        {torres.map(t => (
          <option key={t.id} value={t.id}>
            {t.nombre}
          </option>
        ))}
      </select>

      <br /><br />

      {/* 🔥 APARTAMENTO */}
      <select
        value={apartamentoSeleccionado}
        onChange={(e) => setApartamentoSeleccionado(e.target.value)}
      >
        <option value="">Selecciona apartamento</option>
        {apartamentos.map(a => (
          <option key={a.id} value={a.id}>
            {a.numero}
          </option>
        ))}
      </select>

      <br /><br />

      {/* 🔥 DESCRIPCIÓN */}
      <input
        placeholder="Descripción (ej: Amazon, MercadoLibre...)"
        value={descripcion}
        onChange={e => setDescripcion(e.target.value)}
      />

      <br /><br />

      <button onClick={crearPaquete}>
        Guardar paquete
      </button>
    </div>
  );
}