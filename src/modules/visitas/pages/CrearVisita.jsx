import { useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import toast from 'react-hot-toast';
import { supabase } from '../../../services/supabaseClient';
import { crearVisita as crearVisitaService } from '../services/visitasService';

export default function CrearVisita({ usuarioApp }) {
  const normalizarEstado = (estado) => String(estado || '').trim().toLowerCase();
  const hoyBogota = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Bogota' });
  const fechaHoy = hoyBogota();
  const [form, setForm] = useState({
    nombre: '',
    tipo_documento: '',
    documento: '',
    fecha: fechaHoy,
    tipoVehiculo: '',
    placa: ''
  });
  const [touched, setTouched] = useState({ nombre: false, documento: false, fecha: false });
  const [tiposDocumento, setTiposDocumento] = useState([]);
  const [loading, setLoading] = useState(false);
  const [qrPayload, setQrPayload] = useState(null);
  const [residenteId, setResidenteId] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [filtroHistorial, setFiltroHistorial] = useState('todos');
  const [busquedaFrecuentes, setBusquedaFrecuentes] = useState('');
  const [paginaFrecuentes, setPaginaFrecuentes] = useState(1);
  const qrWrapRef = useRef(null);
  const toastTiposShownRef = useRef(false);

  useEffect(() => {
    const cargarTipos = async () => {
      let { data, error } = await supabase
        .from('tipos_documento')
        .select('id, codigo, nombre, activo')
        .order('id', { ascending: true });

      if ((!data || !data.length) && !error) {
        const allResp = await supabase
          .from('tipos_documento')
          .select('id, codigo, nombre, activo')
          .order('id', { ascending: true });
        data = allResp.data;
        error = allResp.error;
      }

      if (error || !Array.isArray(data)) {
        setTiposDocumento([]);
        if (!toastTiposShownRef.current) {
          toast.error(`No se pudo cargar catálogo tipos_documento (${error?.message || 'sin acceso'})`);
          toastTiposShownRef.current = true;
        }
        return;
      }

      const normalizados = data
        .filter((row) => {
          if (row.activo === undefined || row.activo === null) return true;
          if (typeof row.activo === 'boolean') return row.activo;
          return ['true', '1', 'activo'].includes(String(row.activo).toLowerCase());
        })
        .map((row) => ({
          codigo: String(row.codigo || '').trim(),
          nombre: String(row.nombre || '').trim()
        }))
        .filter((row) => row.codigo && row.nombre);

      setTiposDocumento(normalizados);
      setForm((prev) => ({
        ...prev,
        tipo_documento: prev.tipo_documento && normalizados.some((t) => t.codigo === prev.tipo_documento)
          ? prev.tipo_documento
          : (normalizados[0]?.codigo || '')
      }));
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
  const erroresFormulario = useMemo(() => ({
    nombre: !form.nombre.trim() ? 'Ingresa el nombre del visitante.' : '',
    documento: !form.documento.trim() ? 'Ingresa el número de documento.' : '',
    fecha: !form.fecha ? 'Selecciona la fecha de la visita.' : ''
  }), [form.nombre, form.documento, form.fecha]);
  const visitantesSugeridos = useMemo(() => {
    const map = new Map();
    historial.forEach((h) => {
      const key = `${h.tipo_documento || ''}-${h.documento || ''}`;
      if (!map.has(key)) map.set(key, h);
    });
    return Array.from(map.values());
  }, [historial]);

  const aplicarVisitanteSugerido = (value, campo) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return;
    const found = visitantesSugeridos.find((h) => {
      if (campo === 'documento') return String(h.documento || '').trim().toLowerCase() === normalized;
      return String(h.nombre_visitante || '').trim().toLowerCase() === normalized;
    });
    if (!found) return;
    setForm((prev) => ({
      ...prev,
      nombre: found.nombre_visitante || prev.nombre,
      tipo_documento: found.tipo_documento || prev.tipo_documento,
      documento: found.documento || prev.documento,
      tipoVehiculo: found.tipo_vehiculo || prev.tipoVehiculo,
      placa: found.placa || prev.placa
    }));
  };

  const crearVisita = async () => {
    if (!form.nombre || !form.documento || !form.fecha || !form.tipo_documento) {
      setTouched({ nombre: true, documento: true, fecha: true });
      toast('Completa los campos obligatorios ⚠️');
      return;
    }

    if (!tiposDocumento.length) {
      toast.error('No hay tipos de documento configurados en Supabase');
      return;
    }

    const tipoValido = tiposDocumento.some((t) => t.codigo === form.tipo_documento);
    if (!tipoValido) {
      toast.error('Tipo de documento no válido. Actualiza e intenta de nuevo.');
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
    setForm((prev) => ({ nombre: '', tipo_documento: prev.tipo_documento, documento: '', fecha: fechaHoy, tipoVehiculo: '', placa: '' }));
    setTouched({ nombre: false, documento: false, fecha: false });
    if (residenteId) cargarHistorial(residenteId);
  };

  const compartirCodigoQR = async () => {
    if (!qrPayload) return;
    const texto = `Te comparto tu acceso de visita Urbaphix:\n${qrPayload}`;

    if (navigator.share) {
      await navigator.share({ title: 'QR de visita', text: texto });
      toast.success('Código QR compartido');
      return;
    }
    await navigator.clipboard.writeText(texto);
    toast.success('Código QR copiado para compartir.');
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

  const historialFiltrado = useMemo(() => {
    if (filtroHistorial === 'todos') return historial;
    return historial.filter((h) => normalizarEstado(h.estado) === filtroHistorial);
  }, [historial, filtroHistorial]);
  const historialBuscado = useMemo(() => {
    const term = busquedaFrecuentes.trim().toLowerCase();
    if (!term) return historialFiltrado;
    return historialFiltrado.filter((h) => (h.nombre_visitante || '').toLowerCase().includes(term));
  }, [historialFiltrado, busquedaFrecuentes]);
  const PAGE_SIZE = 6;
  const totalPaginasFrecuentes = Math.max(1, Math.ceil(historialBuscado.length / PAGE_SIZE));
  const paginaFrecuenteActual = Math.min(paginaFrecuentes, totalPaginasFrecuentes);
  const historialPaginado = historialBuscado.slice((paginaFrecuenteActual - 1) * PAGE_SIZE, paginaFrecuenteActual * PAGE_SIZE);

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
          list="sugerencias-nombre-visitante"
          value={form.nombre}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          onBlur={(e) => {
            setTouched((prev) => ({ ...prev, nombre: true }));
            aplicarVisitanteSugerido(e.target.value, 'nombre');
          }}
        />
        <datalist id="sugerencias-nombre-visitante">
          {visitantesSugeridos.map((v) => (
            <option key={`name-${v.id}`} value={v.nombre_visitante || ''} />
          ))}
        </datalist>

        <select
          className="border rounded-lg px-3 py-2"
          value={form.tipo_documento}
          onChange={(e) => setForm({ ...form, tipo_documento: e.target.value })}
        >
          {!tiposDocumento.length && <option value="">Seleccione tipo documento</option>}
          {tiposDocumento.map((item) => (
            <option key={item.codigo} value={item.codigo}>{item.nombre}</option>
          ))}
        </select>

        <input
          className="border rounded-lg px-3 py-2"
          placeholder="Documento"
          list="sugerencias-documento-visitante"
          value={form.documento}
          onChange={(e) => setForm({ ...form, documento: e.target.value })}
          onBlur={(e) => {
            setTouched((prev) => ({ ...prev, documento: true }));
            aplicarVisitanteSugerido(e.target.value, 'documento');
          }}
        />
        <datalist id="sugerencias-documento-visitante">
          {visitantesSugeridos.map((v) => (
            <option key={`doc-${v.id}`} value={v.documento || ''} />
          ))}
        </datalist>

        <input
          type="date"
          className="border rounded-lg px-3 py-2"
          value={form.fecha}
          min={hoyBogota()}
          onChange={(e) => setForm({ ...form, fecha: e.target.value })}
          onBlur={() => setTouched((prev) => ({ ...prev, fecha: true }))}
        />
      </div>
      <div className="grid md:grid-cols-3 gap-2">
        <div>{touched.nombre && erroresFormulario.nombre && <p className="text-xs text-red-600">{erroresFormulario.nombre}</p>}</div>
        <div>{touched.documento && erroresFormulario.documento && <p className="text-xs text-red-600">{erroresFormulario.documento}</p>}</div>
        <div>{touched.fecha && erroresFormulario.fecha && <p className="text-xs text-red-600">{erroresFormulario.fecha}</p>}</div>
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

      <button
        onClick={crearVisita}
        disabled={loading}
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg w-full"
      >
        {loading ? 'Creando...' : 'Crear visita y generar QR'}
      </button>
      </div>

      {form.tipoVehiculo && (
        <input
          className="border rounded-lg px-3 py-2 w-full md:w-1/2"
          placeholder={form.tipoVehiculo === 'carro' ? 'Placa carro (ABC123)' : 'Placa moto (ABC12 o ABC12D)'}
          value={form.placa}
          maxLength={6}
          onChange={(e) => setForm({ ...form, placa: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
        />
      )}
      {form.tipoVehiculo && form.placa && !validacionPlaca.ok && (
        <p className="text-xs text-red-600">{validacionPlaca.mensaje}</p>
      )}

      {qrPayload && (
        <div ref={qrWrapRef} className="border rounded-xl p-4 bg-slate-50 space-y-3">
          <h3 className="font-semibold">QR validable en portería 🔐</h3>
          <p className="text-xs text-gray-500">Portería puede validar este QR escaneando o pegando el código manual.</p>
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <QRCodeCanvas value={qrPayload} size={180} />
            <div className="space-y-2">
              <button className="w-full bg-emerald-600 text-white rounded-lg px-3 py-2 text-sm" onClick={compartirCodigoQR}>Compartir código QR</button>
              <button className="w-full bg-slate-900 text-white rounded-lg px-3 py-2 text-sm" onClick={compartirImagenQR}>Compartir QR</button>
            </div>
          </div>
        </div>
      )}

      <div className="border rounded-xl p-4 space-y-3 bg-slate-50/60">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Visitantes frecuentes</h3>
          <span className="text-xs text-gray-500">{historialFiltrado.length} registros</span>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <button className={`px-3 py-1 rounded-full ${filtroHistorial === 'todos' ? 'bg-slate-900 text-white' : 'bg-slate-100'}`} onClick={() => { setFiltroHistorial('todos'); setPaginaFrecuentes(1); }}>Todos</button>
          <button className={`px-3 py-1 rounded-full ${filtroHistorial === 'pendiente' ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-700'}`} onClick={() => { setFiltroHistorial('pendiente'); setPaginaFrecuentes(1); }}>Pendientes</button>
          <button className={`px-3 py-1 rounded-full ${filtroHistorial === 'ingresado' ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700'}`} onClick={() => { setFiltroHistorial('ingresado'); setPaginaFrecuentes(1); }}>En curso</button>
          <button className={`px-3 py-1 rounded-full ${filtroHistorial === 'salido' ? 'bg-green-600 text-white' : 'bg-green-100 text-green-700'}`} onClick={() => { setFiltroHistorial('salido'); setPaginaFrecuentes(1); }}>Completadas</button>
        </div>
        <input
          className="w-full border rounded-lg px-3 py-2 text-sm"
          placeholder="Filtrar por nombre del visitante"
          value={busquedaFrecuentes}
          onChange={(e) => {
            setBusquedaFrecuentes(e.target.value);
            setPaginaFrecuentes(1);
          }}
        />
        <div className="space-y-2 max-h-72 overflow-auto">
          {historialPaginado.map((item) => (
            <div key={item.id} className="border rounded-xl p-3 text-sm bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{item.nombre_visitante} · {item.documento}</p>
                <span className={`px-2 py-0.5 rounded-full text-xs ${
                  normalizarEstado(item.estado) === 'salido'
                    ? 'bg-green-100 text-green-700'
                    : normalizarEstado(item.estado) === 'ingresado'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-amber-100 text-amber-700'
                }`}>
                  {normalizarEstado(item.estado) === 'salido' ? 'Completada' : normalizarEstado(item.estado) === 'ingresado' ? 'En curso' : 'Pendiente'}
                </span>
              </div>
              <p className="text-gray-500">Fecha visita: {item.fecha_visita}</p>
              {item.placa && <p className="text-gray-500">Placa: {item.placa}</p>}
              <div className="flex flex-wrap gap-2 mt-2">
                {normalizarEstado(item.estado) === 'pendiente' && (
                  <button className="px-2 py-1 border rounded" onClick={() => setQRDesdeHistorial(item)}>Reenviar QR</button>
                )}
                {normalizarEstado(item.estado) === 'salido' && (
                  <button className="px-2 py-1 border rounded" onClick={() => reutilizarVisita(item)}>Crear nueva visita con estos datos</button>
                )}
              </div>
            </div>
          ))}
          {historialBuscado.length === 0 && <p className="text-sm text-gray-500">No hay visitas para este filtro.</p>}
        </div>
        {historialBuscado.length > 0 && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Página {paginaFrecuenteActual} de {totalPaginasFrecuentes}</span>
            <div className="flex gap-2">
              <button
                className="px-2 py-1 border rounded disabled:opacity-40"
                disabled={paginaFrecuenteActual === 1}
                onClick={() => setPaginaFrecuentes((p) => Math.max(1, p - 1))}
              >
                Anterior
              </button>
              <button
                className="px-2 py-1 border rounded disabled:opacity-40"
                disabled={paginaFrecuenteActual === totalPaginasFrecuentes}
                onClick={() => setPaginaFrecuentes((p) => Math.min(totalPaginasFrecuentes, p + 1))}
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
