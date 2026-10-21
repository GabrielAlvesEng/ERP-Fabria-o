import { useState, type FormEvent } from 'react';
import { AbasModulo } from '@/shared/ui/AbasModulo';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Library, RotateCcw, Trash2, Truck } from 'lucide-react';
import { supabase } from '@/shared/lib/supabase';
import { dataHoraBR, mensagemErro } from '@/shared/lib/formato';
import { Aviso, Botao, Cabecalho, Campo, Cartao, Entrada, Selo, Vazio } from '@/shared/ui';

const abas = [
  { to: '/admin', rotulo: 'Senhas', icone: KeyRound, end: true },
  { to: '/admin/excluidas', rotulo: 'Propostas excluídas', icone: Trash2 },
  { to: '/admin/predefinicoes', rotulo: 'Predefinições', icone: Library },
  { to: '/admin/frota', rotulo: 'Frota (custos)', icone: Truck },
];

export function AdminLayout() {
  return <AbasModulo abas={abas} />;
}

// Administração → Senhas → Excluir Proposta (Documento Mestre 8.9).
export function SenhasPage() {
  const qc = useQueryClient();
  const [s1, setS1] = useState('');
  const [s2, setS2] = useState('');
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');
  const { data: situacao } = useQuery({
    queryKey: ['situacao_senha', 'excluir_proposta'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('situacao_senha', { p_acao: 'excluir_proposta' });
      if (error) throw error;
      return (data as { definida: boolean; atualizado_em: string | null }[])[0];
    },
  });
  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('definir_senha_administrativa', { p_acao: 'excluir_proposta', p_senha: s1 });
      if (error) throw error;
    },
    onSuccess: () => { setS1(''); setS2(''); setOk('Senha salva.'); qc.invalidateQueries({ queryKey: ['situacao_senha'] }); },
    onError: (e) => setErro(mensagemErro(e)),
  });

  function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(''); setOk('');
    if (s1.length < 6) return setErro('A senha precisa ter pelo menos 6 caracteres.');
    if (s1 !== s2) return setErro('As duas senhas não conferem.');
    m.mutate();
  }

  return (
    <>
      <Cabecalho titulo="Senhas administrativas" subtitulo="Senhas exigidas em ações críticas. Ficam guardadas com criptografia e ninguém consegue vê-las depois de salvas." />
      <Cartao className="max-w-lg">
        <div className="mb-3 flex items-center justify-between">
          <div className="font-semibold">Excluir Proposta</div>
          {situacao?.definida ? <Selo cor="verde">Definida {situacao.atualizado_em ? `em ${dataHoraBR(situacao.atualizado_em)}` : ''}</Selo> : <Selo cor="amarelo">Não definida</Selo>}
        </div>
        <p className="mb-3 text-sm text-suave">Pedida para excluir propostas que já foram enviadas ao cliente. Rascunhos nunca enviados não pedem senha; propostas aprovadas não podem ser excluídas.</p>
        <form onSubmit={salvar} className="space-y-3">
          {erro && <Aviso>{erro}</Aviso>}
          {ok && <Aviso tipo="info">{ok}</Aviso>}
          <Campo rotulo={situacao?.definida ? 'Nova senha' : 'Senha'}><Entrada type="password" autoComplete="new-password" value={s1} onChange={(e) => setS1(e.target.value)} /></Campo>
          <Campo rotulo="Repita a senha"><Entrada type="password" autoComplete="new-password" value={s2} onChange={(e) => setS2(e.target.value)} /></Campo>
          <div className="flex justify-end"><Botao type="submit" disabled={m.isPending}>{m.isPending ? 'Salvando…' : situacao?.definida ? 'Trocar senha' : 'Definir senha'}</Botao></div>
        </form>
      </Cartao>
    </>
  );
}

interface Excluida { id: string; codigo: string; titulo: string; status: string; empresa: string; excluido_em: string; excluido_por: string | null; justificativa: string | null }

export function ExcluidasPage() {
  const qc = useQueryClient();
  const [erro, setErro] = useState('');
  const { data: lista = [], isLoading } = useQuery({
    queryKey: ['propostas_excluidas'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('propostas_excluidas');
      if (error) throw error;
      return (data ?? []) as Excluida[];
    },
  });
  const restaurar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('restaurar_proposta', { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['propostas_excluidas'] }); qc.invalidateQueries({ queryKey: ['propostas'] }); },
    onError: (e) => setErro(mensagemErro(e)),
  });
  return (
    <>
      <Cabecalho titulo="Propostas excluídas" subtitulo="Exclusão lógica: nada é apagado. Restaure se a exclusão foi um engano." />
      {erro && <div className="mb-3"><Aviso>{erro}</Aviso></div>}
      <Cartao className="p-0">
        {isLoading ? <Vazio>Carregando…</Vazio> : lista.length === 0 ? <Vazio>Nenhuma proposta excluída.</Vazio> : (
          <div className="divide-y divide-borda">
            {lista.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <div><span className="font-mono font-semibold text-roxo-600 dark:text-roxo-100">{p.codigo}</span> · {p.titulo} <span className="text-suave">· {p.empresa}</span></div>
                  <div className="text-xs text-suave">Excluída em {dataHoraBR(p.excluido_em)}{p.excluido_por ? ` por ${p.excluido_por}` : ''} · etapa na exclusão: {p.status}</div>
                  {p.justificativa && <div className="text-xs text-suave">{p.justificativa}</div>}
                </div>
                <Botao variante="secundario" onClick={() => restaurar.mutate(p.id)} disabled={restaurar.isPending}><RotateCcw size={14} /> Restaurar</Botao>
              </div>
            ))}
          </div>
        )}
      </Cartao>
    </>
  );
}
