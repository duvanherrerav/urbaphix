export const ESTADOS_RESERVA = Object.freeze([
    'solicitada',
    'aprobada',
    'rechazada',
    'cancelada',
    'en_curso',
    'finalizada',
    'no_show'
]);

const TRANSICIONES = Object.freeze({
    solicitada: Object.freeze(['aprobada', 'rechazada', 'cancelada']),
    aprobada: Object.freeze(['en_curso', 'cancelada']),
    en_curso: Object.freeze(['finalizada', 'no_show']),
    rechazada: Object.freeze([]),
    cancelada: Object.freeze([]),
    finalizada: Object.freeze([]),
    no_show: Object.freeze([])
});

const ROLES_POR_TRANSICION = Object.freeze({
    'solicitada->aprobada': Object.freeze(['admin']),
    'solicitada->rechazada': Object.freeze(['admin']),
    'solicitada->cancelada': Object.freeze(['admin', 'residente']),
    'aprobada->en_curso': Object.freeze(['admin', 'vigilancia']),
    'aprobada->cancelada': Object.freeze(['admin', 'residente']),
    'en_curso->finalizada': Object.freeze(['admin', 'vigilancia']),
    'en_curso->no_show': Object.freeze(['admin', 'vigilancia'])
});

export const esEstadoReservaValido = (estado) => ESTADOS_RESERVA.includes(estado);

export const puedeTransicionarReserva = ({
    estadoActual,
    estadoObjetivo,
    rolUsuario,
    esDueno = false
}) => {
    if (!esEstadoReservaValido(estadoActual) || !esEstadoReservaValido(estadoObjetivo)) {
        return { ok: false, error: 'Estado de reserva inválido' };
    }

    if (estadoActual === estadoObjetivo) {
        return { ok: false, error: 'La reserva ya está en ese estado' };
    }

    const permitidos = TRANSICIONES[estadoActual] || [];
    if (!permitidos.includes(estadoObjetivo)) {
        return { ok: false, error: `Transición no permitida: ${estadoActual} -> ${estadoObjetivo}` };
    }

    const llave = `${estadoActual}->${estadoObjetivo}`;
    const rolesPermitidos = ROLES_POR_TRANSICION[llave] || [];
    if (!rolesPermitidos.includes(rolUsuario)) {
        return { ok: false, error: `El rol ${rolUsuario || 'desconocido'} no puede ejecutar ${llave}` };
    }

    if (rolUsuario === 'residente' && !esDueno) {
        return { ok: false, error: 'Solo el residente dueño puede ejecutar esta acción' };
    }

    return { ok: true, error: null };
};