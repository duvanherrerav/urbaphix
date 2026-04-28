import { useEffect, useMemo, useRef, useState } from 'react';

const MESES_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS_CORTOS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];

const parseYmdToDate = (ymd) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ymd || ''))) return null;
  const [year, month, day] = ymd.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
};

const formatYmd = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatVisual = (ymd) => {
  const date = parseYmdToDate(ymd);
  if (!date) return '';
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
};

const toMonthStart = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

const getCalendarCells = (monthDate) => {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = (firstOfMonth.getDay() + 6) % 7; // semana inicia lunes
  const cells = [];

  for (let i = 0; i < offset; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(new Date(year, month, day));
  while (cells.length % 7 !== 0) cells.push(null);

  return cells;
};

export default function AppDatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = 'dd/mm/aaaa',
  className = '',
  disabled = false,
  ...props
}) {
  const wrapperRef = useRef(null);
  const selectedDate = parseYmdToDate(value);
  const minDate = parseYmdToDate(min);
  const maxDate = parseYmdToDate(max);
  const initialMonth = selectedDate || minDate || new Date();
  const [open, setOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(toMonthStart(initialMonth));

  useEffect(() => {
    if (selectedDate) setCurrentMonth(toMonthStart(selectedDate));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const cells = useMemo(() => getCalendarCells(currentMonth), [currentMonth]);
  const monthLabel = `${MESES_ES[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;

  const isOutOfBounds = (date) => {
    if (!date) return true;
    if (minDate && formatYmd(date) < formatYmd(minDate)) return true;
    if (maxDate && formatYmd(date) > formatYmd(maxDate)) return true;
    return false;
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className="app-input flex items-center justify-between gap-3 text-left disabled:opacity-60 disabled:cursor-not-allowed"
        {...props}
      >
        <span className={value ? 'text-app-text-primary' : 'text-app-text-secondary'}>
          {value ? formatVisual(value) : placeholder}
        </span>
        <span className="text-brand-secondary" aria-hidden="true">📅</span>
      </button>

      {open && (
        <div className="absolute z-[70] mt-2 w-full min-w-[280px] rounded-xl border border-app-border bg-app-bg-alt p-3 shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <button type="button" className="app-btn-ghost !px-2 !py-1 text-xs" onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}>
              ←
            </button>
            <p className="text-sm font-semibold">{monthLabel}</p>
            <button type="button" className="app-btn-ghost !px-2 !py-1 text-xs" onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}>
              →
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-app-text-secondary mb-1">
            {DIAS_CORTOS.map((dia) => <span key={dia}>{dia}</span>)}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((date, idx) => {
              if (!date) return <div key={`empty-${idx}`} className="h-8" />;
              const ymd = formatYmd(date);
              const selected = ymd === value;
              const disabledDate = isOutOfBounds(date);
              return (
                <button
                  key={ymd}
                  type="button"
                  disabled={disabledDate}
                  onClick={() => {
                    onChange?.(ymd);
                    setOpen(false);
                  }}
                  className={`h-8 rounded-lg text-xs transition-colors ${
                    selected
                      ? 'bg-brand-primary text-white'
                      : disabledDate
                        ? 'text-app-text-secondary/40 cursor-not-allowed'
                        : 'text-app-text-primary hover:bg-app-bg'
                  }`}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
