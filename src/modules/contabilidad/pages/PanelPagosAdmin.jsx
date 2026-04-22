import { useEffect, useState } from 'react';
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

    const [pagos, setPagos] = useState([]);
    const [loading, setLoading] = useState(false);
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
}