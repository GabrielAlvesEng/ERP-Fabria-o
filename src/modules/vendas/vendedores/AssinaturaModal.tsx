import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FolderOpen, Upload } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { dataBR, mensagemErro } from '@/shared/lib/formato';
import { Aviso, Botao, Esqueleto, Modal } from '@/shared/ui';
import { importarAssinaturaOutlook, lerMinhaAssinatura, PASTA_ASSINATURAS, salvarMinhaAssinatura, type AssinaturaLida } from './assinatura';

// Prévia isolada (iframe sem scripts): a assinatura aparece como no e-mail, sem mexer no visual do ERP.
export function PreviaAssinatura({ html, altura = 160 }: { html: string; altura?: number }) {
  return (
    <iframe title="Prévia da assinatura" sandbox="" className="w-full rounded-lg bg-white ring-1 ring-borda" style={{ height: altura }}
      srcDoc={`<!doctype html><meta charset="utf-8"><body style="margin:12px;font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#1f2433">${html}</body>`} />
  );
}

export function useMinhaAssinatura() {
  const { session } = useAuth();
  return useQuery({ queryKey: ['minha_assinatura', session?.user.id], queryFn: () => lerMinhaAssinatura(session!.user.id), enabled: Boolean(session) });
}

// Importar a assinatura do Outlook (decisão 66): o próprio vendedor, no seu cartão em Vendas → Vendedores.
export function AssinaturaModal({ onFechar }: { onFechar: () => void }) {
  const qc = useQueryClient();
  const { data: atual, isLoading } = useMinhaAssinatura();
  const [lida, setLida] = useState<AssinaturaLida | null>(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const [arquivos, setArquivos] = useState<File[]>([]);
  // Escolher só imagens depois do .htm soma com o que já foi escolhido.
  async function escolher(lista: FileList | null) {
    setErro('');
    if (!lista?.length) return;
    const novos = [...lista];
    const juntos = novos.some((f) => /\.html?$/i.test(f.name)) ? novos : [...arquivos, ...novos];
    try { setLida(await importarAssinaturaOutlook(juntos)); setArquivos(juntos); } catch (e) { setErro(mensagemErro(e)); }
  }
  async function salvar(html: string) {
    setErro(''); setSalvando(true);
    try {
      await salvarMinhaAssinatura(html);
      await qc.invalidateQueries({ queryKey: ['minha_assinatura'] });
      onFechar();
    } catch (e) { setErro(mensagemErro(e)); }
    setSalvando(false);
  }

  return (
    <Modal aberto titulo="Minha assinatura de e-mail" onFechar={onFechar} largura="max-w-2xl">
      <div className="space-y-4 text-sm">
        {erro && <Aviso>{erro}</Aviso>}
        <p className="text-suave">Vai no fim de todo e-mail de proposta que você enviar pelo ERP, igual à do seu Outlook. Importe uma vez; se mudar a assinatura no Outlook, importe de novo.</p>

        <div className="rounded-xl bg-pagina p-3 ring-1 ring-borda">
          <div className="mb-1 flex items-center gap-1.5 font-semibold"><FolderOpen size={15} /> Onde está o arquivo</div>
          <ol className="ml-4 list-decimal space-y-0.5 text-xs text-suave">
            <li>Na janela de escolher arquivo, cole <code className="rounded bg-superficie px-1 text-texto">{PASTA_ASSINATURAS}</code> na barra de endereço e tecle Enter.</li>
            <li>Escolha o arquivo <b>.htm</b> com o nome da sua assinatura.</li>
            <li>Se a assinatura tem logo ou fotos: abra também a pasta <b>"nome_arquivos"</b> (ou "nome_files") e selecione as imagens junto, segurando Ctrl. Ou importe só o .htm e depois as imagens que o ERP pedir.</li>
          </ol>
          <label className="mt-3 inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-roxo-500 px-3.5 text-sm font-medium text-white shadow-sm hover:bg-roxo-600">
            <Upload size={15} /> {lida?.faltando.length ? 'Escolher as imagens que faltaram' : 'Escolher arquivo da assinatura'}
            <input type="file" multiple accept=".htm,.html,image/*" className="hidden" onChange={(e) => { escolher(e.target.files); e.target.value = ''; }} />
          </label>
        </div>

        {lida ? (
          <div className="space-y-2">
            <div className="text-xs font-medium text-suave">Prévia · {lida.nomeArquivo}</div>
            <PreviaAssinatura html={lida.html} altura={200} />
            {lida.faltando.length > 0 && (
              <Aviso>Faltaram {lida.faltando.length} imagem(ns): {lida.faltando.join(', ')}. Clique em "Escolher as imagens que faltaram" e selecione-as na pasta "_arquivos" (ou "_files"), ou use a assinatura assim mesmo, sem elas.</Aviso>
            )}
            <div className="flex justify-end gap-2">
              <Botao variante="secundario" onClick={() => { setLida(null); setArquivos([]); }}>Descartar</Botao>
              <Botao onClick={() => salvar(lida.html)} disabled={salvando}>{salvando ? 'Salvando…' : 'Usar esta assinatura'}</Botao>
            </div>
          </div>
        ) : isLoading ? <Esqueleto className="h-40 rounded-lg" /> : atual?.html ? (
          <div className="space-y-2">
            <div className="text-xs font-medium text-suave">Assinatura atual{atual.atualizada ? ` · importada em ${dataBR(atual.atualizada.slice(0, 10))}` : ''}</div>
            <PreviaAssinatura html={atual.html} />
            <div className="flex justify-end"><Botao variante="fantasma" className="text-red-600" onClick={() => salvar('')} disabled={salvando}>Tirar a assinatura</Botao></div>
          </div>
        ) : <p className="text-suave">Você ainda não importou uma assinatura. Sem ela, o e-mail vai só com o texto da mensagem.</p>}
      </div>
    </Modal>
  );
}
