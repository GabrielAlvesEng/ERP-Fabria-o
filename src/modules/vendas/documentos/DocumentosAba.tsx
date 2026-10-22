import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Eye, FileCheck2, PencilLine, RotateCcw, Sparkles } from 'lucide-react';
import { supabase } from '@/shared/lib/supabase';
import { useAuth } from '@/shared/auth/AuthProvider';
import { mensagemErro } from '@/shared/lib/formato';
import { AreaTexto, Aviso, Botao, EsqueletoDetalhe, EsqueletoPagina } from '@/shared/ui';
import { atualizarRascunho, enviarArquivoRevisao, listarRevisoes } from '@/modules/vendas/api';
import { atualizarItem, criarItem } from '@/modules/vendas/custos/api';
import type { Proposta } from '@/modules/vendas/types';
import { carregarImagens, dadosDaProposta, enviarImagem, lerDocumentos, lerPadroes, salvarDocumento } from './api';
import { EditorDocumento } from './EditorDocumento';
import { aplicarTextosIA, aplicarTextosIASecao, completarDocumento, explicacaoParaSecao, fixarSecoesDoModelo, imagensDoDocumento, nomeArquivo, type Documento, type TextosIA, type TipoDocumento } from './modelo';

const Previa = lazy(() => import('./Previa'));
const SEM_IMAGENS: Record<string, string> = {};

// Aba Documentos da proposta (decisão 61): proposta técnica e comercial com textos editáveis, prévia A4 e PDF.
export function DocumentosAba({ proposta: p }: { proposta: Proposta }) {
  const { pode } = useAuth();
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<TipoDocumento>('tecnica');
  const [verPrevia, setVerPrevia] = useState(false);
  const [msg, setMsg] = useState<{ tipo: 'info' | 'erro'; texto: string } | null>(null);
  const [gerando, setGerando] = useState(false);
  const { data: revisoes = [] } = useQuery({ queryKey: ['proposta', p.id, 'revisoes', p.revisao_atual, p.status], queryFn: () => listarRevisoes(p.id) });
  const rev = revisoes.find((r) => r.numero === p.revisao_atual);
  const { data: padroes } = useQuery({ queryKey: ['documento_padroes'], queryFn: lerPadroes });
  const { data: salvos, isLoading } = useQuery({ queryKey: ['proposta_documentos', rev?.id], queryFn: () => lerDocumentos(rev!.id), enabled: Boolean(rev) });
  const preparadoPor = padroes?.empresa.responsavel ?? '';
  const { data: dados } = useQuery({
    queryKey: ['proposta_documentos_dados', p.id, rev?.id, p.titulo, p.descricao, p.data_emissao, p.validade_dias, p.contato_id, p.contato_tecnico_id, p.responsavel_id, p.frete, preparadoPor],
    queryFn: () => dadosDaProposta(p, rev!.id, preparadoPor), enabled: Boolean(rev && padroes),
  });
  const editavel = Boolean(rev?.status === 'rascunho' && pode('vendas', 'editar'));

  // Documento em edição: o salvo da revisão ou, se ainda não existe, o padrão.
  const [docs, setDocs] = useState<Partial<Record<TipoDocumento, Documento>>>({});
  useEffect(() => {
    if (!salvos || !padroes) return;
    // Documento salvo numa versão antiga do modelo é convertido com os padrões atuais (decisão 67).
    setDocs({ tecnica: fixarSecoesDoModelo(completarDocumento(salvos.tecnica, 'tecnica', padroes.tecnica), padroes.tecnica), comercial: fixarSecoesDoModelo(completarDocumento(salvos.comercial, 'comercial', padroes.comercial), padroes.comercial) });
  }, [salvos, padroes]);
  const doc = docs[tipo];

  // Salva sozinho 1 s depois da última alteração.
  const pendente = useRef<Partial<Record<TipoDocumento, Documento>>>({});
  const [salvando, setSalvando] = useState<'' | 'salvando' | 'salvo'>('');
  useEffect(() => {
    if (!editavel || !rev || !Object.keys(pendente.current).length) return;
    const t = setTimeout(async () => {
      const lote = pendente.current; pendente.current = {};
      setSalvando('salvando');
      try {
        for (const [k, d] of Object.entries(lote)) await salvarDocumento(rev.id, k as TipoDocumento, d!);
        setSalvando('salvo');
      } catch (e) { setMsg({ tipo: 'erro', texto: mensagemErro(e) }); setSalvando(''); }
    }, 1000);
    return () => clearTimeout(t);
  }, [docs, editavel, rev]);
  const alterar = (d: Documento) => { pendente.current[tipo] = d; setDocs((x) => ({ ...x, [tipo]: d })); };

  // Imagens usadas nos dois documentos, baixadas uma vez (o PDF é montado no navegador).
  const caminhos = useMemo(() => [...new Set([docs.tecnica, docs.comercial].flatMap((d) => (d ? imagensDoDocumento(d) : [])))].sort(), [docs]);
  const { data: urlsBaixadas } = useQuery({ queryKey: ['proposta_documentos_imagens', caminhos.join('|')], queryFn: () => carregarImagens(caminhos), enabled: caminhos.length > 0, staleTime: Infinity });
  const urls = urlsBaixadas ?? SEM_IMAGENS;
  const imagens = useMemo(() => (rev && editavel ? { enviar: (f: File) => enviarImagem(p.id, rev.id, f), urls } : undefined), [rev, editavel, p.id, urls]);

  const itensResumo = useMemo(() => dados?.itens ?? [], [dados]);

  // Decisão 71: valor de cada item digitado na área Valores da comercial (vai para custo_itens.valor_manual, o mesmo da aba Custos).
  // O valor da proposta acompanha a soma enquanto ela está "À enviar", como na aba Custos.
  const [salvandoValor, setSalvandoValor] = useState(false);
  async function aposValor(total: number | null) {
    if (total != null && p.status === 'À enviar') await atualizarRascunho(p.id, { valor: Math.round(total * 100) / 100 });
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['proposta_documentos_dados', p.id] }),
      qc.invalidateQueries({ queryKey: ['custos'] }),
      qc.invalidateQueries({ queryKey: ['propostas'] }),
      qc.invalidateQueries({ queryKey: ['proposta', p.id] }),
    ]);
  }
  const acoesValor = useMemo(() => (editavel && rev ? {
    ocupado: salvandoValor,
    salvar: async (id: string, valor: number | null) => {
      setSalvandoValor(true); setMsg(null);
      try {
        await atualizarItem(id, { valor_manual: valor });
        const total = (dados?.itens ?? []).reduce((a, i) => a + (i.id === id ? (valor ?? i.calculado ?? i.valor) : i.valor), 0);
        await aposValor(total);
      } catch (e) { setMsg({ tipo: 'erro', texto: mensagemErro(e) }); } finally { setSalvandoValor(false); }
    },
    criarItem: async () => {
      setSalvandoValor(true); setMsg(null);
      try { await criarItem(rev.id, [], p.titulo); await aposValor(null); } catch (e) { setMsg({ tipo: 'erro', texto: mensagemErro(e) }); } finally { setSalvandoValor(false); }
    },
  } : undefined), [editavel, rev, salvandoValor, dados, p.id, p.status, p.titulo]); // eslint-disable-line react-hooks/exhaustive-deps

  async function gerarPdf(anexar: boolean) {
    if (!doc || !dados || !padroes || !rev) return;
    setMsg(null); setGerando(true);
    try {
      const { gerarBlob } = await import('./Previa');
      const blob = await gerarBlob(doc, dados, padroes.empresa, urls, docs.tecnica);
      const nome = nomeArquivo(p.codigo, p.revisao_atual, p.titulo, tipo);
      if (anexar) {
        await enviarArquivoRevisao(p.id, rev.id, tipo, new File([blob], nome, { type: 'application/pdf' }));
        qc.invalidateQueries({ queryKey: ['proposta', p.id] });
        setMsg({ tipo: 'info', texto: `PDF anexado em Arquivos → Propostas (${tipo === 'tecnica' ? 'técnica' : 'comercial'}, R${p.revisao_atual}). Vai junto no e-mail de envio.` });
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = nome;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      }
    } catch (e) { setMsg({ tipo: 'erro', texto: mensagemErro(e) }); }
    setGerando(false);
  }

  // Textos por IA (entrega 3): a explicação vai para a Edge Function, que chama a OpenAI com a chave guardada no Supabase.
  const [pensando, setPensando] = useState(false);
  const explicacao = doc?.explicacao ?? docs[tipo === 'tecnica' ? 'comercial' : 'tecnica']?.explicacao ?? '';
  async function gerarComIA() {
    if (!doc || !dados) return;
    if (explicacao.trim().length < 15) return setMsg({ tipo: 'erro', texto: 'Explique a proposta com um pouco mais de detalhe (o que será feito, para quem e onde).' });
    const jaTem = doc.secoes.some((s) => s.id === 'objetivo' && s.tipo === 'texto' && s.texto.trim());
    if (jaTem && !confirm('A IA vai substituir capa, objetivo e os demais textos da obra. Garantia, validade e confidencialidade não mudam. Continuar?')) return;
    setMsg(null); setPensando(true);
    try {
      const { data, error } = await supabase.functions.invoke('gerar-textos-proposta', {
        body: { tipo, explicacao, titulo: p.titulo, cliente: dados.cliente.nome, local: dados.cliente.local, itens: dados.itens.map((i) => ({ letra: i.letra, descricao: i.descricao })) },
      });
      if (error) {
        const corpo = await (error as { context?: Response }).context?.json?.().catch(() => null);
        throw new Error(corpo?.erro ?? error.message);
      }
      alterar(aplicarTextosIA({ ...doc, explicacao }, (data as { textos: TextosIA }).textos));
      setMsg({ tipo: 'info', texto: 'Textos gerados pela IA. Revise antes de gerar o PDF: a IA pode errar detalhes técnicos.' });
    } catch (e) { setMsg({ tipo: 'erro', texto: mensagemErro(e) }); }
    setPensando(false);
  }

  // Decisão 81: refazer com a IA só uma seção, com um pedido de ajuste opcional.
  async function gerarSecaoComIA(secaoId: string, pedido: string) {
    if (!doc || !dados) return;
    const s = doc.secoes.find((x) => x.id === secaoId);
    if (!s) return;
    if (explicacao.trim().length < 15) return setMsg({ tipo: 'erro', texto: 'Antes, explique a proposta no quadro "Gerar textos com IA" (o que será feito, para quem e onde).' });
    setMsg(null); setPensando(true);
    try {
      const { data, error } = await supabase.functions.invoke('gerar-textos-proposta', {
        body: { tipo, explicacao: explicacaoParaSecao(explicacao, s, pedido), titulo: p.titulo, cliente: dados.cliente.nome, local: dados.cliente.local, itens: dados.itens.map((i) => ({ letra: i.letra, descricao: i.descricao })) },
      });
      if (error) {
        const corpo = await (error as { context?: Response }).context?.json?.().catch(() => null);
        throw new Error(corpo?.erro ?? error.message);
      }
      alterar(aplicarTextosIASecao({ ...doc, explicacao }, (data as { textos: TextosIA }).textos, secaoId));
      setMsg({ tipo: 'info', texto: `Seção "${s.titulo}" refeita pela IA. As outras não mudaram. Revise antes de gerar o PDF.` });
    } catch (e) { setMsg({ tipo: 'erro', texto: mensagemErro(e) }); }
    setPensando(false);
  }

  function restaurar() {
    if (!padroes || !confirm(`Voltar a proposta ${tipo === 'tecnica' ? 'técnica' : 'comercial'} para os textos padrão? O que foi escrito nesta revisão será substituído.`)) return;
    alterar(padroes[tipo]);
  }

  if (isLoading || !padroes || !doc) return <EsqueletoDetalhe />;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded-lg bg-pagina p-0.5 ring-1 ring-borda">
          {(['tecnica', 'comercial'] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTipo(t)}
              className={`rounded-md px-3 py-1.5 text-sm ${tipo === t ? 'bg-superficie font-semibold text-roxo-600 shadow-sm dark:text-roxo-100' : 'text-suave'}`}>
              {t === 'tecnica' ? 'Proposta técnica' : 'Proposta comercial'}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {salvando && <span className="text-xs text-suave">{salvando === 'salvando' ? 'Salvando…' : 'Salvo'}</span>}
          <Botao variante="secundario" className="lg:hidden" onClick={() => setVerPrevia(!verPrevia)}>{verPrevia ? <><PencilLine size={15} /> Editar</> : <><Eye size={15} /> Prévia</>}</Botao>
          {editavel && <Botao variante="secundario" onClick={restaurar}><RotateCcw size={15} /> Textos padrão</Botao>}
          <Botao variante="secundario" onClick={() => gerarPdf(false)} disabled={gerando || !dados}><Download size={15} /> Baixar PDF</Botao>
          {editavel && <Botao onClick={() => gerarPdf(true)} disabled={gerando || !dados}><FileCheck2 size={15} /> {gerando ? 'Gerando…' : 'Gerar e anexar PDF'}</Botao>}
        </div>
      </div>
      {!editavel && <Aviso tipo="info">{rev?.status === 'enviada' ? `A R${p.revisao_atual} já foi enviada: os textos ficam como foram enviados. Para mudar, crie uma nova revisão.` : 'Somente leitura.'}</Aviso>}
      {editavel && (
        <div className="rounded-xl bg-roxo-50/60 p-3 ring-1 ring-roxo-100 dark:bg-roxo-500/10 dark:ring-roxo-500/30">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold"><Sparkles size={15} className="text-roxo-600 dark:text-roxo-100" /> Explique a proposta</div>
          <AreaTexto rows={3} value={explicacao} onChange={(e) => alterar({ ...doc, explicacao: e.target.value })}
            placeholder="Ex.: proposta técnica para a SYMRISE de Descalvado-SP: desenvolvimento de um sistema de vedação pneumática por meio de um perfil de borracha com geometria em “H”, associado a um ponto de conexão para ar comprimido, visando vedar e evitar vazamentos." />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-suave">Vai para a OpenAI só a explicação, o cliente, o local e os itens. Preços e dados de contato não vão.</span>
            <Botao onClick={gerarComIA} disabled={pensando || !dados}><Sparkles size={15} /> {pensando ? 'Escrevendo… (até 1 min)' : `Gerar textos com IA (${tipo === 'tecnica' ? 'técnica' : 'comercial'})`}</Botao>
          </div>
        </div>
      )}
      {msg && <Aviso tipo={msg.tipo === 'info' ? 'info' : undefined}>{msg.texto}</Aviso>}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className={verPrevia ? 'hidden lg:block' : ''}>
          <EditorDocumento doc={doc} onChange={alterar} editavel={editavel} itens={itensResumo} imagens={imagens} valores={acoesValor} capaDados={{ titulo: p.titulo, descricao: p.descricao ?? '' }}
            ia={editavel ? { refazer: gerarSecaoComIA, pensando } : undefined} />
        </div>
        <div className={`lg:sticky lg:top-0 lg:h-[calc(100vh-9rem)] ${verPrevia ? '' : 'hidden lg:block'}`}>
          {dados ? <Suspense fallback={<EsqueletoPagina />}><Previa doc={doc} dados={dados} empresa={padroes.empresa} imagens={urls} tecnica={tipo === 'comercial' ? docs.tecnica : null} /></Suspense> : <EsqueletoPagina />}
        </div>
      </div>
    </div>
  );
}
