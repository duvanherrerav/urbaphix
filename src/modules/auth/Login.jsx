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
      <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => setModo('login')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium ${
            modo === 'login'
              ? 'bg-white shadow'
              : 'text-gray-500'
          }`}
        >
          Iniciar sesión
        </button>

        <button
          onClick={() => setModo('register')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium ${
            modo === 'register'
              ? 'bg-white shadow'
              : 'text-gray-500'
          }`}
        >
          Crear cuenta
        </button>
      </div>

      {/* INPUT EMAIL */}
      <input
        type="email"
        placeholder="Correo electrónico"
        className="w-full border border-gray-300 rounded-lg px-4 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={email}
        onChange={e => setEmail(e.target.value)}
      />

      {/* INPUT PASSWORD */}
      <input
        type="password"
        placeholder="Contraseña"
        className="w-full border border-gray-300 rounded-lg px-4 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={password}
        onChange={e => setPassword(e.target.value)}
      />

      {/* BOTÓN PRINCIPAL */}
      <button
        onClick={handleSubmit}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-semibold"
      >
        {modo === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
      </button>

    </div>
  );
}