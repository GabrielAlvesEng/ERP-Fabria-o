import { Marca } from './Layout';
import { useState, type FormEvent } from 'react';
import { supabase } from '@/shared/lib/supabase';
import { Aviso, Botao, Campo, Entrada } from '@/shared/ui';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setEnviando(false);
    if (error) setErro(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message);
  }

  async function recuperar() {
    setErro('');
    if (!email) return setErro('Informe o e-mail para recuperar a senha.');
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: new URL(import.meta.env.BASE_URL, window.location.origin).href });
    if (error) setErro(error.message);
    else setAviso('Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-pagina p-4">
      <form onSubmit={entrar} className="w-full max-w-sm space-y-4 rounded-xl bg-superficie p-7 shadow-sm ring-1 ring-borda">
        <div className="space-y-3">
          <div className="pb-2"><Marca vertical /></div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-texto">Entrar no ERP</h1>
            <p className="text-sm text-suave">Use seu e-mail e senha.</p>
          </div>
        </div>
        {erro && <Aviso>{erro}</Aviso>}
        {aviso && <Aviso tipo="info">{aviso}</Aviso>}
        <Campo rotulo="E-mail"><Entrada type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></Campo>
        <Campo rotulo="Senha"><Entrada type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required /></Campo>
        <Botao type="submit" className="w-full" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</Botao>
        <button type="button" onClick={recuperar} className="w-full text-center text-xs text-roxo-600 hover:underline dark:text-roxo-100">Esqueci minha senha</button>
      </form>
    </div>
  );
}
