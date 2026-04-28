import { getReservaEstadoLabel } from '../../utils/reservaFormatters';

const STATUS_STYLES = {
    solicitada: 'app-badge-warning',
    aprobada: 'app-badge-success',
    rechazada: 'app-badge-error',
    cancelada: 'app-badge-info',
    en_curso: 'app-badge-info',
    finalizada: 'app-badge-success',
    no_show: 'app-badge-warning'
};

export default function ReservaStatusBadge({ estado, className = '' }) {
    const styles = STATUS_STYLES[estado] || 'app-badge-info';
    const isNoShow = estado === 'no_show';

    return (
        <span
            title={isNoShow ? 'El residente no realizó check-in dentro del tiempo permitido' : undefined}
            className={`${styles} ${className}`}
        >
            {getReservaEstadoLabel(estado)}
        </span>
    );
}