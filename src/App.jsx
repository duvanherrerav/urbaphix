import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { supabase } from './services/supabaseClient';
import isotipo from './assets/brand/isotipo-urbaphix.svg';
import imagotipo from './assets/brand/imagotipo-urbaphix.svg';

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
      <div className="app-shell flex items-center justify-center">
        <div className="app-card text-app-text-secondary text-sm">Cargando Urbaphix...</div>
      </div>
    );
  }

  // 🔐 LOGIN
  if (!user) {
    return (
      <div className="app-shell flex items-center justify-center p-6">

        <div className="app-card w-full max-w-md">

          <div className="mb-6 flex flex-col items-center gap-3">
            <img src={isotipo} alt="Isotipo Urbaphix" className="h-12 w-12" />
            <img src={imagotipo} alt="Urbaphix" className="h-9 w-auto" />
          </div>

          <h1 className="text-2xl font-bold text-center mb-2 text-app-text-primary">
            Bienvenido
          </h1>

          <p className="text-center text-app-text-secondary text-sm mb-6">
            Gestión inteligente para propiedad horizontal
          </p>

          <Login />

        </div>

      </div>
    );
  }

  // 🚀 APP
  return (
    <div className="app-shell flex">

      {/* 🔥 SIDEBAR */}
      <div className="app-sidebar w-72 p-4">

        <div className="mb-6 app-surface-primary p-4">
          <img src={imagotipo} alt="Imagotipo Urbaphix" className="h-8 w-auto" />
          <p className="mt-2 text-xs text-app-text-secondary">
            Plataforma SaaS para propiedad horizontal
          </p>
        </div>

        <nav className="space-y-2">

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

      </div>

      {/* 🔥 CONTENIDO */}
      <div className="flex-1">

        {/* HEADER */}
        <div className="app-header px-7 py-4 flex justify-between items-center relative z-50">

          <h2 className="font-semibold text-lg capitalize text-app-text-primary">
            {moduloActual}
          </h2>

          {/* 👤 MENU */}
          <div className="relative z-50 flex items-center gap-3" ref={menuRef}>

            <img src={isotipo} alt="Isotipo Urbaphix" className="h-8 w-8" />

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

        </div>

        {/* CONTENIDO DINÁMICO */}
        <div className="p-6 space-y-6">
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
                  <>
                    <CrearCobro usuarioApp={usuarioApp} />
                    <PanelPagosAdmin usuarioApp={usuarioApp} />
                    <EstadoCuenta usuarioApp={usuarioApp} />
                  </>
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
                  <>
                    <CrearPaquete usuarioApp={usuarioApp} />
                    <PanelPaquetes usuarioApp={usuarioApp} />
                  </>
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