import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, ClipboardList, Download, Send, ShoppingCart, FileUp, History, ListTree, Pencil, Plus, Settings2, Table2, Trash2 } from 'lucide-react';
import { ExcluirProjetoModal } from './ExcluirProjetoModal';
import { KickoffAba } from '@/modules/vendas/kickoff/KickoffAba';
import { useAuth } from '@/shared/auth/AuthProvider';
import { dataBR, dataHoraBR, mensagemErro, moeda } from '@/shared/lib/formato';
import { useIndicadorAbas } from '@/shared/ui/AbasModulo';
import { AreaTexto, Aviso, Botao, Caixa, Campo, CampoData, Cartao, Entrada, EsqueletoDetalhe, Modal, Selecao, Selo, Vazio } from '@/shared/ui';
import {
  adicionarPeca, atualizarPeca, atualizarProjeto, excluirItem, listarCatalogo, listarConjuntos, listarEventos, listarImportacoesCad, listarPecas,
  listarRefsEng, listarSolicitacoes, listarUsuariosAtivos, obterProjeto, pausarProjeto, solicitarCompra,
} from './api';
import { ROTULO_SOLICITACAO, agruparLista, mudouDesde, planoEnvio, type Solicitacao } from './compra';
import { type LinhaImportada, type PecaProjeto } from '@/modules/compras/regras';
import { LIMITE_DIFERENCA, blocoDaPeca, estimar, resumoCompra, type RefsEng } from './biblioteca';
import { descricaoDoItem } from './CampoBiblioteca';
import { ArvoreView } from './Arvore';
import { ImportarSolidworks } from './ImportarSolidworks';
import {
  COD_OPS, COR_STATUS_PROJETO, NOME_BLOCO, NOME_STATUS_PROJETO, OPS_PADRAO, listaMateriais, progresso, rotuloMaterial,
  type Bloco, type CodOp, type Conjunto, type LinhaBom, type MaterialCatalogo, type Peca, type Projeto,
} from './regras';

// Dentro do projeto, por enquanto, só Kick-off, Árvore e Lista de materiais (decisão 96).
const abas = [
  { id: 'kickoff', rotulo: 'Kick-off', icone: ClipboardList },
  { id: 'arvore', rotulo: 'Árvore', icone: ListTree },
  { id: 'bom', rotulo: 'Lista de materiais', icone: Table2 },
] as const;
type Aba = (typeof abas)[number]['id'];

export function ProjetoPage() {
  const { id = '' } = useParams();
  const [aba, setAba] = useState<Aba>('arvore');
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [dados, setDados] = useState(false);
  const navegar = useNavigate();
  const { pode } = useAuth();
  const { data: projeto, error } = useQuery({ queryKey: ['eng', id, 'projeto'], queryFn: () => obterProjeto(id) });
  const { data: conjuntos = [] } = useQuery({ queryKey: ['eng', id, 'conjuntos'], queryFn: () => listarConjuntos(id) });
  const { data: pecas = [] } = useQuery({ queryKey: ['eng', id, 'pecas'], queryFn: () => listarPecas(id) });
  const { data: usuarios = [] } = useQuery({ queryKey: ['usuarios_ativos'], queryFn: listarUsuariosAtivos, staleTime: 5 * 60_000 });
  const linhaAbas = useIndicadorAbas(`${aba}|${projeto ? 1 : 0}`);

  if (error) return <Aviso>{mensagemErro(error)}</Aviso>;
  if (!projeto) return <EsqueletoDetalhe />;
  const pct = progresso(conjuntos);
  const responsavel = usuarios.find((u) => u.id === projeto.responsavel_id)?.nome;

  return (
    <div className="space-y-4">
      <Link to="/engenharia/projetos" className="inline-flex items-center gap-1 text-sm text-suave hover:text-roxo-600"><ArrowLeft size={15} /> Projetos</Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-2xl font-bold text-texto">{projeto.codigo}</h1>
            <Selo cor={COR_STATUS_PROJETO[projeto.status]}>{NOME_STATUS_PROJETO[projeto.status]}</Selo>
            {projeto.pausado && <Selo cor="amarelo">Pausado</Selo>}
            {projeto.exemplo && <Selo cor="amarelo">Exemplo</Selo>}
          </div>
          <div className="font-semibold">{projeto.titulo}</div>
          <div className="text-sm text-suave">{projeto.cliente_nome}{responsavel && ` · Resp.: ${responsavel}`}{projeto.prazo && ` · prazo ${projeto.prazo.split('-').reverse().join('/')}`}</div>
        </div>
        <div className="flex flex-wrap items-end gap-4 text-sm">
          <Botao variante="secundario" onClick={() => setDados(true)}><Settings2 size={15} /> Dados e histórico</Botao>
          {pode('engenharia', 'editar') && (
            <Botao variante="secundario" onClick={() => setImportando(true)}><FileUp size={15} /> {projeto.importado_cad_em ? 'Atualizar do SolidWorks' : 'Importar do SolidWorks'}</Botao>
          )}
          {pode('engenharia', 'excluir') && (
            <Botao variante="secundario" onClick={() => setExcluindo(true)}><Trash2 size={15} /> Excluir</Botao>
          )}
          <Indicador rotulo="Conjuntos" valor={String(conjuntos.filter((c) => !c.removido_cad_em).length)} />
          <Indicador rotulo="Peças e itens" valor={String(pecas.filter((p) => !p.removido_cad_em).length)} />
          <div>
            <div className="text-xs text-suave">Liberado</div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-24 rounded-full bg-slate-200 dark:bg-marinho-700"><div className="h-2 rounded-full bg-petroleo-500" style={{ width: `${pct}%` }} /></div>
              <span className="font-semibold tabular-nums">{pct}%</span>
            </div>
          </div>
        </div>
      </div>

      <div ref={linhaAbas} className="abas abas-indicador gap-x-1 border-b border-borda" role="tablist">
        {abas.map((a) => (
          <button key={a.id} role="tab" aria-selected={aba === a.id} onClick={() => setAba(a.id)} className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm ${aba === a.id ? 'border-roxo-500 font-semibold text-roxo-600 dark:border-roxo-300 dark:text-roxo-100' : 'border-transparent text-suave hover:text-texto'} transition-colors duration-150`}>
            <a.icone size={15} /> {a.rotulo}
          </button>
        ))}
        <span className="abas-linha" />
      </div>
      <div key={aba} className="entrar">
        {aba === 'kickoff' && (projeto.proposta_id
          ? <KickoffAba propostaId={projeto.proposta_id} statusProposta="Aprovado" somenteLeitura />
          : <Vazio>O Kick-off vem da proposta aprovada. Este projeto de exemplo não tem proposta, então não tem Kick-off.</Vazio>)}
        {aba === 'arvore' && <ArvoreView projetoCodigo={projeto.codigo} conjuntos={conjuntos} pecas={pecas} selecionado={selecionado} onSelecionar={setSelecionado} />}
        {aba === 'bom' && <ListaMateriais projeto={projeto} conjuntos={conjuntos} pecas={pecas} />}
      </div>
      {importando && <ImportarSolidworks projeto={projeto} conjuntos={conjuntos} pecas={pecas} onFechar={() => setImportando(false)} />}
      {excluindo && <ExcluirProjetoModal projeto={projeto} onFechar={() => setExcluindo(false)} onExcluido={() => navegar('/engenharia/projetos')} />}
      {dados && <DadosModal projeto={projeto} onFechar={() => setDados(false)} />}
    </div>
  );
}

function Indicador({ rotulo, valor }: { rotulo: string; valor: string }) {
  return <div><div className="text-xs text-suave">{rotulo}</div><div className="font-semibold tabular-nums">{valor}</div></div>;
}

const REFS_VAZIAS: RefsEng = { chapas: [], perfis: [], itens: [], tipos: [], precosChapa: [] };
const num = (n: number | null | undefined) => (n == null ? '' : String(n).replace('.', ','));
const mm = (n: number | null | undefined) => (n == null ? '—' : Number(n).toLocaleString('pt-BR'));
const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
function baixarCsv(nome: string, linhas: (string | number | null)[][]) {
  const csv = linhas.map((r) => r.map((c) => esc(String(c ?? ''))).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

const BLOCOS: Bloco[] = ['chapa', 'perfil', 'comercial'];
type LinhaEst = LinhaBom & { bloco: Bloco; est: ReturnType<typeof estimar> };

// Lista de materiais em Chapas, Perfis e Itens comerciais, com cadastro manual (decisão 96).
function ListaMateriais({ projeto, conjuntos, pecas }: { projeto: Projeto; conjuntos: Conjunto[]; pecas: Peca[] }) {
  const { pode } = useAuth();
  const editavel = pode('engenharia', 'editar');
  const { data: refs = REFS_VAZIAS } = useQuery({ queryKey: ['bib', 'eng_refs'], queryFn: listarRefsEng, staleTime: 5 * 60_000 });
  const { data: catalogo = [] } = useQuery({ queryKey: ['catalogo_materiais'], queryFn: listarCatalogo, staleTime: 10 * 60_000 });
  const [visao, setVisao] = useState<'pecas' | 'compra'>('pecas');
  const [verRemovidos, setVerRemovidos] = useState(false);
  const [editando, setEditando] = useState<{ bloco: Bloco; peca?: Peca } | null>(null);
  const temRemovidos = pecas.some((p) => p.removido_cad_em) || conjuntos.some((c) => c.removido_cad_em);
  const linhas: LinhaEst[] = useMemo(() => listaMateriais(pecas, conjuntos, verRemovidos)
    .map((l) => ({ ...l, bloco: blocoDaPeca(l), est: estimar(l, refs) })), [pecas, conjuntos, verRemovidos, refs]);
  const ativas = linhas.filter((l) => !l.removido);
  const pesoTotal = ativas.reduce((s, l) => s + (l.pesoTotal ?? 0), 0);
  const nomeMaterial = (cod: string | null) => catalogo.find((c) => c.cod_mat === cod)?.nome ?? cod ?? '';
  const resumo = useMemo(() => resumoCompra(listaMateriais(pecas, conjuntos, false), refs, nomeMaterial), [pecas, conjuntos, refs, catalogo]); // eslint-disable-line react-hooks/exhaustive-deps
  const custoResumo = resumo.reduce((s, l) => s + (l.custo ?? 0), 0);
  const semCusto = ativas.filter((l) => l.est.custoUnit == null).length;
  // Mesma soma da importação de Compras (agruparLista): só o que está no CAD/lista hoje.
  const paraCompra = useMemo(() => agruparLista(listaMateriais(pecas, conjuntos, false).map((l): PecaProjeto => {
    const est = estimar(l, refs);
    const item = l.bib_tipo === 'item' && l.bib_id ? refs.itens.find((x) => x.id === l.bib_id) : undefined;
    return {
      descricao: l.descricao, cod_op: l.cod_op, cod_mat: l.cod_mat, material: catalogo.find((c) => c.cod_mat === l.cod_mat)?.nome || l.material || null,
      espessura: l.espessura ?? null, largura: l.largura ?? null, comprimento: l.comprimento ?? null, peso_unit: l.peso_unit ?? est.pesoBib ?? null,
      bib_tipo: l.bib_id ? l.bib_tipo ?? null : null, bib_id: l.bib_id ?? null, bib_descricao: l.bib_id ? descricaoDoItem(refs, l.bib_tipo, l.bib_id) : null,
      bib_grupo: item?.grupo ?? null, bib_unidade: item?.unidade ?? null, qtd_total: l.qtdTotal,
    };
  })), [pecas, conjuntos, refs, catalogo]);

  function exportarCsv() {
    if (visao === 'compra') {
      return baixarCsv(`Resumo para compra ${projeto.codigo}.csv`, [['Grupo', 'Material / item', 'Quantidade', 'Unidade', 'Comprar', 'Custo estimado (R$)'],
        ...resumo.map((l) => [l.grupo, l.descricao, num(l.quantidade), l.unidade, l.compra, num(l.custo)])]);
    }
    baixarCsv(`Lista de materiais ${projeto.codigo}.csv`, [['Bloco', 'Código', 'Descrição', 'Conjunto', 'COD_OP', 'COD_MAT', 'Material', 'Item da biblioteca', 'Espessura (mm)', 'Largura (mm)', 'Comprimento (mm)', 'Qtd no conjunto', 'Qtd total', 'Peso un. (kg)', 'Peso total (kg)', 'Custo un. (R$)', 'Custo total (R$)'],
      ...linhas.map((l) => [NOME_BLOCO[l.bloco], l.codigo, l.descricao, l.conjunto, l.cod_op.join('/'), l.cod_mat ?? '', l.material, l.bib_id ? descricaoDoItem(refs, l.bib_tipo, l.bib_id) ?? '' : '',
        num(l.espessura), num(l.largura), num(l.comprimento), num(l.quantidade), num(l.qtdTotal), num(l.peso_unit), num(l.pesoTotal), num(l.est.custoUnit),
        num(l.est.custoUnit == null ? null : Math.round(l.est.custoUnit * l.qtdTotal * 100) / 100)])]);
  }

  return (
    <div className="space-y-4">
      <SolicitacaoCompra projeto={projeto} lista={paraCompra} />
      <div className="grid gap-3 sm:grid-cols-3">
        {BLOCOS.map((b) => {
          const doBloco = ativas.filter((l) => l.bloco === b);
          return (
            <Cartao key={b} className="p-4">
              <div className="text-xs text-suave">{NOME_BLOCO[b]}</div>
              <div className="mt-1 text-xl font-semibold tabular-nums">{doBloco.length} <span className="text-sm font-normal text-suave">itens</span></div>
              <div className="text-xs text-suave">{b === 'comercial' ? `${doBloco.reduce((s, l) => s + l.qtdTotal, 0).toLocaleString('pt-BR')} unidades` : `${doBloco.reduce((s, l) => s + (l.pesoTotal ?? 0), 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg`}</div>
            </Cartao>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg bg-pagina p-0.5 ring-1 ring-borda">
          {([['pecas', 'Lista'], ['compra', 'Resumo para compra']] as const).map(([v, r]) => (
            <button key={v} onClick={() => setVisao(v)} className={`rounded-md px-3 py-1 text-sm transition-colors duration-150 ${visao === v ? 'bg-superficie font-semibold text-roxo-600 shadow-sm dark:text-roxo-100' : 'text-suave hover:text-texto'}`}>{r}</button>
          ))}
        </div>
        {visao === 'pecas' && temRemovidos && <Caixa marcado={verRemovidos} onChange={setVerRemovidos}>Mostrar removidos do CAD</Caixa>}
        <span className="ml-auto text-sm text-suave">
          Peso total {pesoTotal.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg · custo estimado (biblioteca) {moeda(custoResumo)}
          {semCusto > 0 && <span className="text-amber-600 dark:text-amber-400"> · {semCusto} sem preço</span>}
        </span>
        <button onClick={exportarCsv} disabled={visao === 'pecas' ? !linhas.length : !resumo.length} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-roxo-600 hover:bg-roxo-50 disabled:opacity-40 dark:text-roxo-100 dark:hover:bg-marinho-700"><Download size={15} /> Excel (CSV)</button>
      </div>

      {visao === 'compra' ? <ResumoCompra resumo={resumo} total={custoResumo} /> : BLOCOS.map((b) => (
        <BlocoTabela key={b} bloco={b} linhas={linhas.filter((l) => l.bloco === b)} refs={refs} editavel={editavel}
          onAdicionar={() => setEditando({ bloco: b })} onEditar={(p) => setEditando({ bloco: b, peca: p })} />
      ))}
      {editando && <PecaModal projeto={projeto} bloco={editando.bloco} peca={editando.peca} conjuntos={conjuntos} catalogo={catalogo} onFechar={() => setEditando(null)} />}
    </div>
  );
}

// Compras v2 (decisão 103): "em compra" = a requisição já tem item comprado e não pode mais ser substituída.
const COR_REQ: Record<Solicitacao['status'], 'cinza' | 'roxo' | 'verde' | 'vermelho' | 'amarelo' | 'azul'> = {
  aberta: 'azul', em_compra: 'roxo', concluida: 'verde', cancelada: 'cinza',
};
const qtdBR = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 });

// Envio da lista de materiais para Compras (decisão 103). Cada envio é uma revisão (R0, R1…) e vira uma RC em Compras.
function SolicitacaoCompra({ projeto, lista }: { projeto: Projeto; lista: LinhaImportada[] }) {
  const { pode } = useAuth();
  const { data: solicitacoes = [], error } = useQuery({ queryKey: ['eng', projeto.id, 'solicitacoes'], queryFn: () => listarSolicitacoes(projeto.id) });
  const [abrindo, setAbrindo] = useState(false);
  const [historico, setHistorico] = useState(false);
  const plano = useMemo(() => planoEnvio(lista, solicitacoes), [lista, solicitacoes]);
  const mudou = useMemo(() => mudouDesde(lista, solicitacoes), [lista, solicitacoes]);
  const ultima = solicitacoes.find((s) => s.status !== 'cancelada');
  const pendente = !ultima ? lista.length > 0 : mudou;
  const podeEnviar = pode('engenharia', 'editar') && projeto.status !== 'cancelado' && plano.itens.length > 0;

  return (
    <Cartao className="p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="rounded-xl bg-petroleo-50 p-2.5 text-petroleo-600 dark:bg-petroleo-600/30 dark:text-teal-100"><ShoppingCart size={18} /></div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold">Solicitação para Compras</div>
          {error ? <div className="text-sm text-red-600">{mensagemErro(error)}</div> : !ultima ? (
            <div className="text-sm text-suave">{lista.length ? `A lista ainda não foi enviada. ${lista.length} ${lista.length === 1 ? 'item' : 'itens'} para comprar.` : 'Lance peças e itens na lista para poder solicitar a compra.'}</div>
          ) : (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-suave">
              <span className="font-mono font-semibold text-texto">{ultima.codigo}</span><span>· R{ultima.revisao}</span>
              <Selo cor={COR_REQ[ultima.status]}>{ROTULO_SOLICITACAO[ultima.status]}</Selo>
              <span>enviada em {dataHoraBR(ultima.criado_em)}{ultima.solicitante ? ` por ${ultima.solicitante}` : ''}</span>
              {ultima.necessario_em && <span>· precisa em {dataBR(ultima.necessario_em)}</span>}
              {ultima.prioridade === 'urgente' && <Selo cor="vermelho">Urgente</Selo>}
            </div>
          )}
          {ultima && mudou && <div className="mt-1 flex items-center gap-1 text-sm text-amber-600 dark:text-amber-400"><AlertTriangle size={14} /> A lista mudou depois do envio da R{ultima.revisao}. Envie uma nova revisão para Compras.</div>}
        </div>
        {solicitacoes.length > 0 && <Botao tamanho="sm" variante="secundario" onClick={() => setHistorico(true)}><History size={14} /> Envios ({solicitacoes.length})</Botao>}
        {pode('engenharia', 'editar') && (
          <Botao tamanho="sm" variante={pendente ? 'primario' : 'secundario'} disabled={!podeEnviar} onClick={() => setAbrindo(true)}
            title={plano.itens.length ? undefined : 'Nada a solicitar: a lista está vazia ou já foi toda pedida'}>
            <Send size={14} /> {ultima ? 'Enviar nova revisão' : 'Solicitar compra'}
          </Botao>
        )}
      </div>
      {abrindo && <SolicitarModal projeto={projeto} plano={plano} onFechar={() => setAbrindo(false)} />}
      {historico && <HistoricoSolicitacoes solicitacoes={solicitacoes} onFechar={() => setHistorico(false)} />}
    </Cartao>
  );
}

function SolicitarModal({ projeto, plano, onFechar }: { projeto: Projeto; plano: ReturnType<typeof planoEnvio>; onFechar: () => void }) {
  const qc = useQueryClient();
  const [necessario, setNecessario] = useState(projeto.prazo ?? '');
  const [prioridade, setPrioridade] = useState<'normal' | 'urgente'>('normal');
  const [obs, setObs] = useState('');
  const [erro, setErro] = useState('');
  const [feito, setFeito] = useState<{ codigo: string; revisao: number } | null>(null);
  const complemento = plano.itens.some((i) => i.observacoes.includes('complemento'));
  const enviar = useMutation({
    mutationFn: () => {
      const notas = [obs.trim(), complemento ? 'Complemento: parte da lista já foi comprada em outra requisição.' : '',
        plano.reducoes.length ? `Itens que diminuíram ou saíram da lista depois de comprados: ${plano.reducoes.join('; ')}.` : ''].filter(Boolean).join('\n');
      return solicitarCompra(projeto.id, plano.itens, necessario || null, prioridade, notas);
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['eng', projeto.id] });
      qc.invalidateQueries({ queryKey: ['compras'] });
      setFeito({ codigo: r.codigo, revisao: r.revisao });
    },
    onError: (e) => setErro(mensagemErro(e)),
  });

  if (feito) return (
    <Modal aberto titulo="Solicitação enviada" onFechar={onFechar}>
      <div className="space-y-3 text-sm">
        <p>A lista R{feito.revisao} foi enviada para Compras como <span className="font-mono font-semibold">{feito.codigo}</span>. Ela aparece no painel de Compras, coluna Abertas.</p>
        <div className="flex justify-end"><Botao onClick={onFechar}>Fechar</Botao></div>
      </div>
    </Modal>
  );

  return (
    <Modal aberto titulo={`Solicitar compra · ${projeto.codigo} · R${plano.proximaRevisao}`} onFechar={onFechar} largura="max-w-3xl">
      <div className="space-y-3 text-sm">
        <p className="text-suave">Vai para Compras a lista inteira, somada por material: chapas em kg, perfis em metros e itens comerciais em unidades. Sem valores: preços e fornecedores ficam com Compras.</p>
        {plano.substitui.length > 0 && <Aviso tipo="info">A requisição {plano.substitui.map((s) => `${s.codigo} (R${s.revisao})`).join(', ')} ainda não teve nada comprado e será cancelada e substituída por esta revisão.</Aviso>}
        {complemento && <Aviso tipo="info">Parte da lista já foi comprada. Vai só o que falta, marcado como complemento.</Aviso>}
        {plano.reducoes.length > 0 && (
          <Aviso>Itens que já foram comprados e diminuíram ou saíram da lista (avise Compras se for preciso cancelar ou devolver):
            <ul className="mt-1 list-disc pl-5">{plano.reducoes.map((r) => <li key={r}>{r}</li>)}</ul>
          </Aviso>
        )}
        <div className="max-h-72 overflow-auto rounded-lg ring-1 ring-borda">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-pagina text-left text-xs uppercase text-suave">
              <tr><th className="px-3 py-2">Grupo</th><th className="px-3 py-2">Material / item</th><th className="px-3 py-2 text-right">Quantidade</th><th className="px-3 py-2">Un.</th></tr>
            </thead>
            <tbody>
              {plano.itens.map((i) => (
                <tr key={i.chave} className="border-t border-borda">
                  <td className="px-3 py-1.5 text-suave">{i.grupo}</td>
                  <td className="px-3 py-1.5">{i.descricao}{i.observacoes && <div className="text-[11px] text-amber-600 dark:text-amber-400">{i.observacoes}</div>}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{qtdBR(i.quantidade)}</td>
                  <td className="px-3 py-1.5">{i.unidade}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Precisa em"><CampoData value={necessario} onChange={setNecessario} /></Campo>
          <Campo rotulo="Prioridade">
            <Selecao value={prioridade} onChange={(e) => setPrioridade(e.target.value as 'normal' | 'urgente')}>
              <option value="normal">Normal</option><option value="urgente">Urgente</option>
            </Selecao>
          </Campo>
        </div>
        <Campo rotulo="Observações para Compras"><AreaTexto value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: entregar na fábrica, preferir chapa de 3000 × 1200" /></Campo>
        {erro && <Aviso>{erro}</Aviso>}
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao disabled={enviar.isPending} onClick={() => { setErro(''); enviar.mutate(); }}><Send size={14} /> {enviar.isPending ? 'Enviando…' : `Enviar ${plano.itens.length} ${plano.itens.length === 1 ? 'item' : 'itens'}`}</Botao>
        </div>
      </div>
    </Modal>
  );
}

function HistoricoSolicitacoes({ solicitacoes, onFechar }: { solicitacoes: Solicitacao[]; onFechar: () => void }) {
  const [aberta, setAberta] = useState<string | null>(solicitacoes[0]?.id ?? null);
  return (
    <Modal aberto titulo="Envios para Compras" onFechar={onFechar} largura="max-w-2xl">
      <div className="space-y-2 text-sm">
        {solicitacoes.map((s) => (
          <div key={s.id} className="rounded-lg ring-1 ring-borda">
            <button onClick={() => setAberta(aberta === s.id ? null : s.id)} className="flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left">
              <span className="font-semibold">R{s.revisao}</span><span className="font-mono text-xs">{s.codigo}</span>
              <Selo cor={COR_REQ[s.status]}>{ROTULO_SOLICITACAO[s.status]}</Selo>
              <span className="ml-auto text-xs text-suave">{dataHoraBR(s.criado_em)}{s.solicitante ? ` · ${s.solicitante}` : ''} · {s.itens.length} itens</span>
            </button>
            {aberta === s.id && (
              <table className="w-full border-t border-borda text-sm">
                <tbody>
                  {s.itens.map((i, n) => (
                    <tr key={n} className="border-t border-borda first:border-0">
                      <td className="px-3 py-1 text-suave">{i.grupo}</td><td className="px-3 py-1">{i.descricao}</td>
                      <td className="px-3 py-1 text-right tabular-nums">{qtdBR(Number(i.quantidade))} {i.unidade}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}

function BlocoTabela({ bloco, linhas, refs, editavel, onAdicionar, onEditar }: { bloco: Bloco; linhas: LinhaEst[]; refs: RefsEng; editavel: boolean; onAdicionar: () => void; onEditar: (p: Peca) => void }) {
  const th = 'px-3 py-2';
  return (
    <Cartao className="overflow-hidden p-0">
      <div className="flex items-center justify-between gap-2 border-b border-borda px-4 py-3">
        <div className="flex items-center gap-2 font-semibold">{NOME_BLOCO[bloco]} <Selo>{linhas.length}</Selo></div>
        {editavel && <Botao tamanho="sm" variante="secundario" onClick={onAdicionar}><Plus size={14} /> Adicionar</Botao>}
      </div>
      {linhas.length === 0 ? <div className="px-4 py-6 text-center text-sm text-suave">Nenhum item. {editavel && 'Use "Adicionar" para lançar à mão ou importe do SolidWorks.'}</div> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-pagina text-left text-xs uppercase text-suave">
              <tr>
                <th className={th}>Código</th><th className={th}>Descrição</th>
                {bloco !== 'comercial' && <><th className={th}>COD_OP</th><th className={th}>Material</th></>}
                {bloco === 'chapa' && <><th className={`${th} text-right`}>Esp. (mm)</th><th className={`${th} text-right`}>Larg. (mm)</th></>}
                {bloco !== 'comercial' && <th className={`${th} text-right`}>Compr. (mm)</th>}
                {bloco === 'comercial' && <th className={th}>Item da biblioteca</th>}
                <th className={`${th} text-right`}>Qtd/conj.</th><th className={`${th} text-right`}>Qtd total</th>
                {bloco !== 'comercial' && <th className={`${th} text-right`}>Peso total</th>}
                <th className={`${th} text-right`}>Custo</th>
                {editavel && <th className={th} />}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const avisa = l.est.diferenca != null && l.est.diferenca > LIMITE_DIFERENCA;
                return (
                  <tr key={l.id} className={`border-t border-borda ${l.removido ? 'text-slate-400 line-through' : ''}`}>
                    <td className="whitespace-nowrap px-3 py-1.5 font-mono text-xs">{l.codigo}</td>
                    <td className="px-3 py-1.5">{l.descricao || <span className="text-suave">—</span>}<div className="text-[11px] text-suave no-underline">{l.removido ? 'Removido do CAD' : `Conjunto ${l.conjunto}`}</div></td>
                    {bloco !== 'comercial' && (
                      <>
                        <td className="px-3 py-1.5"><div className="flex flex-wrap gap-0.5">{l.cod_op.map((o) => <span key={o} className="rounded bg-roxo-500 px-1 font-mono text-[10px] font-semibold text-white">{o}</span>)}</div></td>
                        <td className="px-3 py-1.5">{rotuloMaterial(l) || <span className="text-amber-600 dark:text-amber-400">Sem material</span>}</td>
                      </>
                    )}
                    {bloco === 'chapa' && <><td className="px-3 py-1.5 text-right tabular-nums">{mm(l.espessura)}</td><td className="px-3 py-1.5 text-right tabular-nums">{mm(l.largura)}</td></>}
                    {bloco !== 'comercial' && <td className="px-3 py-1.5 text-right tabular-nums">{mm(l.comprimento)}</td>}
                    {bloco === 'comercial' && <td className="px-3 py-1.5 text-xs">{l.bib_id ? descricaoDoItem(refs, l.bib_tipo, l.bib_id) ?? '—' : <span className="text-suave">—</span>}</td>}
                    <td className="px-3 py-1.5 text-right tabular-nums">{Number(l.quantidade).toLocaleString('pt-BR')}</td>
                    <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{l.qtdTotal.toLocaleString('pt-BR')}</td>
                    {bloco !== 'comercial' && (
                      <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">
                        {avisa && <span title={`Peso do CAD ${Number(l.peso_unit).toLocaleString('pt-BR')} kg × biblioteca ${l.est.pesoBib?.toLocaleString('pt-BR')} kg por unidade (${Math.round(l.est.diferenca! * 100)}% de diferença): confira material ou medidas`}><AlertTriangle size={13} className="mr-1 inline text-amber-500" /></span>}
                        {l.pesoTotal == null ? (l.est.pesoBib ? `${(l.est.pesoBib * l.qtdTotal).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg*` : '—') : `${l.pesoTotal.toLocaleString('pt-BR')} kg`}
                      </td>
                    )}
                    <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">{l.est.custoUnit == null ? '—' : moeda(l.est.custoUnit * l.qtdTotal)}</td>
                    {editavel && (
                      <td className="px-2 py-1.5 text-right">
                        {!l.removido && <button title="Editar" onClick={() => onEditar(l)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-roxo-600 dark:hover:bg-marinho-700"><Pencil size={14} /></button>}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {linhas.some((l) => l.pesoTotal == null && l.est.pesoBib) && <div className="border-t border-borda px-3 py-2 text-xs text-suave">* Peso calculado pela biblioteca (kg/m × comprimento): a peça não tem peso informado.</div>}
        </div>
      )}
    </Cartao>
  );
}

function ResumoCompra({ resumo, total }: { resumo: ReturnType<typeof resumoCompra>; total: number }) {
  return (
    <Cartao className="overflow-hidden p-0">
      {resumo.length === 0 ? <Vazio>Nenhum item na lista de materiais.</Vazio> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-pagina text-left text-xs uppercase text-suave">
              <tr><th className="px-3 py-2">Grupo</th><th className="px-3 py-2">Material / item</th><th className="px-3 py-2 text-right">Quantidade</th><th className="px-3 py-2">Comprar</th><th className="px-3 py-2 text-right">Custo estimado</th></tr>
            </thead>
            <tbody>
              {resumo.map((l) => (
                <tr key={l.chave} className="border-t border-borda">
                  <td className="px-3 py-1.5 text-suave">{l.grupo}</td>
                  <td className="px-3 py-1.5">{l.descricao}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">{l.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {l.unidade}</td>
                  <td className={`px-3 py-1.5 ${l.grupo === 'Sem item' || l.compra.startsWith('Cadastre') || l.compra.startsWith('Informe') ? 'text-amber-600 dark:text-amber-400' : ''}`}>{l.compra}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{l.custo == null ? '—' : moeda(l.custo)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr className="border-t border-borda font-semibold"><td className="px-3 py-2" colSpan={4}>Total estimado</td><td className="px-3 py-2 text-right tabular-nums">{moeda(total)}</td></tr></tfoot>
          </table>
        </div>
      )}
    </Cartao>
  );
}

// Número digitado com vírgula ou ponto; vazio = sem valor.
const lerNumero = (s: string): number | null => {
  const t = (s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s).trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};
const textoNumero = (n: number | null | undefined) => (n == null ? '' : String(n).replace('.', ','));

function PecaModal({ projeto, bloco, peca, conjuntos, catalogo, onFechar }: { projeto: Projeto; bloco: Bloco; peca?: Peca; conjuntos: Conjunto[]; catalogo: MaterialCatalogo[]; onFechar: () => void }) {
  const qc = useQueryClient();
  const ativos = conjuntos.filter((c) => !c.removido_cad_em).sort((a, b) => a.codigo.localeCompare(b.codigo));
  const geral = ativos.find((c) => c.tipo === 'geral');
  const [conjunto, setConjunto] = useState(peca?.conjunto_id ?? geral?.id ?? '');
  const [descricao, setDescricao] = useState(peca?.descricao ?? '');
  const [quantidade, setQuantidade] = useState(textoNumero(peca?.quantidade ?? 1));
  const [codMat, setCodMat] = useState(peca?.cod_mat ?? '');
  const [espessura, setEspessura] = useState(textoNumero(peca?.espessura));
  const [largura, setLargura] = useState(textoNumero(peca?.largura));
  const [comprimento, setComprimento] = useState(textoNumero(peca?.comprimento));
  const [peso, setPeso] = useState(textoNumero(peca?.peso_unit));
  const [ops, setOps] = useState<CodOp[]>(peca?.cod_op ?? OPS_PADRAO[bloco]);
  const [erro, setErro] = useState('');
  const [confirmaExcluir, setConfirmaExcluir] = useState(false);
  const atualizar = () => { qc.invalidateQueries({ queryKey: ['eng', projeto.id] }); qc.invalidateQueries({ queryKey: ['painel_engenharia'] }); qc.invalidateQueries({ queryKey: ['projetos'] }); };

  const salvar = useMutation({
    mutationFn: async () => {
      const q = lerNumero(quantidade);
      if (!descricao.trim()) throw new Error('Informe a descrição.');
      if (q == null || Number.isNaN(q) || q <= 0) throw new Error('A quantidade precisa ser maior que zero.');
      const medidas = { espessura: lerNumero(espessura), largura: lerNumero(largura), comprimento: lerNumero(comprimento), peso_unit: lerNumero(peso) };
      if (Object.values(medidas).some((v) => v != null && (Number.isNaN(v) || v <= 0))) throw new Error('Medidas e peso precisam ser números maiores que zero.');
      if (bloco !== 'comercial' && !ops.length) throw new Error('Escolha ao menos uma operação (COD_OP).');
      const mat = catalogo.find((c) => c.cod_mat === codMat);
      const dados = {
        descricao: descricao.trim(), quantidade: q,
        cod_op: bloco === 'comercial' ? ['CM'] : ops,
        cod_mat: bloco === 'comercial' ? null : mat?.cod_mat ?? null,
        material: bloco === 'comercial' ? '' : mat?.nome ?? '',
        espessura: bloco === 'chapa' ? medidas.espessura : null,
        largura: bloco === 'chapa' ? medidas.largura : null,
        comprimento: bloco === 'comercial' ? null : medidas.comprimento,
        peso_unit: bloco === 'comercial' ? null : medidas.peso_unit,
      };
      if (peca) return atualizarPeca(peca.id, dados as Partial<Peca>);
      if (!conjunto) throw new Error('Escolha o conjunto.');
      await adicionarPeca(conjunto, dados as unknown as Partial<Peca>);
    },
    onSuccess: () => { atualizar(); onFechar(); },
    onError: (e) => setErro(mensagemErro(e)),
  });
  const excluir = useMutation({ mutationFn: () => excluirItem('peca', peca!.id), onSuccess: () => { atualizar(); onFechar(); }, onError: (e) => setErro(mensagemErro(e)) });
  const alternarOp = (o: CodOp) => setOps((x) => (x.includes(o) ? x.filter((y) => y !== o) : [...x, o]));

  return (
    <Modal aberto titulo={`${peca ? 'Editar' : 'Adicionar'} · ${NOME_BLOCO[bloco]}`} onFechar={onFechar} largura="max-w-xl">
      <div className="space-y-3 text-sm">
        {peca ? <div className="font-mono text-xs text-suave">{peca.codigo}</div> : (
          <Campo rotulo="Conjunto">
            <Selecao value={conjunto} onChange={(e) => setConjunto(e.target.value)}>
              {ativos.map((c) => <option key={c.id} value={c.id}>{c.codigo} · {c.nome}</option>)}
            </Selecao>
          </Campo>
        )}
        <Campo rotulo={bloco === 'perfil' ? 'Descrição do perfil (ex.: Cantoneira 2" x 1/4")' : 'Descrição'}><Entrada value={descricao} onChange={(e) => setDescricao(e.target.value)} autoFocus /></Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Quantidade no conjunto"><Entrada inputMode="decimal" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} /></Campo>
          {bloco !== 'comercial' && (
            <Campo rotulo="Material (COD_MAT)">
              <Selecao value={codMat} onChange={(e) => setCodMat(e.target.value)}>
                <option value="">Sem material</option>
                {catalogo.map((c) => <option key={c.cod_mat} value={c.cod_mat}>{c.cod_mat} — {c.nome}</option>)}
              </Selecao>
            </Campo>
          )}
          {bloco === 'chapa' && (
            <>
              <Campo rotulo="Espessura (mm)"><Entrada inputMode="decimal" value={espessura} onChange={(e) => setEspessura(e.target.value)} /></Campo>
              <Campo rotulo="Largura (mm)"><Entrada inputMode="decimal" value={largura} onChange={(e) => setLargura(e.target.value)} /></Campo>
            </>
          )}
          {bloco !== 'comercial' && (
            <>
              <Campo rotulo="Comprimento (mm)"><Entrada inputMode="decimal" value={comprimento} onChange={(e) => setComprimento(e.target.value)} /></Campo>
              <Campo rotulo="Peso unitário (kg, opcional)"><Entrada inputMode="decimal" value={peso} onChange={(e) => setPeso(e.target.value)} /></Campo>
            </>
          )}
        </div>
        {bloco !== 'comercial' && (
          <Campo rotulo="Operações (COD_OP)">
            <div className="flex flex-wrap gap-1.5">
              {COD_OPS.filter((o) => o !== 'CM').map((o) => (
                <button key={o} type="button" onClick={() => alternarOp(o)}
                  className={`rounded-md px-2 py-1 font-mono text-xs font-semibold ring-1 transition-colors duration-150 ${ops.includes(o) ? 'bg-roxo-500 text-white ring-roxo-500' : 'text-suave ring-borda hover:text-texto'}`}>{o}</button>
              ))}
            </div>
          </Campo>
        )}
        {erro && <Aviso>{erro}</Aviso>}
        <div className="flex items-center justify-between gap-2 pt-1">
          <div>
            {peca && (confirmaExcluir
              ? <span className="inline-flex items-center gap-2"><span className="text-suave">Excluir este item?</span><Botao variante="secundario" tamanho="sm" onClick={() => excluir.mutate()} disabled={excluir.isPending}>Sim, excluir</Botao></span>
              : <Botao variante="secundario" tamanho="sm" onClick={() => setConfirmaExcluir(true)}><Trash2 size={14} /> Excluir</Botao>)}
          </div>
          <div className="flex gap-2">
            <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
            <Botao onClick={() => salvar.mutate()} disabled={salvar.isPending}>Salvar</Botao>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// Responsável, prazo, observações, pausa (Chefe), dados do SolidWorks e histórico do projeto.
function DadosModal({ projeto, onFechar }: { projeto: Projeto; onFechar: () => void }) {
  const { pode } = useAuth();
  const qc = useQueryClient();
  const editavel = pode('engenharia', 'editar');
  const chefe = pode('engenharia', 'aprovar');
  const { data: usuarios = [] } = useQuery({ queryKey: ['usuarios_ativos'], queryFn: listarUsuariosAtivos, staleTime: 5 * 60_000 });
  const { data: eventos = [] } = useQuery({ queryKey: ['eng', projeto.id, 'eventos'], queryFn: () => listarEventos(projeto.id) });
  const [erro, setErro] = useState('');
  const atualizar = () => { qc.invalidateQueries({ queryKey: ['eng', projeto.id] }); qc.invalidateQueries({ queryKey: ['projetos'] }); qc.invalidateQueries({ queryKey: ['painel_engenharia'] }); };
  const salvar = async (d: Parameters<typeof atualizarProjeto>[1]) => {
    setErro('');
    try { await atualizarProjeto(projeto.id, d); atualizar(); } catch (e) { setErro(mensagemErro(e)); }
  };
  const pausa = useMutation({ mutationFn: () => pausarProjeto(projeto.id, !projeto.pausado), onSuccess: atualizar, onError: (e) => setErro(mensagemErro(e)) });
  const nome = (s: string | null) => (s ? NOME_STATUS_PROJETO[s as Projeto['status']] ?? s : '');
  return (
    <Modal aberto titulo={`Dados do projeto ${projeto.codigo}`} onFechar={onFechar} largura="max-w-2xl">
      <div className="space-y-4 text-sm">
        {erro && <Aviso>{erro}</Aviso>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Responsável">
            <Selecao value={projeto.responsavel_id ?? ''} disabled={!editavel} onChange={(e) => salvar({ responsavel_id: e.target.value || null })}>
              <option value="">Sem responsável</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </Selecao>
          </Campo>
          <Campo rotulo="Prazo da Engenharia"><CampoData value={projeto.prazo} disabled={!editavel} onChange={(v) => salvar({ prazo: v || null })} /></Campo>
        </div>
        <Campo rotulo="Observações">
          <AreaTexto defaultValue={projeto.observacoes} disabled={!editavel} rows={3} onBlur={(e) => e.target.value !== projeto.observacoes && salvar({ observacoes: e.target.value })} />
        </Campo>
        {chefe && projeto.status !== 'finalizado' && (
          <div className="flex items-center justify-between gap-2 rounded-xl bg-pagina p-3">
            <span>{projeto.pausado ? 'Projeto pausado.' : 'Pausar mantém o projeto na coluna, com o selo Pausado.'}</span>
            <Botao variante="secundario" tamanho="sm" onClick={() => pausa.mutate()} disabled={pausa.isPending}>{projeto.pausado ? 'Retomar' : 'Pausar'}</Botao>
          </div>
        )}
        {projeto.importado_cad_em && <DadosCad projeto={projeto} />}
        <div>
          <div className="mb-1 flex items-center gap-1.5 font-semibold"><History size={15} /> Histórico</div>
          {eventos.length === 0 ? <div className="text-suave">Sem registros.</div> : (
            <ul className="space-y-1">
              {eventos.map((ev) => (
                <li key={ev.id} className="flex flex-wrap gap-x-2">
                  <span className="tabular-nums text-suave">{dataHoraBR(ev.criado_em)}</span>
                  <span className="font-medium">
                    {ev.tipo === 'criado' ? 'Projeto aberto' : ev.tipo === 'compra' ? `Compra solicitada (${ev.para})` : ev.tipo === 'pausa' ? (ev.para === 'pausado' ? 'Pausado' : 'Retomado') : `${nome(ev.de)} → ${nome(ev.para)}`}
                  </span>
                  {ev.justificativa && <span>· {ev.justificativa}</span>}
                  <span className="text-suave">· {ev.usuarios?.nome ?? 'Sistema'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}

// Dados que vieram do carimbo do SolidWorks na importação (só leitura).
function DadosCad({ projeto }: { projeto: Projeto }) {
  const d = (projeto.dados_cad ?? {}) as Record<string, string | number | null>;
  const linhas: [string, string | number | null | undefined][] = [
    ['Código CAD', d.codigo_cad], ['Título no CAD', d.titulo], ['Nº pedido no CAD', d.pedido],
    ['Peso total (kg)', d.peso == null ? null : Number(d.peso).toLocaleString('pt-BR')], ['Área de pintura (m²)', d.area_pintura == null ? null : Number(d.area_pintura).toLocaleString('pt-BR')],
    ['Projetado', [d.projetado, d.data_projetado].filter(Boolean).join(' · ')], ['Desenhado', [d.desenhado, d.data_desenhado].filter(Boolean).join(' · ')],
    ['Aprovado', [d.aprovado, d.data_aprovado].filter(Boolean).join(' · ')], ['Revisão do CAD', d.revisao],
  ];
  return (
    <div className="rounded-xl bg-pagina p-3 text-sm">
      <div className="mb-2 font-semibold">Importado do SolidWorks em {dataHoraBR(projeto.importado_cad_em)}{d.macro ? ` (macro ${d.macro})` : ''}</div>
      <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
        {linhas.filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => (
          <div key={k} className="flex gap-2"><dt className="text-suave">{k}:</dt><dd className="font-medium">{v}</dd></div>
        ))}
      </dl>
      <HistoricoCad projetoId={projeto.id} />
    </div>
  );
}

function HistoricoCad({ projetoId }: { projetoId: string }) {
  const { data: historico = [] } = useQuery({ queryKey: ['eng', projetoId, 'importacoes'], queryFn: () => listarImportacoesCad(projetoId) });
  if (!historico.length) return null;
  const texto = (r: Record<string, number>) =>
    [r.novos && `${r.novos} novo(s)`, r.alterados && `${r.alterados} alterado(s)`, r.removidos && `${r.removidos} removido(s)`, r.liberados_em_revisao && `${r.liberados_em_revisao} liberado(s) → em revisão`]
      .filter(Boolean).join(', ') || 'sem mudanças';
  return (
    <div className="mt-3 border-t border-borda pt-2">
      <div className="mb-1 font-semibold">Histórico de importações</div>
      <ul className="space-y-1">
        {historico.map((h) => (
          <li key={h.id} className="flex flex-wrap gap-x-2">
            <span className="tabular-nums text-suave">{dataHoraBR(h.criado_em)}</span>
            <span className="font-medium">{h.tipo === 'inicial' ? 'Importação inicial' : 'Nova revisão'}</span>
            <span>{texto(h.resumo)}</span>
            {h.arquivo && <span className="font-mono text-[11px] text-suave">{h.arquivo}</span>}
            <span className="text-suave">· {h.usuarios?.nome ?? '—'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
