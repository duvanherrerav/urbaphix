export default function ReservaErrorBanner({ message, onRetry = null }) {
    if (!message) return null;

    return (
        <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm text-rose-800 flex items-start justify-between gap-3">
            <p>{message}</p>
            {onRetry && (
                <button onClick={onRetry} className="text-xs font-semibold underline whitespace-nowrap">
                    Reintentar
                </button>
            )}
        </div>
    );
}