export const formatearMilesCOP = (value) => {
    const limpio = String(value ?? '').replace(/\D/g, '');
    if (!limpio) return '';
    return Number(limpio).toLocaleString('es-CO');
};

export const normalizarInputMoneda = (value) => String(value ?? '').replace(/\D/g, '');

const resolverApartamento = (reserva) => (
    reserva?.apartamentos
    || reserva?.residentes?.apartamentos
    || null
);

export const getReservaResidenteLabel = (reserva) => {
    const nombre = reserva?.residentes?.usuarios_app?.nombre?.trim();
    return nombre || 'Residente registrado';
};

export const getReservaTorreAptoLabel = (reserva) => {
    const apartamento = resolverApartamento(reserva);
    const torre = apartamento?.torres?.nombre;
    const apto = apartamento?.numero;

    if (!torre || !apto) return 'Torre y Apto: No disponible';
    return `Torre y Apto: ${String(torre).trim()}${String(apto).trim()}`;
};
