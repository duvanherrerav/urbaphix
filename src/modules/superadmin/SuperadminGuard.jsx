import { useEffect, useState } from 'react';
import BrandLogo from '../../components/brand/BrandLogo';
import { resolvePlatformAccess } from '../../services/platformAccess';
import { supabase } from '../../services/supabaseClient';
import SuperadminShell from './SuperadminShell';

function GuardState({ title, message, tone = 'info', showSignOut = false }) {
  const badgeClass = tone === 'error' ? 'app-badge-error' : tone === 'warning' ? 'app-badge-warning' : 'app-badge-info';

  return (
    <div className="app-shell flex min-h-screen items-center justify-center p-6">
      <div className="app-surface-primary flex max-w-md flex-col items-center gap-4 px-8 py-7 text-center shadow-app">
        <BrandLogo variant="loading" decorative />
        <p className={`rounded-xl px-4 py-2 text-sm ${badgeClass}`}>{title}</p>
        <p className="text-sm leading-6 text-app-text-secondary">{message}</p>
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
    return <GuardState title="Sesión requerida" message="Inicia sesión con una cuenta de plataforma para acceder a /superadmin." tone="warning" />;
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
