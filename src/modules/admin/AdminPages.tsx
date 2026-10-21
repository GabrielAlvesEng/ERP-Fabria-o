import { useEffect, useState, type FormEvent } from 'react';
import { AbasModulo } from '@/shared/ui/AbasModulo';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, KeyRound, Library, RotateCcw, Trash2, Truck } from 'lucide-react';
import { supabase } from '@/shared/lib/supabase';
import { dataHoraBR, mensagemErro } from '@/shared/lib/formato';
import { Aviso, Botao, Cabecalho, Campo, Carregando, Cartao, Entrada, Modal, Selo, Vazio } from '@/shared/ui';

const abas = [
  { to: '/admin', rotulo: 'Senhas', icone: KeyRound, end: true },
  { to: '/admin/excluidas', rotulo: 'Lixeira', icone: Trash2 },
  { to: '/admin/predefinicoes', rotulo: 'Predefinições', icone: Library },
  { to: '/admin/frota', rotulo: 'Frota (custos)', icone: Truck },
  { to: '/admin/modelos', rotulo: 'Modelos de proposta', icone: FileText },
];

export function AdminLayout() {
  return <AbasModulo abas={abas} />;
}

type AcaoSenha = 'excluir_proposta' | 'excluir_projeto';
const SENHAS: { acao: AcaoSenha; titulo: string; texto: string }[] = [
  { acao: 'excluir_proposta', titulo: 'Excluir Proposta', texto: 'Pedida para excluir propostas já enviadas ao cliente e para excluir propostas definitivamente na Lixeira. Rascunhos nunca enviados não pedem senha; propostas aprovadas não podem ser excluídas.' },
  { acao: 'excluir_projeto', titulo: 'Excluir Projeto', texto: 'Pedida para excluir projetos que já têm peças ou conjuntos e para excluir projetos definitivamente na Lixeira.' },
];

// Administração → Senhas (Documento Mestre 8.9; decisão 60).
export function SenhasPage() {
  return (
    <>
      <Cabecalho titulo="Senhas administrativas" subtitulo="Senhas exigidas em ações críticas. Ficam guardadas com criptografia e ninguém consegue vê-las depois de salvas." />
      <div className="grid gap-4 lg:grid-cols-2">
        {SENHAS.map((s) => <CartaoSenha key={s.acao} {...s} />)}
      </div>
    </>
  );
}

function CartaoSenha({ acao, titulo, texto }: { acao: AcaoSenha; titulo: string; texto: string }) {
  const qc = useQueryClient();
  const [s1, setS1] = useState('');
  const [s2, setS2] = useState('');
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');
  const { data: situacao } = useQuery({
    queryKey: ['situacao_senha', acao],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('situacao_senha', { p_acao: acao });
      if (error) throw error;
      return ((data ?? []) as { definida: boolean; atualizado_em: string | null }[])[0];
    },
  });
  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('definir_senha_administrativa', { p_acao: acao, p_senha: s1 });
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
    <Cartao>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="font-semibold">{titulo}</div>
        {situacao?.definida ? <Selo cor="verde">Definida {situacao.atualizado_em ? `em ${dataHoraBR(situacao.atualizado_em)}` : ''}</Selo> : <Selo cor="amarelo">Não definida</Selo>}
      </div>
      <p className="mb-3 text-sm text-suave">{texto}</p>
      <form onSubmit={salvar} className="space-y-3">
        {erro && <Aviso>{erro}</Aviso>}
        {ok && <Aviso tipo="info">{ok}</Aviso>}
        <Campo rotulo={situacao?.definida ? 'Nova senha' : 'Senha'}><Entrada type="password" autoComplete="new-password" value={s1} onChange={(e) => setS1(e.target.value)} /></Campo>
        <Campo rotulo="Repita a senha"><Entrada type="password" autoComplete="new-password" value={s2} onChange={(e) => setS2(e.target.value)} /></Campo>
        <div className="flex justify-end"><Botao type="submit" disabled={m.isPending}>{m.isPending ? 'Salvando…' : situacao?.definida ? 'Trocar senha' : 'Definir senha'}</Botao></div>
      </form>
    </Cartao>
  );
}

// Lixeira (decisão 60): propostas e projetos excluídos ficam 30 dias; depois a limpeza diária apaga de vez.
const DIAS_LIXEIRA = 30;
const diasRestantes = (excluidoEm: string) => Math.max(0, DIAS_LIXEIRA - Math.floor((Date.now() - new Date(excluidoEm).getTime()) / 86_400_000));

type Tipo = 'proposta' | 'projeto';
interface ItemLixeira { tipo: Tipo; id: string; codigo: string; titulo: string; empresa: string | null; excluido_em: string; excluido_por: string | null; justificativa: string | null; status?: string }

export function ExcluidasPage() {
  const qc = useQueryClient();
  const [erro, setErro] = useState('');
  const [apagando, setApagando] = useState<ItemLixeira | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['lixeira'],
    queryFn: async () => {
      const [pr, pj] = await Promise.all([supabase.rpc('propostas_excluidas'), supabase.rpc('projetos_excluidos')]);
      if (pr.error) throw pr.error;
      if (pj.error) throw pj.error;
      return {
        propostas: ((pr.data ?? []) as Omit<ItemLixeira, 'tipo'>[]).map((x) => ({ ...x, tipo: 'proposta' as const })),
        projetos: ((pj.data ?? []) as Omit<ItemLixeira, 'tipo'>[]).map((x) => ({ ...x, tipo: 'projeto' as const })),
      };
    },
  });
  useRemoverArquivosPendentes();
  const restaurar = useMutation({
    mutationFn: async (it: ItemLixeira) => {
      const { error } = await supabase.rpc(it.tipo === 'proposta' ? 'restaurar_proposta' : 'restaurar_projeto', { p_id: it.id });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lixeira'] }); qc.invalidateQueries({ queryKey: ['propostas'] }); qc.invalidateQueries({ queryKey: ['eng'] }); },
    onError: (e) => setErro(mensagemErro(e)),
  });

  const secao = (titulo: string, lista: ItemLixeira[], vazio: string) => (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-suave">{titulo} <span className="font-normal">({lista.length})</span></h2>
      <Cartao className="p-0">
        {lista.length === 0 ? <Vazio>{vazio}</Vazio> : (
          <div className="divide-y divide-borda">
            {lista.map((it) => {
              const dias = diasRestantes(it.excluido_em);
              return (
                <div key={it.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <div><span className="font-mono font-semibold text-roxo-600 dark:text-roxo-100">{it.codigo}</span> · {it.titulo} {it.empresa && <span className="text-suave">· {it.empresa}</span>}</div>
                    <div className="text-xs text-suave">Excluído em {dataHoraBR(it.excluido_em)}{it.excluido_por ? ` por ${it.excluido_por}` : ''}{it.status ? ` · etapa na exclusão: ${it.status}` : ''}</div>
                    {it.justificativa && <div className="text-xs text-suave">{it.justificativa}</div>}
                    <div className="mt-1"><Selo cor={dias <= 3 ? 'vermelho' : 'amarelo'}>{dias === 0 ? 'Será apagado na próxima limpeza' : `Apagado definitivamente em ${dias} dia(s)`}</Selo></div>
                  </div>
                  <div className="flex gap-2">
                    <Botao variante="secundario" onClick={() => restaurar.mutate(it)} disabled={restaurar.isPending}><RotateCcw size={14} /> Restaurar</Botao>
                    <Botao variante="perigo" onClick={() => setApagando(it)}><Trash2 size={14} /> Excluir definitivamente</Botao>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Cartao>
    </div>
  );

  return (
    <>
      <Cabecalho titulo="Lixeira" subtitulo={`Propostas e projetos excluídos ficam aqui por ${DIAS_LIXEIRA} dias: restaure se foi engano ou exclua definitivamente. Depois desse prazo são apagados sozinhos.`} />
      {erro && <div className="mb-3"><Aviso>{erro}</Aviso></div>}
      {isLoading || !data ? <Carregando /> : (
        <div className="space-y-6">
          {secao('Propostas', data.propostas, 'Nenhuma proposta na Lixeira.')}
          {secao('Projetos', data.projetos, 'Nenhum projeto na Lixeira.')}
        </div>
      )}
      {apagando && <ApagarDefinitivo item={apagando} onFechar={() => setApagando(null)} />}
    </>
  );
}

// Confirmação forte: digitar o código e a senha administrativa do tipo. Não tem volta.
function ApagarDefinitivo({ item, onFechar }: { item: ItemLixeira; onFechar: () => void }) {
  const qc = useQueryClient();
  const [codigo, setCodigo] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const m = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('apagar_definitivo', { p_tipo: item.tipo, p_id: item.id, p_codigo: codigo.trim(), p_senha: senha });
      if (error) throw error;
      if (data === 'senha_incorreta') throw new Error('Senha administrativa incorreta. Depois de 5 tentativas erradas, fica bloqueado por 15 minutos.');
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lixeira'] }); qc.invalidateQueries({ queryKey: ['arquivos_a_remover'] }); onFechar(); },
    onError: (e) => { setErro(mensagemErro(e)); setSenha(''); },
  });
  const nome = item.tipo === 'proposta' ? 'a proposta' : 'o projeto';
  return (
    <Modal aberto titulo={`Excluir definitivamente ${nome} ${item.codigo}?`} onFechar={onFechar}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); setErro(''); if (codigo.trim() !== item.codigo) return setErro(`Digite ${item.codigo} para confirmar.`); if (!senha) return setErro('Informe a senha administrativa.'); m.mutate(); }}>
        <Aviso>
          {item.tipo === 'proposta'
            ? 'Apaga a proposta, as revisões, os custos, os arquivos, o histórico, os follow-ups e o kick-off.'
            : 'Apaga o projeto, os conjuntos, as peças e as importações do SolidWorks.'} Não tem como desfazer. O código {item.codigo} não volta a ser usado.
        </Aviso>
        {erro && <Aviso>{erro}</Aviso>}
        <Campo rotulo={`Digite ${item.codigo} para confirmar *`}><Entrada value={codigo} onChange={(e) => setCodigo(e.target.value)} autoComplete="off" /></Campo>
        <Campo rotulo={`Senha administrativa (${item.tipo === 'proposta' ? 'Excluir Proposta' : 'Excluir Projeto'}) *`}><Entrada type="password" autoComplete="off" value={senha} onChange={(e) => setSenha(e.target.value)} /></Campo>
        <div className="flex justify-end gap-2 pt-1">
          <Botao type="button" variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao type="submit" variante="perigo" disabled={m.isPending}>{m.isPending ? 'Excluindo…' : 'Excluir definitivamente'}</Botao>
        </div>
      </form>
    </Modal>
  );
}

// Arquivos de propostas apagadas: o banco não pode remover arquivos do Storage, então a Lixeira remove aqui
// (a política do Storage só permite apagar o que está na lista) e confirma para tirar da lista.
function useRemoverArquivosPendentes() {
  const { data: pendentes = [] } = useQuery({
    queryKey: ['arquivos_a_remover'],
    queryFn: async () => {
      const { data, error } = await supabase.from('arquivos_a_remover').select('id, bucket, caminho').limit(500);
      if (error) throw error;
      return (data ?? []) as { id: number; bucket: string; caminho: string }[];
    },
  });
  useEffect(() => {
    if (!pendentes.length) return;
    (async () => {
      for (const bucket of [...new Set(pendentes.map((p) => p.bucket))]) {
        const doBucket = pendentes.filter((p) => p.bucket === bucket);
        const { error } = await supabase.storage.from(bucket).remove(doBucket.map((p) => p.caminho));
        if (!error) await supabase.rpc('confirmar_arquivos_removidos', { p_ids: doBucket.map((p) => p.id) });
      }
    })();
  }, [pendentes]);
}
