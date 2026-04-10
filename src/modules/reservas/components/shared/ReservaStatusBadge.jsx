const STATUS_STYLES = {
    solicitada: 'bg-amber-100 text-amber-800 border-amber-200',
    aprobada: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    rechazada: 'bg-rose-100 text-rose-800 border-rose-200',
    cancelada: 'bg-slate-100 text-slate-700 border-slate-200',
    en_curso: 'bg-blue-100 text-blue-800 border-blue-200',
    finalizada: 'bg-violet-100 text-violet-800 border-violet-200',
    no_show: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200'
};

const STATUS_LABELS = {
    solicitada: 'Solicitada',
    aprobada: 'Aprobada',
    rechazada: 'Rechazada',
    cancelada: 'Cancelada',
    en_curso: 'En curso',
    finalizada: 'Finalizada',
    no_show: 'No show'
};

const getReservaStatusLabel = (estado) => STATUS_LABELS[estado] || estado || 'Sin estado';

export default function ReservaStatusBadge({ estado, className = '' }) {
    const styles = STATUS_STYLES[estado] || 'bg-gray-100 text-gray-700 border-gray-200';

    return (
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border ${styles} ${className}`}>
            {getReservaStatusLabel(estado)}
        </span>
    );
}