const SENSITIVE_KEY_PATTERN = /(token|session|password|secret|authorization|auth|cookie|key|payload|headers)/i;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const maskValue = (key, value) => {
  if (SENSITIVE_KEY_PATTERN.test(key)) return '[redacted]';
  if (typeof value === 'string' && UUID_PATTERN.test(value)) return '[uuid]';
  return value;
};

const sanitizeError = (error) => ({
  name: error?.name,
  code: error?.code,
  status: error?.status,
  message: error?.message
});

const sanitizeMetadata = (metadata) => {
  if (metadata instanceof Error) return sanitizeError(metadata);
  if (!metadata || typeof metadata !== 'object') return metadata;
  if (Array.isArray(metadata)) return '[array]';

  return Object.fromEntries(
    Object.entries(metadata)
      .slice(0, 12)
      .map(([key, value]) => [key, value instanceof Error ? sanitizeError(value) : maskValue(key, value)])
  );
};

const logDev = (method, message, metadata) => {
  if (!import.meta.env.DEV) return;
  if (typeof metadata === 'undefined') {
    console[method](message);
    return;
  }
  console[method](message, sanitizeMetadata(metadata));
};

export const logger = {
  info: (message, metadata) => logDev('info', message, metadata),
  warn: (message, metadata) => logDev('warn', message, metadata),
  error: (message, metadata) => logDev('error', message, metadata)
};
