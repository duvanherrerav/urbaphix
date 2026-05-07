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
    <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.035] p-4 shadow-[0_22px_70px_rgba(2,6,23,0.42),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl sm:p-6">

      {/* TOGGLE */}
      <div className="grid grid-cols-2 rounded-2xl border border-white/10 bg-slate-950/75 p-1.5 shadow-inner shadow-black/25">
        <button
          type="button"
          onClick={() => setModo('login')}
          className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200 ${
            modo === 'login'
              ? 'bg-gradient-to-r from-brand-primary/95 to-brand-secondary/95 text-white shadow-lg shadow-brand-primary/20'
              : 'text-app-text-secondary hover:bg-white/[0.035] hover:text-app-text-primary'
            }`}
        >
          Iniciar sesión
        </button>

        <button
          type="button"
          onClick={() => setModo('register')}
          className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200 ${
            modo === 'register'
            ? 'bg-gradient-to-r from-brand-primary/95 to-brand-secondary/95 text-white shadow-lg shadow-brand-primary/20'
            : 'text-app-text-secondary hover:bg-white/[0.035] hover:text-app-text-primary'
            }`}
        >
          Crear cuenta
        </button>
      </div>

      <div className="min-h-0 space-y-3" aria-live="polite">
        {errorMsg && <div className="rounded-2xl border border-state-error/30 bg-state-error/10 px-4 py-3 text-sm text-state-error">{errorMsg}</div>}
        {infoMsg && <div className="rounded-2xl border border-state-info/30 bg-state-info/10 px-4 py-3 text-sm text-state-info">{infoMsg}</div>}
      </div>

      {/* INPUT EMAIL */}
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-[0.16em] text-app-text-secondary">Correo electrónico</label>
        <div className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3 transition-all focus-within:border-brand-secondary/60 focus-within:bg-slate-950/85 focus-within:ring-2 focus-within:ring-brand-secondary/15">
          <span className="text-base text-brand-secondary/80" aria-hidden="true">✉</span>
          <input
            type="email"
            placeholder="tu@correo.com"
            className="border-0 bg-transparent p-0 text-sm shadow-none focus:ring-0"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
      </div>

      {/* INPUT PASSWORD */}
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-[0.16em] text-app-text-secondary">Contraseña</label>
        <div className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3 transition-all focus-within:border-brand-secondary/60 focus-within:bg-slate-950/85 focus-within:ring-2 focus-within:ring-brand-secondary/15">
          <span className="text-base text-brand-secondary/80" aria-hidden="true">●</span>
          <input
            type="password"
            placeholder="••••••••"
            className="border-0 bg-transparent p-0 text-sm shadow-none focus:ring-0"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
          />
        </div>
      </div>

      {/* BOTÓN PRINCIPAL */}
      <button
        type="submit"
        disabled={loading}
        className="group relative inline-flex w-full items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-r from-brand-primary via-blue-500/95 to-brand-secondary px-4 py-3.5 text-sm font-bold text-white shadow-[0_14px_36px_rgba(37,99,235,0.24)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(14,165,233,0.24)] focus:outline-none focus:ring-2 focus:ring-brand-secondary/50 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
      >
        <span className="absolute inset-0 translate-x-[-120%] bg-gradient-to-r from-transparent via-white/16 to-transparent transition-transform duration-700 group-hover:translate-x-[120%]" />
        <span className="relative">{loading ? 'Procesando...' : (modo === 'login' ? 'Iniciar sesión' : 'Crear cuenta')}</span>
      </button>

      <p className="text-center text-xs leading-5 text-app-text-secondary">
        Plataforma protegida para operación residencial. Tus credenciales se validan de forma segura.
      </p>

    </form>
  );
}
