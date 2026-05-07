import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { supabase } from './services/supabaseClient';
import BrandLogo from './components/brand/BrandLogo';

import Login from './modules/auth/Login';
import { pedirPermiso } from './utils/push';
import { migrarStoragePorteria } from './modules/visitas/services/porteriaService';

const MisPagos = lazy(() => import('./modules/contabilidad/pages/MisPagos'));
const CrearCobro = lazy(() => import('./modules/contabilidad/pages/CrearCobro'));
const CrearVisita = lazy(() => import('./modules/visitas/pages/CrearVisita'));
const PanelVigilancia = lazy(() => import('./modules/visitas/pages/PanelVigilancia'));
const NotificacionesVisitas = lazy(() => import('./modules/visitas/components/NotificacionesVisitas'));
const DashboardAdmin = lazy(() => import('./modules/admin/pages/DashboardAdmin'));
const CrearPaquete = lazy(() => import('./modules/paqueteria/pages/CrearPaquete'));
const MisPaquetes = lazy(() => import('./modules/paqueteria/pages/MisPaquetes'));
const PanelPaquetes = lazy(() => import('./modules/paqueteria/pages/PanelPaquetes'));
const NotificacionesPaquetes = lazy(() => import('./modules/paqueteria/components/NotificacionesPaquetes'));
const PanelPagosAdmin = lazy(() => import('./modules/contabilidad/pages/PanelPagosAdmin'));
const NotificacionesPagos = lazy(() => import('./modules/contabilidad/components/NotificacionesPagos'));
const EstadoCuenta = lazy(() => import('./modules/contabilidad/components/EstadoCuenta'));
const ListaIncidentes = lazy(() => import('./modules/seguridad/pages/ListaIncidentes'));
const ReportarIncidente = lazy(() => import('./modules/seguridad/pages/ReportarIncidente'));
const ReservarZona = lazy(() => import('./modules/reservas/pages/ReservarZona'));
const PanelReservasAdmin = lazy(() => import('./modules/reservas/pages/PanelReservasAdmin'));
const PanelReservasVigilancia = lazy(() => import('./modules/reservas/pages/PanelReservasVigilancia'));

function App() {

  const [user, setUser] = useState(null);
  const [usuarioApp, setUsuarioApp] = useState(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [errorPerfil, setErrorPerfil] = useState('');
  const [openMenu, setOpenMenu] = useState(false);
  const [modulo, setModulo] = useState('');
  const [pagosTab, setPagosTab] = useState('bandejas');
  const menuRef = useRef(null);

  const menuBtnClass = (target) => `app-sidebar-item ${moduloActual === target ? 'app-sidebar-item-active' : ''}`;
  const ROLES_VALIDOS = ['admin', 'vigilancia', 'residente'];

  // 🔔 permisos
  useEffect(() => {
    pedirPermiso();
  }, []);

  // 🔥 sesión
  useEffect(() => {

    let isMounted = true;

    const withTimeout = (promise, timeoutMs = 8000) => {
      return Promise.race([
        promise,
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('timeout')), timeoutMs);
        })
      ]);
    };

    const obtenerUsuario = async (userId) => {
      const { data, error } = await supabase
        .from('usuarios_app')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        if (isMounted) {
          setErrorPerfil('No pudimos cargar tu perfil. Intenta cerrar sesión y volver a ingresar.');
          setUsuarioApp(null);
        }
        return;
      }

      if (isMounted) {
        setErrorPerfil('');
        setUsuarioApp(data);
      }
    };

    const obtenerSesion = async () => {
      try {
        const { data, error } = await withTimeout(supabase.auth.getUser());
        if (error) {
          throw error;
        }

        if (!isMounted) return;
        setUser(data.user);

        if (data.user) {
          migrarStoragePorteria();
          await obtenerUsuario(data.user.id);
        }
      } catch {
        if (isMounted) {
          setErrorPerfil('No pudimos verificar tu sesión. Revisa tu conexión e intenta nuevamente.');
          setUser(null);
          setUsuarioApp(null);
        }
      } finally {
        if (isMounted) {
          setIsBootstrapping(false);
        }
      }

    };

    obtenerSesion();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const user = session?.user || null;
        if (!isMounted) return;

        setUser(user);

        if (user) {
          migrarStoragePorteria();
          obtenerUsuario(user.id);
        } else {
          setErrorPerfil('');
          setUsuarioApp(null);
        }
      }
    );

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };

  }, []);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!openMenu) return;
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenu(false);
      }
    };

    const onEscape = (event) => {
      if (event.key === 'Escape') {
        setOpenMenu(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onEscape);

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, [openMenu]);

  const moduloPorRol = {
    admin: 'dashboard',
    vigilancia: 'visitas',
    residente: 'visitas'
  };

  const moduloActual = modulo || moduloPorRol[usuarioApp?.rol_id] || '';
  const seleccionarModulo = (siguienteModulo) => {
    setModulo(siguienteModulo);
  };
  const rolNoAutorizado = Boolean(usuarioApp) && !ROLES_VALIDOS.includes(usuarioApp?.rol_id);

  useEffect(() => {
    setOpenMenu(false);
    setModulo('');
  }, [user?.id]);

  useEffect(() => {
    setModulo('');
  }, [usuarioApp?.rol_id]);

  if (isBootstrapping) {
    return (
      <div className="app-shell flex items-center justify-center p-6">
        <div className="app-surface-primary flex min-w-[220px] flex-col items-center gap-4 px-8 py-7 text-center shadow-app">
          <BrandLogo variant="loading" decorative />
          <div className="space-y-3">
            <p className="text-sm font-medium text-app-text-secondary">
              Cargando Urbaphix...
            </p>
            <div className="mx-auto h-1 w-24 overflow-hidden rounded-full bg-app-bg-alt">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-brand-secondary" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 🔐 LOGIN
  if (!user) {
    const loginFeatures = ['Control de visitas', 'Reservas', 'Pagos', 'Comunicados', 'Seguridad'];

    return (
      <div className="app-shell relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.20),_transparent_32%),linear-gradient(135deg,_#020617_0%,_#0f172a_48%,_#020617_100%)] px-4 py-8 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-40 [background-image:linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] [background-size:44px_44px]" />
        <div className="pointer-events-none absolute -left-24 top-16 -z-10 h-72 w-72 rounded-full bg-brand-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 right-0 -z-10 h-80 w-80 rounded-full bg-brand-secondary/10 blur-3xl" />

        <main className="grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/70 shadow-[0_28px_90px_rgba(2,6,23,0.65)] backdrop-blur-xl lg:grid-cols-[1.08fr_0.92fr]">
          <section className="relative hidden min-h-[640px] overflow-hidden border-r border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-[#071827] p-10 lg:flex lg:flex-col lg:justify-between">
            <div className="absolute right-10 top-12 h-36 w-36 rounded-full border border-brand-secondary/20" />
            <div className="absolute -right-20 bottom-20 h-64 w-64 rounded-full border border-brand-primary/20" />
            <div className="absolute inset-x-10 bottom-32 h-px bg-gradient-to-r from-transparent via-brand-secondary/40 to-transparent" />

            <div className="relative z-10">
              <div className="mb-10 inline-flex rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 shadow-app">
                <BrandLogo variant="banner" className="h-auto w-56" alt="Banner Urbaphix" />
              </div>

              <p className="mb-5 inline-flex rounded-full border border-brand-secondary/25 bg-brand-secondary/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-brand-secondary">
                SaaS para propiedad horizontal
              </p>

              <h1 className="max-w-xl text-4xl font-bold leading-tight tracking-[-0.04em] text-app-text-primary xl:text-5xl">
                Administra tu conjunto con control, seguridad y trazabilidad.
              </h1>

              <p className="mt-5 max-w-lg text-base leading-7 text-app-text-secondary">
                Gestión inteligente para administradores, residentes y vigilancia en una experiencia centralizada, moderna y confiable.
              </p>
            </div>

            <div className="relative z-10 grid gap-4 sm:grid-cols-2">
              {[
                ['99.9%', 'Disponibilidad visual para operación diaria'],
                ['3 roles', 'Administración, residentes y vigilancia'],
                ['24/7', 'Entrada segura a la plataforma'],
                ['360°', 'Gestión de comunidad conectada']
              ].map(([metric, label]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-2xl font-bold text-app-text-primary">{metric}</p>
                  <p className="mt-1 text-xs leading-5 text-app-text-secondary">{label}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="relative flex flex-col justify-center p-5 sm:p-8 lg:p-10">
            <div className="mx-auto w-full max-w-md">
              <div className="mb-7 flex justify-center lg:hidden">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 shadow-app">
                  <BrandLogo variant="banner" className="h-auto w-64 max-w-full" alt="Banner Urbaphix" />
                </div>
              </div>

              <div className="mb-7 text-center lg:text-left">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-brand-secondary">
                  Acceso seguro
                </p>
                <h2 className="text-3xl font-bold tracking-[-0.03em] text-app-text-primary">
                  Bienvenido a Urbaphix
                </h2>
                <p className="mt-3 text-sm leading-6 text-app-text-secondary">
                  Acceso para administradores, residentes y vigilancia de tu conjunto residencial.
                </p>
              </div>

              <Login />

              <div className="mt-7 flex flex-wrap justify-center gap-2 lg:justify-start" aria-label="Capacidades de Urbaphix">
                {loginFeatures.map((feature) => (
                  <span key={feature} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-app-text-secondary">
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          </section>
        </main>
      </div>
    );
  }

  // 🚀 APP
  return (
    <div className="app-shell flex flex-col lg:flex-row">

      {/* 🔥 SIDEBAR */}
      <aside className="app-sidebar w-full shrink-0 p-3 lg:min-h-screen lg:w-72 lg:p-4">

        <div className="mb-3 app-surface-primary px-3 py-2.5 lg:mb-4">
          <BrandLogo variant="sidebar" className="max-w-full" alt="Urbaphix" />
        </div>

        <nav className="flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-2 lg:overflow-visible lg:pb-0">

          {/* ADMIN */}
          {usuarioApp?.rol_id === 'admin' && (
            <>
              <button type="button" onClick={() => seleccionarModulo('dashboard')} className={menuBtnClass('dashboard')}>
                📊 Dashboard
              </button>

              <button type="button" onClick={() => seleccionarModulo('pagos')} className={menuBtnClass('pagos')}>
                💰 Pagos
              </button>

              <button type="button" onClick={() => seleccionarModulo('incidentes')} className={menuBtnClass('incidentes')}>
                🚨 Incidentes
              </button>

              <button type="button" onClick={() => seleccionarModulo('reservas')} className={menuBtnClass('reservas')}>
                🏟️ Reservas
              </button>
            </>
          )}

          {/* VIGILANCIA */}
          {usuarioApp?.rol_id === 'vigilancia' && (
            <>
              <button type="button" onClick={() => seleccionarModulo('visitas')} className={menuBtnClass('visitas')}>
                🚗 Control visitas
              </button>

              <button type="button" onClick={() => seleccionarModulo('paquetes')} className={menuBtnClass('paquetes')}>
                📦 Paquetería
              </button>

              <button type="button" onClick={() => seleccionarModulo('incidentes')} className={menuBtnClass('incidentes')}>
                🚨 Reportar incidente
              </button>

              <button type="button" onClick={() => seleccionarModulo('reservas')} className={menuBtnClass('reservas')}>
                🏟️ Reservas
              </button>
            </>
          )}

          {/* RESIDENTE */}
          {usuarioApp?.rol_id === 'residente' && (
            <>
              <button type="button" onClick={() => seleccionarModulo('visitas')} className={menuBtnClass('visitas')}>
                ➕ Solicitar visita
              </button>

              <button type="button" onClick={() => seleccionarModulo('paquetes')} className={menuBtnClass('paquetes')}>
                📦 Mis paquetes
              </button>

              <button type="button" onClick={() => seleccionarModulo('pagos')} className={menuBtnClass('pagos')}>
                💰 Mis pagos
              </button>

              <button type="button" onClick={() => seleccionarModulo('reservas')} className={menuBtnClass('reservas')}>
                🏟️ Reservas
              </button>
            </>
          )}

        </nav>

      </aside>

      {/* 🔥 CONTENIDO */}
      <div className="min-w-0 flex-1">

        {/* HEADER */}
        <header className="app-header px-4 py-3 sm:px-7 sm:py-4 flex justify-between items-center gap-4 relative z-50">

          <div className="flex min-w-0 items-center gap-3">
            <BrandLogo variant="isotipo" className="h-7 w-7 shrink-0 opacity-85" decorative />
            <h2 className="truncate font-semibold text-lg capitalize text-app-text-primary">
              {moduloActual}
            </h2>
          </div>

          {/* 👤 MENU */}
          <div className="relative z-50 flex items-center gap-3" ref={menuRef}>

            <BrandLogo variant="header" className="hidden max-w-[112px] sm:flex" alt="Urbaphix" />

            <button
              onClick={() => setOpenMenu(!openMenu)}
              className="w-10 h-10 rounded-full border border-app-border bg-app-bg text-app-text-primary flex items-center justify-center font-bold"
            >
              {usuarioApp?.nombre?.[0]?.toUpperCase() || 'U'}
            </button>

            {openMenu && (
              <div className="absolute right-0 top-10 mt-2 w-56 rounded-xl border border-app-border bg-app-bg-alt shadow-app z-[70]">

                <div className="px-4 py-3 border-b border-app-border">
                  <p className="text-sm font-semibold text-app-text-primary">
                    {usuarioApp?.nombre || 'Usuario'}
                  </p>
                  <p className="text-xs text-app-text-secondary">
                    Urbaphix
                  </p>
                </div>

                <button className="w-full text-left px-4 py-2 hover:bg-app-bg text-sm text-app-text-secondary hover:text-app-text-primary">
                  Perfil
                </button>

                <button className="w-full text-left px-4 py-2 hover:bg-app-bg text-sm text-app-text-secondary hover:text-app-text-primary">
                  Configuración
                </button>

                <button
                  onClick={() => supabase.auth.signOut()}
                  className="w-full text-left px-4 py-2 hover:bg-[#EF444426] text-sm text-state-error"
                >
                  Cerrar sesión
                </button>

              </div>
            )}

          </div>

        </header>

        {/* CONTENIDO DINÁMICO */}
        <div className="space-y-6 p-4 sm:p-6">
          {errorPerfil && (
            <div className="app-badge-error w-full rounded-xl px-4 py-3 text-sm">
              {errorPerfil}
            </div>
          )}

          {rolNoAutorizado && (
            <div className="app-badge-warning w-full rounded-xl px-4 py-3 text-sm">
              Tu rol actual no está autorizado para este panel. Contacta al administrador del conjunto.
            </div>
          )}

          <Suspense fallback={<div className="app-badge-info">Cargando módulo...</div>}>
            {/* ADMIN */}
            {usuarioApp?.rol_id === 'admin' && (
              <>
                {moduloActual === 'dashboard' && (
                  <DashboardAdmin usuarioApp={usuarioApp} />
                )}

                {moduloActual === 'pagos' && (
                  <div className="space-y-4">
                    <CrearCobro usuarioApp={usuarioApp} />

                    <div className="app-surface-muted p-2 flex flex-wrap gap-2">
                      {[
                        { key: 'bandejas', label: 'Bandejas' },
                        { key: 'estado', label: 'Estado de cuenta' },
                        { key: 'analitica', label: 'Analítica' }
                      ].map((tab) => (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => setPagosTab(tab.key)}
                          className={`app-btn text-xs ${pagosTab === tab.key ? 'app-btn-secondary' : 'app-btn-ghost'}`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {pagosTab === 'bandejas' && <PanelPagosAdmin usuarioApp={usuarioApp} vistaInicial="bandejas" />}
                    {pagosTab === 'estado' && <EstadoCuenta usuarioApp={usuarioApp} />}
                    {pagosTab === 'analitica' && <PanelPagosAdmin usuarioApp={usuarioApp} vistaInicial="analitica" />}
                  </div>
                )}

                {moduloActual === 'incidentes' && (
                  <ListaIncidentes usuarioApp={usuarioApp} />
                )}

                {moduloActual === 'reservas' && (
                  <PanelReservasAdmin usuarioApp={usuarioApp} />
                )}
              </>
            )}

            {/* VIGILANCIA */}
            {usuarioApp?.rol_id === 'vigilancia' && (
              <>
                {moduloActual === 'visitas' && (
                  <>
                    <PanelVigilancia usuarioApp={usuarioApp} />
                  </>
                )}

                {moduloActual === 'paquetes' && (
                  <section className="space-y-3">
                    <p className="text-xs text-app-text-secondary uppercase tracking-wide">Operación de portería</p>
                    <div className="grid xl:grid-cols-[minmax(0,1fr)_320px] gap-3 items-start">
                      <PanelPaquetes usuarioApp={usuarioApp} />
                      <div className="xl:sticky xl:top-4 xl:pt-1">
                        <CrearPaquete usuarioApp={usuarioApp} />
                      </div>
                    </div>
                  </section>
                )}

                {moduloActual === 'incidentes' && (
                  <ReportarIncidente user={usuarioApp} />
                )}

                {moduloActual === 'reservas' && (
                  <PanelReservasVigilancia usuarioApp={usuarioApp} />
                )}
              </>
            )}

            {/* RESIDENTE */}
            {usuarioApp?.rol_id === 'residente' && (
              <>
                {moduloActual === 'visitas' && (
                  <CrearVisita usuarioApp={usuarioApp} />
                )}

                {moduloActual === 'paquetes' && (
                  <MisPaquetes usuarioApp={usuarioApp} />
                )}

                {moduloActual === 'pagos' && (
                  <MisPagos usuarioApp={usuarioApp} />
                )}

                {moduloActual === 'reservas' && (
                  <ReservarZona usuarioApp={usuarioApp} />
                )}
              </>
            )}
          </Suspense>

        </div>

      </div>

      {/* 🔔 NOTIFICACIONES */}
      {usuarioApp && (
        <Suspense fallback={null}>
          <>
            <NotificacionesVisitas usuarioApp={usuarioApp} />
            <NotificacionesPaquetes usuarioApp={usuarioApp} />
            <NotificacionesPagos usuarioApp={usuarioApp} />
          </>
        </Suspense>
      )}

    </div>
  );
}

export default App;
