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
    <div className="app-surface-primary rounded-2xl border border-brand-primary/10 p-4 space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Registrar recepción 📦</h2>
        <p className="text-xs text-app-text-secondary">Carga rápida por torre y apartamento.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-app-text-secondary">Tipo de registro</span>
          <select className="app-input w-full" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="paquete">Paquete</option>
            <option value="servicio_publico">Servicio público</option>
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-app-text-secondary">Torre</span>
          <select className="app-input w-full" value={torreSeleccionada} onChange={(e) => setTorreSeleccionada(e.target.value)}>
            <option value="">Selecciona torre</option>
            {torres.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-app-text-secondary">Apartamento</span>
          <input className="app-input w-full" placeholder="Ej: 201" value={apartamentoManual} onChange={(e) => setApartamentoManual(e.target.value)} />
        </label>

        <label className="block space-y-1 sm:col-span-2 xl:col-span-1">
          <span className="text-xs font-medium text-app-text-secondary">Descripción</span>
          <input className="app-input w-full" placeholder={categoria === 'servicio_publico' ? 'Ej: Factura de energía abril' : 'Ej: Amazon, MercadoLibre'} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        </label>
      </div>

      <button onClick={crearPaquete} disabled={loading} className="app-btn-primary w-full text-sm">
        {loading ? 'Guardando...' : (categoria === 'servicio_publico' ? 'Registrar servicio público' : 'Guardar paquete')}
      </button>
    </div>
  );
}
