const STATUS_STYLES = {
    solicitada: 'app-badge-warning',
    aprobada: 'app-badge-success',
    rechazada: 'app-badge-error',
    cancelada: 'app-badge-info',
    en_curso: 'app-badge-info',
    finalizada: 'app-badge-success',
    no_show: 'app-badge-warning'
};

const STATUS_LABELS = {
    solicitada: 'Solicitada',
    aprobada: 'Aprobada',
    rechazada: 'Rechazada',
    cancelada: 'Cancelada',
    en_curso: 'En curso',
    finalizada: 'Finalizada',
    no_show: 'No asistió'
};

const getReservaStatusLabel = (estado) => STATUS_LABELS[estado] || estado || 'Sin estado';

export default function ReservaStatusBadge({ estado, className = '' }) {
    const styles = STATUS_STYLES[estado] || 'app-badge-info';
    const isNoShow = estado === 'no_show';

    return (
        <span
            title={isNoShow ? 'El residente no realizó check-in dentro del tiempo permitido' : undefined}
            className={`${styles} ${className}`}
        >
            {getReservaStatusLabel(estado)}
        </span>
    );
}