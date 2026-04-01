import { useEffect, useState } from 'react';
import { supabase } from '../../../services/supabaseClient';

const formatFechaBogota = (value) => {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' });
};

export default function PanelPagosAdmin({ usuarioApp }) {

    const [pagos, setPagos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filtroTorre, setFiltroTorre] = useState('');
    const [filtroEstado, setFiltroEstado] = useState('');
    const [busquedaApto, setBusquedaApto] = useState('');

    // 🔥 CARGAR PAGOS (SOLUCIÓN FINAL CON JOIN)
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
            .order('created_at', { ascending: false });

        if (error) {
            console.log('Error cargando pagos:', error);
            setLoading(false);
            return;
        }

        // 🔥 FORMATEAR DATOS
        const pagosFormateados = data.map(p => ({
            ...p,
            nombre: p.residentes?.usuarios_app?.nombre || 'Residente',
            apartamento: p.residentes?.apartamentos?.numero || '-',
            torre: p.residentes?.apartamentos?.torres?.nombre || '-'
        }));

        setPagos(pagosFormateados);
        setLoading(false);
    }

    useEffect(() => {
        if (usuarioApp?.conjunto_id) {
            const timer = setTimeout(() => {
                cargarPagos();
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [usuarioApp]);

    // 🔥 APROBAR PAGO
    const aprobarPago = async (pago) => {

        const { error } = await supabase
            .from('pagos')
            .update({
                estado: 'pagado',
                fecha_pago: new Date().toISOString()
            })
            .eq('id', pago.id);

        if (error) {
            console.log(error);
            alert('Error al aprobar pago');
            return;
        }

        // 🔔 NOTIFICACIÓN
        await supabase.from('notificaciones').insert([{
            usuario_id: pago.residentes?.usuario_id,
            tipo: 'pago_aprobado',
            titulo: 'Pago aprobado',
            mensaje: `Tu pago de ${pago.valor} fue aprobado`
        }]);

        alert('✅ Pago aprobado');

        cargarPagos();
    };
    const pagosFiltrados = pagos.filter(p => {

        const cumpleTorre = filtroTorre ? p.torre === filtroTorre : true;

        const cumpleEstado = filtroEstado ? p.estado === filtroEstado : true;

        const cumpleApto = busquedaApto
            ? p.apartamento?.toString().includes(busquedaApto)
            : true;

        return cumpleTorre && cumpleEstado && cumpleApto;
    });
    return (
        <div>

            <h2 className="text-2xl font-bold mb-4">
                Gestión de pagos 💰
            </h2>

            <div className="bg-white p-4 rounded-xl shadow flex flex-col md:flex-row gap-3 mb-4">

                {/* TORRE */}
                <select
                    value={filtroTorre}
                    onChange={e => setFiltroTorre(e.target.value)}
                    className="border rounded-lg px-3 py-2 w-full md:w-1/3"
                >
                    <option value="">Todas las torres</option>

                    {[...new Set(pagos.map(p => p.torre).filter(Boolean))].map((torre, i) => (
                        <option key={i} value={torre}>
                            Torre {torre}
                        </option>
                    ))}
                </select>

                {/* ESTADO */}
                <select
                    value={filtroEstado}
                    onChange={e => setFiltroEstado(e.target.value)}
                    className="border rounded-lg px-3 py-2 w-full md:w-1/3"
                >
                    <option value="">Todos los estados</option>
                    <option value="pendiente">Pendiente</option>
                    <option value="pagado">Pagado</option>
                </select>

                {/* BUSQUEDA APTO */}
                <input
                    type="text"
                    placeholder="Buscar apto (ej: 301)"
                    value={busquedaApto}
                    onChange={e => setBusquedaApto(e.target.value)}
                    className="border rounded-lg px-3 py-2 w-full md:w-1/3"
                />

            </div>

            <p className="text-sm text-gray-500 mb-2">
                Mostrando {pagosFiltrados.length} resultados
            </p>

            {/* 🔄 LOADING */}
            {loading && (
                <p className="text-gray-500">Cargando pagos...</p>
            )}

            {/* 📭 SIN DATOS */}
            {!loading && pagos.length === 0 && (
                <p>No hay pagos</p>
            )}

            {/* 📋 LISTADO */}
            <div className="space-y-4">

                {pagosFiltrados.map(p => (

                    <div
                        key={p.id}
                        className="bg-white p-5 rounded-2xl shadow hover:shadow-lg transition flex justify-between items-center"
                    >

                        {/* IZQUIERDA */}
                        <div>

                            {/* 🔥 TORRE + APTO (PRINCIPAL) */}
                            <p className="text-lg font-bold text-gray-800">
                                🏢 Torre {p.torre} • Apto {p.apartamento}
                            </p>

                            {/* 👤 NOMBRE */}
                            <p className="text-sm text-gray-500">
                                {p.nombre}
                            </p>

                            {/* 🧾 CONCEPTO */}
                            <p className="text-sm text-gray-400 mt-1">
                                {p.concepto}
                            </p>
                            <p className="text-xs text-gray-400">
                                Tipo: {p.tipo_pago || '-'}
                            </p>

                            {/* 📅 FECHA */}
                            <p className="text-xs text-gray-400">
                                {formatFechaBogota(p.created_at)}
                            </p>

                            {/* 📄 COMPROBANTE */}
                            {p.comprobante_url && (
                                <a
                                    href={p.comprobante_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-blue-500 text-xs mt-1 inline-block"
                                >
                                    Ver comprobante 📄
                                </a>
                            )}

                        </div>

                        {/* DERECHA */}
                        <div className="text-right">

                            {/* 💰 VALOR */}
                            <p className="text-xl font-bold text-gray-800">
                                ${p.valor?.toLocaleString()}
                            </p>

                            {/* 🔥 ESTADO */}
                            <span className={`text-xs px-3 py-1 rounded-full font-semibold ${p.estado === 'pendiente'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-green-100 text-green-700'
                                }`}>
                                {p.estado}
                            </span>

                            {/* ✅ BOTÓN */}
                            {p.estado === 'pendiente' && p.comprobante_url && (
                                <button
                                    onClick={() => aprobarPago(p)}
                                    className="mt-2 block bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1 rounded-lg"
                                >
                                    Aprobar
                                </button>
                            )}

                        </div>

                    </div>

                ))}

            </div>

        </div>
    );
}
