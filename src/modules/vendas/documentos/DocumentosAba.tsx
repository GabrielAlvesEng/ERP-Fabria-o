import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Eye, PencilLine, RotateCcw } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { mensagemErro } from '@/shared/lib/formato';
import { Aviso, Botao, EsqueletoDetalhe, EsqueletoPagina } from '@/shared/ui';
import { atualizarRascunho, listarRevisoes } from '@/modules/vendas/api';
import { atualizarItem, criarItem } from '@/modules/vendas/custos/api';
import type { Proposta } from '@/modules/vendas/types';
import { carregarImagens, dadosDaProposta, enviarImagem, lerDocumentos, lerPadroes, salvarDocumento } from './api';
import { EditorDocumento } from './EditorDocumento';
import { aplicarDiferenca, diferencaDocumento, juntarDiferencas, type DiferencaDoc } from './aoVivoDoc';
import { useDigitandoAoVivo } from '../aoVivo';
import { completarDocumento, fixarSecoesDoModelo, imagensDoDocumento, nomeArquivo, paraEscolher, type Documento, type TipoDocumento } from './modelo';

const Previa = lazy(() => import('./Previa'));
const SEM_IMAGENS: Record<string, string> = {};
// Envio agrupado: troca de documento (técnica ↔ comercial) no meio do grupo manda só o último.
const juntarPorTipo = (a: { tipo: TipoDocumento; dif: DiferencaDoc } | null, b: { tipo: TipoDocumento; dif: DiferencaDoc }) =>
  a && a.tipo === b.tipo ? { tipo: b.tipo, dif: juntarDiferencas(a.dif, b.dif) } : b;

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
  // Salva sozinho 1 s depois da última alteração.
  const pendente = useRef<Partial<Record<TipoDocumento, Documento>>>({});
  const gravando = useRef<Partial<Record<TipoDocumento, boolean>>>({});
  const recebido = useRef<Partial<Record<TipoDocumento, number>>>({});
  useEffect(() => {
    if (!salvos || !padroes) return;
    // Documento salvo numa versão antiga do modelo é convertido com os padrões atuais (decisão 67).
    // Decisão 98: documento ainda não salvo (proposta nova) vem do modelo com as seções editáveis por escolher.
    const montar = (t: TipoDocumento) => {
      const d = fixarSecoesDoModelo(completarDocumento(salvos[t], t, padroes[t]), padroes[t]);
      return !salvos[t] && editavel ? paraEscolher(d) : d;
    };
    const doBanco = { tecnica: montar('tecnica'), comercial: montar('comercial') };
    // Ao vivo (decisão 83): o que outra pessoa salvou entra na tela, menos no documento com alteração daqui ainda não gravada.
    setDocs((atual) => {
      // Também fica o que chegou ao vivo há pouco: o banco pode estar um pouco atrás do que a outra pessoa já digitou.
      const manter = (t: TipoDocumento) => Boolean(atual[t] && (pendente.current[t] || gravando.current[t] || Date.now() - (recebido.current[t] ?? 0) < 3000));
      return { tecnica: manter('tecnica') ? atual.tecnica : doBanco.tecnica, comercial: manter('comercial') ? atual.comercial : doBanco.comercial };
    });
  }, [salvos, padroes, editavel]);
  const doc = docs[tipo];

  const [salvando, setSalvando] = useState<'' | 'salvando' | 'salvo'>('');
  useEffect(() => {
    if (!editavel || !rev || !Object.keys(pendente.current).length) return;
    const t = setTimeout(async () => {
      const lote = pendente.current; pendente.current = {};
      setSalvando('salvando');
      try {
        for (const [k, d] of Object.entries(lote)) {
          gravando.current[k as TipoDocumento] = true;
          try { await salvarDocumento(rev.id, k as TipoDocumento, d!); } finally { gravando.current[k as TipoDocumento] = false; }
        }
        setSalvando('salvo');
      } catch (e) { setMsg({ tipo: 'erro', texto: mensagemErro(e) }); setSalvando(''); }
    }, 1000);
    return () => clearTimeout(t);
  }, [docs, editavel, rev]);
  // Ao vivo enquanto digita (decisão 85): o que mudou vai para quem está com o mesmo documento aberto. O que chega
  // entra na tela e também no que falta salvar daqui, para o salvamento de um não apagar o texto do outro.
  const enviarAoVivo = useDigitandoAoVivo<{ tipo: TipoDocumento; dif: DiferencaDoc }>(p.id, `documento:${rev?.id ?? ''}`,
    juntarPorTipo, ({ tipo: t, dif }) => {
      recebido.current[t] = Date.now();
      setDocs((x) => ({ ...x, [t]: aplicarDiferenca(x[t], dif) }));
      if (pendente.current[t]) pendente.current[t] = aplicarDiferenca(pendente.current[t], dif);
    });
  const gravar = (t: TipoDocumento, d: Documento, antes: Documento | undefined) => {
    const dif = editavel ? diferencaDocumento(antes, d) : null;
    if (dif) enviarAoVivo({ tipo: t, dif });
    pendente.current[t] = d; setDocs((x) => ({ ...x, [t]: d }));
  };
  // Decisão 142: técnica e comercial são editadas na mesma lista; a capa é uma só (o que muda nela vale para as duas).
  const alterarDoc = (t: TipoDocumento, d: Documento) => {
    gravar(t, d, docs[t]);
    const outro = docs[t === 'tecnica' ? 'comercial' : 'tecnica'];
    if (outro && d.capa.imagem !== outro.capa.imagem && d.capa.imagem !== docs[t]?.capa.imagem) {
      gravar(outro.tipo, { ...outro, capa: { ...outro.capa, imagem: d.capa.imagem } }, outro);
    }
  };

  // Imagens usadas nos dois documentos, baixadas uma vez (o PDF é montado no navegador).
  const caminhos = useMemo(() => [...new Set([docs.tecnica, docs.comercial].flatMap((d) => (d ? imagensDoDocumento(d) : [])))].sort(), [docs]);
  const { data: urlsBaixadas } = useQuery({ queryKey: ['proposta_documentos_imagens', caminhos.join('|')], queryFn: () => carregarImagens(caminhos), enabled: caminhos.length > 0, staleTime: Infinity });
  const urls = urlsBaixadas ?? SEM_IMAGENS;
  const imagens = useMemo(() => (rev && editavel ? { enviar: (f: File) => enviarImagem(p.id, rev.id, f), urls } : undefined), [rev, editavel, p.id, urls]);

  const itensResumo = useMemo(() => dados?.itens ?? [], [dados]);

  // Decisões 71 e 99: valor unitário de cada item digitado na área Valores da comercial (vai para custo_itens.valor_manual, o mesmo da aba Custos).
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
        const total = (dados?.itens ?? []).reduce((a, i) => a + (i.id === id ? (valor != null ? valor * (i.quantidade || 1) : i.calculado ?? i.valor) : i.valor), 0);
        await aposValor(total);
      } catch (e) { setMsg({ tipo: 'erro', texto: mensagemErro(e) }); } finally { setSalvandoValor(false); }
    },
    criarItem: async () => {
      setSalvandoValor(true); setMsg(null);
      try { await criarItem(rev.id, [], p.titulo); await aposValor(null); } catch (e) { setMsg({ tipo: 'erro', texto: mensagemErro(e) }); } finally { setSalvandoValor(false); }
    },
  } : undefined), [editavel, rev, salvandoValor, dados, p.id, p.status, p.titulo]); // eslint-disable-line react-hooks/exhaustive-deps

  // Decisão 144: o PDF anexado é gerado sozinho ao enviar a proposta (decisão 124); aqui só se baixa o que está na prévia.
  async function baixarPdf() {
    if (!doc || !dados || !padroes) return;
    setMsg(null); setGerando(true);
    try {
      const { gerarBlob } = await import('./Previa');
      const blob = await gerarBlob(doc, dados, padroes.empresa, urls, docs.tecnica);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = nomeArquivo(p.codigo, p.revisao_atual, p.titulo, tipo);
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch (e) { setMsg({ tipo: 'erro', texto: mensagemErro(e) }); }
    setGerando(false);
  }

  function restaurar() {
    if (!padroes || !confirm('Voltar a proposta técnica e a comercial para os textos padrão? O que foi escrito nesta revisão será substituído.')) return;
    gravar('tecnica', padroes.tecnica, docs.tecnica);
    gravar('comercial', padroes.comercial, docs.comercial);
  }

  if (isLoading || !padroes || !doc || !docs.tecnica || !docs.comercial) return <EsqueletoDetalhe />;
  const seletor = (
    <div className="flex rounded-lg bg-pagina p-0.5 ring-1 ring-borda">
      {(['tecnica', 'comercial'] as const).map((t) => (
        <button key={t} type="button" onClick={() => setTipo(t)}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${tipo === t ? 'bg-superficie font-semibold text-roxo-600 shadow-sm dark:text-roxo-100' : 'text-suave'}`}>
          {t === 'tecnica' ? 'Proposta técnica' : 'Proposta comercial'}
        </button>
      ))}
    </div>
  );
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {salvando && <span className="text-xs text-suave">{salvando === 'salvando' ? 'Salvando…' : 'Salvo'}</span>}
          <Botao variante="secundario" className="lg:hidden" onClick={() => setVerPrevia(!verPrevia)}>{verPrevia ? <><PencilLine size={15} /> Editar</> : <><Eye size={15} /> Prévia</>}</Botao>
          {editavel && <Botao variante="secundario" onClick={restaurar}><RotateCcw size={15} /> Textos padrão</Botao>}
        </div>
      </div>
      {!editavel && <Aviso tipo="info">{rev?.status === 'enviada' ? `A R${p.revisao_atual} já foi enviada: os textos ficam como foram enviados. Para mudar, crie uma nova revisão.` : 'Somente leitura.'}</Aviso>}
      {msg && <Aviso tipo={msg.tipo === 'info' ? 'info' : undefined}>{msg.texto}</Aviso>}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className={verPrevia ? 'hidden lg:block' : ''}>
          {/* Decisão 142: uma lista só, com as seções da técnica e, no fim, as da comercial (Forma de pagamento e Valores). */}
          <div className="space-y-3">
            <EditorDocumento doc={docs.tecnica} onChange={(d) => alterarDoc('tecnica', d)} editavel={editavel} itens={itensResumo} imagens={imagens} valores={acoesValor} capaDados={{ titulo: p.titulo, descricao: p.descricao ?? '' }}
/>
            <EditorDocumento doc={docs.comercial} onChange={(d) => alterarDoc('comercial', d)} editavel={editavel} itens={itensResumo} imagens={imagens} valores={acoesValor} soSecoes
/>
          </div>
        </div>
        <div className={`flex flex-col gap-2 lg:sticky lg:top-0 lg:h-[calc(100vh-9rem)] ${verPrevia ? '' : 'hidden lg:flex'}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            {seletor}
            <div className="flex flex-wrap items-center gap-2">
              <Botao variante="secundario" tamanho="sm" onClick={baixarPdf} disabled={gerando || !dados}><Download size={15} /> {gerando ? 'Gerando…' : 'Baixar PDF'}</Botao>
            </div>
          </div>
          <div className="min-h-0 flex-1">
          {dados ? <Suspense fallback={<EsqueletoPagina />}><Previa doc={doc} dados={dados} empresa={padroes.empresa} imagens={urls} tecnica={tipo === 'comercial' ? docs.tecnica : null} /></Suspense> : <EsqueletoPagina />}
          </div>
        </div>
      </div>
    </div>
  );
}
