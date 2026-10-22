import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Mail, X } from 'lucide-react';
import { supabase } from '@/shared/lib/supabase';
import { hojeISO, mensagemErro } from '@/shared/lib/formato';
import { AreaTexto, Aviso, Botao, Caixa, Campo, CampoData, Entrada, Modal } from '@/shared/ui';
import { listarArquivos, listarContatos, listarRevisoes, moverProposta } from '../api';
import type { Proposta } from '../types';
import { PreviaAssinatura, useMinhaAssinatura } from '../vendedores/AssinaturaModal';
import { assuntoProposta, baixarArquivo, blobParaBase64, codigoComRevisao, corpoPadrao, emailValido, montarEml, separarEmails, type Anexo } from './email';

export function EnviarEmailModal({ proposta, onFechar }: { proposta: Proposta; onFechar: () => void }) {
  const qc = useQueryClient();
  const { data: contatos = [] } = useQuery({ queryKey: ['contatos'], queryFn: listarContatos });
  const { data: revisoes = [] } = useQuery({ queryKey: ['proposta', proposta.id, 'revisoes', proposta.revisao_atual, proposta.status], queryFn: () => listarRevisoes(proposta.id) });
  const rev = revisoes.find((r) => r.numero === proposta.revisao_atual);
  const { data: arquivos = [] } = useQuery({ queryKey: ['proposta', proposta.id, 'arquivos', rev?.id], queryFn: () => listarArquivos([rev!.id]).then((l) => l.filter((a) => a.tipo !== 'imagem_documento')), enabled: Boolean(rev) });

  const { data: minhaAssinatura } = useMinhaAssinatura();
  const contato = contatos.find((c) => c.id === proposta.contato_id);
  const [para, setPara] = useState<string | null>(null);
  // O contato técnico da proposta (decisão 67) já entra em C/C; dá para tirar.
  const tecnico = contatos.find((c) => c.id === proposta.contato_tecnico_id);
  const [ccEscolhido, setCc] = useState<string[] | null>(null);
  const cc = ccEscolhido ?? (tecnico?.email && tecnico.id !== proposta.contato_id ? [tecnico.email] : []);
  const [ccLivre, setCcLivre] = useState('');
  const [assunto, setAssunto] = useState(assuntoProposta(proposta.codigo, proposta.revisao_atual, proposta.titulo));
  const [corpo, setCorpo] = useState<string | null>(null);
  const [anexosSel, setAnexosSel] = useState<Record<string, boolean>>({});
  const [data, setData] = useState(hojeISO());
  const [retorno, setRetorno] = useState('');
  const [gerarEmail, setGerarEmail] = useState(true);
  const [erro, setErro] = useState('');

  const paraValor = para ?? contato?.email ?? '';
  const corpoValor = corpo ?? corpoPadrao(contato?.nome ?? '', proposta.codigo, proposta.revisao_atual, proposta.titulo);
  const propostasPdf = arquivos.filter((a) => a.tipo === 'comercial' || a.tipo === 'tecnica');
  const anexoMarcado = (id: string, tipo: string) => anexosSel[id] ?? (tipo === 'comercial' || tipo === 'tecnica');
  const faltaComercial = !arquivos.some((a) => a.tipo === 'comercial');
  const faltaTecnica = !arquivos.some((a) => a.tipo === 'tecnica');

  // CC: só os contatos (com e-mail) da mesma empresa do contato da proposta.
  const empresaCc = contato?.empresa_id ?? proposta.empresa_id;
  const opcoesCc = useMemo(() => contatos
    .filter((c) => c.email && c.id !== proposta.contato_id && c.empresa_id === empresaCc)
    .sort((a, b) => a.nome.localeCompare(b.nome)), [contatos, proposta.contato_id, empresaCc]);
  const [buscaCc, setBuscaCc] = useState('');
  const filtradosCc = opcoesCc.filter((c) => !cc.includes(c.email) && (!buscaCc || `${c.nome} ${c.email} ${c.empresas?.nome_fantasia ?? ''}`.toLowerCase().includes(buscaCc.toLowerCase()))).slice(0, 8);

  const m = useMutation({
    mutationFn: async () => {
      const paraLista = separarEmails(paraValor);
      const ccLista = [...cc, ...separarEmails(ccLivre)];
      if (gerarEmail) {
        if (!paraLista.length) throw new Error('Informe o e-mail do destinatário.');
        const invalido = [...paraLista, ...ccLista].find((e) => !emailValido(e));
        if (invalido) throw new Error(`E-mail inválido: ${invalido}`);
      }
      // 1) prepara o e-mail com os anexos (se algo falhar aqui, a proposta não muda de etapa)
      let eml = '';
      if (gerarEmail) {
        const anexos: Anexo[] = [];
        for (const a of arquivos.filter((x) => anexoMarcado(x.id, x.tipo))) {
          const { data: blob, error } = await supabase.storage.from('vendas').download(a.caminho);
          if (error || !blob) throw new Error(`Não foi possível baixar o anexo ${a.nome}.`);
          anexos.push({ nome: a.nome, tipo: blob.type || 'application/pdf', base64: await blobParaBase64(blob) });
        }
        eml = montarEml({ para: paraLista, cc: ccLista, assunto, corpo: corpoValor, assinaturaHtml: minhaAssinatura?.html, anexos });
      }
      // 2) move para Enviados (congela a revisão) e registra para quem foi
      await moverProposta(proposta.id, 'Enviados', {
        data_envio: data,
        proximo_followup: retorno,
        observacao: gerarEmail
          ? `Enviada ao cliente por e-mail para ${paraLista.join(', ')}${ccLista.length ? ` (CC: ${ccLista.join(', ')})` : ''}.`
          : 'Enviada ao cliente (sem gerar e-mail pelo sistema).',
      });
      // 3) abre o rascunho
      if (gerarEmail) baixarArquivo(eml, `Proposta ${codigoComRevisao(proposta.codigo, proposta.revisao_atual)}.eml`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['propostas'] });
      qc.invalidateQueries({ queryKey: ['proposta'] });
      onFechar();
    },
    onError: (e) => setErro(mensagemErro(e)),
  });

  return (
    <Modal aberto titulo={`Enviar ao cliente · ${codigoComRevisao(proposta.codigo, proposta.revisao_atual)}`} onFechar={onFechar} largura="max-w-3xl">
      <form className="space-y-3" onSubmit={(e: FormEvent) => { e.preventDefault(); setErro(''); m.mutate(); }}>
        <Aviso tipo="info">Ao enviar, a revisão R{proposta.revisao_atual} fica congelada (dados, arquivos e custos). Ajustes depois disso geram nova revisão.</Aviso>
        {erro && <Aviso>{erro}</Aviso>}

        <Caixa marcado={gerarEmail} onChange={setGerarEmail}>Gerar o e-mail com os anexos</Caixa>

        {gerarEmail && (
          <>
            <Campo rotulo="Para"><Entrada value={paraValor} onChange={(e) => setPara(e.target.value)} placeholder="email@cliente.com.br" /></Campo>
            <Campo rotulo="CC (copiados)">
              <div className="rounded-lg border border-slate-300 p-2 dark:border-marinho-500">
                <div className="mb-1 flex flex-wrap gap-1">
                  {cc.map((e) => (
                    <span key={e} className="inline-flex items-center gap-1 rounded-full bg-roxo-50 px-2 py-0.5 text-xs text-roxo-700 dark:bg-roxo-700/30 dark:text-roxo-100">
                      {e}<button type="button" onClick={() => setCc(cc.filter((x) => x !== e))} aria-label="Remover"><X size={12} /></button>
                    </span>
                  ))}
                </div>
                {opcoesCc.length === 0 && <div className="px-1 py-1 text-xs text-suave">Nenhum outro contato com e-mail em {contato?.empresas?.nome_fantasia ?? 'nesta empresa'}.</div>}
                {opcoesCc.length > 0 && <input value={buscaCc} onChange={(e) => setBuscaCc(e.target.value)} placeholder={`Buscar contato de ${contato?.empresas?.nome_fantasia ?? 'da empresa'}…`} className="w-full bg-transparent px-1 py-1 text-sm outline-none" />}
                {buscaCc !== '' || cc.length === 0 ? (
                  <div className="mt-1 max-h-36 overflow-y-auto">
                    {filtradosCc.map((c) => (
                      <button type="button" key={c.id} onClick={() => { setCc([...cc, c.email]); setBuscaCc(''); }}
                        className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-sm hover:bg-slate-100 dark:hover:bg-marinho-700">
                        <span>{c.nome} <span className="text-xs text-suave">· {c.empresas?.nome_fantasia}</span></span>
                        <span className="text-xs text-suave">{c.email}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
                <input value={ccLivre} onChange={(e) => setCcLivre(e.target.value)} placeholder="Outros e-mails (separe por vírgula)" className="mt-1 w-full border-t border-borda bg-transparent px-1 pt-2 text-sm outline-none" />
              </div>
            </Campo>
            <Campo rotulo="Assunto"><Entrada value={assunto} onChange={(e) => setAssunto(e.target.value)} /></Campo>
            <Campo rotulo="Mensagem"><AreaTexto rows={9} value={corpoValor} onChange={(e) => setCorpo(e.target.value)} /></Campo>
            <div>
              <div className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-300">Assinatura</div>
              {minhaAssinatura?.html
                ? <><PreviaAssinatura html={minhaAssinatura.html} altura={120} /><p className="mt-1 text-xs text-suave">A sua, importada do Outlook. Para trocar: Vendas → Vendedores → Minha assinatura de e-mail.</p></>
                : <Aviso tipo="info">Você ainda não importou sua assinatura do Outlook: o e-mail vai sem assinatura. Importe uma vez em Vendas → Vendedores → Minha assinatura de e-mail.</Aviso>}
            </div>

            <div>
              <div className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-300">Anexos da R{proposta.revisao_atual}</div>
              {arquivos.length === 0 && <div className="text-sm text-suave">Nenhum arquivo anexado nesta revisão.</div>}
              <div className="space-y-1">
                {arquivos.map((a) => (
                  <Caixa key={a.id} marcado={anexoMarcado(a.id, a.tipo)} onChange={(v) => setAnexosSel({ ...anexosSel, [a.id]: v })}>
                    <FileText size={14} className="text-slate-400" /> {a.nome} <span className="text-xs text-suave">({a.tipo === 'comercial' ? 'proposta comercial' : a.tipo === 'tecnica' ? 'proposta técnica' : a.tipo === 'documento_tecnico' ? 'documento técnico' : 'anexo'})</span>
                  </Caixa>
                ))}
              </div>
              {(faltaComercial || faltaTecnica) && (
                <div className="mt-2"><Aviso>Falta anexar a proposta {[faltaComercial && 'comercial', faltaTecnica && 'técnica'].filter(Boolean).join(' e a ')} na aba "Revisões e arquivos". Você pode enviar mesmo assim.</Aviso></div>
              )}
              {propostasPdf.length > 0 && <div className="mt-1 text-xs text-suave">Os PDFs vão anexados ao e-mail.</div>}
            </div>
          </>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Data de envio"><CampoData value={data} onChange={setData} required /></Campo>
          <Campo rotulo="Próximo follow-up (vazio = 5 dias)"><CampoData value={retorno} onChange={setRetorno} /></Campo>
        </div>

        {gerarEmail && (
          <div className="rounded-lg bg-pagina p-3 text-xs text-slate-600 dark:text-slate-300">
            <div className="mb-1 flex items-center gap-1 font-semibold"><Mail size={13} /> Como o e-mail abre</div>
            O sistema baixa o arquivo <b>Proposta {codigoComRevisao(proposta.codigo, proposta.revisao_atual)}.eml</b>. Abra o arquivo:
            <ul className="ml-4 mt-1 list-disc">
              <li><b>Outlook (instalado no computador):</b> abre como mensagem nova, com anexos. Confira e clique em Enviar.</li>
              <li><b>Thunderbird:</b> abre a mensagem; use <b>Editar como nova mensagem</b> (Ctrl+E). Clique em Enviar.</li>
              <li><b>Outlook no navegador (365 web):</b> ainda não abre arquivos .eml. Use o Outlook instalado ou anexe os PDFs manualmente por enquanto.</li>
            </ul>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Botao type="button" variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao type="submit" disabled={m.isPending}>{m.isPending ? 'Preparando…' : gerarEmail ? 'Enviar e abrir e-mail' : 'Marcar como enviada'}</Botao>
        </div>
      </form>
    </Modal>
  );
}
