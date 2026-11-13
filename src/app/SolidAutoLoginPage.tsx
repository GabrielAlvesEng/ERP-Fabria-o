import { useState } from 'react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { supabase } from '@/shared/lib/supabase';
import { loginVisivel } from '@/shared/lib/login';
import { cancelarSolidAuto, guardarPedidoSolidAuto, retornoSolidAuto, type PedidoSolidAuto } from '@/shared/lib/solidauto';
import { Aviso, Botao } from '@/shared/ui';
import { Marca } from './Layout';

// O SolidAuto pediu "Entrar com o ERP": confirma com quem já está logado e manda ao app um código de uso único.
export function SolidAutoLoginPage({ pedido, onFim }: { pedido: PedidoSolidAuto; onFim: () => void }) {
  const { session } = useAuth();
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [pronto, setPronto] = useState(false);

  async function entrar() {
    setErro('');
    setEnviando(true);
    const { data, error } = await supabase.functions.invoke('solidauto-login', { body: {} });
    setEnviando(false);
    const codigo = (data as { token_hash?: string } | null)?.token_hash;
    if (error || !codigo) {
      let msg = (data as { erro?: string } | null)?.erro ?? '';
      if (!msg && error && 'context' in error) msg = (await (error.context as Response).json().catch(() => ({})))?.erro ?? '';
      return setErro(msg || 'Não foi possível entrar no SolidAuto. Tente de novo.');
    }
    guardarPedidoSolidAuto(null);
    setPronto(true);
    window.location.href = retornoSolidAuto(pedido, codigo);
  }

  function cancelar() {
    guardarPedidoSolidAuto(null);
    window.location.href = cancelarSolidAuto(pedido);
    onFim();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-pagina p-4">
      <div className="w-full max-w-sm space-y-4 rounded-xl bg-superficie p-7 shadow-sm ring-1 ring-borda">
        <div className="pb-2"><Marca vertical /></div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-texto">Entrar no SolidAuto</h1>
          <p className="text-sm text-suave">
            O SolidAuto deste computador quer entrar com a sua conta do ERP: <strong>{loginVisivel(session?.user.email)}</strong>.
          </p>
        </div>
        {erro && <Aviso>{erro}</Aviso>}
        {pronto
          ? <Aviso tipo="info">Pronto. Volte para o SolidAuto; esta aba pode ser fechada.</Aviso>
          : (
            <>
              <Botao className="w-full" onClick={entrar} disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar no SolidAuto'}</Botao>
              <button type="button" onClick={cancelar} className="w-full text-center text-xs text-suave hover:underline">Não fui eu, cancelar</button>
            </>
          )}
        <button type="button" onClick={() => { guardarPedidoSolidAuto(null); onFim(); }} className="w-full text-center text-xs text-roxo-600 hover:underline dark:text-roxo-100">
          Ir para o ERP
        </button>
      </div>
    </div>
  );
}
