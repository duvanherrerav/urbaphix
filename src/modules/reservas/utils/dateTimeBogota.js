const BOGOTA_TZ = 'America/Bogota';

const NAIVE_TS_REGEX = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/;

const toBogotaDate = (value) => {
    if (!value) return null;
    if (value instanceof Date) return value;

    if (typeof value === 'string') {
        const match = value.match(NAIVE_TS_REGEX);
        if (match) {
            const [, y, m, d, hh, mm, ss = '00'] = match;
            return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh) + 5, Number(mm), Number(ss)));
        }
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
};

export const formatDateTimeBogota = (value) => {
    const date = toBogotaDate(value);
    if (!date) return 'Sin fecha';

    return new Intl.DateTimeFormat('es-CO', {
        timeZone: BOGOTA_TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(date);
};

export const formatDateRangeBogota = (inicio, fin) => `${formatDateTimeBogota(inicio)} → ${formatDateTimeBogota(fin)}`;

export const getTodayBogotaDate = () => {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: BOGOTA_TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(new Date());

    const byType = Object.fromEntries(parts.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
    return `${byType.year}-${byType.month}-${byType.day}`;
};

export const getNowBogotaTimeHHMM = () => {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: BOGOTA_TZ,
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
    }).formatToParts(new Date());

    const byType = Object.fromEntries(parts.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
    return `${byType.hour}:${byType.minute}`;
};
