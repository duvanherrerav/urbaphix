import { useState } from 'react';
import { supabase } from '../../../services/supabaseClient';
import jsPDF from 'jspdf';

const formatFechaBogota = (value) => {
  if (!value) return '-';
  const raw = String(value).trim().replace(' ', 'T');
  const hasZone = /Z$|[+-]\d{2}:\d{2}$/.test(raw);
  const parsed = new Date(hasZone ? raw : `${raw}Z`);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleDateString('es-CO', { timeZone: 'America/Bogota' });
};

export default function EstadoCuenta({ usuarioApp }) {
  const hoy = new Date();
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [fechaDesde, setFechaDesde] = useState(new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0]);
  const [fechaHasta, setFechaHasta] = useState(hoy.toISOString().split('T')[0]);
  const [estado, setEstado] = useState(null);
  const [loading, setLoading] = useState(false);

  const generarEstado = async () => {
    if (!usuarioApp?.conjunto_id) return;
    if (!fechaDesde || !fechaHasta || fechaDesde > fechaHasta) {
      alert('Rango de fechas inválido');
      return;
    }
    setLoading(true);

    let query = supabase
      .from('pagos')
      .select('id, valor, estado, created_at, concepto, tipo_pago')
      .eq('conjunto_id', usuarioApp.conjunto_id)
      .gte('created_at', `${fechaDesde}T00:00:00`)
      .lte('created_at', `${fechaHasta}T23:59:59`)
      .order('created_at', { ascending: false });

    if (filtroEstado !== 'todos') {
      query = query.eq('estado', filtroEstado);
    }

    const { data, error } = await query;
    setLoading(false);

    if (error) {
      console.log(error);
      alert('Error generando reporte');
      return;
    }

    const pagos = data || [];
    const totalPendiente = pagos
      .filter((p) => p.estado === 'pendiente')
      .reduce((acc, p) => acc + Number(p.valor || 0), 0);
    const totalPagado = pagos
      .filter((p) => p.estado === 'pagado')
      .reduce((acc, p) => acc + Number(p.valor || 0), 0);
    const totalMovimientos = pagos.length;
    const totalValorPeriodo = pagos.reduce((acc, p) => acc + Number(p.valor || 0), 0);

    const porTipo = {};
    pagos.forEach((p) => {
      const tipo = p.tipo_pago || 'sin_tipo';
      if (!porTipo[tipo]) porTipo[tipo] = { cantidad: 0, total: 0 };
      porTipo[tipo].cantidad += 1;
      porTipo[tipo].total += Number(p.valor || 0);
    });

    setEstado({
      fechaDesde,
      fechaHasta,
      filtroEstado,
      totalPendiente,
      totalPagado,
      totalMovimientos,
      totalValorPeriodo,
      pagos,
      porTipo
    });
  };

  const generarPDF = () => {
    if (!estado) return;

    const doc = new jsPDF();
    let y = 10;
    doc.setFontSize(16);
    doc.text('Reporte consolidado de pagos - Urbaphix', 10, y);
    y += 8;
    doc.setFontSize(11);
    doc.text(`Periodo: ${estado.fechaDesde} a ${estado.fechaHasta}`, 10, y);
    y += 6;
    doc.text(`Estado filtrado: ${estado.filtroEstado}`, 10, y);
    y += 8;
    doc.text(`Total pendiente: $${estado.totalPendiente.toLocaleString('es-CO')}`, 10, y);
    y += 6;
    doc.text(`Total pagado: $${estado.totalPagado.toLocaleString('es-CO')}`, 10, y);
    y += 8;
    doc.text('Resumen por tipo de pago:', 10, y);
    y += 6;

    Object.entries(estado.porTipo).forEach(([tipo, info]) => {
      doc.text(`${tipo}: ${info.cantidad} registros - $${info.total.toLocaleString('es-CO')}`, 10, y);
      y += 6;
    });

    y += 2;
    doc.text('Movimientos:', 10, y);
    y += 6;

    estado.pagos.forEach((p) => {
      doc.text(
        `${formatFechaBogota(p.created_at)} | ${p.estado} | ${p.tipo_pago || '-'} | $${Number(p.valor || 0).toLocaleString('es-CO')}`,
        10,
        y
      );
      y += 6;
      if (y > 270) {
        doc.addPage();
        y = 10;
      }
    });

    doc.save(`reporte_pagos_${estado.fechaDesde}_${estado.fechaHasta}.pdf`);
  };

  return (
    <div className="app-surface-primary p-6 space-y-4">
      <div>
        <h2 className="text-xl font-bold mb-1">Estado de cuenta consolidado</h2>
        <p className="text-sm text-app-text-secondary">Resumen financiero del periodo seleccionado. Este bloque respeta exclusivamente filtros de fecha y estado.</p>
      </div>

      <div className="app-surface-muted p-3 grid md:grid-cols-4 gap-3">
        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="app-input">
          <option value="todos">Todos</option>
          <option value="pendiente">Pendiente</option>
          <option value="pagado">Pagado</option>
        </select>

        <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className="app-input" />
        <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className="app-input" />

        <button onClick={generarEstado} className="app-btn-secondary">
          {loading ? 'Generando...' : 'Generar reporte'}
        </button>
      </div>

      {estado && (
        <div className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-app-text-secondary mb-2">Resumen del periodo seleccionado</p>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-state-success/35 bg-app-bg px-4 py-3">
                <p className="text-xs text-app-text-secondary">Recaudado</p>
                <p className="text-2xl font-bold text-state-success">${estado.totalPagado.toLocaleString('es-CO')}</p>
              </div>
              <div className="rounded-xl border border-state-warning/35 bg-app-bg px-4 py-3">
                <p className="text-xs text-app-text-secondary">Pendiente</p>
                <p className="text-2xl font-bold text-state-warning">${estado.totalPendiente.toLocaleString('es-CO')}</p>
              </div>
              <div className="rounded-xl border border-brand-secondary/35 bg-app-bg px-4 py-3">
                <p className="text-xs text-app-text-secondary">Total movimientos</p>
                <p className="text-2xl font-bold">{estado.totalMovimientos}</p>
              </div>
              <div className="rounded-xl border border-brand-primary/35 bg-app-bg px-4 py-3">
                <p className="text-xs text-app-text-secondary">Valor total del periodo</p>
                <p className="text-2xl font-bold">${estado.totalValorPeriodo.toLocaleString('es-CO')}</p>
              </div>
            </div>
          </div>

          <div className="app-surface-muted">
            <h3 className="font-semibold mb-2">Tipos de pago del periodo</h3>
            <div className="grid md:grid-cols-3 gap-2 text-sm">
              {Object.entries(estado.porTipo).map(([tipo, info]) => (
                <div key={tipo} className="rounded-lg border border-app-border bg-app-bg px-3 py-2">
                  <p className="font-medium">{tipo}</p>
                  <p className="text-app-text-secondary">{info.cantidad} registros</p>
                  <p className="text-app-text-secondary">${info.total.toLocaleString('es-CO')}</p>
                </div>
              ))}
            </div>
          </div>

          <button onClick={generarPDF} className="app-btn-ghost">
            Descargar PDF 📄
          </button>

          <div>
            <h3 className="font-semibold mb-2">Movimientos del periodo</h3>
            <div className="space-y-2 max-h-72 overflow-auto">
              {estado.pagos.map((p) => (
                <article key={p.id} className="rounded-xl border border-app-border bg-app-bg p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{p.concepto || 'Sin concepto'}</p>
                      <p className="text-xs text-app-text-secondary">{formatFechaBogota(p.created_at)} · Tipo: {p.tipo_pago || '-'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">${Number(p.valor || 0).toLocaleString('es-CO')}</p>
                      <span className={`app-badge capitalize ${p.estado === 'pendiente' ? 'app-badge-warning' : p.estado === 'pagado' ? 'app-badge-success' : 'app-badge-error'}`}>
                        {p.estado}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
              {estado.pagos.length === 0 && <p className="text-app-text-secondary">Sin pagos para ese filtro.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
