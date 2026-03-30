import { useEffect, useState } from 'react';
import { supabase } from '../../../services/supabaseClient';
import { crearPago } from '../services/contabilidadService';

export default function CrearCobro({ usuarioApp }) {

  const [modo, setModo] = useState('individual');

  const [form, setForm] = useState({
    concepto: '',
    valor: ''
  });

  const [torres, setTorres] = useState([]);
  const [apartamentos, setApartamentos] = useState([]);

  const [torreSeleccionada, setTorreSeleccionada] = useState('');
  const [apartamentoSeleccionado, setApartamentoSeleccionado] = useState('');

  const [loading, setLoading] = useState(false);

  // 🔥 CARGA INICIAL
  useEffect(() => {
    if (usuarioApp?.conjunto_id) {
      obtenerTorres();
    }
  }, [usuarioApp]);

  // 🔥 TORRES
  const obtenerTorres = async () => {
    const { data } = await supabase
      .from('torres')
      .select('id, nombre')
      .eq('conjunto_id', usuarioApp.conjunto_id);

    setTorres(data || []);
  };

  // 🔥 APARTAMENTOS
  const obtenerApartamentos = async (torreId) => {
    const { data } = await supabase
      .from('apartamentos')
      .select('id, numero')
      .eq('torre_id', torreId);

    setApartamentos(data || []);
  };

  const handleTorreChange = (id) => {
    setTorreSeleccionada(id);
    setApartamentoSeleccionado('');
    obtenerApartamentos(id);
  };

  // 🔥 INDIVIDUAL
  const crearIndividual = async () => {

    if (!form.concepto || !form.valor || !apartamentoSeleccionado) {
      alert('Selecciona apartamento y completa los campos');
      return;
    }

    setLoading(true);

    // 🔥 buscar residente del apartamento
    const { data: residente } = await supabase
      .from('residentes')
      .select('id')
      .eq('apartamento_id', apartamentoSeleccionado)
      .single();

    if (!residente) {
      alert('Este apartamento no tiene residente');
      setLoading(false);
      return;
    }

    const { error } = await supabase
      .from('pagos')
      .insert([{
        residente_id: residente.id,
        concepto: form.concepto,
        valor: Number(form.valor),
        conjunto_id: usuarioApp.conjunto_id,
        estado: 'pendiente'
      }]);

    setLoading(false);

    if (error) {
      console.log(error);
      alert('Error al crear cobro');
      return;
    }

    alert('💰 Cobro creado');

    limpiar();
  };

  // 🔥 MASIVO POR TORRE/APTO
  const crearMasivo = async () => {

    if (!form.concepto || !form.valor || !torreSeleccionada) {
      alert('Selecciona torre y completa los campos');
      return;
    }

    if (!confirm('¿Generar cobro para los apartamentos seleccionados?')) return;

    setLoading(true);

    // 🔥 obtener apartamentos
    const { data: aptos } = await supabase
      .from('apartamentos')
      .select('id')
      .eq('torre_id', torreSeleccionada);

    let apartamentosFiltrados = aptos;

    if (apartamentoSeleccionado) {
      apartamentosFiltrados = aptos.filter(a => a.id === apartamentoSeleccionado);
    }

    // 🔥 residentes por apto
    const { data: residentesFiltrados } = await supabase
      .from('residentes')
      .select('id, apartamento_id')
      .in('apartamento_id', apartamentosFiltrados.map(a => a.id));

    const pagos = residentesFiltrados.map(r => ({
      residente_id: r.id,
      concepto: form.concepto,
      valor: Number(form.valor),
      conjunto_id: usuarioApp.conjunto_id,
      estado: 'pendiente'
    }));

    const { error } = await supabase.from('pagos').insert(pagos);

    setLoading(false);

    if (error) {
      console.log(error);
      alert('Error en cobro masivo');
      return;
    }

    alert(`💰 Cobro generado (${pagos.length} pagos)`);

    limpiar();
  };

  const limpiar = () => {
    setForm({ concepto: '', valor: '' });
    setResidenteSeleccionado('');
    setTorreSeleccionada('');
    setApartamentoSeleccionado('');
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow max-w-xl">

      <h2 className="text-xl font-bold mb-4">
        Crear cobro 💰
      </h2>

      {/* 🔥 TOGGLE */}
      <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => setModo('individual')}
          className={`flex-1 py-2 rounded-lg ${modo === 'individual' ? 'bg-white shadow' : 'text-gray-500'
            }`}
        >
          Individual
        </button>

        <button
          onClick={() => setModo('masivo')}
          className={`flex-1 py-2 rounded-lg ${modo === 'masivo' ? 'bg-white shadow' : 'text-gray-500'
            }`}
        >
          Masivo
        </button>
      </div>

      {/* 👤 INDIVIDUAL */}
      {modo === 'individual' && (
        <>
          <select
            value={torreSeleccionada}
            onChange={e => handleTorreChange(e.target.value)}
            className="w-full mb-3 border rounded-lg px-3 py-2"
          >
            <option value="">Selecciona torre</option>
            {torres.map(t => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
          <select
            value={apartamentoSeleccionado}
            onChange={e => setApartamentoSeleccionado(e.target.value)}
            className="w-full mb-4 border rounded-lg px-3 py-2"
          >
            <option value="">Todos los apartamentos</option>
            {apartamentos.map(a => (
              <option key={a.id} value={a.id}>
                Apto {a.numero}
              </option>
            ))}
          </select>
        </>
      )}

      {/* 🏢 MASIVO */}
      {modo === 'masivo' && (
        <>
          <select
            value={torreSeleccionada}
            onChange={e => handleTorreChange(e.target.value)}
            className="w-full mb-3 border rounded-lg px-3 py-2"
          >
            <option value="">Selecciona torre</option>
            {torres.map(t => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>

          <select
            value={apartamentoSeleccionado}
            onChange={e => setApartamentoSeleccionado(e.target.value)}
            className="w-full mb-4 border rounded-lg px-3 py-2"
          >
            <option value="">Todos los apartamentos</option>
            {apartamentos.map(a => (
              <option key={a.id} value={a.id}>
                Apto {a.numero}
              </option>
            ))}
          </select>
        </>
      )}

      {/* CONCEPTO */}
      <input
        value={form.concepto}
        placeholder="Concepto"
        onChange={e => setForm({ ...form, concepto: e.target.value })}
        className="w-full mb-3 border rounded-lg px-3 py-2"
      />

      {/* VALOR */}
      <input
        value={form.valor}
        type="number"
        placeholder="Valor"
        onChange={e => setForm({ ...form, valor: e.target.value })}
        className="w-full mb-6 border rounded-lg px-3 py-2"
      />

      {/* BOTÓN */}
      <button
        onClick={modo === 'individual' ? crearIndividual : crearMasivo}
        disabled={loading}
        className={`w-full py-2 rounded-lg text-white font-semibold ${modo === 'masivo'
          ? 'bg-purple-600 hover:bg-purple-700'
          : 'bg-blue-600 hover:bg-blue-700'
          }`}
      >
        {loading
          ? 'Procesando...'
          : modo === 'masivo'
            ? 'Generar cobro masivo'
            : 'Crear cobro'}
      </button>

    </div>
  );
}