import { useMemo, useState } from 'react';
import { supabase } from '../../../services/supabaseClient';
import jsPDF from 'jspdf';

const MESES = [
  { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' }, { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' }, { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' }, { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' }
];

export default function EstadoCuenta({ usuarioApp }) {
  const hoy = new Date();
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [estado, setEstado] = useState(null);
  const [loading, setLoading] = useState(false);

  const aniosDisponibles = useMemo(() => {
    const current = new Date().getFullYear();
    return [current - 2, current - 1, current, current + 1];
  }, []);

  const generarEstado = async () => {
    if (!usuarioApp?.conjunto_id) return;
    setLoading(true);

    const inicio = `${anio}-${String(mes).padStart(2, '0')}-01`;
    const finDate = new Date(anio, mes, 0);
    const fin = `${anio}-${String(mes).padStart(2, '0')}-${String(finDate.getDate()).padStart(2, '0')}`;

    let query = supabase
      .from('pagos')
      .select('id, valor, estado, created_at, concepto, tipo_pago')
      .eq('conjunto_id', usuarioApp.conjunto_id)
      .gte('created_at', `${inicio}T00:00:00`)
      .lte('created_at', `${fin}T23:59:59`)
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

    const porTipo = {};
    pagos.forEach((p) => {
      const tipo = p.tipo_pago || 'sin_tipo';
      if (!porTipo[tipo]) porTipo[tipo] = { cantidad: 0, total: 0 };
      porTipo[tipo].cantidad += 1;
      porTipo[tipo].total += Number(p.valor || 0);
    });

    setEstado({
      mesLabel: MESES.find((m) => m.value === mes)?.label || `${mes}`,
      anio,
      filtroEstado,
      totalPendiente,
      totalPagado,
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
    doc.text(`Periodo: ${estado.mesLabel} ${estado.anio}`, 10, y);
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
        `${new Date(p.created_at).toLocaleDateString()} | ${p.estado} | ${p.tipo_pago || '-'} | $${Number(p.valor || 0).toLocaleString('es-CO')}`,
        10,
        y
      );
      y += 6;
      if (y > 270) {
        doc.addPage();
        y = 10;
      }
    });

    doc.save(`reporte_pagos_${estado.anio}_${String(mes).padStart(2, '0')}.pdf`);
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow">
      <h2 className="text-xl font-bold mb-2">📄 Estado de cuenta consolidado</h2>
      <p className="text-sm text-gray-500 mb-4">Genera reporte mensual por estado de pago (sin filtro por torre o apartamento).</p>

      <div className="grid md:grid-cols-4 gap-3 mb-4">
        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="border rounded-lg px-3 py-2">
          <option value="todos">Todos</option>
          <option value="pendiente">Pendiente</option>
          <option value="pagado">Pagado</option>
        </select>

        <select value={mes} onChange={(e) => setMes(Number(e.target.value))} className="border rounded-lg px-3 py-2">
          {MESES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>

        <select value={anio} onChange={(e) => setAnio(Number(e.target.value))} className="border rounded-lg px-3 py-2">
          {aniosDisponibles.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>

        <button onClick={generarEstado} className="bg-blue-600 text-white rounded-lg px-4 py-2">
          {loading ? 'Generando...' : 'Generar reporte'}
        </button>
      </div>

      {estado && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-red-100 p-4 rounded-lg">
              <p className="text-sm text-gray-500">Pendiente</p>
              <p className="text-xl font-bold text-red-600">${estado.totalPendiente.toLocaleString('es-CO')}</p>
            </div>

            <div className="bg-green-100 p-4 rounded-lg">
              <p className="text-sm text-gray-500">Pagado</p>
              <p className="text-xl font-bold text-green-600">${estado.totalPagado.toLocaleString('es-CO')}</p>
            </div>
          </div>
          <div className="bg-slate-50 rounded-lg p-4">
            <h3 className="font-semibold mb-2">Tipo de pago</h3>
            <div className="grid md:grid-cols-3 gap-2 text-sm">
              {Object.entries(estado.porTipo).map(([tipo, info]) => (
                <div key={tipo} className="border bg-white rounded px-3 py-2">
                  <p className="font-medium">{tipo}</p>
                  <p>{info.cantidad} registros</p>
                  <p className="text-slate-600">${info.total.toLocaleString('es-CO')}</p>
                </div>
              ))}
            </div>
          </div>

          <button onClick={generarPDF} className="bg-gray-900 text-white px-4 py-2 rounded-lg">
            Descargar PDF 📄
          </button>

          <div>
            <h3 className="font-semibold mb-2">Movimientos del periodo</h3>
            <div className="space-y-2 max-h-72 overflow-auto">
              {estado.pagos.map((p) => (
                <div key={p.id} className="flex justify-between border p-2 rounded text-sm">
                  <span>{new Date(p.created_at).toLocaleDateString()} · {p.tipo_pago || '-'}</span>
                  <span className={p.estado === 'pendiente' ? 'text-red-600' : 'text-green-600'}>
                    ${Number(p.valor || 0).toLocaleString('es-CO')} ({p.estado})
                  </span>
                </div>
              ))}
              {estado.pagos.length === 0 && <p className="text-gray-500">Sin pagos para ese filtro.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}