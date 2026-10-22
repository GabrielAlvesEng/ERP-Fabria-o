import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BellOff, BellRing, Send, Share, Smartphone, SquarePlus } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { dataHoraBR, mensagemErro } from '@/shared/lib/formato';
import { supabase } from '@/shared/lib/supabase';
import { Aviso, Botao, Selo } from '@/shared/ui';
import { chamarEnvio } from './api';
import { ativarNesteAparelho, desativarNesteAparelho, useSituacaoAparelho } from './push';

// "Receba os comunicados no celular": ativa o aviso neste aparelho, com o passo a passo do iPhone.
// compacto = cartão no topo da Caixa de entrada (some quando já está ativo); completo = seção do Meu perfil.
export function CelularAviso({ compacto = false }: { compacto?: boolean }) {
  const { situacao, atualizar } = useSituacaoAparelho();
  const qc = useQueryClient();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [info, setInfo] = useState('');

  async function fazer(f: () => Promise<unknown>, msg?: string) {
    setErro(''); setInfo(''); setOcupado(true);
    try { await f(); if (msg) setInfo(msg); } catch (e) { setErro(mensagemErro(e)); }
    await atualizar();
    await qc.invalidateQueries({ queryKey: ['comunicacao', 'aparelhos'] });
    setOcupado(false);
  }

  if (!situacao || (compacto && (situacao === 'ativo' || situacao === 'sem-suporte'))) return null;

  const conteudo = {
    'iphone-instalar': (
      <div className="space-y-2 text-sm">
        <p>No iPhone, o aviso só chega com o ERP na tela de início:</p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>No Safari, toque em <Share size={14} className="inline align-text-bottom" /> <b>Compartilhar</b>.</li>
          <li>Toque em <SquarePlus size={14} className="inline align-text-bottom" /> <b>Adicionar à Tela de Início</b> e confirme.</li>
          <li>Abra o ERP pelo ícone novo, entre com o seu login e toque em <b>Ativar avisos</b>.</li>
        </ol>
        <p className="text-xs text-suave">Precisa do iOS 16.4 ou mais novo.</p>
      </div>
    ),
    'sem-suporte': <p className="text-sm">Este navegador não recebe avisos. No celular, use o Chrome (Android) ou o Safari (iPhone).</p>,
    bloqueado: <p className="text-sm">As notificações do ERP estão bloqueadas neste aparelho. Toque no cadeado ao lado do endereço (ou em Configurações → Notificações) e permita para este site; depois toque em <b>Ativar avisos</b>.</p>,
    desligado: <p className="text-sm">Ative para receber os comunicados na tela do celular, mesmo com o ERP fechado.{!compacto && ' Ative em cada aparelho que você usa.'}</p>,
    ativo: <p className="text-sm">Os comunicados chegam neste aparelho.</p>,
  }[situacao];

  return (
    <div className={compacto ? 'rounded-xl bg-roxo-50 p-4 ring-1 ring-roxo-100 dark:bg-roxo-700/20 dark:ring-roxo-700/40' : ''}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 gap-3">
          <span className="mt-0.5 shrink-0 text-roxo-500 dark:text-roxo-300"><Smartphone size={20} /></span>
          <div className="min-w-0">
            {compacto && <div className="mb-1 font-semibold">Receba os comunicados no celular</div>}
            {conteudo}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(situacao === 'desligado' || situacao === 'bloqueado') && (
            <Botao tamanho="sm" disabled={ocupado} onClick={() => fazer(ativarNesteAparelho, 'Pronto: os avisos estão ativos neste aparelho.')}>
              <BellRing size={14} /> {ocupado ? 'Ativando…' : 'Ativar avisos'}
            </Botao>
          )}
          {situacao === 'ativo' && !compacto && (
            <>
              <Botao variante="secundario" tamanho="sm" disabled={ocupado} onClick={() => fazer(async () => {
                const r = await chamarEnvio<{ aparelhos: number; ok: number }>({ acao: 'teste' });
                if (!r.ok) throw new Error('Nenhum aparelho recebeu o teste. Desative e ative de novo.');
              }, 'Teste enviado. Deve chegar em alguns segundos.')}><Send size={14} /> Enviar teste</Botao>
              <Botao variante="fantasma" tamanho="sm" disabled={ocupado} onClick={() => fazer(desativarNesteAparelho)}><BellOff size={14} /> Desativar neste aparelho</Botao>
            </>
          )}
        </div>
      </div>
      {erro && <div className="mt-3"><Aviso>{erro}</Aviso></div>}
      {info && <div className="mt-3"><Aviso tipo="info">{info}</Aviso></div>}
    </div>
  );
}

// Meu perfil → Notificações no celular: este aparelho e a lista dos outros ativados.
export function NotificacoesPerfil() {
  const { session } = useAuth();
  const { data: aparelhos = [] } = useQuery({
    queryKey: ['comunicacao', 'aparelhos', session?.user.id],
    enabled: Boolean(session),
    queryFn: async () => {
      const { data, error } = await supabase.from('push_aparelhos').select('id, nome, criado_em, ultimo_envio_em').eq('ativo', true).order('criado_em');
      if (error) throw error;
      return data as { id: string; nome: string; criado_em: string; ultimo_envio_em: string | null }[];
    },
  });
  return (
    <div className="rounded-xl bg-superficie p-5 shadow-sm ring-1 ring-borda">
      <h2 className="mb-3 flex items-center gap-1.5 font-semibold"><BellRing size={16} className="text-roxo-500 dark:text-roxo-300" /> Notificações no celular</h2>
      <CelularAviso />
      {aparelhos.length > 0 && (
        <ul className="mt-4 divide-y divide-borda border-t border-borda text-sm">
          {aparelhos.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="flex items-center gap-2"><Smartphone size={15} className="text-suave" /> {a.nome || 'Aparelho'}</span>
              <span className="text-xs text-suave">ativado em {dataHoraBR(a.criado_em)}{a.ultimo_envio_em && <> · último aviso {dataHoraBR(a.ultimo_envio_em)}</>}</span>
            </li>
          ))}
        </ul>
      )}
      {aparelhos.length === 0 && <div className="mt-3"><Selo>Nenhum aparelho ativado ainda</Selo></div>}
    </div>
  );
}
