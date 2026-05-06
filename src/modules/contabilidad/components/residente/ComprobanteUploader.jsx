import { useEffect, useId, useRef, useState } from 'react';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png'];
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

const STATUS_COPY = {
  idle: 'Selecciona un PDF, JPG o PNG de hasta 10 MB.',
  selected: 'Archivo listo para enviar a revisión.',
  uploading: 'Subiendo comprobante de forma segura...',
  success: 'Comprobante enviado. Quedará en revisión administrativa.',
  error: 'No fue posible subir el comprobante. Inténtalo nuevamente.',
};

function getExtension(fileName = '') {
  return fileName.split('.').pop()?.toLowerCase() || '';
}

function formatFileSize(bytes = 0) {
  if (!bytes) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);

  return `${value >= 10 || exponent === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[exponent]}`;
}

function getFileIcon(extension) {
  if (extension === 'pdf') return '📄';
  if (['jpg', 'jpeg', 'png'].includes(extension)) return '🖼️';
  return '📎';
}

function createEmptyFileEvent() {
  return { target: { files: [] } };
}

export default function ComprobanteUploader({ tieneComprobante, onArchivoChange, onSubirComprobante }) {
  const generatedInputId = useId();
  const inputRef = useRef(null);
  const successTimerRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [status, setStatus] = useState('idle');
  const [feedback, setFeedback] = useState('');

  const selectedExtension = selectedFile ? getExtension(selectedFile.name) : '';
  const inputId = `comprobante-uploader-${generatedInputId}`;
  const isUploading = status === 'uploading';
  const canUpload = Boolean(selectedFile) && !isUploading;

  const resetSuccessTimer = () => {
    if (successTimerRef.current) window.clearTimeout(successTimerRef.current);
  };

  useEffect(() => () => resetSuccessTimer(), []);

  const clearSelectedFile = () => {
    setSelectedFile(null);
    onArchivoChange?.(createEmptyFileEvent());
    if (inputRef.current) inputRef.current.value = '';
  };

  const showValidationError = (message) => {
    resetSuccessTimer();
    setStatus('error');
    setFeedback(message);
    clearSelectedFile();
  };

  const validateFile = (file) => {
    const extension = getExtension(file?.name);
    const hasValidExtension = ALLOWED_EXTENSIONS.includes(extension);
    const hasValidMimeType = !file?.type || ALLOWED_MIME_TYPES.includes(file.type);

    if (!file) return 'Selecciona un archivo para continuar.';
    if (!hasValidExtension || !hasValidMimeType) return 'Formato no permitido. Usa PDF, JPG, JPEG o PNG.';
    if (file.size > MAX_FILE_SIZE) return 'El archivo supera el límite de 10 MB.';

    return '';
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    const validationError = validateFile(file);

    if (validationError) {
      showValidationError(validationError);
      return;
    }

    resetSuccessTimer();
    setSelectedFile(file);
    setStatus('selected');
    setFeedback('');
    onArchivoChange?.(event);
  };

  const handleUpload = async () => {
    if (!selectedFile || isUploading) return;

    setStatus('uploading');
    setFeedback('');

    try {
      const uploadSucceeded = await onSubirComprobante?.();

      if (!uploadSucceeded) {
        setStatus('error');
        setFeedback(STATUS_COPY.error);
        return;
      }

      setStatus('success');
      setFeedback('');
      clearSelectedFile();
      resetSuccessTimer();
      successTimerRef.current = window.setTimeout(() => setStatus('idle'), 2800);
    } catch {
      setStatus('error');
      setFeedback(STATUS_COPY.error);
    }
  };

  return (
    <div className="rounded-xl border border-app-border/70 bg-app-bg-alt/60 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <label
          htmlFor={inputId}
          className="group flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-brand-primary/30 bg-app-bg/65 px-3 py-2 transition-all hover:border-brand-secondary/80 hover:bg-[#38BDF812] focus-within:border-brand-secondary/80 focus-within:ring-2 focus-within:ring-brand-secondary/20"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-primary/10 text-base" aria-hidden="true">
            {selectedFile ? getFileIcon(selectedExtension) : '☁️'}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold text-app-text-primary">
              {selectedFile ? selectedFile.name : tieneComprobante ? 'Seleccionar nuevo comprobante' : 'Seleccionar comprobante'}
            </span>
            <span className="mt-0.5 block truncate text-[11px] text-app-text-secondary">
              {selectedFile
                ? `${selectedExtension.toUpperCase()} — ${formatFileSize(selectedFile.size)}`
                : tieneComprobante
                  ? 'El archivo actual será reemplazado al subir uno nuevo.'
                  : 'PDF, JPG, JPEG o PNG · máx. 10 MB'}
            </span>
          </span>
          <span className="shrink-0 rounded-full bg-brand-primary/10 px-2.5 py-1 text-[11px] font-bold text-brand-secondary transition-colors group-hover:bg-brand-secondary/15">
            Buscar
          </span>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            onChange={handleFileChange}
            className="sr-only"
            disabled={isUploading}
          />
        </label>

        <button
          type="button"
          onClick={handleUpload}
          disabled={!canUpload}
          className="app-btn-secondary min-h-10 px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-55"
        >
          <span className="inline-flex items-center justify-center gap-2">
            {isUploading && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />}
            <span>{isUploading ? 'Subiendo...' : tieneComprobante ? 'Reemplazar comprobante' : 'Subir comprobante'}</span>
          </span>
        </button>
      </div>

      <div className="mt-2 flex min-h-5 items-center gap-2 text-[11px] leading-snug" role={status === 'error' ? 'alert' : 'status'} aria-live="polite">
        <span aria-hidden="true">{status === 'success' ? '✅' : status === 'error' ? '⚠️' : status === 'uploading' ? '⏳' : '•'}</span>
        <p className={`${status === 'error' ? 'text-state-error' : status === 'success' ? 'text-state-success' : 'text-app-text-secondary'} truncate sm:whitespace-normal`}>
          {feedback || STATUS_COPY[status]}
        </p>
      </div>
    </div>
  );
}
