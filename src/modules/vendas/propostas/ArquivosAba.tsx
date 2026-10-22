import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Paperclip, Trash2, Upload } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { dataBR, mensagemErro } from '@/shared/lib/formato';
import { Aviso, Selo, Vazio } from '@/shared/ui';
import { abrirArquivo, enviarArquivoRevisao, listarArquivos, listarRevisoes, removerArquivo } from '../api';
import type { Arquivo, Proposta, Revisao } from '../types';
import { rotuloRevisao } from './regras';

// Aba Arquivos da proposta (decisão 70), com 3 sub-abas no estilo do Windows 11:
// Propostas (PDFs técnica e comercial, um card por revisão com a lista recolhida), Anexos (técnicos e comerciais) e Aprovação.
const SUBABAS = ['Propostas', 'Anexos', 'Aprovação'] as const;

export function ArquivosAba({ p, aprovacao }: { p: Proposta; aprovacao: ReactNode }) {
  const [sub, setSub] = useState<(typeof SUBABAS)[number]>('Propostas');
  const { pode } = useAuth();
  const qc = useQueryClient();
  const [erro, setErro] = useState('');
  const { data: revisoes = [] } = useQuery({ queryKey: ['proposta', p.id, 'revisoes', p.revisao_atual, p.status], queryFn: () => listarRevisoes(p.id) });
  const { data: arquivos = [] } = useQuery({
    queryKey: ['proposta', p.id, 'arquivos', revisoes.map((r) => r.id).join()],
    queryFn: () => listarArquivos(revisoes.map((r) => r.id)),
    enabled: revisoes.length > 0,
  });
  const atual = revisoes.find((r) => r.numero === p.revisao_atual);
  const podeEditar = (r?: Revisao) => r?.status === 'rascunho' && pode('vendas', 'editar');
  const recarregar = () => {
    qc.invalidateQueries({ queryKey: ['proposta', p.id, 'arquivos'] });
    qc.invalidateQueries({ queryKey: ['proposta_documentos_dados', p.id] }); // anexos saem no PDF
  };
  const up = useMutation({
    mutationFn: ({ tipo, file }: { tipo: Arquivo['tipo']; file: File }) => enviarArquivoRevisao(p.id, atual!.id, tipo, file),
    onSuccess: recarregar, onError: (e) => setErro(mensagemErro(e)),
  });
  const rm = useMutation({ mutationFn: removerArquivo, onSuccess: recarregar, onError: (e) => setErro(mensagemErro(e)) });
  const abrir = (a: Arquivo) => abrirArquivo(a.caminho).catch((e) => setErro(mensagemErro(e)));
  const ordenadas = [...revisoes].sort((a, b) => b.numero - a.numero);

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-xl bg-pagina p-1 ring-1 ring-borda" role="tablist">
        {SUBABAS.map((a) => (
          <button key={a} type="button" role="tab" aria-selected={sub === a} onClick={() => setSub(a)}
            className={`relative rounded-lg px-4 py-1.5 text-sm transition-colors ${sub === a ? 'bg-superficie font-semibold text-texto shadow-sm ring-1 ring-borda' : 'text-suave hover:text-texto'}`}>
            {a}
            {sub === a && <span className="absolute inset-x-1/3 -bottom-0.5 h-[3px] rounded-full bg-roxo-500" />}
          </button>
        ))}
      </div>
      {erro && <Aviso>{erro}</Aviso>}

      {sub === 'Propostas' && (
        <div className="grid gap-4 md:grid-cols-2">
          {(['tecnica', 'comercial'] as const).map((tipo) => (
            <div key={tipo} className="space-y-2">
              <div className="text-sm font-semibold">{tipo === 'tecnica' ? 'Proposta técnica' : 'Proposta comercial'}</div>
              {ordenadas.map((r) => (
                <CardRevisao key={r.id} r={r} arquivos={arquivos.filter((a) => a.revisao_id === r.id && a.tipo === tipo)}
                  onAbrir={abrir} onRemover={podeEditar(r) ? (a) => rm.mutate(a) : undefined} />
              ))}
              <p className="text-xs text-suave">Os PDFs entram aqui pelo botão “Gerar e anexar PDF” da aba Documentos.</p>
            </div>
          ))}
        </div>
      )}

      {sub === 'Anexos' && (
        <div className="grid gap-4 md:grid-cols-2">
          {([['documento_tecnico', 'Anexos técnicos', 'Saem em cards na seção Anexo da proposta técnica.'], ['anexo', 'Anexos comerciais', 'Saem em cards nos Anexos da proposta comercial.']] as const).map(([tipo, titulo, ajuda]) => {
            const lista = arquivos.filter((a) => a.tipo === tipo);
            return (
              <div key={tipo} className="space-y-2 rounded-xl p-3 ring-1 ring-borda">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold">{titulo}</div>
                  {podeEditar(atual) && (
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-roxo-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-roxo-600">
                      <Upload size={14} /> {up.isPending && up.variables?.tipo === tipo ? 'Enviando…' : `Anexar à ${rotuloRevisao(p.revisao_atual)}`}
                      <input type="file" multiple className="hidden" onChange={(e) => { [...(e.target.files ?? [])].forEach((file) => up.mutate({ tipo, file })); e.target.value = ''; }} />
                    </label>
                  )}
                </div>
                <p className="text-xs text-suave">{ajuda} Vale o que está na revisão atual ({rotuloRevisao(p.revisao_atual)}).</p>
                {lista.length === 0 ? <Vazio>Nenhum arquivo.</Vazio> : (
                  <div className="space-y-1.5">
                    {lista.map((a) => {
                      const r = revisoes.find((x) => x.id === a.revisao_id);
                      return <LinhaArquivo key={a.id} a={a} selo={r ? rotuloRevisao(r.numero) : ''} onAbrir={() => abrir(a)} onRemover={podeEditar(r) ? () => rm.mutate(a) : undefined} />;
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {sub === 'Aprovação' && aprovacao}
    </div>
  );
}

function CardRevisao({ r, arquivos, onAbrir, onRemover }: { r: Revisao; arquivos: Arquivo[]; onAbrir: (a: Arquivo) => void; onRemover?: (a: Arquivo) => void }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="rounded-xl bg-superficie ring-1 ring-borda">
      <button type="button" onClick={() => setAberto(!aberto)} className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left">
        <span className="flex items-center gap-2">
          {aberto ? <ChevronDown size={15} className="text-suave" /> : <ChevronRight size={15} className="text-suave" />}
          <span className="font-semibold">{rotuloRevisao(r.numero)}</span>
          {r.status === 'enviada' ? <Selo cor="verde">Enviada {dataBR(r.enviada_em)}</Selo> : <Selo cor="amarelo">Rascunho</Selo>}
        </span>
        <span className="text-xs text-suave">{arquivos.length} arquivo{arquivos.length === 1 ? '' : 's'}</span>
      </button>
      {aberto && (
        <div className="space-y-1.5 border-t border-borda p-2">
          {arquivos.length === 0 ? <div className="px-1 py-1 text-sm text-suave">Sem arquivos nesta revisão.</div>
            : arquivos.map((a) => <LinhaArquivo key={a.id} a={a} onAbrir={() => onAbrir(a)} onRemover={onRemover ? () => onRemover(a) : undefined} />)}
        </div>
      )}
    </div>
  );
}

// Ícone do arquivo com a extensão colorida (mesmas cores dos cards do PDF).
const CORES: Record<string, string> = { PDF: 'bg-red-600', DWG: 'bg-blue-600', DXF: 'bg-blue-600', STEP: 'bg-blue-600', STP: 'bg-blue-600', XLS: 'bg-green-600', XLSX: 'bg-green-600', CSV: 'bg-green-600', DOC: 'bg-blue-700', DOCX: 'bg-blue-700', JPG: 'bg-violet-500', JPEG: 'bg-violet-500', PNG: 'bg-violet-500', ZIP: 'bg-slate-600', RAR: 'bg-slate-600' };
export function IconeArquivo({ nome }: { nome: string }) {
  const ext = (nome.match(/\.([a-z0-9]{1,5})$/i)?.[1] ?? '').toUpperCase();
  return (
    <span className="relative inline-flex h-9 w-7 shrink-0 items-center justify-center rounded-[4px] bg-white ring-1 ring-borda dark:bg-marinho-700">
      {ext ? <span className={`absolute -left-1 bottom-1 rounded-[3px] px-1 text-[8px] font-bold leading-[12px] text-white ${CORES[ext] ?? 'bg-roxo-500'}`}>{ext.slice(0, 4)}</span> : <Paperclip size={13} className="text-suave" />}
    </span>
  );
}
const tamanho = (b: number) => (b >= 1048576 ? `${(b / 1048576).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

function LinhaArquivo({ a, selo, onAbrir, onRemover }: { a: Arquivo; selo?: string; onAbrir: () => void; onRemover?: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-pagina px-2.5 py-2 ring-1 ring-borda">
      <IconeArquivo nome={a.nome} />
      <button type="button" onClick={onAbrir} className="min-w-0 flex-1 text-left">
        <div className="truncate text-sm font-medium hover:text-roxo-600 dark:hover:text-roxo-100">{a.nome}</div>
        <div className="text-xs text-suave">{[selo, tamanho(a.tamanho), dataBR(a.criado_em)].filter(Boolean).join(' · ')}</div>
      </button>
      {onRemover && <button type="button" onClick={() => confirm(`Apagar “${a.nome}”?`) && onRemover()} className="rounded p-1 text-suave hover:text-red-600" title="Apagar"><Trash2 size={15} /></button>}
    </div>
  );
}
