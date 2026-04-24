import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../services/supabaseClient';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
} from 'chart.js';

import PaquetesPorTorre from '../components/PaquetesPorTorre';
import KPIsAdmin from '../components/KPIsAdmin';
import DashboardResumen from '../components/DashboardResumen';
import CarteraResumen from '../../contabilidad/components/CarteraResumen';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

export default function DashboardAdmin({ usuarioApp }) {

  const [visitas, setVisitas] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [incidentes, setIncidentes] = useState([]);
  const [reservas, setReservas] = useState([]);

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

  const chartTextColor = '#E5E7EB';
  const chartGridColor = 'rgba(148, 163, 184, 0.18)';

  const visitasChart = useMemo(() => {
    const visitasPorDia = {};

    visitas.forEach((v) => {
      const fecha = v.fecha_visita;
      if (!visitasPorDia[fecha]) visitasPorDia[fecha] = 0;
      visitasPorDia[fecha] += 1;
    });

    const fechas = Object.keys(visitasPorDia).sort();
    const labels = fechas.map((f) => new Date(f).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }));

    return {
      data: {
        labels,
        datasets: [
          {
            label: 'Visitas',
            data: fechas.map((f) => visitasPorDia[f]),
            backgroundColor: 'rgba(59, 130, 246, 0.9)',
            hoverBackgroundColor: 'rgba(37, 99, 235, 1)',
            borderRadius: 8,
            maxBarThickness: 36
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: chartTextColor, boxWidth: 12, padding: 14, font: { size: 12, weight: '600' } }
          },
          tooltip: {
            backgroundColor: '#0F172A',
            titleColor: '#F8FAFC',
            bodyColor: '#E2E8F0'
          }
        },
        layout: {
          padding: { top: 4, right: 8, bottom: 2, left: 4 }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: chartTextColor, font: { size: 11, weight: '600' } }
          },
          y: {
            beginAtZero: true,
            ticks: { color: chartTextColor, stepSize: 1, font: { size: 11, weight: '600' } },
            grid: { color: chartGridColor }
          }
        }
      }
    };
  }, [visitas]);

  const flujoChart = useMemo(() => {
    const agrupado = {};

    pagos.forEach((p) => {
      const fecha = p.created_at.split('T')[0];
      if (!agrupado[fecha]) agrupado[fecha] = { pagado: 0, pendiente: 0 };
      if (p.estado === 'pagado') agrupado[fecha].pagado += Number(p.valor || 0);
      else agrupado[fecha].pendiente += Number(p.valor || 0);
    });

    const fechas = Object.keys(agrupado).sort();
    const labels = fechas.map((f) => new Date(f).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }));

    return {
      data: {
        labels,
        datasets: [
          {
            label: 'Pagado',
            data: fechas.map((f) => agrupado[f].pagado),
            backgroundColor: 'rgba(16, 185, 129, 0.9)',
            borderRadius: 8,
            maxBarThickness: 30
          },
          {
            label: 'Pendiente',
            data: fechas.map((f) => agrupado[f].pendiente),
            backgroundColor: 'rgba(245, 158, 11, 0.9)',
            borderRadius: 8,
            maxBarThickness: 30
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            align: 'center',
            labels: { color: chartTextColor, boxWidth: 12, padding: 16, font: { size: 12, weight: '600' } }
          },
          tooltip: {
            backgroundColor: '#0F172A',
            titleColor: '#F8FAFC',
            bodyColor: '#E2E8F0'
          }
        },
        layout: {
          padding: { top: 4, right: 10, bottom: 6, left: 6 }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: chartTextColor, font: { size: 11, weight: '600' } }
          },
          y: {
            beginAtZero: true,
            ticks: { color: chartTextColor, font: { size: 11, weight: '600' } },
            grid: { color: chartGridColor }
          }
        }
      }
    };
  }, [pagos]);

  const carteraChart = useMemo(() => {
    const totalPagado = pagos
      .filter((p) => p.estado === 'pagado')
      .reduce((acc, p) => acc + Number(p.valor || 0), 0);
    const totalPendiente = pagos
      .filter((p) => p.estado !== 'pagado')
      .reduce((acc, p) => acc + Number(p.valor || 0), 0);

    return {
      totalPagado,
      totalPendiente,
      data: {
        labels: ['Pagado', 'Pendiente'],
        datasets: [
          {
            data: [totalPagado, totalPendiente],
            backgroundColor: ['#10B981', '#F59E0B'],
            borderColor: ['#059669', '#D97706'],
            borderWidth: 1,
            hoverOffset: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        radius: '82%',
        plugins: {
          legend: {
            position: 'bottom',
            align: 'center',
            labels: { color: chartTextColor, boxWidth: 12, padding: 14, font: { size: 12, weight: '600' } }
          },
          tooltip: {
            backgroundColor: '#0F172A',
            titleColor: '#F8FAFC',
            bodyColor: '#E2E8F0'
          }
        },
        layout: {
          padding: { top: 4, right: 6, bottom: 0, left: 6 }
        }
      }
    };
  }, [pagos]);

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
          <div className="h-[320px] rounded-xl bg-app-bg-alt p-3">
            <Bar data={visitasChart.data} options={visitasChart.options} />
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
          <div className="h-[300px] rounded-xl bg-app-bg-alt p-3">
            <Bar data={flujoChart.data} options={flujoChart.options} />
          </div>
        </div>
        <div className="app-surface-primary p-4 flex flex-col">
          <h3 className="text-app-text-primary text-lg font-bold mb-1">📊 Análisis de cartera</h3>
          <p className="text-sm text-app-text-secondary mb-3">Estado financiero consolidado del conjunto.</p>
          <div className="rounded-xl bg-app-bg-alt p-3">
            <div className="h-[240px] max-w-[320px] w-full mx-auto">
              <Doughnut data={carteraChart.data} options={carteraChart.options} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-app-border bg-app-bg p-2">
                <p className="font-semibold text-app-text-primary">Pagado</p>
                <p className="text-sm font-bold text-state-success">${carteraChart.totalPagado.toLocaleString('es-CO')}</p>
              </div>
              <div className="rounded-lg border border-app-border bg-app-bg p-2">
                <p className="font-semibold text-app-text-primary">Pendiente</p>
                <p className="text-sm font-bold text-state-warning">${carteraChart.totalPendiente.toLocaleString('es-CO')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="app-surface-primary p-6 mt-3">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-app-text-primary text-lg font-bold">Últimas visitas</h3>
          <span className="text-sm text-app-text-secondary">{visitas.slice(0, 5).length} registros recientes</span>
        </div>
        <div className="space-y-2">
          {visitas.slice(0, 5).map(v => (
            <div key={v.id} className="app-surface-muted p-3 flex justify-between items-center">
              <div>
                <p className="font-medium">{v.nombre_visitante || 'Visitante'}</p>
                <p className="text-sm text-app-text-secondary">{v.documento || '-'} • {v.placa || 'Sin placa'}</p>
                <p className="text-xs text-app-text-secondary">
                  Fecha: {v.fecha_visita || '-'} · Ingreso: {v.hora_ingreso || 'Pendiente'} · Salida: {v.hora_salida || 'Pendiente'}
                </p>
              </div>
              <span className={v.estado === 'pendiente' ? 'app-badge app-badge-warning' : v.estado === 'ingresado' ? 'app-badge app-badge-info' : 'app-badge app-badge-success'}>{v.estado}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
