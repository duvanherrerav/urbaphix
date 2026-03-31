import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { supabase } from './services/supabaseClient';

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

function App() {

  const [user, setUser] = useState(null);
  const [usuarioApp, setUsuarioApp] = useState(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [errorPerfil, setErrorPerfil] = useState('');
  const [openMenu, setOpenMenu] = useState(false);
  const [modulo, setModulo] = useState('');
  const menuRef = useRef(null);

  const menuBtn = "w-full text-left p-2 rounded hover:bg-gray-700";
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
  const rolNoAutorizado = Boolean(usuarioApp) && !ROLES_VALIDOS.includes(usuarioApp?.rol_id);

  if (isBootstrapping) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-gray-600 text-sm">Cargando Urbaphix...</div>
      </div>
    );
  }

  // 🔐 LOGIN
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">

        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">

          <h1 className="text-2xl font-bold text-center mb-2">
            Urbaphix 🚀
          </h1>

          <p className="text-center text-gray-500 text-sm mb-6">
            Gestión inteligente para propiedad horizontal
          </p>

          <Login />

        </div>

      </div>
    );
  }

  // 🚀 APP
  return (
    <div className="flex min-h-screen bg-gray-100">

      {/* 🔥 SIDEBAR */}
      <div className="w-64 bg-gray-900 text-white p-4">

        <h1 className="text-xl font-bold mb-6">
          Urbaphix 🚀
        </h1>

        <nav className="space-y-2">

          {/* ADMIN */}
          {usuarioApp?.rol_id === 'admin' && (
            <>
              <button onClick={() => setModulo('dashboard')} className={menuBtn}>
                📊 Dashboard
              </button>

              <button onClick={() => setModulo('pagos')} className={menuBtn}>
                💰 Pagos
              </button>
            </>
          )}

          {/* VIGILANCIA */}
          {usuarioApp?.rol_id === 'vigilancia' && (
            <>
              <button onClick={() => setModulo('visitas')} className={menuBtn}>
                🚗 Control visitas
              </button>

              <button onClick={() => setModulo('paquetes')} className={menuBtn}>
                📦 Paquetería
              </button>
            </>
          )}

          {/* RESIDENTE */}
          {usuarioApp?.rol_id === 'residente' && (
            <>
              <button onClick={() => setModulo('visitas')} className={menuBtn}>
                ➕ Solicitar visita
              </button>

              <button onClick={() => setModulo('paquetes')} className={menuBtn}>
                📦 Mis paquetes
              </button>

              <button onClick={() => setModulo('pagos')} className={menuBtn}>
                💰 Mis pagos
              </button>
            </>
          )}

        </nav>

      </div>

      {/* 🔥 CONTENIDO */}
      <div className="flex-1">

        {/* HEADER */}
        <div className="bg-white shadow px-6 py-4 flex justify-between items-center">

          <h2 className="font-semibold text-lg capitalize">
            {moduloActual}
          </h2>

          {/* 👤 MENU */}
          <div className="relative" ref={menuRef}>

            <button
              onClick={() => setOpenMenu(!openMenu)}
              className="w-10 h-10 bg-gray-900 text-white rounded-full flex items-center justify-center font-bold"
            >
              {usuarioApp?.nombre?.[0]?.toUpperCase() || 'U'}
            </button>

            {openMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border">

                <div className="px-4 py-3 border-b">
                  <p className="text-sm font-semibold">
                    {usuarioApp?.nombre || 'Usuario'}
                  </p>
                  <p className="text-xs text-gray-500">
                    Urbaphix
                  </p>
                </div>

                <button className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm">
                  Perfil
                </button>

                <button className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm">
                  Configuración
                </button>

                <button
                  onClick={() => supabase.auth.signOut()}
                  className="w-full text-left px-4 py-2 hover:bg-red-100 text-sm text-red-600"
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
            <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
              {errorPerfil}
            </div>
          )}

          {rolNoAutorizado && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-700 px-4 py-3 text-sm">
              Tu rol actual no está autorizado para este panel. Contacta al administrador del conjunto.
            </div>
          )}

          <Suspense fallback={<div className="text-sm text-gray-500">Cargando módulo...</div>}>
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