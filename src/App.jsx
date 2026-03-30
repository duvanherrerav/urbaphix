import { useEffect, useState } from 'react';
import { supabase } from './services/supabaseClient';

import EscanearQR from './modules/visitas/pages/EscanearQR';
import Login from './modules/auth/Login';
import MisPagos from './modules/contabilidad/pages/MisPagos';
import CrearCobro from './modules/contabilidad/pages/CrearCobro';
import CrearVisita from './modules/visitas/pages/CrearVisita';
import PanelVigilancia from './modules/visitas/pages/PanelVigilancia';
import NotificacionesVisitas from './modules/visitas/components/NotificacionesVisitas';
import DashboardAdmin from './modules/admin/pages/DashboardAdmin';
import CrearPaquete from './modules/paqueteria/pages/CrearPaquete';
import MisPaquetes from './modules/paqueteria/pages/MisPaquetes';
import PanelPaquetes from './modules/paqueteria/pages/PanelPaquetes';
import NotificacionesPaquetes from './modules/paqueteria/components/NotificacionesPaquetes';
import PanelPagosAdmin from './modules/contabilidad/pages/PanelPagosAdmin';
import NotificacionesPagos from './modules/contabilidad/components/NotificacionesPagos';

import { pedirPermiso } from './utils/push';
import EstadoCuenta from './modules/contabilidad/components/EstadoCuenta';

function App() {

  const [user, setUser] = useState(null);
  const [usuarioApp, setUsuarioApp] = useState(null);
  const [openMenu, setOpenMenu] = useState(false);
  const [modulo, setModulo] = useState('');

  const menuBtn = "w-full text-left p-2 rounded hover:bg-gray-700";

  // 🔔 permisos
  useEffect(() => {
    pedirPermiso();
  }, []);

  // 🔥 sesión
  useEffect(() => {

    const obtenerUsuario = async (userId) => {
      const { data } = await supabase
        .from('usuarios_app')
        .select('*')
        .eq('id', userId)
        .single();

      setUsuarioApp(data);
    };

    const obtenerSesion = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);

      if (data.user) {
        obtenerUsuario(data.user.id);
      }
    };

    obtenerSesion();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const user = session?.user || null;
        setUser(user);

        if (user) {
          obtenerUsuario(user.id);
        } else {
          setUsuarioApp(null);
        }
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };

  }, []);

  // 🔥 DEFINIR MÓDULO INICIAL SEGÚN ROL
  useEffect(() => {
    if (!usuarioApp || modulo) return;

    if (usuarioApp.rol_id === 'admin') {
      setModulo('dashboard');
    }

    if (usuarioApp.rol_id === 'vigilancia') {
      setModulo('visitas');
    }

    if (usuarioApp.rol_id === 'residente') {
      setModulo('visitas');
    }

  }, [usuarioApp]);

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
            {modulo}
          </h2>

          {/* 👤 MENU */}
          <div className="relative">

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

          {/* ADMIN */}
          {usuarioApp?.rol_id === 'admin' && (
            <>
              {modulo === 'dashboard' && (
                <DashboardAdmin usuarioApp={usuarioApp} />
              )}

              {modulo === 'pagos' && (
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
              {modulo === 'visitas' && (
                <>
                  <PanelVigilancia usuarioApp={usuarioApp} />
                  <EscanearQR usuarioApp={usuarioApp} />
                </>
              )}

              {modulo === 'paquetes' && (
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
              {modulo === 'visitas' && (
                <CrearVisita usuarioApp={usuarioApp} />
              )}

              {modulo === 'paquetes' && (
                <MisPaquetes usuarioApp={usuarioApp} />
              )}

              {modulo === 'pagos' && (
                <MisPagos usuarioApp={usuarioApp} />
              )}
            </>
          )}

        </div>

      </div>

      {/* 🔔 NOTIFICACIONES */}
      {usuarioApp && (
        <>
          <NotificacionesVisitas usuarioApp={usuarioApp} />
          <NotificacionesPaquetes usuarioApp={usuarioApp} />
          <NotificacionesPagos usuarioApp={usuarioApp} />
        </>
      )}

    </div>
  );
}

export default App;