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

  const [visitas, setVisitas] = useState([]);
  const [pagos, setPagos] = useState([]);

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

  // 🔥 VISITAS
  async function obtenerVisitas() {
    try {
      const hoy = new Date();
      const hace7dias = new Date();

      hace7dias.setDate(hoy.getDate() - 7);

      const fechaInicio = hace7dias.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('registro_visitas')
        .select('*')
        .eq('conjunto_id', usuarioApp.conjunto_id)
        .gte('fecha_visita', fechaInicio);

      if (error) {
        setVisitas([]);
        setStats({
          total: 0,
          ingresados: 0,
          pendientes: 0,
          salidos: 0
        });
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
      setStats({
        total: 0,
        ingresados: 0,
        pendientes: 0,
        salidos: 0
      });
    }
  }

  // 🔥 PAGOS
  async function obtenerPagos() {

    const { data, error } = await supabase
      .from('pagos')
      .select('valor, estado, created_at')
      .eq('conjunto_id', usuarioApp.conjunto_id);

    if (error) return;

    setPagos(data || []);
  }

  useEffect(() => {

    if (!usuarioApp?.conjunto_id) return;

    const timer = setTimeout(() => {
      obtenerVisitas();
      obtenerPagos();
    }, 0);

    const channel = supabase
      .channel('admin-visitas')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'registro_visitas'
        },
        () => {
          obtenerVisitas();
        }
      )
      .subscribe();

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };

  }, [usuarioApp]);

  return (
    <div className="space-y-6">

      {/* 🔥 HEADER PRO */}
      <div className="app-surface-primary p-6 text-app-text-primary">

        <h2 className="text-2xl font-bold">
          👋 Hola {usuarioApp?.nombre || 'Admin'}
        </h2>

        <p className="text-sm text-app-text-secondary mt-1">
          Resumen general del conjunto
        </p>

        <div className="flex gap-6 mt-4 text-sm">

          <div>🚗 {stats.ingresados} visitas activas</div>
          <div>📦 {kpis.paquetesPendientes} paquetes</div>
          <div>💰 {resumenFinanciero.pendientesCantidad} pagos pendientes</div>

        </div>

      </div>

      {/* 🔥 KPIs */}
      <KPIsAdmin usuarioApp={usuarioApp} setKpis={setKpis} />
      <DashboardResumen stats={stats} kpis={kpis} />

      {/* 🔥 CARDS MEJORADAS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

        <div className="app-surface-muted p-4">
          🟡 Pendientes
          <div className="text-2xl font-bold">{stats.pendientes}</div>
        </div>

        <div className="app-surface-muted p-4">
          🔵 Ingresados
          <div className="text-2xl font-bold">{stats.ingresados}</div>
        </div>

        <div className="app-surface-muted p-4">
          🟢 Salidos
          <div className="text-2xl font-bold">{stats.salidos}</div>
        </div>

        <div className="app-surface-muted p-4">
          📦 Total
          <div className="text-2xl font-bold">{stats.total}</div>
        </div>

      </div>

      {/* 🔥 NUEVOS MINI DASHBOARDS (sin saturar) */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="app-surface-primary p-4">
          <h3 className="font-semibold text-app-text-primary mb-3">⚙️ Salud operativa</h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Ocupación de visitas</span>
                <span className="font-semibold">{saludOperativa.ocupacion}%</span>
              </div>
              <div className="h-2 bg-app-bg rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400" style={{ width: `${saludOperativa.ocupacion}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Visitas finalizadas</span>
                <span className="font-semibold">{saludOperativa.finalizacion}%</span>
              </div>
              <div className="h-2 bg-app-bg rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-500 to-lime-400" style={{ width: `${saludOperativa.finalizacion}%` }} />
              </div>
            </div>
          </div>
        </div>

        <div className="app-surface-primary p-4">
          <h3 className="font-semibold text-app-text-primary mb-3">💼 Pulso financiero</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-app-border bg-app-bg p-3">
              <p className="text-state-success font-medium">Recaudado</p>
              <p className="text-lg font-bold text-app-text-primary">${resumenFinanciero.pagadoMonto.toLocaleString('es-CO')}</p>
            </div>
            <div className="rounded-xl border border-app-border bg-app-bg p-3">
              <p className="text-state-warning font-medium">Pendiente</p>
              <p className="text-lg font-bold text-app-text-primary">${resumenFinanciero.pendienteMonto.toLocaleString('es-CO')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 🔥 ALERTA CARTERA */}
      <div className="app-surface-primary p-4">
        <h3 className="font-semibold text-state-error mb-2">
          🔥 Cartera en riesgo
        </h3>

        <CarteraResumen usuarioApp={usuarioApp} />
      </div>

      {/* 🔥 GRÁFICAS PRINCIPALES */}
      <div className="grid md:grid-cols-2 gap-6">

        <div className="app-surface-primary p-4">
          <h3 className="font-semibold mb-2">📊 Actividad</h3>
          <GraficaVisitas visitas={visitas} />
        </div>

        <div className="app-surface-primary p-4">
          <h3 className="font-semibold mb-2">📦 Paquetes</h3>
          <PaquetesPorTorre usuarioApp={usuarioApp} />
        </div>



        {/* 🔥 FINANCIERO */}
        <div className="app-surface-primary p-4">
          <h3 className="font-semibold mb-2">💰 Flujo financiero</h3>
          <GraficaFinanciera pagos={pagos} />
        </div>

        {/* 🔥 CARTERA ANALÍTICA */}
        <div className="app-surface-primary p-4">
          <h3 className="font-semibold mb-2">📊 Análisis de cartera</h3>
          <GraficaCartera pagos={pagos} />
        </div>
      </div>

      {/* 🔥 LISTADO */}
      <div className="app-surface-primary p-4">

        <h3 className="font-semibold mb-4">
          Últimas visitas
        </h3>

        <div className="space-y-3">

          {visitas.slice(0, 5).map(v => (
            <div
              key={v.id}
              className="border rounded-lg p-3 flex justify-between items-center"
            >
              <div>
                <p className="font-medium">{v.nombre_visitante}</p>
                <p className="text-sm text-app-text-secondary">
                  {v.documento} • {v.placa || 'Sin placa'}
                </p>
              </div>

              <span className={
                v.estado === 'pendiente'
                  ? 'text-yellow-500 font-semibold'
                  : v.estado === 'ingresado'
                    ? 'text-blue-500 font-semibold'
                    : 'text-green-500 font-semibold'
              }>
                {v.estado}
              </span>

            </div>
          ))}

        </div>

      </div>

    </div>
  );
}
