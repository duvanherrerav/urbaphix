import { useEffect, useState } from 'react';
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

  useEffect(() => {

    if (!usuarioApp?.conjunto_id) return;

    obtenerVisitas();
    obtenerPagos();

    const channel = supabase
      .channel('admin-visitas')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'visitas'
        },
        () => {
          obtenerVisitas();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };

  }, [usuarioApp]);

  // 🔥 VISITAS
  const obtenerVisitas = async () => {

    const hoy = new Date();
    const hace7dias = new Date();

    hace7dias.setDate(hoy.getDate() - 7);

    const fechaInicio = hace7dias.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('visitas')
      .select('*')
      .eq('conjunto_id', usuarioApp.conjunto_id)
      .gte('fecha_visita', fechaInicio);

    if (error) return;

    setVisitas(data || []);

    setStats({
      total: data.length,
      ingresados: data.filter(v => v.estado === 'ingresado').length,
      pendientes: data.filter(v => v.estado === 'pendiente').length,
      salidos: data.filter(v => v.estado === 'salido').length
    });
  };

  // 🔥 PAGOS
  const obtenerPagos = async () => {

    const { data, error } = await supabase
      .from('pagos')
      .select('valor, estado, created_at')
      .eq('conjunto_id', usuarioApp.conjunto_id);

    if (error) return;

    setPagos(data || []);
  };

  return (
    <div className="space-y-6">

      {/* 🔥 HEADER PRO */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-700 text-white p-6 rounded-2xl shadow-lg">

        <h2 className="text-2xl font-bold">
          👋 Hola {usuarioApp?.nombre || 'Admin'}
        </h2>

        <p className="text-sm text-gray-300 mt-1">
          Resumen general del conjunto
        </p>

        <div className="flex gap-6 mt-4 text-sm">

          <div>🚗 {stats.ingresados} visitas activas</div>
          <div>📦 {kpis.paquetesPendientes} paquetes</div>
          <div>💰 {pagos.filter(p => p.estado === 'pendiente').length} pagos pendientes</div>

        </div>

      </div>

      {/* 🔥 KPIs */}
      <KPIsAdmin usuarioApp={usuarioApp} setKpis={setKpis} />
      <DashboardResumen stats={stats} kpis={kpis} />

      {/* 🔥 CARDS MEJORADAS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

        <div className="bg-yellow-400 text-white p-4 rounded-2xl shadow hover:scale-105 transition">
          🟡 Pendientes
          <div className="text-2xl font-bold">{stats.pendientes}</div>
        </div>

        <div className="bg-blue-500 text-white p-4 rounded-2xl shadow hover:scale-105 transition">
          🔵 Ingresados
          <div className="text-2xl font-bold">{stats.ingresados}</div>
        </div>

        <div className="bg-green-500 text-white p-4 rounded-2xl shadow hover:scale-105 transition">
          🟢 Salidos
          <div className="text-2xl font-bold">{stats.salidos}</div>
        </div>

        <div className="bg-gray-900 text-white p-4 rounded-2xl shadow hover:scale-105 transition">
          📦 Total
          <div className="text-2xl font-bold">{stats.total}</div>
        </div>

      </div>

      {/* 🔥 ALERTA CARTERA */}
      <div className="bg-red-50 border border-red-200 p-4 rounded-2xl shadow">
        <h3 className="font-semibold text-red-600 mb-2">
          🔥 Cartera en riesgo
        </h3>

        <CarteraResumen usuarioApp={usuarioApp} />
      </div>

      {/* 🔥 GRÁFICAS PRINCIPALES */}
      <div className="grid md:grid-cols-2 gap-6">

        <div className="bg-white p-4 rounded-2xl shadow">
          <h3 className="font-semibold mb-2">📊 Actividad</h3>
          <GraficaVisitas visitas={visitas} />
        </div>

        <div className="bg-white p-4 rounded-2xl shadow">
          <h3 className="font-semibold mb-2">📦 Paquetes</h3>
          <PaquetesPorTorre usuarioApp={usuarioApp} />
        </div>



        {/* 🔥 FINANCIERO */}
        <div className="bg-white p-4 rounded-2xl shadow">
          <h3 className="font-semibold mb-2">💰 Flujo financiero</h3>
          <GraficaFinanciera pagos={pagos} />
        </div>

        {/* 🔥 CARTERA ANALÍTICA */}
        <div className="bg-white p-4">
          <h3 className="font-semibold mb-2">📊 Análisis de cartera</h3>
          <GraficaCartera pagos={pagos} />
        </div>
      </div>

      {/* 🔥 LISTADO */}
      <div className="bg-white p-4 rounded-2xl shadow">

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
                <p className="text-sm text-gray-500">
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