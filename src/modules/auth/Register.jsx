import { useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { logger } from '../../utils/logger';
import { getAuthErrorMessage } from '../../utils/errorMessages';

export default function Register() {

  const [form, setForm] = useState({
    email: '',
    password: ''
  });

  const register = async () => {

    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password
    });

    if (error) {
      logger.error('Register: no se pudo crear usuario', error);
      alert(getAuthErrorMessage(error.message));
    } else {
      alert('Usuario creado');
      logger.info('Register: usuario creado', { user_id: data?.user?.id });
    }
  };

  return (
    <div>
      <h2>Registro 📝</h2>

      <input
        placeholder="Email"
        onChange={e => setForm({...form, email: e.target.value})}
      />

      <input
        type="password"
        placeholder="Password"
        onChange={e => setForm({...form, password: e.target.value})}
      />

      <button onClick={register}>
        Crear cuenta
      </button>
    </div>
  );
}