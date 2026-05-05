import { QRCodeCanvas } from 'qrcode.react';

export default function QRShareCard({ qrValue, manualCode, onShare, onCopy, onDownload, visitanteNombre, fechaVisita, qrWrapRef }) {
  return (
    <div
      ref={qrWrapRef}
      className="rounded-2xl border border-brand-primary/45 bg-gradient-to-br from-[#0B1A2B] via-app-bg to-[#10253f] p-5 shadow-[0_18px_40px_rgba(37,99,235,0.22)] space-y-4"
      tabIndex={-1}
    >
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-secondary">Resultado de la visita</p>
        <h3 className="text-xl font-bold">Código de ingreso 🔐</h3>
        <p className="text-sm text-app-text-secondary">Comparte este código con tu visitante para presentarlo en portería.</p>
      </div>

      {manualCode && (
        <div className="rounded-2xl border border-brand-secondary/40 bg-[#38BDF814] p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-secondary">Código manual</p>
          <p className="mt-1 font-mono text-3xl font-bold tracking-[0.18em] text-app-text-primary">{manualCode}</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-[auto_minmax(0,1fr)] md:items-center">
        <div className="mx-auto rounded-2xl bg-white p-3 shadow-lg md:mx-0">
          <QRCodeCanvas value={qrValue} size={196} />
        </div>
        <div className="space-y-3">
          <div className="text-sm text-app-text-secondary space-y-1">
            {visitanteNombre && <p><b className="text-app-text-primary">Visitante:</b> {visitanteNombre}</p>}
            {fechaVisita && <p><b className="text-app-text-primary">Fecha:</b> {fechaVisita}</p>}
          </div>
          <div className="grid gap-2 sm:grid-cols-3 md:grid-cols-1 lg:grid-cols-3 xl:grid-cols-1">
            <button className="w-full app-btn-secondary" onClick={onShare}>Compartir</button>
            <button className="w-full app-btn-secondary" onClick={onCopy}>Copiar código</button>
            <button className="w-full btn-primary" onClick={onDownload}>Descargar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
