import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../../services/supabaseClient';
import {
  actualizarGestionIncidente,
  obtenerEstadosIncidentesLocal,
  obtenerFechasIncidentesLocal
} from '../services/seguridadService';
import {
  ESTADOS_INCIDENCIA,
  ESTADO_BADGE_CLASS,
  NIVEL_BADGE_CLASS,
  NIVEL_LABEL,
  PRIORIDAD_ORDEN,
  getAccionEstado,
  getEstadoActual,
  getEstadoLabel,
  parseDescripcionIncidente,
  getRadicadoAmigable
} from '../utils/incidenteUI';

const formatBogota = (value, localEpoch) => {
  const source = localEpoch || value;
  if (!source) return '-';

  const parsed = new Date(source);
  if (Number.isNaN(parsed.getTime())) return '-';

  if (localEpoch) {
    return parsed.toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short' });
  }

  return parsed.toLocaleString('es-CO', { timeZone: 'America/Bogota' });
};

export default function ListaIncidentes({ usuarioApp }) {
  const [incidentes, setIncidentes] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [estadosLocal, setEstadosLocal] = useState({});
  const [fechasLocal, setFechasLocal] = useState({});
  const [pagina, setPagina] = useState(1);
  const [editingIncidenteId, setEditingIncidenteId] = useState(null);
  const [editForm, setEditForm] = useState({ resolucion: '', impacto_economico: '', evidencia_url: '', estado: 'nuevo' });
  const [savingGestion, setSavingGestion] = useState(false);
  const [gestionError, setGestionError] = useState('');
  const [gestionSuccess, setGestionSuccess] = useState('');
  const [editFieldErrors, setEditFieldErrors] = useState({});
  const PAGE_SIZE = 5;

  const getEstadoVisible = (incidente) => incidente.estado || getEstadoActual(estadosLocal, incidente.id);

  useEffect(() => {
    const cargar = async () => {
      if (!usuarioApp?.conjunto_id) return;

      const { data, error } = await supabase.from('incidentes').select('*').eq('conjunto_id', usuarioApp.conjunto_id).order('created_at', { ascending: false });
      if (error) return toast.error('No se pudieron cargar incidentes');

      setIncidentes(data || []);
      setEstadosLocal(obtenerEstadosIncidentesLocal());
      setFechasLocal(obtenerFechasIncidentesLocal());
    };

    cargar();
    const channel = supabase
      .channel(`incidentes-admin-${usuarioApp?.conjunto_id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidentes', filter: `conjunto_id=eq.${usuarioApp?.conjunto_id}` }, () => cargar())
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [usuarioApp?.conjunto_id]);

  const iniciarEdicion = (incidente, estadoDestino = null) => {
    const estadoActual = getEstadoVisible(incidente);
    setEditingIncidenteId(incidente.id);
    setEditForm({
      resolucion: incidente.resolucion || '',
      impacto_economico: incidente.impacto_economico || '',
      evidencia_url: incidente.evidencia_url || '',
      estado: estadoDestino || estadoActual
    });
    setGestionError('');
    setGestionSuccess('');
    setEditFieldErrors({});
  };

  const cancelarEdicion = () => {
    setEditingIncidenteId(null);
    setEditForm({ resolucion: '', impacto_economico: '', evidencia_url: '', estado: 'nuevo' });
    setGestionError('');
    setEditFieldErrors({});
  };

  const guardarGestion = async (incidente) => {
    const estadoActual = getEstadoVisible(incidente);
    const estadoDestino = editForm.estado || estadoActual;
    const resolucion = editForm.resolucion.trim();
    const evidencia = editForm.evidencia_url.trim();
    const errores = {};

    if (evidencia && !/^https?:\/\//i.test(evidencia)) {
      errores.evidencia_url = 'Debe iniciar con http:// o https://';
    }

    if ((estadoDestino === 'resuelto' || estadoDestino === 'cerrado') && !resolucion) {
      errores.resolucion = 'La resolución es obligatoria para esta acción';
    }

    if (Object.keys(errores).length > 0) {
      setEditFieldErrors(errores);
      setGestionError('Revisa los campos obligatorios antes de guardar.');
      return;
    }
    setEditFieldErrors({});

    if (estadoDestino !== estadoActual && !['nuevo', 'en_gestion', 'resuelto', 'cerrado'].includes(estadoDestino)) {
      toast.error('Estado inválido');
      return;
    }

    const accionCritica = estadoDestino === 'resuelto' ? 'marcar como resuelto' : estadoDestino === 'cerrado' ? 'cerrar' : null;
    if (accionCritica) {
      const confirmed = window.confirm(`¿Confirmas ${accionCritica} este incidente?`);
      if (!confirmed) return;
    }

    setGestionError('');
    setSavingGestion(true);
    const { ok, error } = await actualizarGestionIncidente({
      incidenteId: incidente.id,
      resolucion,
      impacto_economico: editForm.impacto_economico.trim(),
      evidencia_url: evidencia,
      estado: estadoDestino
    });
    setSavingGestion(false);

    if (!ok) {
      setGestionError(error || 'No se pudo guardar la gestión del incidente.');
      return toast.error(error);
    }

    setIncidentes((prev) => prev.map((item) => (item.id === incidente.id ? {
      ...item,
      resolucion: resolucion || null,
      impacto_economico: editForm.impacto_economico.trim() || null,
      evidencia_url: evidencia || null,
      estado: estadoDestino
    } : item)));
    setEstadosLocal(obtenerEstadosIncidentesLocal());
    setGestionSuccess(`Cambios guardados para ${getRadicadoAmigable(incidente.id)}.`);
    cancelarEdicion();
    toast.success('Gestión del incidente actualizada');
  };

  const lista = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    const filtered = incidentes.filter((incidente) => {
      const estadoActual = getEstadoVisible(incidente);
      const parsedLegacy = parseDescripcionIncidente(incidente.descripcion);
      const tipo = incidente.tipo || parsedLegacy.categoria || null;
      const tipoLabel = tipo ? tipo.charAt(0).toUpperCase() + tipo.slice(1) : 'Sin tipo';
      const ubicacion = incidente.ubicacion_texto || parsedLegacy.ubicacion || null;
      const descripcion = parsedLegacy.descripcionLimpia;
      const matchEstado = filtroEstado === 'todos' ? true : estadoActual === filtroEstado;
      const matchBusqueda = !term
        || descripcion.toLowerCase().includes(term)
        || tipoLabel.toLowerCase().includes(term)
        || (ubicacion || '').toLowerCase().includes(term)
        || (incidente.nivel || '').toLowerCase().includes(term)
        || getEstadoLabel(estadoActual).toLowerCase().includes(term);
      return matchEstado && matchBusqueda;
    });

    return filtered.sort((a, b) => {
      const ea = getEstadoVisible(a);
      const eb = getEstadoVisible(b);
      if (ea === 'cerrado' && eb !== 'cerrado') return 1;
      if (ea !== 'cerrado' && eb === 'cerrado') return -1;
      const pa = PRIORIDAD_ORDEN[a.nivel] ?? 99;
      const pb = PRIORIDAD_ORDEN[b.nivel] ?? 99;
      if (pa !== pb) return pa - pb;
      const da = new Date(a.created_at || 0).getTime();
      const db = new Date(b.created_at || 0).getTime();
      return db - da;
    });
  }, [incidentes, estadosLocal, filtroEstado, busqueda]);

  const totalPaginas = Math.max(1, Math.ceil(lista.length / PAGE_SIZE));
  const paginaActual = Math.min(pagina, totalPaginas);
  const listaPaginada = lista.slice((paginaActual - 1) * PAGE_SIZE, paginaActual * PAGE_SIZE);

  const resumen = {
    total: lista.length,
    alto: lista.filter((incidente) => incidente.nivel === 'alto').length,
    enGestion: lista.filter((incidente) => getEstadoVisible(incidente) === 'en_gestion').length,
    cerrados: lista.filter((incidente) => getEstadoVisible(incidente) === 'cerrado').length
  };

  return (
    <div className="app-surface-primary p-5 space-y-4">
      <div className="grid lg:grid-cols-[1fr_auto] gap-3 items-start">
        <div>
          <h2 className="text-2xl font-bold">Incidentes</h2>
          <p className="text-sm text-app-text-secondary mt-1">Bandeja administrativa con prioridad, estado y siguiente acción operativa.</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
          <div className="app-surface-muted p-2"><p className="text-app-text-secondary">Total</p><p className="font-semibold text-lg">{resumen.total}</p></div>
          <div className="app-surface-muted p-2"><p className="text-app-text-secondary">Prioridad alta</p><p className="font-semibold text-lg text-state-error">{resumen.alto}</p></div>
          <div className="app-surface-muted p-2"><p className="text-app-text-secondary">En gestión</p><p className="font-semibold text-lg text-state-info">{resumen.enGestion}</p></div>
          <div className="app-surface-muted p-2"><p className="text-app-text-secondary">Cerrados</p><p className="font-semibold text-lg">{resumen.cerrados}</p></div>
        </div>
      </div>

      <div className="grid md:grid-cols-[1fr_220px] gap-2">
        <input className="app-input text-sm" placeholder="Buscar por descripción, categoría, prioridad o estado..." value={busqueda} onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }} />
        <select className="app-input text-sm" value={filtroEstado} onChange={(e) => { setFiltroEstado(e.target.value); setPagina(1); }}>
          <option value="todos">Todos</option>
          {ESTADOS_INCIDENCIA.map((estado) => <option key={estado} value={estado}>{getEstadoLabel(estado)}</option>)}
        </select>
      </div>

      {listaPaginada.map((incidente) => {
        const estadoActual = getEstadoVisible(incidente);
        const parsedLegacy = parseDescripcionIncidente(incidente.descripcion);
        const tipo = incidente.tipo || parsedLegacy.categoria || null;
        const tipoLabel = tipo ? tipo.charAt(0).toUpperCase() + tipo.slice(1) : 'Sin tipo';
        const tipoClass = tipo === 'convivencia'
          ? 'app-badge-warning'
          : tipo === 'infraestructura' || tipo === 'acceso'
            ? 'app-badge-info'
            : 'app-badge-error';
        const descripcion = parsedLegacy.descripcionLimpia;
        const ubicacion = incidente.ubicacion_texto || parsedLegacy.ubicacion || null;
        const accion = getAccionEstado(estadoActual);
        const enEdicion = editingIncidenteId === incidente.id;

        return (
          <div key={incidente.id} className={`app-surface-muted p-4 space-y-3 border-l-4 ${incidente.nivel === 'alto' ? 'border-l-state-error' : incidente.nivel === 'medio' ? 'border-l-state-warning' : 'border-l-brand-primary/40'} ${enEdicion ? 'ring-1 ring-brand-primary/70 bg-app-bg/40' : ''}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2 flex-1 min-w-[220px]">
                <div className="flex flex-wrap gap-2 items-center">
                  <span className={`app-badge ${tipoClass}`}>{tipoLabel}</span>
                  <span className={`app-badge ${NIVEL_BADGE_CLASS[incidente.nivel] || 'app-badge-info'}`}>Prioridad {NIVEL_LABEL[incidente.nivel] || 'Baja'}</span>
                  <span className={`app-badge ${ESTADO_BADGE_CLASS[estadoActual] || 'app-badge-warning'}`}>{getEstadoLabel(estadoActual)}</span>
                </div>
                <p className="font-medium leading-relaxed">{descripcion}</p>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-2 text-sm">
              <p className="text-app-text-secondary">Radicado: <span className="inline-flex rounded-md bg-app-bg border border-app-border px-2 py-0.5 font-mono font-bold tracking-wide text-app-text-primary">{getRadicadoAmigable(incidente.id)}</span></p>
              <p className="text-app-text-secondary">Reporte: {formatBogota(incidente.created_at, fechasLocal[incidente.id])}</p>
              <p className="text-app-text-secondary md:text-right">{ubicacion ? `Ubicación: ${ubicacion}` : 'Ubicación no registrada'}</p>
            </div>

            <div className="grid md:grid-cols-3 gap-2 text-xs">
              <div className="app-surface-primary p-2">
                <p className="text-app-text-secondary">Evidencia</p>
                {!enEdicion && (
                  <>
                    <p className="text-app-text-secondary mt-1">{incidente.evidencia_url ? 'Registrada' : 'No registrada'}</p>
                    {incidente.evidencia_url && <a href={incidente.evidencia_url} target="_blank" rel="noreferrer" className="text-brand-secondary">Ver evidencia</a>}
                  </>
                )}
                {enEdicion && (
                  <input className="app-input text-xs mt-1" placeholder="https://..." value={editForm.evidencia_url} onChange={(e) => setEditForm((prev) => ({ ...prev, evidencia_url: e.target.value }))} />
                )}
              </div>
              <div className="app-surface-primary p-2">
                <p className="text-app-text-secondary">Resolución</p>
                {!enEdicion && <p className="text-app-text-secondary mt-1">{incidente.resolucion || 'No registrada'}</p>}
                {enEdicion && (
                  <textarea className="app-input text-xs mt-1 min-h-20" placeholder="Detalle de resolución" value={editForm.resolucion} onChange={(e) => setEditForm((prev) => ({ ...prev, resolucion: e.target.value }))} />
                )}
              </div>
              <div className="app-surface-primary p-2">
                <p className="text-app-text-secondary">Impacto económico</p>
                {!enEdicion && <p className="text-app-text-secondary mt-1">{incidente.impacto_economico || 'No registrado'}</p>}
                {enEdicion && (
                  <input className="app-input text-xs mt-1" placeholder="$ 0" value={editForm.impacto_economico} onChange={(e) => setEditForm((prev) => ({ ...prev, impacto_economico: e.target.value }))} />
                )}
              </div>
            </div>

            {usuarioApp?.rol_id === 'admin' && !enEdicion && accion && (
              <div className="app-surface-primary p-3">
                <p className="text-xs text-app-text-secondary mb-2">Siguiente acción</p>
                <div className="flex flex-wrap gap-2 items-center justify-between">
                  <p className="text-xs text-app-text-secondary">Paso actual: <span className="font-semibold text-app-text-primary">{getEstadoLabel(estadoActual)}</span></p>
                  <p className="text-xs text-app-text-secondary">Acción recomendada: <span className="font-semibold text-app-text-primary">{accion ? accion.label : 'Sin acciones'}</span></p>
                  <div className="flex gap-2">
                    {accion && <button className="app-btn-primary text-xs" onClick={() => iniciarEdicion(incidente, accion.estadoDestino)}>{accion.label}</button>}
                    <button className="app-btn-ghost text-xs" onClick={() => iniciarEdicion(incidente)}>Editar</button>
                  </div>
                </div>
              </div>
            )}
            {usuarioApp?.rol_id === 'admin' && !enEdicion && !accion && (
              <div className="app-surface-primary p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-app-text-secondary">Acción recomendada: <span className="font-semibold text-app-text-primary">Sin acciones</span></p>
                  <button className="app-btn-ghost text-xs" onClick={() => iniciarEdicion(incidente)}>Editar</button>
                </div>
              </div>
            )}
            {usuarioApp?.rol_id === 'admin' && enEdicion && (
              <div className="app-surface-primary p-3 space-y-2">
                <div className="inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold app-badge-info">Editando incidente</div>
                <p className="text-xs text-app-text-secondary">Cambiar estado</p>
                <div className="flex flex-wrap gap-2">
                  {estadoActual === 'nuevo' && <button className={`app-btn-ghost text-xs ${editForm.estado === 'en_gestion' ? 'ring-1 ring-brand-primary' : ''}`} onClick={() => setEditForm((prev) => ({ ...prev, estado: 'en_gestion' }))}>Iniciar gestión</button>}
                  {estadoActual === 'en_gestion' && <button className={`app-btn-ghost text-xs ${editForm.estado === 'resuelto' ? 'ring-1 ring-brand-primary' : ''}`} onClick={() => setEditForm((prev) => ({ ...prev, estado: 'resuelto' }))}>Marcar como resuelto</button>}
                  {estadoActual === 'resuelto' && <button className={`app-btn-ghost text-xs ${editForm.estado === 'cerrado' ? 'ring-1 ring-brand-primary' : ''}`} onClick={() => setEditForm((prev) => ({ ...prev, estado: 'cerrado' }))}>Cerrar incidente</button>}
                </div>
                {editFieldErrors.resolucion && <p className="text-xs text-state-error">{editFieldErrors.resolucion}</p>}
                {editFieldErrors.evidencia_url && <p className="text-xs text-state-error">{editFieldErrors.evidencia_url}</p>}
                {gestionError && <p className="text-xs text-state-error">{gestionError}</p>}
                <div className="flex gap-2">
                  <button className="app-btn-primary text-xs" disabled={savingGestion} onClick={() => guardarGestion(incidente)}>{savingGestion ? 'Guardando...' : 'Guardar cambios'}</button>
                  <button className="app-btn-ghost text-xs" disabled={savingGestion} onClick={cancelarEdicion}>Cancelar</button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {gestionSuccess && <p className="text-xs text-state-success">{gestionSuccess}</p>}
      {incidentes.length === 0 && <p className="text-sm text-app-text-secondary">No hay incidentes registrados para este conjunto.</p>}
      {incidentes.length > 0 && lista.length === 0 && <p className="text-sm text-app-text-secondary">No se encontraron incidentes con los filtros aplicados.</p>}
      {
        lista.length > 0 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-app-text-secondary">Página {paginaActual} de {totalPaginas}</p>
            <div className="flex gap-2">
              <button className="app-btn-ghost text-xs" disabled={paginaActual === 1} onClick={() => setPagina((p) => Math.max(1, p - 1))}>Anterior</button>
              <button className="app-btn-ghost text-xs" disabled={paginaActual === totalPaginas} onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}>Siguiente</button>
            </div>
          </div>
        )
      }
    </div >
  );
}
