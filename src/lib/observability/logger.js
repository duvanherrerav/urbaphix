const SENSITIVE_KEY_PATTERN = /(token|session|password|secret|authorization|auth|cookie|jwt|email|telefono|phone|placa|document|comprobante|signed|url|payload|headers)/i;

const ENVIRONMENT = import.meta.env.MODE || (import.meta.env.PROD ? 'production' : 'development');

const truncate = (value, max = 140) => {
  const text = String(value ?? '');
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
};

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isErrorLike = (value) => {
  if (!value || typeof value !== 'object') return false;
  if (value instanceof Error) return true;

  const hasName = typeof value.name === 'string' && value.name.length > 0;
  const hasMessage = typeof value.message === 'string' && value.message.length > 0;
  const hasCode = typeof value.code === 'string' || typeof value.code === 'number';
  const hasStatus = typeof value.status === 'number' || typeof value.statusCode === 'number';

  return hasName || hasMessage || hasCode || hasStatus;
};

const sanitizePrimitive = (key, value) => {
  if (typeof value === 'string' && SENSITIVE_KEY_PATTERN.test(key)) return '[redacted]';
  if (typeof value === 'string') return truncate(value);
  if (typeof value === 'number' || typeof value === 'boolean' || value == null) return value;
  return `[${typeof value}]`;
};

export const normalizeError = (error) => {
  if (!error) return { type: 'UnknownError', message: 'Unknown error', code: null, status: null };
  if (typeof error === 'string') return { type: 'Error', message: truncate(error), code: null, status: null };

  const normalized = {
    type: error.name || 'Error',
    message: truncate(error.message || 'Unexpected error'),
    code: error.code ?? null,
    status: error.status ?? error.statusCode ?? null
  };

  if (import.meta.env.DEV && typeof error.stack === 'string') {
    normalized.stack = truncate(error.stack, 500);
  }

  return normalized;
};

export const sanitizeContext = (context = {}) => {
  if (!context || typeof context !== 'object') return {};

  return Object.fromEntries(
    Object.entries(context)
      .slice(0, 20)
      .map(([key, value]) => {
        if (SENSITIVE_KEY_PATTERN.test(key)) return [key, '[redacted]'];
        if (isErrorLike(value)) return [key, normalizeError(value)];
        if (Array.isArray(value)) return [key, `[array:${value.length}]`];
        if (value && typeof value === 'object') return [key, '[object]'];
        return [key, sanitizePrimitive(key, value)];
      })
  );
};

const resolveContextAndError = (arg2, arg3) => {
  let context = {};
  let error;

  if (isErrorLike(arg2)) {
    error = arg2;
    if (isPlainObject(arg3) && !isErrorLike(arg3)) context = arg3;
    else if (isErrorLike(arg3) && !error) error = arg3;
    return { context, error };
  }

  if (isPlainObject(arg2)) context = arg2;

  if (isErrorLike(arg3)) error = arg3;
  else if (isPlainObject(arg3) && !Object.keys(context).length) context = arg3;

  return { context, error };
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

export const logWarn = (message, arg2 = {}, arg3) => {
  const { context, error } = resolveContextAndError(arg2, arg3);
  const event = createEvent({ severity: 'warn', message, context, error });
  emit('warn', event);
  return event;
};

export const logError = (message, arg2, arg3) => {
  const { context, error } = resolveContextAndError(arg2, arg3);
  const event = createEvent({ severity: 'error', message, context, error });
  emit('error', event);
  return event;
};

export const logger = {
  info: (message, metadata) => logInfo(message, metadata),
  warn: (message, arg2, arg3) => logWarn(message, arg2, arg3),
  error: (message, arg2, arg3) => logError(message, arg2, arg3)
};

export { isErrorLike };
