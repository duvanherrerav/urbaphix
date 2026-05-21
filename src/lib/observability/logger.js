const SENSITIVE_KEY_PATTERN = /(token|session|password|secret|authorization|auth|cookie|jwt|email|telefono|phone|placa|document|comprobante|signed|url|payload|headers)/i;

const ENVIRONMENT = import.meta.env.MODE || (import.meta.env.PROD ? 'production' : 'development');

const truncate = (value, max = 140) => {
  const text = String(value ?? '');
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
};

const sanitizePrimitive = (key, value) => {
  if (typeof value === 'string' && SENSITIVE_KEY_PATTERN.test(key)) return '[redacted]';
  if (typeof value === 'string') return truncate(value);
  if (typeof value === 'number' || typeof value === 'boolean' || value == null) return value;
  return `[${typeof value}]`;
};

export const sanitizeContext = (context = {}) => {
  if (!context || typeof context !== 'object') return {};

  return Object.fromEntries(
    Object.entries(context)
      .slice(0, 20)
      .map(([key, value]) => {
        if (SENSITIVE_KEY_PATTERN.test(key)) return [key, '[redacted]'];
        if (value instanceof Error) return [key, normalizeError(value)];
        if (Array.isArray(value)) return [key, `[array:${value.length}]`];
        if (value && typeof value === 'object') return [key, '[object]'];
        return [key, sanitizePrimitive(key, value)];
      })
  );
};

export const normalizeError = (error) => {
  if (!error) return { type: 'UnknownError', message: 'Unknown error' };
  if (typeof error === 'string') return { type: 'Error', message: truncate(error) };

  return {
    type: error.name || 'Error',
    message: truncate(error.message || 'Unexpected error'),
    code: error.code || null,
    status: error.status || error.statusCode || null
  };
};

const createEvent = ({ severity, message, error, context = {} }) => ({
  module: context.module || 'app',
  action: context.action || 'unknown',
  severity,
  timestamp: new Date().toISOString(),
  environment: ENVIRONMENT,
  message: truncate(message || 'No message'),
  error: error ? normalizeError(error) : undefined,
  context: sanitizeContext(context)
});

const emit = (method, event) => {
  const fn = console[method] || console.log;
  fn('[urbaphix-observability]', event);
};

export const logInfo = (message, context = {}) => {
  const event = createEvent({ severity: 'info', message, context });
  if (import.meta.env.DEV) emit('info', event);
  return event;
};

export const logWarn = (message, context = {}, error) => {
  const event = createEvent({ severity: 'warn', message, context, error });
  emit('warn', event);
  return event;
};

export const logError = (message, error, context = {}) => {
  const event = createEvent({ severity: 'error', message, context, error });
  emit('error', event);
  return event;
};

export const logger = {
  info: (message, metadata) => logInfo(message, metadata),
  warn: (message, metadata) => logWarn(message, metadata),
  error: (message, errorOrMetadata, metadata = {}) => {
    if (errorOrMetadata instanceof Error) return logError(message, errorOrMetadata, metadata);
    return logError(message, null, errorOrMetadata || {});
  }
};
