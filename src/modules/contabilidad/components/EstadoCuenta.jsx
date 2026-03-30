import { useEffect, useState } from 'react';
import { supabase } from '../../../services/supabaseClient';
import jsPDF from 'jspdf';

export default function EstadoCuenta({ usuarioApp }) {

  const [torres, setTorres] = useState([]);
  const [apartamentos, setApartamentos] = useState([]);
  const [torreSeleccionada, setTorreSeleccionada] = useState('');
  const [apartamentoSeleccionado, setApartamentoSeleccionado] = useState('');
  const [estado, setEstado] = useState(null);

  // 🔥 CARGAR TORRES
  useEffect(() => {
    if (usuarioApp?.conjunto_id) {
      obtenerTorres();
    }
  }, [usuarioApp]);

  const obtenerTorres = async () => {
    const { data } = await supabase
      .from('torres')
      .select('id, nombre')
      .eq('conjunto_id', usuarioApp.conjunto_id);

    setTorres(data || []);
  };

  const obtenerApartamentos = async (torreId) => {
    const { data } = await supabase
      .from('apartamentos')
      .select('id, numero')
      .eq('torre_id', torreId);

    setApartamentos(data || []);
  };

  const handleTorre = (id) => {
    setTorreSeleccionada(id);
    setApartamentoSeleccionado('');
    setEstado(null);
    obtenerApartamentos(id);
  };

  // 🔥 GENERAR ESTADO
  const generarEstado = async () => {

    if (!apartamentoSeleccionado) {
      alert('Selecciona un apartamento');
      return;
    }

    const { data, error } = await supabase
      .from('pagos')
      .select(`
        valor,
        estado,
        created_at,
        residentes (
          id,
          usuario_id,
          apartamentos (
            numero,
            torres!fk_apartamento_torre (
              nombre
            )
          ),
          usuarios_app (
            nombre
          )
        )
      `)
      .eq('conjunto_id', usuarioApp.conjunto_id)
      .eq('residentes.apartamentos.id', apartamentoSeleccionado);

    if (error) {
      console.log(error);
      alert('Error generando estado');
      return;
    }

    if (!data || data.length === 0) {
      alert('No hay información para este apartamento');
      return;
    }

    let totalPendiente = 0;
    let totalPagado = 0;

    data.forEach(p => {
      if (p.estado === 'pendiente') {
        totalPendiente += p.valor;
      } else {
        totalPagado += p.valor;
      }
    });

    const info = data[0]?.residentes;

    setEstado({
      nombre: info?.usuarios_app?.nombre || 'Residente',
      apartamento: info?.apartamentos?.numero || '-',
      torre: info?.apartamentos?.torres?.nombre || '-',
      totalPendiente,
      totalPagado,
      pagos: data
    });
  };

  // 🔥 GENERAR PDF
  const generarPDF = () => {

    if (!estado) return;

    const doc = new jsPDF();
    let y = 10;

    doc.setFontSize(16);
    doc.text('Estado de Cuenta - Urbaphix', 10, y);

    y += 10;

    doc.setFontSize(12);
    doc.text(`Torre: ${estado.torre}`, 10, y);
    y += 6;

    doc.text(`Apartamento: ${estado.apartamento}`, 10, y);
    y += 6;

    doc.text(`Residente: ${estado.nombre}`, 10, y);
    y += 10;

    doc.text(`Total Pendiente: $${estado.totalPendiente.toLocaleString()}`, 10, y);
    y += 6;

    doc.text(`Total Pagado: $${estado.totalPagado.toLocaleString()}`, 10, y);
    y += 10;

    doc.text('Movimientos:', 10, y);
    y += 6;

    estado.pagos.forEach((p) => {

      const fecha = new Date(p.created_at).toLocaleDateString();

      doc.text(
        `${fecha} - $${p.valor.toLocaleString()} (${p.estado})`,
        10,
        y
      );

      y += 6;

      if (y > 270) {
        doc.addPage();
        y = 10;
      }

    });

    doc.save(`estado_cuenta_apto_${estado.apartamento}.pdf`);
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow">

      <h2 className="text-xl font-bold mb-4">
        📄 Estado de cuenta
      </h2>

      {/* SELECTORES */}
      <div className="grid md:grid-cols-3 gap-3 mb-4">

        <select
          value={torreSeleccionada}
          onChange={e => handleTorre(e.target.value)}
          className="border rounded-lg px-3 py-2"
        >
          <option value="">Selecciona torre</option>
          {torres.map(t => (
            <option key={t.id} value={t.id}>
              {t.nombre}
            </option>
          ))}
        </select>

        <select
          value={apartamentoSeleccionado}
          onChange={e => setApartamentoSeleccionado(e.target.value)}
          className="border rounded-lg px-3 py-2"
        >
          <option value="">Selecciona apartamento</option>
          {apartamentos.map(a => (
            <option key={a.id} value={a.id}>
              Apto {a.numero}
            </option>
          ))}
        </select>

        <button
          onClick={generarEstado}
          className="bg-blue-600 text-white rounded-lg px-4 py-2"
        >
          Generar
        </button>

      </div>

      {/* RESULTADO */}
      {estado && (

        <div className="space-y-4">

          {/* HEADER */}
          <div className="bg-gray-100 p-4 rounded-lg">
            <p className="font-bold">
              🏢 Torre {estado.torre} • Apto {estado.apartamento}
            </p>
            <p className="text-sm text-gray-500">
              {estado.nombre}
            </p>
          </div>

          {/* RESUMEN */}
          <div className="grid grid-cols-2 gap-4">

            <div className="bg-red-100 p-4 rounded-lg">
              <p className="text-sm text-gray-500">Pendiente</p>
              <p className="text-xl font-bold text-red-600">
                ${estado.totalPendiente.toLocaleString()}
              </p>
            </div>

            <div className="bg-green-100 p-4 rounded-lg">
              <p className="text-sm text-gray-500">Pagado</p>
              <p className="text-xl font-bold text-green-600">
                ${estado.totalPagado.toLocaleString()}
              </p>
            </div>

          </div>

          {/* BOTÓN PDF */}
          <button
            onClick={generarPDF}
            className="bg-gray-900 text-white px-4 py-2 rounded-lg"
          >
            Descargar PDF 📄
          </button>

          {/* DETALLE */}
          <div>

            <h3 className="font-semibold mb-2">
              Movimientos
            </h3>

            <div className="space-y-2">

              {estado.pagos.map((p, i) => (
                <div
                  key={i}
                  className="flex justify-between border p-2 rounded"
                >
                  <span className="text-sm">
                    {new Date(p.created_at).toLocaleDateString()}
                  </span>

                  <span className={
                    p.estado === 'pendiente'
                      ? 'text-red-600'
                      : 'text-green-600'
                  }>
                    ${p.valor.toLocaleString()}
                  </span>
                </div>
              ))}

            </div>

          </div>

        </div>

      )}

    </div>
  );
}