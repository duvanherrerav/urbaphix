import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../../services/supabaseClient';
import { actualizarEstadoIncidente, obtenerEstadosIncidentesLocal, obtenerFechasIncidentesLocal } from '../services/seguridadService';
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

  const cambiarEstado = async (incidente, estadoDestino) => {
    const estadoActual = getEstadoActual(estadosLocal, incidente.id);
    const { ok, error } = await actualizarEstadoIncidente({ incidenteId: incidente.id, estado: estadoDestino, usuarioId: usuarioApp?.id, estadoActual });
    if (!ok) return toast.error(error);
    setEstadosLocal(obtenerEstadosIncidentesLocal());
    toast.success(`Incidente actualizado a ${getEstadoLabel(estadoDestino)}`);
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

        return (
          <div key={incidente.id} className={`app-surface-muted p-4 space-y-3 border-l-4 ${incidente.nivel === 'alto' ? 'border-l-state-error' : incidente.nivel === 'medio' ? 'border-l-state-warning' : 'border-l-brand-primary/40'}`}>
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
                <p className="text-app-text-secondary mt-1">{incidente.evidencia_url ? 'Registrada' : 'No registrada'}</p>
                {incidente.evidencia_url && <a href={incidente.evidencia_url} target="_blank" rel="noreferrer" className="text-brand-secondary">Ver evidencia</a>}
              </div>
              <div className="app-surface-primary p-2">
                <p className="text-app-text-secondary">Resolución</p>
                <p className="text-app-text-secondary mt-1">{incidente.resolucion || 'No registrada'}</p>
              </div>
              <div className="app-surface-primary p-2">
                <p className="text-app-text-secondary">Impacto económico</p>
                <p className="text-app-text-secondary mt-1">{incidente.impacto_economico || 'No registrado'}</p>
              </div>
            </div>

            {usuarioApp?.rol_id === 'admin' && accion && (
              <div className="app-surface-primary p-3">
                <p className="text-xs text-app-text-secondary mb-2">Siguiente acción</p>
                <div className="flex flex-wrap gap-2 items-center justify-between">
                  <p className="text-xs text-app-text-secondary">Paso actual: <span className="font-semibold text-app-text-primary">{getEstadoLabel(estadoActual)}</span></p>
                  <p className="text-xs text-app-text-secondary">Acción recomendada: <span className="font-semibold text-app-text-primary">{accion ? accion.label : 'Sin acciones'}</span></p>
                  {accion && <button className="app-btn-primary text-xs" onClick={() => cambiarEstado(incidente, accion.estadoDestino)}>{accion.label}</button>}
                </div>
              </div>
            )}
            {usuarioApp?.rol_id === 'admin' && !accion && (
              <div className="app-surface-primary p-3">
                <p className="text-xs text-app-text-secondary">Acción recomendada: <span className="font-semibold text-app-text-primary">Sin acciones</span></p>
              </div>
            )}
          </div>
        );
      })}

      {lista.length === 0 && <p className="text-sm text-app-text-secondary">Sin incidentes para el filtro seleccionado.</p>}
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
