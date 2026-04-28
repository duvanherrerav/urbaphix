import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../services/supabaseClient';

import GraficaVisitas from '../components/GraficaVisitas';
import GraficaFinanciera from '../../contabilidad/components/GraficaFinanciera';
import PaquetesPorTorre from '../components/PaquetesPorTorre';
import KPIsAdmin from '../components/KPIsAdmin';
import DashboardResumen from '../components/DashboardResumen';
import CarteraResumen from '../../contabilidad/components/CarteraResumen';
import GraficaCartera from '../../contabilidad/components/GraficaCartera';

export default function DashboardAdmin({ usuarioApp }) {
  const VISITAS_PREVIEW_LIMIT = 4;
  const VISITAS_MODAL_PAGE_SIZE = 8;
  const VISITAS_RANGO_HORAS = 72;

  const [visitas, setVisitas] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [incidentes, setIncidentes] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [visitasModalOpen, setVisitasModalOpen] = useState(false);
  const [busquedaVisitas, setBusquedaVisitas] = useState('');
  const [paginaVisitasModal, setPaginaVisitasModal] = useState(1);

  const [stats, setStats] = useState({
    total: 0,
    ingresados: 0,
    pendientes: 0,
    salidos: 0
  });

  const [kpis, setKpis] = useState({
    visitasHoy: 0,
    visitasSemana: 0,
    paquetesPendientes: 0,
    torreTop: '-'
  });

  const resumenFinanciero = useMemo(() => {
    const pendientes = pagos.filter((p) => p.estado === 'pendiente');
    const pagados = pagos.filter((p) => p.estado === 'pagado');

    const pendienteMonto = pendientes.reduce((acc, p) => acc + Number(p.valor || 0), 0);
    const pagadoMonto = pagados.reduce((acc, p) => acc + Number(p.valor || 0), 0);

    return {
      pendientesCantidad: pendientes.length,
      pendienteMonto,
      pagadoMonto
    };
  }, [pagos]);

  const saludOperativa = useMemo(() => {
    const totalVisitas = Math.max(stats.total, 1);
    const ocupacion = Math.round((stats.ingresados / totalVisitas) * 100);
    const finalizacion = Math.round((stats.salidos / totalVisitas) * 100);

    return { ocupacion, finalizacion };
  }, [stats]);

  const atencionInmediata = useMemo(() => {
    const pagosPendientes = pagos.filter((p) => p.estado === 'pendiente').length;
    const incidentesAltos = incidentes.filter((i) => i.nivel === 'alto').length;
    const reservasPendientes = reservas.filter((r) => r.estado === 'pendiente').length;
    const proximaReserva = [...reservas]
      .sort((a, b) => new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime())[0] || null;

    return { pagosPendientes, incidentesAltos, reservasPendientes, proximaReserva };
  }, [pagos, incidentes, reservas]);

  function obtenerFechaVisita(visita) {
    const fechaBase = typeof visita?.fecha_visita === 'string' ? visita.fecha_visita.trim() : '';
    if (!fechaBase) return null;

    const horaBase = typeof visita?.hora_ingreso === 'string' && visita.hora_ingreso.trim()
      ? visita.hora_ingreso.trim()
      : '00:00:00';

    const isoLocal = `${fechaBase}T${horaBase}`;
    const parsed = new Date(isoLocal);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  }

  const ultimasVisitasRango = useMemo(() => {
    const limite = Date.now() - VISITAS_RANGO_HORAS * 60 * 60 * 1000;

    return visitas
      .filter((visita) => {
        const fecha = obtenerFechaVisita(visita);
        return fecha ? fecha.getTime() >= limite : false;
      })
      .sort((a, b) => {
        const fechaA = obtenerFechaVisita(a)?.getTime() || 0;
        const fechaB = obtenerFechaVisita(b)?.getTime() || 0;
        return fechaB - fechaA;
      });
  }, [visitas]);

  const visitasPreview = useMemo(
    () => ultimasVisitasRango.slice(0, VISITAS_PREVIEW_LIMIT),
    [ultimasVisitasRango]
  );

  const visitasFiltradasModal = useMemo(() => {
    const term = busquedaVisitas.trim().toLowerCase();
    if (!term) return ultimasVisitasRango;

    return ultimasVisitasRango.filter((visita) => {
      const texto = [
        obtenerNombreVisita(visita),
        obtenerDocumentoVisita(visita),
        obtenerPlacaVisita(visita),
        obtenerTorreAptoVisita(visita),
        visita?.estado || '',
        visita?.fecha_visita || ''
      ]
        .join(' ')
        .toLowerCase();

      return texto.includes(term);
    });
  }, [ultimasVisitasRango, busquedaVisitas]);

  const totalPaginasVisitas = Math.max(1, Math.ceil(visitasFiltradasModal.length / VISITAS_MODAL_PAGE_SIZE));
  const visitasPaginadasModal = useMemo(() => {
    const desde = (paginaVisitasModal - 1) * VISITAS_MODAL_PAGE_SIZE;
    return visitasFiltradasModal.slice(desde, desde + VISITAS_MODAL_PAGE_SIZE);
  }, [visitasFiltradasModal, paginaVisitasModal]);

  async function obtenerVisitas() {
    try {
      const hoy = new Date();
      const hace7dias = new Date();

      hace7dias.setDate(hoy.getDate() - 7);

      const fechaInicio = hace7dias.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('registro_visitas')
        .select('*, visitante:visitantes(nombre, documento, placa), apartamento:apartamentos(numero, torre:torres(nombre))')
        .eq('conjunto_id', usuarioApp.conjunto_id)
        .gte('fecha_visita', fechaInicio)
        .order('fecha_visita', { ascending: false })
        .order('hora_ingreso', { ascending: false });

      if (error) {
        setVisitas([]);
        setStats({ total: 0, ingresados: 0, pendientes: 0, salidos: 0 });
        return;
      }

      const visitasData = data || [];
      setVisitas(visitasData);

      setStats({
        total: visitasData.length,
        ingresados: visitasData.filter(v => v.estado === 'ingresado').length,
        pendientes: visitasData.filter(v => v.estado === 'pendiente').length,
        salidos: visitasData.filter(v => v.estado === 'salido').length
      });
    } catch {
      setVisitas([]);
      setStats({ total: 0, ingresados: 0, pendientes: 0, salidos: 0 });
    }
  }

  async function obtenerPagos() {
    const { data, error } = await supabase
      .from('pagos')
      .select('valor, estado, created_at')
      .eq('conjunto_id', usuarioApp.conjunto_id);

    if (error) return;

    setPagos(data || []);
  }

  async function obtenerIncidentes() {
    const { data, error } = await supabase
      .from('incidentes')
      .select('id, nivel, created_at')
      .eq('conjunto_id', usuarioApp.conjunto_id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) return;
    setIncidentes(data || []);
  }

  async function obtenerReservas() {
    const { data, error } = await supabase
      .from('reservas_zonas')
      .select('id, estado, fecha_inicio')
      .eq('conjunto_id', usuarioApp.conjunto_id)
      .gte('fecha_inicio', new Date().toISOString())
      .order('fecha_inicio', { ascending: true })
      .limit(20);

    if (error) return;
    setReservas(data || []);
  }

  useEffect(() => {
    if (!usuarioApp?.conjunto_id) return;

    const timer = setTimeout(() => {
      obtenerVisitas();
      obtenerPagos();
      obtenerIncidentes();
      obtenerReservas();
    }, 0);

    const channel = supabase
      .channel('admin-visitas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'registro_visitas' }, () => {
        obtenerVisitas();
      })
      .subscribe();

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };

  }, [usuarioApp]);

  useEffect(() => {
    setPaginaVisitasModal(1);
  }, [busquedaVisitas, visitasModalOpen]);

  useEffect(() => {
    if (paginaVisitasModal > totalPaginasVisitas) {
      setPaginaVisitasModal(totalPaginasVisitas);
    }
  }, [paginaVisitasModal, totalPaginasVisitas]);

  function obtenerPlacaVisita(visita) {
    const posiblesPlacas = [
      visita?.placa,
      visita?.vehiculo_placa,
      visita?.visitante?.placa,
      visita?.visitantes?.placa,
      visita?.vehiculo?.placa,
      visita?.vehiculos?.placa,
      visita?.vehiculo_visitante?.placa
    ];

    const placaValida = posiblesPlacas
      .map((valor) => (typeof valor === 'string' ? valor.trim() : ''))
      .find((valor) => valor.length > 0);

    return placaValida || 'Sin placa';
  }

  function obtenerNombreVisita(visita) {
    const posiblesNombres = [
      visita?.nombre_visitante,
      visita?.visitante?.nombre,
      visita?.visitantes?.nombre
    ];

    const nombreValido = posiblesNombres
      .map((valor) => (typeof valor === 'string' ? valor.trim() : ''))
      .find((valor) => valor.length > 0);

    return nombreValido || 'Visitante';
  }

  function obtenerDocumentoVisita(visita) {
    const posiblesDocumentos = [
      visita?.documento,
      visita?.visitante?.documento,
      visita?.visitantes?.documento
    ];

    const documentoValido = posiblesDocumentos
      .map((valor) => (typeof valor === 'string' ? valor.trim() : ''))
      .find((valor) => valor.length > 0);

    return documentoValido || 'Sin documento';
  }

  function obtenerTorreAptoVisita(visita) {
    const torre = [
      visita?.torre,
      visita?.apartamento?.torre?.nombre,
      visita?.apartamentos?.torre?.nombre
    ]
      .map((valor) => (typeof valor === 'string' ? valor.trim() : ''))
      .find((valor) => valor.length > 0);

    const apto = [
      visita?.apartamento,
      visita?.apartamento_numero,
      visita?.apartamento?.numero,
      visita?.apartamentos?.numero
    ]
      .map((valor) => (typeof valor === 'string' ? valor.trim() : ''))
      .find((valor) => valor.length > 0);

    if (torre && apto) return `Torre y Apto: ${torre}${apto}`;
    return 'Ubicación no disponible';
  }

  return (
    <div className="space-y-5">
      <div className="app-surface-primary p-6 text-app-text-primary">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">👋 Hola {usuarioApp?.nombre || 'Admin'}</h2>
            <p className="text-sm text-app-text-secondary mt-1">Resumen del día del conjunto con foco operativo y financiero.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs min-w-[280px]">
            <div className="app-surface-muted p-3"><p className="text-app-text-secondary">Activas</p><p className="text-lg font-semibold">{stats.ingresados}</p></div>
            <div className="app-surface-muted p-3"><p className="text-app-text-secondary">Paquetes</p><p className="text-lg font-semibold">{kpis.paquetesPendientes}</p></div>
            <div className="app-surface-muted p-3"><p className="text-app-text-secondary">Pendientes</p><p className="text-lg font-semibold">{resumenFinanciero.pendientesCantidad}</p></div>
          </div>
        </div>
      </div>

      <KPIsAdmin usuarioApp={usuarioApp} setKpis={setKpis} />
      <DashboardResumen stats={stats} kpis={kpis} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="app-surface-muted p-4 min-h-24"><p className="text-xs text-app-text-secondary">Pendientes</p><div className="text-2xl font-bold text-state-warning">{stats.pendientes}</div></div>
        <div className="app-surface-muted p-4 min-h-24"><p className="text-xs text-app-text-secondary">Ingresados</p><div className="text-2xl font-bold text-state-info">{stats.ingresados}</div></div>
        <div className="app-surface-muted p-4 min-h-24"><p className="text-xs text-app-text-secondary">Salidos</p><div className="text-2xl font-bold text-state-success">{stats.salidos}</div></div>
        <div className="app-surface-muted p-4 min-h-24"><p className="text-xs text-app-text-secondary">Total</p><div className="text-2xl font-bold">{stats.total}</div></div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="app-surface-primary p-4">
          <h3 className="font-semibold text-app-text-primary mb-3">⚙️ Salud operativa</h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1"><span className="text-app-text-secondary">Ocupación de visitas</span><span className="font-semibold">{saludOperativa.ocupacion}%</span></div>
              <div className="h-2 bg-app-bg rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400" style={{ width: `${saludOperativa.ocupacion}%` }} /></div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1"><span className="text-app-text-secondary">Visitas finalizadas</span><span className="font-semibold">{saludOperativa.finalizacion}%</span></div>
              <div className="h-2 bg-app-bg rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-emerald-500 to-lime-400" style={{ width: `${saludOperativa.finalizacion}%` }} /></div>
            </div>
          </div>
        </div>

        <div className="app-surface-primary p-4">
          <h3 className="font-semibold text-app-text-primary mb-3">💼 Pulso financiero</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-app-border bg-app-bg p-3"><p className="text-state-success font-medium">Recaudado</p><p className="text-lg font-bold text-app-text-primary">${resumenFinanciero.pagadoMonto.toLocaleString('es-CO')}</p></div>
            <div className="rounded-xl border border-app-border bg-app-bg p-3"><p className="text-state-warning font-medium">Pendiente</p><p className="text-lg font-bold text-app-text-primary">${resumenFinanciero.pendienteMonto.toLocaleString('es-CO')}</p></div>
          </div>
        </div>
      </div>

      <div className="app-surface-primary p-4">
        <h3 className="font-semibold text-app-text-primary mb-3">🚨 Atención inmediata</h3>
        <div className="grid md:grid-cols-3 gap-3 text-sm">
          <div className="rounded-xl border border-app-border bg-app-bg p-3">
            <p className="text-app-text-secondary">Pagos pendientes</p>
            <p className="text-2xl font-bold text-state-warning">{atencionInmediata.pagosPendientes}</p>
            <p className="text-xs text-app-text-secondary mt-1">Priorizar gestión de cartera y recordatorios.</p>
          </div>
          <div className="rounded-xl border border-app-border bg-app-bg p-3">
            <p className="text-app-text-secondary">Incidentes nivel alto</p>
            <p className="text-2xl font-bold text-state-error">{atencionInmediata.incidentesAltos}</p>
            <p className="text-xs text-app-text-secondary mt-1">Escalar seguridad cuando el conteo suba.</p>
          </div>
          <div className="rounded-xl border border-app-border bg-app-bg p-3">
            <p className="text-app-text-secondary">Reservas por revisar</p>
            <p className="text-2xl font-bold text-state-info">{atencionInmediata.reservasPendientes}</p>
            <p className="text-xs text-app-text-secondary mt-1">
              Próxima: {atencionInmediata.proximaReserva?.fecha_inicio ? new Date(atencionInmediata.proximaReserva.fecha_inicio).toLocaleString('es-CO') : 'sin programación cercana'}.
            </p>
          </div>
        </div>
      </div>

      <div className="app-surface-primary p-4">
        <h3 className="font-semibold text-state-error mb-2">🔥 Cartera en riesgo</h3>
        <CarteraResumen usuarioApp={usuarioApp} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="app-surface-primary p-4 flex flex-col">
          <h3 className="text-app-text-primary text-lg font-bold mb-1">📊 Visitas por día</h3>
          <p className="text-sm text-app-text-secondary mb-3">Comportamiento diario de ingresos y salidas.</p>
          <div className="h-[320px]">
            <GraficaVisitas visitas={visitas} />
          </div>
        </div>
        <div className="app-surface-primary p-4 flex flex-col">
          <h3 className="text-app-text-primary text-lg font-bold mb-1">📦 Paquetes</h3>
          <p className="text-sm text-app-text-secondary mb-3">Distribución operativa por torre.</p>
          <div className="h-[320px] relative">
            <PaquetesPorTorre usuarioApp={usuarioApp} />
          </div>
        </div>
        <div className="app-surface-primary p-4 flex flex-col">
          <h3 className="text-app-text-primary text-lg font-bold mb-1">💰 Flujo financiero</h3>
          <p className="text-sm text-app-text-secondary mb-2">Comparativo visual de recaudo y valores pendientes.</p>
          <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
            <div className="rounded-lg border border-app-border bg-app-bg p-2">
              <p className="font-semibold text-app-text-primary">Recaudado</p>
              <p className="text-base font-bold text-state-success">${resumenFinanciero.pagadoMonto.toLocaleString('es-CO')}</p>
            </div>
            <div className="rounded-lg border border-app-border bg-app-bg p-2">
              <p className="font-semibold text-app-text-primary">Pendiente</p>
              <p className="text-base font-bold text-state-warning">${resumenFinanciero.pendienteMonto.toLocaleString('es-CO')}</p>
            </div>
          </div>
          <div className="h-[300px]">
            <GraficaFinanciera pagos={pagos} />
          </div>
        </div>
        <div className="app-surface-primary p-4 flex flex-col">
          <h3 className="text-app-text-primary text-lg font-bold mb-1">📊 Análisis de cartera</h3>
          <p className="text-sm text-app-text-secondary mb-3">Estado financiero consolidado del conjunto.</p>
          <div className="h-[360px]">
            <GraficaCartera pagos={pagos} />
          </div>
        </div>
      </div>

      <div className="app-surface-primary p-6 mt-3">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-app-text-primary text-lg font-bold">Últimas visitas</h3>
          <span className="text-sm text-app-text-secondary">{visitasPreview.length} de {ultimasVisitasRango.length} registros recientes</span>
        </div>
        <p className="text-xs text-app-text-secondary mb-3">Últimas visitas de los últimos 3 días.</p>
        <div className="space-y-2">
          {visitasPreview.map(v => {
            const torreApto = obtenerTorreAptoVisita(v);

            return (
              <div key={v.id} className="app-surface-muted p-3 flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{obtenerNombreVisita(v)}</p>
                    <span className="text-xs text-app-text-secondary">• {obtenerDocumentoVisita(v)}</span>
                  </div>
                  <p className="text-sm text-app-text-secondary">Placa: {obtenerPlacaVisita(v)}</p>
                  <p className="text-xs text-app-text-secondary">
                    Fecha: {v.fecha_visita || '-'} · Ingreso: {v.hora_ingreso || 'Pendiente'} · Salida: {v.hora_salida || 'Pendiente'}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="text-[11px] px-2 py-1 rounded-lg bg-app-bg border border-app-border text-app-text-secondary">{torreApto}</span>
                  <span className={v.estado === 'pendiente' ? 'app-badge app-badge-warning' : v.estado === 'ingresado' ? 'app-badge app-badge-info' : 'app-badge app-badge-success'}>{v.estado}</span>
                </div>
              </div>
            );
          })}
          {visitasPreview.length === 0 && (
            <p className="text-sm text-app-text-secondary">Sin visitas registradas en los últimos 3 días.</p>
          )}
        </div>
        {ultimasVisitasRango.length > VISITAS_PREVIEW_LIMIT && (
          <div className="mt-3">
            <button
              type="button"
              className="app-btn-ghost text-xs"
              onClick={() => {
                setBusquedaVisitas('');
                setPaginaVisitasModal(1);
                setVisitasModalOpen(true);
              }}
            >
              Ver todas las visitas ({ultimasVisitasRango.length})
            </button>
          </div>
        )}
      </div>

      {visitasModalOpen && (
        <div className="fixed inset-0 bg-app-bg/85 backdrop-blur-sm z-50 p-4 flex items-center justify-center">
          <div className="app-surface-primary w-full max-w-5xl p-4 space-y-4 border border-brand-primary/20 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="font-semibold text-lg text-app-text-primary">Todas las visitas recientes</h4>
                <p className="text-xs text-app-text-secondary">Rango consultado: últimos 3 días ({ultimasVisitasRango.length} registros).</p>
              </div>
              <button type="button" className="app-btn-ghost text-xs" onClick={() => setVisitasModalOpen(false)}>
                Cerrar
              </button>
            </div>

            <div className="app-surface-muted p-2 md:grid md:grid-cols-[1fr_auto] gap-2">
              <input
                className="app-input"
                placeholder="Buscar por visitante, documento, placa o torre/apto"
                value={busquedaVisitas}
                onChange={(e) => setBusquedaVisitas(e.target.value)}
              />
              <div className="text-xs text-app-text-secondary flex items-center justify-end">
                {visitasFiltradasModal.length} resultado(s)
              </div>
            </div>

            <div className="space-y-2 max-h-[68vh] overflow-y-auto pr-1 app-scrollbar">
              {visitasPaginadasModal.length === 0 && (
                <p className="text-xs text-app-text-secondary">Sin resultados para esta búsqueda.</p>
              )}
              {visitasPaginadasModal.map((v) => {
                const torreApto = obtenerTorreAptoVisita(v);

                return (
                  <div key={v.id} className="app-surface-muted p-3 flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{obtenerNombreVisita(v)}</p>
                        <span className="text-xs text-app-text-secondary">• {obtenerDocumentoVisita(v)}</span>
                      </div>
                      <p className="text-sm text-app-text-secondary">Placa: {obtenerPlacaVisita(v)}</p>
                      <p className="text-xs text-app-text-secondary">
                        Fecha: {v.fecha_visita || '-'} · Ingreso: {v.hora_ingreso || 'Pendiente'} · Salida: {v.hora_salida || 'Pendiente'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-[11px] px-2 py-1 rounded-lg bg-app-bg border border-app-border text-app-text-secondary">{torreApto}</span>
                      <span className={v.estado === 'pendiente' ? 'app-badge app-badge-warning' : v.estado === 'ingresado' ? 'app-badge app-badge-info' : 'app-badge app-badge-success'}>{v.estado}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {visitasFiltradasModal.length > VISITAS_MODAL_PAGE_SIZE && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-app-text-secondary">
                  Página {paginaVisitasModal} de {totalPaginasVisitas}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="app-btn-ghost text-xs disabled:opacity-40"
                    disabled={paginaVisitasModal === 1}
                    onClick={() => setPaginaVisitasModal((prev) => Math.max(1, prev - 1))}
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    className="app-btn-ghost text-xs disabled:opacity-40"
                    disabled={paginaVisitasModal === totalPaginasVisitas}
                    onClick={() => setPaginaVisitasModal((prev) => Math.min(totalPaginasVisitas, prev + 1))}
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
