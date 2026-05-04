import { QRCodeCanvas } from 'qrcode.react';

export default function QRShareCard({ qrValue, onShare, onCopy, onDownload, visitanteNombre, fechaVisita, qrWrapRef }) {
  return (
    <div ref={qrWrapRef} className="app-surface-muted p-4 space-y-3" tabIndex={-1}>
      <h3 className="font-semibold">Código para ingreso en portería 🔐</h3>
      <p className="text-xs text-app-text-secondary">Comparte este código con tu visitante para presentarlo en portería.</p>
      <div className="text-xs text-app-text-secondary space-y-1">
        {visitanteNombre && <p><b>Visitante:</b> {visitanteNombre}</p>}
        {fechaVisita && <p><b>Fecha:</b> {fechaVisita}</p>}
      </div>
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <QRCodeCanvas value={qrValue} size={180} />
        <div className="space-y-2 w-full md:w-auto">
          <button className="w-full app-btn-secondary" onClick={onShare}>Compartir</button>
          <button className="w-full app-btn-secondary" onClick={onCopy}>Copiar código</button>
          <button className="w-full btn-primary" onClick={onDownload}>Descargar</button>
        </div>
      </div>
    </div>
  );
}
