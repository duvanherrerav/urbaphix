export default function ReservaEmptyState({ title, description, actionLabel = null, onAction = null }) {
    return (
        <div className="border border-dashed border-slate-300 rounded-xl p-6 text-center bg-slate-50">
            <h4 className="font-semibold text-slate-900">{title}</h4>
            <p className="text-sm text-slate-600 mt-1">{description}</p>
            {actionLabel && onAction && (
                <button onClick={onAction} className="mt-3 text-sm px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100">
                    {actionLabel}
                </button>
            )}
        </div>
    );
}
