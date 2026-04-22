export default function ReservaEmptyState({ title, description, actionLabel = null, onAction = null }) {
    return (
        <div className="border border-dashed border-app-border rounded-xl p-6 text-center bg-app-bg">
            <h4 className="font-semibold text-app-text-primary">{title}</h4>
            <p className="text-sm text-app-text-secondary mt-1">{description}</p>
            {actionLabel && onAction && (
                <button onClick={onAction} className="mt-3 text-sm px-3 py-1.5 rounded-lg border border-app-border bg-app-bg-alt hover:bg-app-bg">
                    {actionLabel}
                </button>
            )}
        </div>
    );
}