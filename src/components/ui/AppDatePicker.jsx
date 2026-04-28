export default function AppDatePicker({ value, onChange, min, max, className = '', ...props }) {
  return (
    <label className={`relative block ${className}`}>
      <input
        type="date"
        value={value || ''}
        min={min}
        max={max}
        onChange={(e) => onChange?.(e.target.value)}
        className="app-input app-date-picker pr-11"
        {...props}
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-brand-secondary" aria-hidden="true">
        📅
      </span>
    </label>
  );
}
