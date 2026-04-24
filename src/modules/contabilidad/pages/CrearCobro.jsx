import { useEffect, useState } from 'react';
import { supabase } from '../../../services/supabaseClient';
import { crearPago } from '../services/contabilidadService';
import toast from 'react-hot-toast';

const CATEGORIAS_PH = [
  { value: 'administracion', label: 'Administración' },
  { value: 'incumplimiento_rph', label: 'Incumplimiento RPH' },
  { value: 'llamado_atencion', label: 'Llamado de atención' },
  { value: 'multa', label: 'Multa' },
  { value: 'cuota_extraordinaria', label: 'Cuota extraordinaria' }
];

export default function CrearCobro({ usuarioApp }) {
  const [modo, setModo] = useState('individual');
  const [loading, setLoading] = useState(false);

  const [torres, setTorres] = useState([]);
  const [torreSeleccionada, setTorreSeleccionada] = useState('');
  const [apartamentoInput, setApartamentoInput] = useState('');

  const [form, setForm] = useState({
    concepto: 'administracion',
    subcategoriaMulta: '',
    valor: ''
  });

  const [tarifasTipo, setTarifasTipo] = useState({
    pequeno: '60000',
    mediano: '80000',
    grande: '96000'
  });

  const formatearMiles = (value) => {
    const limpio = String(value || '').replace(/\D/g, '');
    if (!limpio) return '';
    return Number(limpio).toLocaleString('es-CO');
  };

  const normalizarInputMoneda = (value) => String(value || '').replace(/\D/g, '');

  const notificarError = (codigo, detalle) => toast.error(`${codigo}: ${detalle}`);

  useEffect(() => {
    const cargarTorres = async () => {
      if (!usuarioApp?.conjunto_id) return;
      const { data } = await supabase
        .from('torres')
        .select('id, nombre')
        .eq('conjunto_id', usuarioApp.conjunto_id);
      setTorres(data || []);
    };
    cargarTorres();
  }, [usuarioApp]);

  const limpiar = () => {
    setApartamentoInput('');
    setTorreSeleccionada('');
    setForm({ concepto: 'administracion', subcategoriaMulta: '', valor: '' });
  };

  const obtenerResidentePorApartamento = async () => {
    const numero = apartamentoInput.trim();
    if (!numero) return { residenteId: null, error: 'Ingresa un apartamento' };

    let query = supabase
      .from('apartamentos')
      .select('id, numero, torre_id')
      .eq('conjunto_id', usuarioApp.conjunto_id)
      .eq('numero', numero);

    if (torreSeleccionada) {
      query = query.eq('torre_id', torreSeleccionada);
    }

    const { data: aptos, error: aptoError } = await query;
    if (aptoError || !aptos?.length) {
      return { residenteId: null, error: 'No existe ese apartamento en el conjunto' };
    }

    if (aptos.length > 1) {
      return { residenteId: null, error: 'Hay apartamentos repetidos, filtra por torre' };
    }

    const { data: residente } = await supabase
      .from('residentes')
      .select('id')
      .eq('apartamento_id', aptos[0].id)
      .single();

    if (!residente?.id) return { residenteId: null, error: 'Este apartamento no tiene residente' };
    return { residenteId: residente.id, error: null };
  };

  const crearIndividual = async () => {
    if (!form.concepto || !form.valor) {
      notificarError('COBRO-001', 'Completa categoría y valor');
      return;
    }

    setLoading(true);
    const { residenteId, error: errorResidente } = await obtenerResidentePorApartamento();
    if (errorResidente) {
      notificarError('COBRO-002', errorResidente);
      setLoading(false);
      return;
    }

    const { data: authData, error: errorAuth } = await supabase.auth.getUser();
    if (errorAuth || !authData?.user) {
      notificarError('COBRO-003', 'No se pudo validar la sesión');
      setLoading(false);
      return;
    }

    const conceptoLabel = CATEGORIAS_PH.find((c) => c.value === form.concepto)?.label || form.concepto;
    const esMulta = form.concepto === 'multa';
    if (esMulta && !form.subcategoriaMulta) {
      notificarError('COBRO-004', 'Selecciona subcategoría de multa');
      setLoading(false);
      return;
    }

    const tipoPago = esMulta ? 'multa' : form.concepto;
    const conceptoFinal = esMulta ? `${conceptoLabel} - ${form.subcategoriaMulta}` : conceptoLabel;

    const { error } = await crearPago({
      residente_id: residenteId,
      concepto: conceptoFinal,
      tipo_pago: tipoPago,
      valor: Number(form.valor)
    }, authData.user);

    if (error) {
      notificarError('COBRO-004', error);
      setLoading(false);
      return;
    }

    toast.success('💰 Cobro individual creado');
    limpiar();
    setLoading(false);
  };

  const crearMasivo = async () => {
    const adminTarifas = {
      pequeno: Number(tarifasTipo.pequeno || 0),
      mediano: Number(tarifasTipo.mediano || 0),
      grande: Number(tarifasTipo.grande || 0)
    };

    if (Object.values(adminTarifas).some((v) => !Number.isFinite(v) || v <= 0)) {
      notificarError('COBRO-005', 'Configura tarifas válidas para pequeño, mediano y grande');
      return;
    }

    if (!confirm('¿Generar cobros masivos por tipo de apartamento para TODO el conjunto?')) return;

    setLoading(true);

    const { data: apartamentos, error: errorAptos } = await supabase
      .from('apartamentos')
      .select('id, tipo_apartamento')
      .eq('conjunto_id', usuarioApp.conjunto_id);

    if (errorAptos) {
      notificarError('COBRO-006', 'No se pudieron cargar apartamentos');
      setLoading(false);
      return;
    }

    const { data: residentes } = await supabase
      .from('residentes')
      .select('id, apartamento_id')
      .in('apartamento_id', (apartamentos || []).map((a) => a.id));

    if (!residentes?.length) {
      notificarError('COBRO-007', 'No hay residentes para cobrar');
      setLoading(false);
      return;
    }

    const aptoPorId = {};
    (apartamentos || []).forEach((a) => { aptoPorId[a.id] = a; });

    const { data: authData, error: errorAuth } = await supabase.auth.getUser();
    if (errorAuth || !authData?.user) {
      notificarError('COBRO-008', 'No se pudo validar la sesión');
      setLoading(false);
      return;
    }

    let exitosos = 0;
    let omitidos = 0;
    for (const r of residentes) {
      const tipo = String(aptoPorId[r.apartamento_id]?.tipo_apartamento || '').toLowerCase();
      const valor = adminTarifas[tipo];
      if (!valor) {
        omitidos += 1;
        continue;
      }

      const { error } = await crearPago({
        residente_id: r.id,
        concepto: 'Administración',
        tipo_pago: 'administracion',
        valor
      }, authData.user);

      if (error) {
        omitidos += 1;
      } else {
        exitosos += 1;
      }
    }

    if (exitosos === 0) {
      notificarError('COBRO-009', 'No se logró generar cobros');
    } else {
      toast.success(`💰 Cobros masivos generados: ${exitosos}. Omitidos: ${omitidos}`);
    }

    setLoading(false);
  };

  return (
    <div className="app-surface-primary p-5 space-y-4">
      <h2 className="text-xl font-bold mb-1">Crear cobro 💰</h2>
      <p className="text-sm text-app-text-secondary mb-4">Cobro individual por apartamento escrito o masivo por tipo de apartamento.</p>

      <div className="flex mb-6 bg-app-bg rounded-lg p-1">
        <button
          onClick={() => setModo('individual')}
          className={`flex-1 py-2 rounded-lg ${modo === 'individual' ? 'bg-app-bg-alt shadow' : 'text-app-text-secondary'}`}
        >
          Individual
        </button>
        <button
          onClick={() => setModo('masivo')}
          className={`flex-1 py-2 rounded-lg ${modo === 'masivo' ? 'bg-app-bg-alt shadow' : 'text-app-text-secondary'}`}
        >
          Masivo
        </button>
      </div>

      {modo === 'individual' && (
        <div className="space-y-3">
          <select
            value={torreSeleccionada}
            onChange={(e) => setTorreSeleccionada(e.target.value)}
            className="app-input"
          >
            <option value="">Torre</option>
            {torres.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>

          <input
            value={apartamentoInput}
            placeholder="Escribe apartamento (ej: 301)"
            onChange={(e) => setApartamentoInput(e.target.value)}
            className="app-input"
          />

          <select
            value={form.concepto}
            onChange={(e) => setForm({ ...form, concepto: e.target.value, subcategoriaMulta: '' })}
            className="app-input"
          >
            {CATEGORIAS_PH.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>

          {form.concepto === 'multa' && (
            <select
              value={form.subcategoriaMulta}
              onChange={(e) => setForm({ ...form, subcategoriaMulta: e.target.value })}
              className="app-input"
            >
              <option value="">Subcategoría de multa</option>
              <option value="leve">Leve</option>
              <option value="moderado">Moderado</option>
              <option value="grave">Grave</option>
            </select>
          )}

          <input
            value={formatearMiles(form.valor)}
            type="text"
            inputMode="numeric"
            placeholder="Valor (ej: 100.000)"
            onChange={(e) => setForm({ ...form, valor: normalizarInputMoneda(e.target.value) })}
            className="app-input"
          />
          {form.valor && (
            <p className="text-xs text-app-text-secondary">
              Valor a cobrar: ${formatearMiles(form.valor)}
            </p>
          )}
        </div>
      )}

      {modo === 'masivo' && (
        <div className="space-y-3">
          <p className="text-sm text-app-text-secondary">Se aplicará administración masiva a todos los apartamentos según <b>tipo apartamento</b>.</p>
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-app-text-secondary">Pequeño</label>
              <input
                type="text"
                inputMode="numeric"
                value={formatearMiles(tarifasTipo.pequeno)}
                onChange={(e) => setTarifasTipo({ ...tarifasTipo, pequeno: normalizarInputMoneda(e.target.value) })}
                className="app-input"
              />
            </div>
            <div>
              <label className="text-xs text-app-text-secondary">Mediano</label>
              <input
                type="text"
                inputMode="numeric"
                value={formatearMiles(tarifasTipo.mediano)}
                onChange={(e) => setTarifasTipo({ ...tarifasTipo, mediano: normalizarInputMoneda(e.target.value) })}
                className="app-input"
              />
            </div>
            <div>
              <label className="text-xs text-app-text-secondary">Grande</label>
              <input
                type="text"
                inputMode="numeric"
                value={formatearMiles(tarifasTipo.grande)}
                onChange={(e) => setTarifasTipo({ ...tarifasTipo, grande: normalizarInputMoneda(e.target.value) })}
                className="app-input"
              />
            </div>
          </div>
          <p className="text-xs text-app-text-secondary">Los valores se guardan como número, con visualización en miles para facilitar la carga.</p>
        </div>
      )}

      <button
        onClick={modo === 'individual' ? crearIndividual : crearMasivo}
        disabled={loading}
        className={`w-full mt-6 py-2 rounded-lg text-white font-semibold ${modo === 'masivo' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'}`}
      >
        {loading ? 'Procesando...' : modo === 'masivo' ? 'Generar cobro masivo' : 'Crear cobro'}
      </button>
    </div>
  );
}
