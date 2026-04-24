import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../services/supabaseClient';

const formatFechaBogota = (value) => {
  if (!value) return '-';
  const raw = String(value).trim().replace(' ', 'T');
  const hasZone = /Z$|[+-]\d{2}:\d{2}$/.test(raw);
  const parsed = new Date(hasZone ? raw : `${raw}Z`);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleDateString('es-CO', { timeZone: 'America/Bogota' });
};

export default function PanelPagosAdmin({ usuarioApp }) {
  const PREVIEW_LIMIT = 3;
  const MODAL_PAGE_SIZE = 8;
  const CAUSALES_ECONOMICAS = ['no asistió', 'daño', 'tiempo excedido', 'depósito retenido'];
  const ESTADOS_BANDEJA = [
    { key: 'pendiente', label: 'Pendientes', badge: 'app-badge-warning', titleClass: 'text-state-warning' },
    { key: 'pagado', label: 'Aprobados', badge: 'app-badge-success', titleClass: 'text-state-success' },
    { key: 'rechazado', label: 'Rechazados', badge: 'app-badge-error', titleClass: 'text-state-error' }
  ];
  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filtroTorre, setFiltroTorre] = useState('');
  const [busquedaApto, setBusquedaApto] = useState('');
  const [bandejaActiva, setBandejaActiva] = useState('pendiente');
  const [panelAmpliadoOpen, setPanelAmpliadoOpen] = useState(false);
  const [busquedaPanel, setBusquedaPanel] = useState('');
  const [paginaPanel, setPaginaPanel] = useState(1);
  const [causalDraft, setCausalDraft] = useState({});
  const [impactoDraft, setImpactoDraft] = useState({});

  async function cargarPagos() {
    setLoading(true);
    const { data, error } = await supabase
      .from('pagos')
      .select(`
        *,
        tipo_pago,
        residentes (
          id,
          usuario_id,
          apartamentos (
            numero,
            torres!fk_apartamento_torre ( nombre )
          ),
          usuarios_app ( nombre )
        )
      `)
      .eq('conjunto_id', usuarioApp.conjunto_id)
      .order('created_at', { ascending: false });

    setLoading(false);
    if (error) return;

    const pagosFormateados = (data || []).map((p) => ({
      ...p,
      nombre: p.residentes?.usuarios_app?.nombre || 'Residente',
      apartamento: p.residentes?.apartamentos?.numero || '-',
      torre: p.residentes?.apartamentos?.torres?.nombre || '-'
    }));

    setPagos(pagosFormateados);
  }

  useEffect(() => {
    if (usuarioApp?.conjunto_id) cargarPagos();
  }, [usuarioApp]);

  const aprobarPago = async (pago) => {
    const tieneComprobante = Boolean(String(pago?.comprobante_url || '').trim());
    if (!tieneComprobante) {
      alert('No se puede aprobar hasta que el residente adjunte comprobante');
      return;
    }

    const { error } = await supabase.from('pagos').update({ estado: 'pagado', fecha_pago: new Date().toISOString() }).eq('id', pago.id);
    if (error) return alert('Error al aprobar pago');

    const usuarioId = pago?.residentes?.usuario_id;
    if (usuarioId) {
      await supabase.from('notificaciones').insert([{ usuario_id: usuarioId, tipo: 'pago_aprobado', titulo: 'Pago aprobado', mensaje: `Tu pago de ${pago.valor} fue aprobado` }]);
    }

    alert('✅ Pago aprobado');
    cargarPagos();
  };

  const torres = useMemo(() => [...new Set(pagos.map((p) => p.torre).filter(Boolean))], [pagos]);
  const pagosFiltrados = useMemo(() => pagos.filter((p) => {
    const cumpleTorre = filtroTorre ? p.torre === filtroTorre : true;
    const cumpleApto = busquedaApto ? p.apartamento?.toString().includes(busquedaApto) : true;
    return cumpleTorre && cumpleApto;
  }), [pagos, filtroTorre, busquedaApto]);

  const resumen = useMemo(() => ({
    total: pagosFiltrados.length,
    pendientes: pagosFiltrados.filter((p) => p.estado === 'pendiente').length,
    pagados: pagosFiltrados.filter((p) => p.estado === 'pagado').length,
    cartera: pagosFiltrados.filter((p) => p.estado === 'pendiente').reduce((acc, p) => acc + Number(p.valor || 0), 0)
  }), [pagosFiltrados]);
  const pagosAgrupados = useMemo(() => ({
    pendiente: pagosFiltrados.filter((p) => p.estado === 'pendiente'),
    pagado: pagosFiltrados.filter((p) => p.estado === 'pagado'),
    rechazado: pagosFiltrados.filter((p) => p.estado === 'rechazado')
  }), [pagosFiltrados]);

  const renderTarjetaPago = (pago, expandida = false) => {
    const tieneComprobante = Boolean(String(pago.comprobante_url || '').trim());
    const estadoLegible = pago.estado === 'pagado' ? 'aprobado' : pago.estado;

    return (
      <div key={pago.id} className={`app-surface-muted p-3 ${pago.estado === 'pendiente' ? 'border border-state-warning/40' : ''}`}>
        <div className="grid md:grid-cols-[1fr_auto] gap-2 items-start">
        <div>
            <p className="font-medium">{pago.nombre}</p>
            <p className="text-xs text-app-text-secondary">Torre {pago.torre} · Apto {pago.apartamento}</p>
            <p className="text-xs text-app-text-secondary">Concepto: {pago.concepto || '-'}</p>
          <p className="text-xs text-app-text-secondary">Creado: {formatFechaBogota(pago.created_at)} · Pago: {formatFechaBogota(pago.fecha_pago)}</p>
          <p className="text-xs text-app-text-secondary">
              Comprobante: {tieneComprobante ? 'Adjunto' : 'Pendiente de comprobante'} · Tipo: {pago.tipo_pago || '-'}
          </p>
          <p className="text-xs text-app-text-secondary">Radicado: {String(pago.id || '-').slice(0, 8)}</p>
            {tieneComprobante && <a href={pago.comprobante_url} target="_blank" rel="noreferrer" className="text-xs text-brand-secondary">Ver comprobante 📄</a>}
        </div>
        <div className="text-right space-y-1">
          <p className="font-semibold text-lg">${Number(pago.valor || 0).toLocaleString('es-CO')}</p>
            <span className={`app-badge ${pago.estado === 'pendiente' ? 'app-badge-warning' : pago.estado === 'rechazado' ? 'app-badge-error' : 'app-badge-success'} capitalize`}>{estadoLegible}</span>
        </div>
      </div>
      {pago.estado === 'pendiente' && (
        <div className="mt-3 space-y-2">
          {expandida && (
            <div className="app-surface-primary p-2 border border-brand-primary/20">
              <p className="text-xs text-app-text-secondary mb-1">Causal económica (preparación UI)</p>
              <div className="flex flex-wrap gap-1">
                {CAUSALES_ECONOMICAS.map((causal) => (
                  <button
                    key={causal}
                    type="button"
                    onClick={() => setCausalDraft((prev) => ({ ...prev, [pago.id]: causal }))}
                    className={`app-btn text-[11px] ${causalDraft[pago.id] === causal ? 'app-btn-secondary' : 'app-btn-ghost'}`}
                  >
                    {causal}
                  </button>
                ))}
              </div>
              <input
                className="app-input mt-2 text-xs"
                placeholder="Impacto económico estimado (placeholder)"
                value={impactoDraft[pago.id] || ''}
                onChange={(e) => setImpactoDraft((prev) => ({ ...prev, [pago.id]: e.target.value }))}
              />
              <p className="text-[11px] text-app-text-secondary mt-1">Referencia visual, aún sin persistencia backend.</p>
            </div>
          )}
          <div className="flex justify-end">
              <div className="space-y-1 text-right">
                {!tieneComprobante && (
                  <p className="text-[11px] text-state-warning">No se puede aprobar hasta que el residente adjunte comprobante.</p>
                )}
                <button
                  className="app-btn-secondary text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => aprobarPago(pago)}
                  disabled={!tieneComprobante}
                  title={!tieneComprobante ? 'Pendiente de comprobante' : 'Aprobar pago'}
                >
                  Aprobar pago
                </button>
              </div>
          </div>
        </div>
      )}
      </div>
    );
  };

  const pagosBandejaActiva = pagosAgrupados[bandejaActiva] || [];
  const bandejaSeleccionada = ESTADOS_BANDEJA.find((b) => b.key === bandejaActiva) || ESTADOS_BANDEJA[0];
  const pagosBandejaPreview = pagosBandejaActiva.slice(0, PREVIEW_LIMIT);
  const textoBotonVerTodos = `Ver todos los ${bandejaSeleccionada.label.toLowerCase()}`;
  const pagosPanelFiltrados = useMemo(() => {
    const termino = busquedaPanel.trim().toLowerCase();
    if (!termino) return pagosBandejaActiva;
    return pagosBandejaActiva.filter((p) => {
      const radicado = String(p.id || '').slice(0, 8).toLowerCase();
      const nombre = String(p.nombre || '').toLowerCase();
      const apto = String(p.apartamento || '').toLowerCase();
      const concepto = String(p.concepto || '').toLowerCase();
      return radicado.includes(termino) || nombre.includes(termino) || apto.includes(termino) || concepto.includes(termino);
    });
  }, [pagosBandejaActiva, busquedaPanel]);
  const totalPaginasPanel = Math.max(1, Math.ceil(pagosPanelFiltrados.length / MODAL_PAGE_SIZE));
  const pagosPanelPaginados = useMemo(() => {
    const desde = (paginaPanel - 1) * MODAL_PAGE_SIZE;
    return pagosPanelFiltrados.slice(desde, desde + MODAL_PAGE_SIZE);
  }, [pagosPanelFiltrados, paginaPanel]);

  useEffect(() => {
    setPaginaPanel(1);
  }, [bandejaActiva, busquedaPanel]);

  return (
    <div className="app-surface-primary p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold">Estado de cuenta consolidado</h3>
          <p className="text-sm text-app-text-secondary">Balance de cobros, filtros operativos y acciones administrativas.</p>
        </div>
        <button className="app-btn-ghost text-xs" onClick={cargarPagos}>Actualizar panel</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        <div className="app-surface-muted"><span className="text-app-text-secondary">Registros</span><p className="text-lg font-semibold">{resumen.total}</p></div>
        <div className="app-surface-muted"><span className="text-app-text-secondary">Pendientes</span><p className="text-lg font-semibold text-state-warning">{resumen.pendientes}</p></div>
        <div className="app-surface-muted"><span className="text-app-text-secondary">Pagados</span><p className="text-lg font-semibold text-state-success">{resumen.pagados}</p></div>
        <div className="app-surface-muted"><span className="text-app-text-secondary">Cartera</span><p className="text-lg font-semibold">${resumen.cartera.toLocaleString('es-CO')}</p></div>
      </div>

      <div className="app-surface-muted p-3 grid md:grid-cols-3 gap-2">
        <select className="app-input" value={filtroTorre} onChange={(e) => setFiltroTorre(e.target.value)}>
          <option value="">Todas las torres</option>
          {torres.map((torre) => <option key={torre} value={torre}>{torre}</option>)}
        </select>
        <input className="app-input" placeholder="Buscar apto" value={busquedaApto} onChange={(e) => setBusquedaApto(e.target.value)} />
        <div className="text-xs text-app-text-secondary flex items-center">Aplicando filtros en tiempo real</div>
      </div>

      {loading && <p className="text-sm text-app-text-secondary">Cargando pagos...</p>}
      {!loading && pagosFiltrados.length === 0 && <p className="text-sm text-app-text-secondary">Sin resultados para filtros actuales.</p>}

      <div className="space-y-3">
        <div className="app-surface-muted p-2 flex flex-wrap gap-2">
          {ESTADOS_BANDEJA.map((bandeja) => (
            <button
              key={bandeja.key}
              type="button"
              onClick={() => setBandejaActiva(bandeja.key)}
              className={`app-btn text-xs ${bandejaActiva === bandeja.key ? 'app-btn-secondary' : 'app-btn-ghost'}`}
            >
              {bandeja.label}
              <span className={`ml-2 app-badge ${bandeja.badge}`}>{pagosAgrupados[bandeja.key]?.length || 0}</span>
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className={`font-semibold ${bandejaSeleccionada.titleClass}`}>Bandeja: {bandejaSeleccionada.label}</h4>
            <span className="text-xs text-app-text-secondary">{pagosBandejaActiva.length} registros</span>
          </div>
          {pagosBandejaActiva.length === 0 && <p className="text-xs text-app-text-secondary">Sin pagos para esta bandeja.</p>}
          <div className="space-y-2">
            {pagosBandejaPreview.map((pago) => renderTarjetaPago(pago, false))}
          </div>
          {pagosBandejaActiva.length > PREVIEW_LIMIT && (
            <button
              type="button"
              className="app-btn-ghost text-xs"
              onClick={() => {
                setBusquedaPanel('');
                setPaginaPanel(1);
                setPanelAmpliadoOpen(true);
              }}
            >
              {textoBotonVerTodos} ({pagosBandejaActiva.length})
            </button>
          )}
        </div>
      </div>

      {panelAmpliadoOpen && (
        <div className="fixed inset-0 bg-app-bg/85 backdrop-blur-sm z-50 p-4 flex items-center justify-center">
          <div className="app-surface-primary w-full max-w-5xl p-4 space-y-4 border border-brand-primary/20 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className={`font-semibold text-lg ${bandejaSeleccionada.titleClass}`}>Panel ampliado: {bandejaSeleccionada.label}</h4>
                <p className="text-xs text-app-text-secondary">{pagosBandejaActiva.length} registros en la bandeja activa</p>
              </div>
              <button type="button" className="app-btn-ghost text-xs" onClick={() => setPanelAmpliadoOpen(false)}>
                Cerrar
              </button>
            </div>

            <div className="app-surface-muted p-2 md:grid md:grid-cols-[1fr_auto] gap-2">
              <input
                className="app-input"
                placeholder="Buscar por residente, apto, concepto o radicado"
                value={busquedaPanel}
                onChange={(e) => setBusquedaPanel(e.target.value)}
              />
              <div className="text-xs text-app-text-secondary flex items-center justify-end">
                {pagosPanelFiltrados.length} resultado(s)
              </div>
            </div>

            <div className="space-y-2 max-h-[68vh] overflow-y-auto pr-1 app-scrollbar">
              {pagosPanelPaginados.length === 0 && <p className="text-xs text-app-text-secondary">Sin resultados en esta búsqueda.</p>}
              {pagosPanelPaginados.map((pago) => renderTarjetaPago(pago, true))}
            </div>

            {pagosPanelFiltrados.length > MODAL_PAGE_SIZE && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-app-text-secondary">
                  Página {paginaPanel} de {totalPaginasPanel}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="app-btn-ghost text-xs disabled:opacity-40"
                    disabled={paginaPanel === 1}
                    onClick={() => setPaginaPanel((prev) => Math.max(1, prev - 1))}
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    className="app-btn-ghost text-xs disabled:opacity-40"
                    disabled={paginaPanel === totalPaginasPanel}
                    onClick={() => setPaginaPanel((prev) => Math.min(totalPaginasPanel, prev + 1))}
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
