import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../../services/supabaseClient';
import { registrarPaquete } from '../services/paquetesService';

export default function CrearPaquete({ usuarioApp }) {
  const [torres, setTorres] = useState([]);
  const [loading, setLoading] = useState(false);

  const [torreSeleccionada, setTorreSeleccionada] = useState('');
  const [apartamentoManual, setApartamentoManual] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [categoria, setCategoria] = useState('paquete');

  useEffect(() => {
    if (!usuarioApp?.conjunto_id) return;
    const obtenerTorres = async () => {
      const { data, error } = await supabase
        .from('torres')
        .select('id, nombre')
        .eq('conjunto_id', usuarioApp.conjunto_id)
        .order('nombre', { ascending: true });

      if (error) {
        toast.error('No se pudieron cargar las torres');
        return;
      }

      setTorres(data || []);
    };
    obtenerTorres();
  }, [usuarioApp?.conjunto_id]);

  const limpiarFormulario = () => {
    setDescripcion('');
    setApartamentoManual('');
    setTorreSeleccionada('');
    setCategoria('paquete');
  };

  const crearPaquete = async () => {
    if (!torreSeleccionada) return toast.error('Selecciona torre');
    if (!apartamentoManual.trim()) return toast.error('Escribe el apartamento');
    if (!descripcion.trim()) return toast.error('Ingresa una descripción');
    if (!usuarioApp?.id) return toast.error('Usuario no autenticado');

    setLoading(true);
    const result = await registrarPaquete({
      apartamento_numero: apartamentoManual.trim().toUpperCase(),
      torre_id: torreSeleccionada,
      descripcion: descripcion.trim(),
      categoria
    }, usuarioApp);
    setLoading(false);

    if (!result.ok) {
      toast.error(`No se pudo registrar: ${result.error}`);
      return;
    }

    toast.success(
      categoria === 'servicio_publico'
        ? 'Servicio público recibido y notificado al residente'
        : 'Paquete registrado y notificado al residente'
    );
    limpiarFormulario();
  };

  return (
    <div className="bg-white rounded-2xl shadow p-5 space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Registrar recepción 📦</h2>
        <p className="text-sm text-gray-500">
          Registra paquetes o servicios públicos para que el residente tenga alerta al llegar.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <select
          className="border rounded-lg px-3 py-2"
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
        >
          <option value="paquete">Paquete</option>
          <option value="servicio_publico">Servicio público</option>
        </select>

        <select
          className="border rounded-lg px-3 py-2"
          value={torreSeleccionada}
          onChange={(e) => setTorreSeleccionada(e.target.value)}
        >
          <option value="">Selecciona torre</option>
          {torres.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre}
            </option>
          ))}
        </select>

        <input
          className="border rounded-lg px-3 py-2"
          placeholder="Apartamento (escrito manual, ej: 1203A)"
          value={apartamentoManual}
          onChange={(e) => setApartamentoManual(e.target.value)}
        />

        <input
          className="border rounded-lg px-3 py-2"
          placeholder={categoria === 'servicio_publico' ? 'Ej: Factura de energía abril' : 'Ej: Amazon, MercadoLibre'}
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
        />
      </div>

      <button
        onClick={crearPaquete}
        disabled={loading}
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
      >
        {loading ? 'Guardando...' : (categoria === 'servicio_publico' ? 'Registrar servicio público' : 'Guardar paquete')}
      </button>
    </div>
  );
}
