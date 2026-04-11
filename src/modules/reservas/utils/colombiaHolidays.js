const pad2 = (n) => String(n).padStart(2, '0');
const ymd = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const addDays = (date, days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
};

const toNextMonday = (date) => {
    const day = date.getDay();
    if (day === 1) return date;
    const delta = day === 0 ? 1 : (8 - day);
    return addDays(date, delta);
};

// Algoritmo de Meeus/Jones/Butcher para domingo de Pascua (calendario gregoriano)
const getEasterSunday = (year) => {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=marzo, 4=abril
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
};

export const getColombiaHolidaySet = (year) => {
    const set = new Set();

    const addFixed = (month, day) => {
        set.add(ymd(new Date(year, month - 1, day)));
    };

    const addEmiliani = (month, day) => {
        set.add(ymd(toNextMonday(new Date(year, month - 1, day))));
    };

    // Fijos
    addFixed(1, 1); // Año nuevo
    addFixed(5, 1); // Trabajo
    addFixed(7, 20); // Independencia
    addFixed(8, 7); // Batalla de Boyacá
    addFixed(12, 8); // Inmaculada
    addFixed(12, 25); // Navidad

    // Emiliani
    addEmiliani(1, 6); // Reyes
    addEmiliani(3, 19); // San José
    addEmiliani(6, 29); // San Pedro y San Pablo
    addEmiliani(8, 15); // Asunción
    addEmiliani(10, 12); // Día de la raza
    addEmiliani(11, 1); // Todos los santos
    addEmiliani(11, 11); // Independencia Cartagena

    // Pascua y derivados
    const easter = getEasterSunday(year);

    // No Emiliani
    set.add(ymd(addDays(easter, -3))); // Jueves santo
    set.add(ymd(addDays(easter, -2))); // Viernes santo

    // Emiliani respecto a Pascua
    set.add(ymd(toNextMonday(addDays(easter, 43)))); // Ascensión
    set.add(ymd(toNextMonday(addDays(easter, 64)))); // Corpus Christi
    set.add(ymd(toNextMonday(addDays(easter, 71)))); // Sagrado Corazón

    return set;
};

export const isColombiaHoliday = (dateString) => {
    if (!dateString || typeof dateString !== 'string') return false;
    const [yearStr, monthStr, dayStr] = dateString.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;

    const holidaySet = getColombiaHolidaySet(year);
    return holidaySet.has(`${yearStr}-${monthStr}-${dayStr}`);
};