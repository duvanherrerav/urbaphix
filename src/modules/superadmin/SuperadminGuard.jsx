import { useEffect, useState } from 'react';
import BrandLogo from '../../components/brand/BrandLogo';
import { resolvePlatformAccess } from '../../services/platformAccess';
import { supabase } from '../../services/supabaseClient';
import { getAuthErrorMessage } from '../../utils/errorMessages';
import SuperadminShell from './SuperadminShell';

function SuperadminLoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMsg('');
    setInfoMsg('');

    if (!email || !password) {
      setErrorMsg('Completa correo y contraseña.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setErrorMsg(getAuthErrorMessage(error.message));
      setLoading(false);
      return;
    }

    setInfoMsg('Sesión iniciada. Validando membership plataforma en /superadmin...');
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4 rounded-3xl border border-white/10 bg-white/[0.035] p-4 text-left shadow-[0_22px_70px_rgba(2,6,23,0.42),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl sm:p-6">
      <div className="min-h-0 space-y-3" aria-live="polite">
        {errorMsg && <div className="rounded-2xl border border-state-error/30 bg-state-error/10 px-4 py-3 text-sm text-state-error">{errorMsg}</div>}
        {infoMsg && <div className="rounded-2xl border border-state-info/30 bg-state-info/10 px-4 py-3 text-sm text-state-info">{infoMsg}</div>}
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-[0.16em] text-app-text-secondary" htmlFor="superadmin-email">Correo electrónico</label>
        <div className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3 transition-all focus-within:border-brand-secondary/60 focus-within:bg-slate-950/85 focus-within:ring-2 focus-within:ring-brand-secondary/15">
          <span className="text-base text-brand-secondary/80" aria-hidden="true">✉</span>
          <input
            id="superadmin-email"
            type="email"
            placeholder="operador@urbaphix.com"
            className="border-0 bg-transparent p-0 text-sm shadow-none focus:ring-0"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-[0.16em] text-app-text-secondary" htmlFor="superadmin-password">Contraseña</label>
        <div className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3 transition-all focus-within:border-brand-secondary/60 focus-within:bg-slate-950/85 focus-within:ring-2 focus-within:ring-brand-secondary/15">
          <span className="text-base text-brand-secondary/80" aria-hidden="true">●</span>
          <input
            id="superadmin-password"
            type="password"
            placeholder="••••••••"
            className="border-0 bg-transparent p-0 text-sm shadow-none focus:ring-0"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="group relative inline-flex w-full items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-r from-brand-primary via-blue-500/95 to-brand-secondary px-4 py-3.5 text-sm font-bold text-white shadow-[0_14px_36px_rgba(37,99,235,0.24)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(14,165,233,0.24)] focus:outline-none focus:ring-2 focus:ring-brand-secondary/50 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
      >
        <span className="absolute inset-0 translate-x-[-120%] bg-gradient-to-r from-transparent via-white/16 to-transparent transition-transform duration-700 group-hover:translate-x-[120%]" />
        <span className="relative">{loading ? 'Validando...' : 'Iniciar sesión plataforma'}</span>
      </button>
    </form>
  );
}

function GuardState({ title, message, tone = 'info', showSignOut = false, showLogin = false }) {
  const badgeClass = tone === 'error' ? 'app-badge-error' : tone === 'warning' ? 'app-badge-warning' : 'app-badge-info';

  return (
    <div className="app-shell flex min-h-screen items-center justify-center p-6">
      <div className="app-surface-primary flex w-full max-w-md flex-col items-center gap-4 px-8 py-7 text-center shadow-app">
        <BrandLogo variant="loading" decorative />
        <p className={`rounded-xl px-4 py-2 text-sm ${badgeClass}`}>{title}</p>
        <p className="text-sm leading-6 text-app-text-secondary">{message}</p>
        {showLogin && <SuperadminLoginForm />}
        {showSignOut && (
          <button type="button" onClick={() => supabase.auth.signOut()} className="app-btn app-btn-secondary">
            Cerrar sesión
          </button>
        )}
      </div>
    </div>
  );
}

function SuperadminGuard({ user, isBootstrapping }) {
  const [access, setAccess] = useState({ status: 'loading', allowed: false, membership: null, error: null });

  useEffect(() => {
    let isMounted = true;

    const validateAccess = async () => {
      if (isBootstrapping) return;

      if (!user) {
        setAccess({ status: 'unauthenticated', allowed: false, membership: null, error: null });
        return;
      }

      setAccess({ status: 'loading', allowed: false, membership: null, error: null });
      const result = await resolvePlatformAccess(user);

      if (isMounted) {
        setAccess(result);
      }
    };

    validateAccess();

    return () => {
      isMounted = false;
    };
  }, [isBootstrapping, user]);

  if (isBootstrapping || access.status === 'loading') {
    return <GuardState title="Validando acceso" message="Estamos comprobando tu sesión y membership plataforma." />;
  }

  if (access.status === 'unauthenticated') {
    return <GuardState title="Sesión requerida" message="Inicia sesión con una cuenta de plataforma. Conservaremos esta ruta para volver a validar /superadmin cuando la sesión esté activa." tone="warning" showLogin />;
  }

  if (access.status === 'error') {
    return <GuardState title="Error de validación" message="No fue posible validar tu membership plataforma. Intenta de nuevo o contacta soporte interno." tone="error" showSignOut />;
  }

  if (!access.allowed) {
    return <GuardState title="Acceso denegado" message="Tu sesión no tiene una membership plataforma activa con rol superadmin o platform_ops." tone="warning" showSignOut />;
  }

  return <SuperadminShell user={user} platformMembership={access.membership} />;
}

export default SuperadminGuard;
