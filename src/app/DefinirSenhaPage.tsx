import { useState, type FormEvent } from 'react';
import { supabase } from '@/shared/lib/supabase';
import { mensagemErro } from '@/shared/lib/formato';
import { Aviso, Botao, Campo, Entrada } from '@/shared/ui';
import { Marca } from './Layout';

// Tela de definir senha (RH, entrega 4): aberta pelo link de convite que o RH manda, ou pelo link de nova senha.
// A senha vai direto para o Supabase Auth; o ERP nunca a guarda.
export function DefinirSenhaPage({ convite, email, onPronto }: { convite: boolean; email: string; onPronto: () => void }) {
  const [s1, setS1] = useState('');
  const [s2, setS2] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    if (s1.length < 8) return setErro('A senha precisa ter pelo menos 8 caracteres.');
    if (s1 !== s2) return setErro('As duas senhas não são iguais.');
    setSalvando(true);
    const { error } = await supabase.auth.updateUser({ password: s1 });
    setSalvando(false);
    if (error) return setErro(error.message.includes('different from the old') ? 'A nova senha precisa ser diferente da anterior.' : mensagemErro(error));
    onPronto();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-pagina p-4">
      <form onSubmit={salvar} className="w-full max-w-sm space-y-4 rounded-xl bg-superficie p-7 shadow-sm ring-1 ring-borda">
        <div className="space-y-3">
          <div className="pb-2"><Marca vertical /></div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-texto">{convite ? 'Bem-vindo ao ERP' : 'Nova senha'}</h1>
            <p className="text-sm text-suave">{convite ? 'Escolha a senha do seu login' : 'Escolha uma nova senha para'} <b>{email}</b>.</p>
          </div>
        </div>
        {erro && <Aviso>{erro}</Aviso>}
        <input type="email" autoComplete="username" value={email} readOnly hidden />
        <Campo rotulo="Senha"><Entrada type="password" autoComplete="new-password" value={s1} onChange={(e) => setS1(e.target.value)} required autoFocus /></Campo>
        <Campo rotulo="Repita a senha"><Entrada type="password" autoComplete="new-password" value={s2} onChange={(e) => setS2(e.target.value)} required /></Campo>
        <Botao type="submit" className="w-full" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar senha e entrar'}</Botao>
      </form>
    </div>
  );
}
