import { useState } from 'react';
import { supabase } from '../../../services/supabaseClient';
import jsPDF from 'jspdf';
import AppDatePicker from '../../../components/ui/AppDatePicker';
import { getTipoPagoLabel } from '../utils/pagosLabels';

const formatFechaBogota = (value) => {
  if (!value) return '-';
  const raw = String(value).trim().replace(' ', 'T');
  const hasZone = /Z$|[+-]\d{2}:\d{2}$/.test(raw);
  const parsed = new Date(hasZone ? raw : `${raw}Z`);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleDateString('es-CO', { timeZone: 'America/Bogota' });
};

export default function EstadoCuenta({ usuarioApp }) {
  const MOVIMIENTOS_PREVIEW_LIMIT = 5;
  const MOVIMIENTOS_PAGE_SIZE = 8;
  const hoy = new Date();
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [fechaDesde, setFechaDesde] = useState(new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0]);
  const [fechaHasta, setFechaHasta] = useState(hoy.toISOString().split('T')[0]);
  const [estado, setEstado] = useState(null);
  const [loading, setLoading] = useState(false);
  const [movimientosModalOpen, setMovimientosModalOpen] = useState(false);
  const [movimientosPagina, setMovimientosPagina] = useState(1);

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
    const drawHeader = () => {
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 34, 'F');
      doc.setTextColor(56, 189, 248);
      doc.setFontSize(14);
      doc.text('Urbaphix', 12, 13);
      doc.setTextColor(226, 232, 240);
      doc.setFontSize(16);
      doc.text('Estado de cuenta consolidado', 12, 22);
      doc.setFontSize(10);
      doc.text(`Periodo: ${estado.fechaDesde} a ${estado.fechaHasta}`, 12, 29);
      doc.text(`Generado: ${new Date().toLocaleString('es-CO')}`, 136, 29);
      doc.setTextColor(15, 23, 42);
      return 42;
    };

    const drawMetricCard = (x, y, title, value) => {
      doc.setDrawColor(203, 213, 225);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x, y, 45, 20, 2, 2, 'FD');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(title, x + 2, y + 6);
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(value, x + 2, y + 14);
    };

    let y = drawHeader();
    drawMetricCard(12, y, 'Recaudado', `$${estado.totalPagado.toLocaleString('es-CO')}`);
    drawMetricCard(60, y, 'Pendiente', `$${estado.totalPendiente.toLocaleString('es-CO')}`);
    drawMetricCard(108, y, 'Total movimientos', `${estado.totalMovimientos}`);
    drawMetricCard(156, y, 'Valor total', `$${estado.totalValorPeriodo.toLocaleString('es-CO')}`);
    y += 28;

    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('Tipos de pago', 12, y);
    y += 5;
    doc.setFontSize(9);
    Object.entries(estado.porTipo).forEach(([tipo, info]) => {
      if (y > 265) {
        doc.addPage();
        y = drawHeader();
      }
      doc.text(`• ${getTipoPagoLabel(tipo)}: ${info.cantidad} registro(s) - $${info.total.toLocaleString('es-CO')}`, 14, y);
      y += 5;
    });

    y += 3;
    if (y > 250) {
      doc.addPage();
      y = drawHeader();
    }

    doc.setFontSize(11);
    doc.text('Movimientos', 12, y);
    y += 6;

    const tableX = 12;
    const tableWidths = [32, 30, 94, 30];
    const headers = ['Fecha', 'Estado', 'Concepto', 'Valor'];
    doc.setFillColor(226, 232, 240);
    doc.rect(tableX, y - 4, tableWidths.reduce((acc, w) => acc + w, 0), 7, 'F');
    doc.setFontSize(9);
    let cursorX = tableX + 1;
    headers.forEach((header, index) => {
      doc.text(header, cursorX, y);
      cursorX += tableWidths[index];
    });
    y += 5;

    estado.pagos.forEach((p) => {
      if (y > 276) {
        doc.addPage();
        y = drawHeader();
        doc.setFillColor(226, 232, 240);
        doc.rect(tableX, y - 4, tableWidths.reduce((acc, w) => acc + w, 0), 7, 'F');
        cursorX = tableX + 1;
        headers.forEach((header, index) => {
          doc.text(header, cursorX, y);
          cursorX += tableWidths[index];
        });
        y += 5;
      }

      const cols = [
        formatFechaBogota(p.created_at),
        getTipoPagoLabel(p.estado),
        (p.concepto || '-').slice(0, 46),
        `$${Number(p.valor || 0).toLocaleString('es-CO')}`
      ];

      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      cursorX = tableX + 1;
      cols.forEach((col, index) => {
        doc.text(String(col), cursorX, y);
        cursorX += tableWidths[index];
      });
      y += 5;
    });

    doc.save(`reporte_pagos_${estado.fechaDesde}_${estado.fechaHasta}.pdf`);
  };

  const movimientos = estado?.pagos || [];
  const movimientosPreview = movimientos.slice(0, MOVIMIENTOS_PREVIEW_LIMIT);
  const totalPaginasMovimientos = Math.max(1, Math.ceil(movimientos.length / MOVIMIENTOS_PAGE_SIZE));
  const movimientosPaginados = movimientos.slice(
    (movimientosPagina - 1) * MOVIMIENTOS_PAGE_SIZE,
    movimientosPagina * MOVIMIENTOS_PAGE_SIZE
  );

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

        <AppDatePicker value={fechaDesde} max={fechaHasta} onChange={setFechaDesde} />
        <AppDatePicker value={fechaHasta} min={fechaDesde} onChange={setFechaHasta} />

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
                  <p className="font-medium">{getTipoPagoLabel(tipo)}</p>
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
            <div className="space-y-2 max-h-72 overflow-auto pr-1 app-scrollbar">
              {movimientosPreview.map((p) => (
                <article key={p.id} className="rounded-xl border border-app-border bg-app-bg p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{p.concepto || 'Sin concepto'}</p>
                      <p className="text-xs text-app-text-secondary">{formatFechaBogota(p.created_at)} · Tipo: {getTipoPagoLabel(p.tipo_pago)}</p>
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
              {movimientos.length === 0 && <p className="text-app-text-secondary">Sin pagos para ese filtro.</p>}
            </div>
            {movimientos.length > MOVIMIENTOS_PREVIEW_LIMIT && (
              <button
                type="button"
                className="app-btn-ghost text-xs mt-3"
                onClick={() => {
                  setMovimientosPagina(1);
                  setMovimientosModalOpen(true);
                }}
              >
                Ver todos los movimientos ({movimientos.length})
              </button>
            )}
          </div>
        </div>
      )}

      {movimientosModalOpen && (
        <div className="fixed inset-0 bg-app-bg/85 backdrop-blur-sm z-50 p-4 flex items-center justify-center">
          <div className="app-surface-primary w-full max-w-4xl p-4 space-y-4 border border-brand-primary/20 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="font-semibold text-lg">Todos los movimientos del periodo</h4>
                <p className="text-xs text-app-text-secondary">{movimientos.length} registros en el periodo seleccionado</p>
              </div>
              <button type="button" className="app-btn-ghost text-xs" onClick={() => setMovimientosModalOpen(false)}>
                Cerrar
              </button>
            </div>

            <div className="space-y-2 max-h-[68vh] overflow-y-auto pr-1 app-scrollbar">
              {movimientosPaginados.map((p) => (
                <article key={p.id} className="rounded-xl border border-app-border bg-app-bg p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{p.concepto || 'Sin concepto'}</p>
                      <p className="text-xs text-app-text-secondary">
                        {formatFechaBogota(p.created_at)} · Tipo: {getTipoPagoLabel(p.tipo_pago)}
                      </p>
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
            </div>

            {movimientos.length > MOVIMIENTOS_PAGE_SIZE && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-app-text-secondary">
                  Página {movimientosPagina} de {totalPaginasMovimientos}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="app-btn-ghost text-xs disabled:opacity-40"
                    disabled={movimientosPagina === 1}
                    onClick={() => setMovimientosPagina((prev) => Math.max(1, prev - 1))}
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    className="app-btn-ghost text-xs disabled:opacity-40"
                    disabled={movimientosPagina === totalPaginasMovimientos}
                    onClick={() => setMovimientosPagina((prev) => Math.min(totalPaginasMovimientos, prev + 1))}
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
