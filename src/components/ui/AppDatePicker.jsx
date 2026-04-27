import { useEffect, useMemo, useRef, useState } from 'react';

const DATE_VALUE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const parseDateValue = (value) => {
  if (!DATE_VALUE_REGEX.test(value || '')) return null;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const toDateValue = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toDisplayDate = (value, placeholder) => {
  const parsed = parseDateValue(value);
  if (!parsed) return placeholder;
  return parsed.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

const isSameDay = (a, b) => (
  a.getFullYear() === b.getFullYear()
  && a.getMonth() === b.getMonth()
  && a.getDate() === b.getDate()
);

const getMonthLabel = (date) => date.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });

const getCalendarCells = (viewDate) => {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const firstWeekday = (firstDay.getDay() + 6) % 7;
  const startDate = new Date(year, month, 1 - firstWeekday);

  return Array.from({ length: 42 }, (_, idx) => {
    const current = new Date(startDate);
    current.setDate(startDate.getDate() + idx);
    return current;
  });
};

export default function AppDatePicker({
  value,
  onChange,
  minDate = null,
  placeholder = 'Selecciona fecha',
  disabled = false,
  className = ''
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const selectedDate = useMemo(() => parseDateValue(value), [value]);
  const minDateParsed = useMemo(() => parseDateValue(minDate), [minDate]);
  const [viewDate, setViewDate] = useState(selectedDate || new Date());

  useEffect(() => {
    if (selectedDate) setViewDate(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    if (!open) return undefined;
    const onOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  const cells = useMemo(() => getCalendarCells(viewDate), [viewDate]);

  const handleSelect = (date) => {
    const asValue = toDateValue(date);
    if (minDateParsed && asValue < toDateValue(minDateParsed)) return;
    onChange(asValue);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className="app-input flex items-center justify-between gap-2 text-left"
      >
        <span className={value ? 'text-app-text-primary' : 'text-app-text-secondary'}>{toDisplayDate(value, placeholder)}</span>
        <span aria-hidden="true" className="text-base text-brand-secondary">📅</span>
      </button>

      {open && !disabled && (
        <div className="app-date-dropdown">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" className="app-date-nav-btn" onClick={() => setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}>‹</button>
            <p className="text-sm font-medium capitalize text-app-text-primary">{getMonthLabel(viewDate)}</p>
            <button type="button" className="app-date-nav-btn" onClick={() => setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}>›</button>
          </div>

          <div className="mb-1 grid grid-cols-7 text-center text-[11px] uppercase tracking-wide text-app-text-secondary">
            {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'].map((day) => <span key={day}>{day}</span>)}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell) => {
              const cellValue = toDateValue(cell);
              const isOutsideMonth = cell.getMonth() !== viewDate.getMonth();
              const isDisabled = minDateParsed ? cellValue < toDateValue(minDateParsed) : false;
              const isSelected = selectedDate ? isSameDay(cell, selectedDate) : false;
              return (
                <button
                  key={cellValue}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => handleSelect(cell)}
                  className={`app-date-day ${isOutsideMonth ? 'app-date-day-outside' : ''} ${isSelected ? 'app-date-day-selected' : ''}`}
                >
                  {cell.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
