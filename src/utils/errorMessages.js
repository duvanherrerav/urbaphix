const TECHNICAL_ERROR_PATTERNS = [
  /supabase/i,
  /postgres/i,
  /postgrest/i,
  /schema/i,
  /column/i,
  /relation/i,
  /constraint/i,
  /duplicate key/i,
  /violates/i,
  /JWT/i,
  /RLS/i,
  /policy/i,
  /permission denied/i,
  /failed to fetch/i,
  /networkerror/i,
  /timeout/i
];

export const GENERIC_LOAD_ERROR = 'No fue posible cargar la información. Intenta nuevamente. Si el problema continúa, contacta al administrador.';
export const GENERIC_SAVE_ERROR = 'No fue posible guardar la información. Intenta nuevamente. Si el problema continúa, contacta al administrador.';

export const getErrorMessage = (error, fallback = GENERIC_LOAD_ERROR) => {
  const message = typeof error === 'string' ? error : error?.message;
  if (!message) return fallback;
  if (TECHNICAL_ERROR_PATTERNS.some((pattern) => pattern.test(message))) return fallback;
  return message;
};

export const getAuthErrorMessage = (message) => {
  const text = String(message || '').toLowerCase();
  if (text.includes('invalid login') || text.includes('invalid credentials')) return 'Correo o contraseña incorrectos.';
  if (text.includes('email not confirmed')) return 'Debes confirmar tu correo antes de ingresar.';
  if (text.includes('password')) return 'La contraseña no cumple los requisitos mínimos.';
  if (text.includes('rate limit') || text.includes('too many')) return 'Demasiados intentos. Intenta nuevamente en unos minutos.';
  return 'No fue posible completar la autenticación. Intenta nuevamente.';
};
