import { useState } from 'react';
import { supabase } from '../../services/supabaseClient';

export default function Login() {

  const [modo, setModo] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async () => {

    if (!email || !password) {
      alert('Completa los campos');
      return;
    }

    if (modo === 'login') {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) alert(error.message);
    }

    if (modo === 'register') {
      const { error } = await supabase.auth.signUp({
        email,
        password
      });

      if (error) alert(error.message);
      else alert('Cuenta creada, revisa tu correo');
    }
  };

  return (
    <div>

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

      {/* INPUT EMAIL */}
      <input
        type="email"
        placeholder="Correo electrónico"
        className="mb-3"
        value={email}
        onChange={e => setEmail(e.target.value)}
      />

      {/* INPUT PASSWORD */}
      <input
        type="password"
        placeholder="Contraseña"
        className="mb-4"
        value={password}
        onChange={e => setPassword(e.target.value)}
      />

      {/* BOTÓN PRINCIPAL */}
      <button
        onClick={handleSubmit}
        className="app-btn-primary w-full"
      >
        {modo === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
      </button>

    </div>
  );
}