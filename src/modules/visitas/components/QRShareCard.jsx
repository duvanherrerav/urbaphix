import { QRCodeCanvas } from 'qrcode.react';

export default function QRShareCard({ qrValue, manualCode, onShare, onCopy, onDownload, visitanteNombre, fechaVisita, qrWrapRef }) {
  return (
    <div
      ref={qrWrapRef}
      className="rounded-2xl border border-brand-primary/40 bg-gradient-to-br from-[#0B1A2B] via-app-bg to-[#10253f] p-4 md:p-4 shadow-[0_14px_34px_rgba(37,99,235,0.2)] space-y-3"
      tabIndex={-1}
    >
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-secondary">Resultado listo</p>
        <h3 className="text-lg md:text-xl font-bold leading-tight">Código de ingreso</h3>
        <p className="text-sm text-app-text-secondary">Compártelo con tu visitante para presentarlo en portería.</p>
      </div>

      {manualCode && (
        <div className="rounded-xl border border-brand-secondary/45 bg-[#38BDF814] px-3 py-3 text-center shadow-[inset_0_0_0_1px_rgba(56,189,248,0.15)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-secondary">Código manual</p>
          <p className="mt-1.5 font-mono text-[2rem] md:text-[2.2rem] font-extrabold tracking-[0.26em] text-app-text-primary">{manualCode}</p>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-[auto_minmax(0,1fr)] md:items-center">
        <div className="mx-auto rounded-xl bg-white p-2.5 shadow-lg ring-1 ring-slate-200/80 md:mx-0">
          <QRCodeCanvas value={qrValue} size={184} />
        </div>
        <div className="space-y-2.5">
          <div className="text-sm text-app-text-secondary space-y-1">
            {visitanteNombre && <p><b className="text-app-text-primary">Visitante:</b> {visitanteNombre}</p>}
            {fechaVisita && <p><b className="text-app-text-primary">Fecha:</b> {fechaVisita}</p>}
          </div>
          <div className="grid gap-2 sm:grid-cols-3 md:grid-cols-1 lg:grid-cols-3">
            <button className="w-full app-btn-secondary" onClick={onShare}>Compartir</button>
            <button className="w-full app-btn-secondary" onClick={onCopy}>Copiar código</button>
            <button className="w-full btn-primary" onClick={onDownload}>Descargar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
