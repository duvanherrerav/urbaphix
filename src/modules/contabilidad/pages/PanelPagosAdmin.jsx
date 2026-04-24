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
  const CAUSALES_ECONOMICAS = ['no asistió', 'daño', 'tiempo excedido', 'depósito retenido'];
  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filtroTorre, setFiltroTorre] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [busquedaApto, setBusquedaApto] = useState('');
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
    const cumpleEstado = filtroEstado ? p.estado === filtroEstado : true;
    const cumpleApto = busquedaApto ? p.apartamento?.toString().includes(busquedaApto) : true;
    return cumpleTorre && cumpleEstado && cumpleApto;
  }), [pagos, filtroTorre, filtroEstado, busquedaApto]);

  const resumen = useMemo(() => ({
    total: pagosFiltrados.length,
    pendientes: pagosFiltrados.filter((p) => p.estado === 'pendiente').length,
    pagados: pagosFiltrados.filter((p) => p.estado === 'pagado').length,
    cartera: pagosFiltrados.filter((p) => p.estado === 'pendiente').reduce((acc, p) => acc + Number(p.valor || 0), 0)
  }), [pagosFiltrados]);
  const pagosAgrupados = useMemo(() => ({
    pendientes: pagosFiltrados.filter((p) => p.estado === 'pendiente'),
    aprobados: pagosFiltrados.filter((p) => p.estado === 'pagado'),
    rechazados: pagosFiltrados.filter((p) => p.estado === 'rechazado')
  }), [pagosFiltrados]);

  const renderTarjetaPago = (pago) => (
    <div key={pago.id} className={`app-surface-muted p-3 ${pago.estado === 'pendiente' ? 'border border-state-warning/40' : ''}`}>
      <div className="grid md:grid-cols-[1fr_auto] gap-2 items-start">
        <div>
          <p className="font-medium">{pago.nombre}</p>
          <p className="text-xs text-app-text-secondary">Torre {pago.torre} · Apto {pago.apartamento} · {pago.concepto}</p>
          <p className="text-xs text-app-text-secondary">Creado: {formatFechaBogota(pago.created_at)} · Pago: {formatFechaBogota(pago.fecha_pago)}</p>
          <p className="text-xs text-app-text-secondary">
            Comprobante: {pago.comprobante_url ? 'Adjunto' : 'Sin soporte'} · Tipo: {pago.tipo_pago || '-'}
          </p>
          <p className="text-xs text-app-text-secondary">Radicado: {String(pago.id || '-').slice(0, 8)}</p>
          {pago.comprobante_url && <a href={pago.comprobante_url} target="_blank" rel="noreferrer" className="text-xs text-brand-secondary">Ver comprobante 📄</a>}
        </div>
        <div className="text-right space-y-1">
          <p className="font-semibold text-lg">${Number(pago.valor || 0).toLocaleString('es-CO')}</p>
          <span className={`app-badge ${pago.estado === 'pendiente' ? 'app-badge-warning' : pago.estado === 'rechazado' ? 'app-badge-error' : 'app-badge-success'} capitalize`}>{pago.estado}</span>
        </div>
      </div>
      {pago.estado === 'pendiente' && (
        <div className="mt-3 space-y-2">
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
          <div className="flex justify-end">
            <button className="app-btn-secondary text-xs" onClick={() => aprobarPago(pago)}>Aprobar pago</button>
          </div>
        </div>
      )}
    </div>
  );

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

      <div className="app-surface-muted p-3 grid lg:grid-cols-4 gap-2">
        <select className="app-input" value={filtroTorre} onChange={(e) => setFiltroTorre(e.target.value)}>
          <option value="">Todas las torres</option>
          {torres.map((torre) => <option key={torre} value={torre}>{torre}</option>)}
        </select>
        <select className="app-input" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="pagado">Pagado</option>
        </select>
        <input className="app-input" placeholder="Buscar apto" value={busquedaApto} onChange={(e) => setBusquedaApto(e.target.value)} />
        <div className="text-xs text-app-text-secondary flex items-center">Aplicando filtros en tiempo real</div>
      </div>

      {loading && <p className="text-sm text-app-text-secondary">Cargando pagos...</p>}
      {!loading && pagosFiltrados.length === 0 && <p className="text-sm text-app-text-secondary">Sin resultados para filtros actuales.</p>}

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-state-warning">Pendientes</h4>
            <span className="text-xs text-app-text-secondary">{pagosAgrupados.pendientes.length}</span>
          </div>
          {pagosAgrupados.pendientes.length === 0 && <p className="text-xs text-app-text-secondary">Sin pagos pendientes.</p>}
          {pagosAgrupados.pendientes.map(renderTarjetaPago)}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-state-success">Aprobados</h4>
            <span className="text-xs text-app-text-secondary">{pagosAgrupados.aprobados.length}</span>
          </div>
          {pagosAgrupados.aprobados.length === 0 && <p className="text-xs text-app-text-secondary">Sin pagos aprobados.</p>}
          {pagosAgrupados.aprobados.map(renderTarjetaPago)}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-state-error">Rechazados</h4>
            <span className="text-xs text-app-text-secondary">{pagosAgrupados.rechazados.length}</span>
          </div>
          {pagosAgrupados.rechazados.length === 0 && <p className="text-xs text-app-text-secondary">Sin pagos rechazados.</p>}
          {pagosAgrupados.rechazados.map(renderTarjetaPago)}
        </div>
      </div>
    </div>
  );
}
