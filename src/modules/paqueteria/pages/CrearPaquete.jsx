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

      if (error) return toast.error('No se pudieron cargar las torres');
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

    if (!result.ok) return toast.error(`No se pudo registrar: ${result.error}`);

    toast.success(categoria === 'servicio_publico' ? 'Servicio público recibido y notificado al residente' : 'Paquete registrado y notificado al residente');
    window.dispatchEvent(new CustomEvent('paqueteria:changed', { detail: { action: 'created', paquete: result.paquete || null } }));
    limpiarFormulario();
  };

  return (
    <div className="app-surface-primary p-5 space-y-5">
      <div>
        <h2 className="text-2xl font-bold">Registrar recepción 📦</h2>
        <p className="text-sm text-app-text-secondary">Carga rápida para paquetería y servicios públicos por torre/apartamento.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <select className="app-input" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          <option value="paquete">Paquete</option>
          <option value="servicio_publico">Servicio público</option>
        </select>

        <select className="app-input" value={torreSeleccionada} onChange={(e) => setTorreSeleccionada(e.target.value)}>
          <option value="">Selecciona torre</option>
          {torres.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
        </select>

        <input className="app-input" placeholder="Apartamento" value={apartamentoManual} onChange={(e) => setApartamentoManual(e.target.value)} />
        <input className="app-input" placeholder={categoria === 'servicio_publico' ? 'Ej: Factura de energía abril' : 'Ej: Amazon, MercadoLibre'} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
      </div>

      <button onClick={crearPaquete} disabled={loading} className="app-btn-primary">
        {loading ? 'Guardando...' : (categoria === 'servicio_publico' ? 'Registrar servicio público' : 'Guardar paquete')}
      </button>
    </div>
  );
}
