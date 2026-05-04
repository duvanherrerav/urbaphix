import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../../services/supabaseClient';
import { crearVisita as crearVisitaService } from '../services/visitasService';
import QRShareCard from '../components/QRShareCard';


const formatManualIngresoCode = (qrCode) => {
  const normalized = String(qrCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!normalized) return '';
  const base = normalized.slice(-8).padStart(8, '0');
  return `${base.slice(0, 4)}-${base.slice(4)}`;
};


export default function CrearVisita({ usuarioApp: _usuarioApp }) {
  const normalizarEstado = (estado) => String(estado || '').trim().toLowerCase();
  const hoyBogota = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Bogota' });
  const fechaHoy = hoyBogota();
  const normalizarDocumento = (value) => String(value || '').replace(/\s+/g, '').toUpperCase();
  const normalizarNombre = (value) => String(value || '').replace(/\s+/g, ' ').trim();
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
  const [qrMetadata, setQrMetadata] = useState({ visitanteNombre: '', fechaVisita: '' });
  const [residenteId, setResidenteId] = useState(null);
  const [resumenOpen, setResumenOpen] = useState(false);
  const [historial, setHistorial] = useState([]);
  const [filtroHistorial, setFiltroHistorial] = useState('todos');
  const [busquedaFrecuentes, setBusquedaFrecuentes] = useState('');
  const [paginaFrecuentes, setPaginaFrecuentes] = useState(1);
  const qrWrapRef = useRef(null);
  const qrSectionRef = useRef(null);
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
    const { data, error } = await supabase
      .from('registro_visitas')
      .select(`
        id, fecha_visita, estado, qr_code, created_at,
        visitantes!inner(id, residente_id, nombre, tipo_documento, documento, placa, tipo_vehiculo)
      `)
      .eq('visitantes.residente_id', rid)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) {
      toast.error('No se pudo cargar el historial de visitas');
      setHistorial([]);
      return;
    }
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
      const { data: residentesRows } = await supabase
        .from('residentes')
        .select('id')
        .eq('usuario_id', authData?.user?.id)
        .limit(1);
      const residente = residentesRows?.[0] || null;
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
    nombre: !form.nombre.trim() ? 'Ingresa el nombre del visitante' : '',
    documento: !form.documento.trim() ? 'Ingresa el documento del visitante' : '',
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
    const nombreLimpio = normalizarNombre(form.nombre);
    const documentoLimpio = normalizarDocumento(form.documento);

    if (!nombreLimpio || !documentoLimpio || !form.fecha || !form.tipo_documento) {
      setTouched({ nombre: true, documento: true, fecha: true });
      toast('Completa los campos obligatorios ⚠️');
      return;
    }
    if (form.fecha < hoyBogota()) {
      setTouched((prev) => ({ ...prev, fecha: true }));
      toast.error('La fecha no puede ser anterior a hoy');
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
    const { data: residentesRows } = await supabase
      .from('residentes')
      .select('id, apartamento_id')
      .eq('usuario_id', authData?.user?.id)
      .limit(1);
    const residente = residentesRows?.[0] || null;

    if (!residente?.id) {
      toast.error('No tienes residente asociado');
      setLoading(false);
      return;
    }

    const { ok, visita, qr_code, error } = await crearVisitaService({
      residente_id: residente.id,
      apartamento_id: residente.apartamento_id,
      nombre: nombreLimpio,
      tipo_documento: form.tipo_documento,
      documento: documentoLimpio,
      tipo_vehiculo: form.tipoVehiculo || null,
      placa: form.tipoVehiculo ? form.placa : null,
      fecha: form.fecha
    }, authData?.user);

    setLoading(false);
    if (!ok || !visita) {
      toast.error(error || 'No se pudo crear la visita');
      return;
    }

    setQrPayload(qr_code);
    setQrMetadata({ visitanteNombre: nombreLimpio, fechaVisita: form.fecha });
    toast.success('Visita registrada correctamente');
    setForm((prev) => ({ nombre: '', tipo_documento: prev.tipo_documento, documento: '', fecha: hoyBogota(), tipoVehiculo: '', placa: '' }));
    setTouched({ nombre: false, documento: false, fecha: false });
    if (residenteId) cargarHistorial(residenteId);
    requestAnimationFrame(() => qrWrapRef.current?.focus() || qrSectionRef.current?.focus());
  };

  const compartirCodigoQR = async () => {
    if (!qrPayload) return;
    const codigoIngreso = formatManualIngresoCode(qrPayload);
    const texto = `Urbaphix · Código de ingreso\nCódigo manual: ${codigoIngreso}\nCódigo QR: ${qrPayload}`;

    try {
      if (navigator.share) {
        await navigator.share({ title: 'QR de visita', text: texto });
        toast.success('Código compartido');
        return;
      }
      await navigator.clipboard.writeText(texto);
      toast.success('Código copiado');
    } catch (error) {
      toast.error(`No se pudo compartir el QR: ${error?.message || 'error inesperado'}`);
    }
  };

  const copiarCodigo = async () => {
    if (!qrPayload) return;
    const codigoIngreso = formatManualIngresoCode(qrPayload);
    const texto = `Urbaphix · Código de ingreso\nCódigo manual: ${codigoIngreso}\nCódigo QR: ${qrPayload}`;
    try {
      await navigator.clipboard.writeText(texto);
      toast.success('Código copiado');
    } catch (error) {
      toast.error(`No se pudo copiar el código: ${error?.message || 'error inesperado'}`);
    }
  };

  const compartirImagenQR = async () => {
    const canvas = qrWrapRef.current?.querySelector('canvas');
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/png');
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], 'qr-visita.png', { type: 'image/png' });

    try {
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: 'QR visita', files: [file] });
        return;
      }
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'qr-visita.png';
      a.click();
      toast.success('Imagen QR descargada');
    } catch (error) {
      toast.error(`No se pudo compartir la imagen del QR: ${error?.message || 'error inesperado'}`);
    }
  };

  const setQRDesdeHistorial = (item) => {
    setQrPayload(item.qr_code);
    setQrMetadata({
      visitanteNombre: normalizarNombre(item.nombre_visitante || ''),
      fechaVisita: item.fecha_visita || ''
    });
  };

  const reutilizarVisita = (item) => {
    setForm({
      nombre: item.nombre_visitante || '',
      tipo_documento: item.tipo_documento || 'CC',
      documento: item.documento || '',
      fecha: hoyBogota(),
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
  const quickFrecuentes = useMemo(() => visitantesSugeridos.slice(0, 5), [visitantesSugeridos]);

  return (
    <div className="app-surface-primary p-6 space-y-5 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold">Solicitar visita 🚶‍♂️</h2>
        <p className="text-sm text-app-text-secondary">Completa los datos y genera un código para el ingreso en portería.</p>
      </div>

      <section className="app-surface-muted p-4 space-y-3"><h3 className="font-semibold">Datos del visitante</h3><div className="grid md:grid-cols-2 gap-3">
        <input
          className="app-input"
          placeholder="Nombre visitante"
          list="sugerencias-nombre-visitante"
          value={form.nombre}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          onBlur={(e) => {
            setTouched((prev) => ({ ...prev, nombre: true }));
            setForm((prev) => ({ ...prev, nombre: normalizarNombre(prev.nombre) }));
            aplicarVisitanteSugerido(e.target.value, 'nombre');
          }}
        />
        <datalist id="sugerencias-nombre-visitante">
          {visitantesSugeridos.map((v) => (
            <option key={`name-${v.id}`} value={v.nombre_visitante || ''} />
          ))}
        </datalist>

        <select
          className="app-input"
          value={form.tipo_documento}
          onChange={(e) => setForm({ ...form, tipo_documento: e.target.value })}
        >
          {!tiposDocumento.length && <option value="">Seleccione tipo documento</option>}
          {tiposDocumento.map((item) => (
            <option key={item.codigo} value={item.codigo}>{item.nombre}</option>
          ))}
        </select>

        <input
          className="app-input"
          placeholder="Documento"
          list="sugerencias-documento-visitante"
          value={form.documento}
          onChange={(e) => setForm({ ...form, documento: normalizarDocumento(e.target.value) })}
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
          className="app-input"
          value={form.fecha}
          min={hoyBogota()}
          onChange={(e) => setForm({ ...form, fecha: e.target.value })}
          onBlur={() => setTouched((prev) => ({ ...prev, fecha: true }))}
        />
      </div><p className="text-xs text-app-text-secondary">Documento del visitante para control en portería</p></section>
      <section className="app-surface-muted p-4 space-y-3"><h3 className="font-semibold">Detalles de la visita</h3><p className="text-xs text-app-text-secondary">Selecciona el día en que llegará tu visita</p>{quickFrecuentes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-app-text-secondary">Accesos rápidos de visitantes frecuentes</p>
          <div className="flex flex-wrap gap-2">
            {quickFrecuentes.map((item) => (
              <button
                key={`quick-${item.id}`}
                type="button"
                className="text-xs px-3 py-1 rounded-full border border-app-border bg-app-bg-alt hover:bg-[#10253f]"
                onClick={() => reutilizarVisita(item)}
              >
                {item.nombre_visitante} · {item.documento}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="grid md:grid-cols-3 gap-2">
        <div>{touched.nombre && erroresFormulario.nombre && <p className="text-xs text-state-error">{erroresFormulario.nombre}</p>}</div>
        <div>{touched.documento && erroresFormulario.documento && <p className="text-xs text-state-error">{erroresFormulario.documento}</p>}</div>
        <div>{touched.fecha && erroresFormulario.fecha && <p className="text-xs text-state-error">{erroresFormulario.fecha}</p>}</div>
      </div>

      </section>

      <section className="app-surface-muted p-4 space-y-3"><h3 className="font-semibold">Vehículo (opcional)</h3><div className="grid md:grid-cols-2 gap-3 items-start">
        <select
          className="app-input w-full"
          value={form.tipoVehiculo}
          onChange={(e) => setForm({ ...form, tipoVehiculo: e.target.value, placa: '' })}
        >
          <option value="">Sin vehículo</option>
          <option value="carro">Carro</option>
          <option value="moto">Moto</option>
        </select>

        {form.tipoVehiculo && (
          <input
            className="app-input w-full"
            placeholder={form.tipoVehiculo === 'carro' ? 'Placa carro (ABC123)' : 'Placa moto (ABC12 o ABC12D)'}
            value={form.placa}
            maxLength={6}
            onChange={(e) => setForm({ ...form, placa: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
          />
        )}
        {form.tipoVehiculo && form.placa && !validacionPlaca.ok && (
          <p className="text-xs text-state-error">{validacionPlaca.mensaje}</p>
        )}
      </div></section>

      <section className="app-surface-muted p-4"><h3 className="font-semibold mb-3">Acción</h3><button
        onClick={() => {
          const nombreLimpio = normalizarNombre(form.nombre);
          const documentoLimpio = normalizarDocumento(form.documento);
          if (!nombreLimpio || !documentoLimpio || !form.fecha || !form.tipo_documento) {
            setTouched({ nombre: true, documento: true, fecha: true });
            toast('Completa los campos obligatorios ⚠️');
            return;
          }
          if (form.fecha < hoyBogota()) {
            setTouched((prev) => ({ ...prev, fecha: true }));
            toast.error('La fecha no puede ser anterior a hoy');
            return;
          }
          if (form.tipoVehiculo && !validacionPlaca.ok) {
            toast.error(validacionPlaca.mensaje);
            return;
          }
          setResumenOpen(true);
        }}
        disabled={loading}
        className="btn-primary w-full py-3 text-sm shadow-[0_10px_24px_rgba(37,99,235,0.25)]"
      >
{loading ? 'Generando...' : 'Generar código de ingreso'}
      </button></section>

      {resumenOpen && (
        <div className="app-surface-muted p-4 space-y-3 border border-brand-primary/30">
          <h3 className="font-semibold">Resumen de la visita</h3>
          <p className="text-sm"><b>Nombre:</b> {normalizarNombre(form.nombre)}</p>
          <p className="text-sm"><b>Documento:</b> {form.tipo_documento} {normalizarDocumento(form.documento)}</p>
          <p className="text-sm"><b>Fecha:</b> {form.fecha}</p>
          <p className="text-sm"><b>Vehículo:</b> {form.tipoVehiculo ? `${form.tipoVehiculo} ${form.placa || ''}` : 'Sin vehículo'}</p>
          <div className="flex gap-2">
            <button className="btn-primary" onClick={() => { setResumenOpen(false); crearVisita(); }}>Confirmar y generar código</button>
            <button className="app-btn-secondary" onClick={() => setResumenOpen(false)}>Editar</button>
          </div>
        </div>
      )}

      {qrPayload && (
        <div ref={qrSectionRef}><QRShareCard qrValue={qrPayload} manualCode={formatManualIngresoCode(qrPayload)} onShare={compartirCodigoQR} onCopy={copiarCodigo} onDownload={compartirImagenQR} visitanteNombre={qrMetadata.visitanteNombre} fechaVisita={qrMetadata.fechaVisita} qrWrapRef={qrWrapRef} /></div>
      )}

      <div className="app-surface-muted p-4 space-y-3 bg-app-bg/60 border border-brand-primary/20">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Visitas recientes</h3>
          <span className="text-xs text-app-text-secondary">{historialFiltrado.length} registros</span>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <button className={`px-3 py-1 rounded-full ${filtroHistorial === 'todos' ? 'bg-brand-primary text-app-text-primary' : 'bg-app-bg'}`} onClick={() => { setFiltroHistorial('todos'); setPaginaFrecuentes(1); }}>Todos</button>
          <button className={`px-3 py-1 rounded-full ${filtroHistorial === 'pendiente' ? 'bg-amber-500 text-white' : 'bg-[#F59E0B1F] text-state-warning'}`} onClick={() => { setFiltroHistorial('pendiente'); setPaginaFrecuentes(1); }}>Pendientes</button>
          <button className={`px-3 py-1 rounded-full ${filtroHistorial === 'ingresado' ? 'bg-blue-600 text-white' : 'bg-[#38BDF826] text-state-info'}`} onClick={() => { setFiltroHistorial('ingresado'); setPaginaFrecuentes(1); }}>En curso</button>
          <button className={`px-3 py-1 rounded-full ${filtroHistorial === 'salido' ? 'bg-green-600 text-white' : 'bg-[#22C55E26] text-state-success'}`} onClick={() => { setFiltroHistorial('salido'); setPaginaFrecuentes(1); }}>Completadas</button>
        </div>
        <input
          className="app-input"
          placeholder="Filtrar por nombre del visitante"
          value={busquedaFrecuentes}
          onChange={(e) => {
            setBusquedaFrecuentes(e.target.value);
            setPaginaFrecuentes(1);
          }}
        />
        <div className="space-y-2 max-h-72 overflow-auto pr-1">
          {historialPaginado.map((item) => (
            <div key={item.id} className="app-surface-primary p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{item.nombre_visitante} · {item.documento}</p>
                <span className={`px-2 py-0.5 rounded-full text-xs ${normalizarEstado(item.estado) === 'salido'
                  ? 'bg-[#22C55E26] text-state-success'
                  : normalizarEstado(item.estado) === 'ingresado'
                    ? 'bg-[#38BDF826] text-state-info'
                    : 'bg-[#F59E0B1F] text-state-warning'
                  }`}>
                  {normalizarEstado(item.estado) === 'salido' ? 'Completada' : normalizarEstado(item.estado) === 'ingresado' ? 'En curso' : 'Pendiente'}
                </span>
              </div>
              <p className="text-app-text-secondary">Fecha visita: {item.fecha_visita}</p>
              {item.placa && <p className="text-app-text-secondary">Placa: {item.placa}</p>}
              <div className="flex flex-wrap gap-2 mt-2">
                {normalizarEstado(item.estado) === 'pendiente' && (
                  <button className="app-btn-ghost text-xs" onClick={() => setQRDesdeHistorial(item)}>Reenviar código</button>
                )}
                {normalizarEstado(item.estado) === 'salido' && (
                  <button className="app-btn-ghost text-xs" onClick={() => reutilizarVisita(item)}>Usar nuevamente</button>
                )}
              </div>
            </div>
          ))}
          {historialBuscado.length === 0 && <p className="text-sm text-app-text-secondary">Aún no has registrado visitas. Cuando crees una visita aparecerá aquí para reutilizarla fácilmente</p>}
        </div>
        {historialBuscado.length > 0 && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-app-text-secondary">Página {paginaFrecuenteActual} de {totalPaginasFrecuentes}</span>
            <div className="flex gap-2">
              <button
                className="app-btn-ghost text-xs disabled:opacity-40"
                disabled={paginaFrecuenteActual === 1}
                onClick={() => setPaginaFrecuentes((p) => Math.max(1, p - 1))}
              >
                Anterior
              </button>
              <button
                className="app-btn-ghost text-xs disabled:opacity-40"
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
