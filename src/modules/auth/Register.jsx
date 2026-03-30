import { useState } from 'react';
import { supabase } from '../../services/supabaseClient';

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
      alert(error.message);
    } else {
      alert('Usuario creado');
      console.log(data);
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