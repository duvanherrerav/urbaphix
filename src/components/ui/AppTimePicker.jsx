import { useEffect, useMemo, useRef, useState } from 'react';

const TIME_OPTIONS = Array.from({ length: 48 }, (_, idx) => {
  const totalMinutes = idx * 30;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const period = hours >= 12 ? 'p. m.' : 'a. m.';
  const hour12 = ((hours + 11) % 12) + 1;
  return {
    value: `${hh}:${mm}`,
    label: `${String(hour12).padStart(2, '0')}:${mm === 0 ? '00' : mm} ${period}`
  };
});

const toLabel = (value, placeholder) => {
  if (!value) return placeholder;
  return TIME_OPTIONS.find((opt) => opt.value === value)?.label || value;
};

export default function AppTimePicker({
  value,
  onChange,
  placeholder = 'Selecciona hora',
  disabled = false,
  className = ''
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const selectedLabel = useMemo(() => toLabel(value, placeholder), [placeholder, value]);

  useEffect(() => {
    if (!open) return undefined;
    const onClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const handleSelect = (nextValue) => {
    onChange(nextValue);
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
        <span className={value ? 'text-app-text-primary' : 'text-app-text-secondary'}>{selectedLabel}</span>
        <span aria-hidden="true" className="text-base text-brand-secondary">🕒</span>
      </button>

      {open && !disabled && (
        <div className="app-time-dropdown app-scrollbar">
          {TIME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleSelect(opt.value)}
              className={`app-time-item ${value === opt.value ? 'app-time-selected' : ''}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
