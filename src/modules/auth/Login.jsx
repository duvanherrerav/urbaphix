import { useState } from 'react';
import { supabase } from '../../services/supabaseClient';

export default function Login() {

  const [modo, setModo] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  const traducirAuthError = (message) => {
    const text = String(message || '').toLowerCase();
    if (text.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.';
    if (text.includes('email not confirmed')) return 'Confirma tu correo antes de ingresar.';
    if (text.includes('password')) return 'La contraseña no cumple los requisitos mínimos.';
    return message || 'No fue posible completar la autenticación.';
  };

  const getRolLabel = (rol) => {
    if (rol === 'admin') return 'administración';
    if (rol === 'vigilancia') return 'vigilancia';
    if (rol === 'residente') return 'residente';
    return 'tu panel';
  };

  const handleSubmit = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');

    if (!email || !password) {
      setErrorMsg('Completa correo y contraseña.');
      return;
    }

    setLoading(true);

    if (modo === 'login') {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        setLoading(false);
        setErrorMsg(traducirAuthError(error.message));
        return;
      }

      const userId = data?.user?.id;
      if (userId) {
        const { data: perfil } = await supabase
          .from('usuarios_app')
          .select('rol_id')
          .eq('id', userId)
          .maybeSingle();
        setInfoMsg(`Acceso concedido. Redirigiendo a ${getRolLabel(perfil?.rol_id)}...`);
      }
    }

    if (modo === 'register') {
      const { error } = await supabase.auth.signUp({
        email,
        password
      });

      if (error) setErrorMsg(traducirAuthError(error.message));
      else setInfoMsg('Cuenta creada. Revisa tu correo para confirmar el acceso.');
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* TOGGLE */}
      <div className="mb-6 flex rounded-lg border border-app-border bg-app-bg p-1">
        <button
          onClick={() => setModo('login')}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
            modo === 'login'
              ? 'bg-brand-primary text-app-text-primary'
              : 'text-app-text-secondary hover:bg-app-bg-alt'
          }`}
        >
          Iniciar sesión
        </button>

        <button
          onClick={() => setModo('register')}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
            modo === 'register'
              ? 'bg-brand-primary text-app-text-primary'
              : 'text-app-text-secondary hover:bg-app-bg-alt'
          }`}
        >
          Crear cuenta
        </button>
      </div>

      {errorMsg && <div className="app-surface-muted border border-state-error/30 text-state-error text-xs p-2 rounded-lg">{errorMsg}</div>}
      {infoMsg && <div className="app-surface-muted border border-state-info/30 text-state-info text-xs p-2 rounded-lg">{infoMsg}</div>}

      {/* INPUT EMAIL */}
      <div>
        <label className="text-xs text-app-text-secondary">Correo electrónico</label>
        <input
          type="email"
          placeholder="tu@correo.com"
          className="app-input mt-1"
          value={email}
          onChange={e => setEmail(e.target.value)}
          autoComplete="email"
        />
      </div>

      {/* INPUT PASSWORD */}
      <div>
        <label className="text-xs text-app-text-secondary">Contraseña</label>
        <input
          type="password"
          placeholder="••••••••"
          className="app-input mt-1"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
        />
      </div>

      {/* BOTÓN PRINCIPAL */}
      <button
        type="submit"
        disabled={loading}
        className="app-btn-primary w-full"
      >
        {loading ? 'Procesando...' : (modo === 'login' ? 'Iniciar sesión' : 'Crear cuenta')}
      </button>

    </form>
  );
}
