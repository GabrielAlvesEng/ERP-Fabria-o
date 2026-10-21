import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FolderOpen, FolderPlus, Search } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { dataBR, mensagemErro } from '@/shared/lib/formato';
import { Aviso, Botao, Cabecalho, Cartao, Entrada, EsqueletoCartoes, Selo, Vazio } from '@/shared/ui';
import { criarProjeto, listarProjetos, propostasSemProjeto } from './api';
import type { Projeto } from './regras';

export const NOME_STATUS_PROJETO: Record<Projeto['status'], string> = { em_andamento: 'Em andamento', pausado: 'Pausado', concluido: 'Concluído', cancelado: 'Cancelado' };
export const COR_STATUS_PROJETO: Record<Projeto['status'], 'roxo' | 'amarelo' | 'verde' | 'vermelho'> = { em_andamento: 'roxo', pausado: 'amarelo', concluido: 'verde', cancelado: 'vermelho' };

export function ProjetosPage() {
  const { pode } = useAuth();
  const qc = useQueryClient();
  const navegar = useNavigate();
  const [busca, setBusca] = useState('');
  const [erro, setErro] = useState('');
  const { data: projetos = [], isLoading } = useQuery({ queryKey: ['projetos'], queryFn: listarProjetos });
  const { data: aguardando = [] } = useQuery({ queryKey: ['propostas_sem_projeto'], queryFn: propostasSemProjeto });

  const abrir = useMutation({
    mutationFn: criarProjeto,
    onSuccess: (p) => { qc.invalidateQueries({ queryKey: ['projetos'] }); qc.invalidateQueries({ queryKey: ['propostas_sem_projeto'] }); navegar(`/engenharia/projetos/${p.id}`); },
    onError: (e) => setErro(mensagemErro(e)),
  });

  const t = busca.toLowerCase();
  const lista = projetos.filter((p) => !t || `${p.codigo} ${p.titulo} ${p.empresas?.nome_fantasia ?? ''}`.toLowerCase().includes(t));

  return (
    <>
      <Cabecalho titulo="Projetos" subtitulo="Cada proposta aprovada vira um projeto com o mesmo código." />
      {erro && <div className="mb-3"><Aviso>{erro}</Aviso></div>}

      {aguardando.length > 0 && (
        <Cartao className="mb-5 border-l-4 border-l-roxo-500">
          <div className="mb-2 flex items-center gap-2 font-semibold"><FolderPlus size={17} className="text-roxo-500" /> Propostas aprovadas aguardando projeto <Selo cor="roxo">{aguardando.length}</Selo></div>
          <div className="divide-y divide-borda">
            {aguardando.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <div><span className="font-mono font-semibold text-roxo-600 dark:text-roxo-100">{p.codigo}</span> · {p.titulo} <span className="text-suave">· {p.empresas?.nome_fantasia}</span></div>
                {pode('engenharia', 'criar') && (
                  <Botao onClick={() => abrir.mutate(p.id)} disabled={abrir.isPending}><FolderOpen size={15} /> Abrir projeto</Botao>
                )}
              </div>
            ))}
          </div>
        </Cartao>
      )}

      <div className="relative mb-4 max-w-sm">
        <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
        <Entrada placeholder="Buscar por código, título ou cliente" className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>

      {isLoading ? <EsqueletoCartoes /> : lista.length === 0 ? (
        <Vazio>Nenhum projeto ainda. Quando uma proposta for aprovada, ela aparece acima para abrir o projeto.</Vazio>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {lista.map((p) => (
            <Link key={p.id} to={`/engenharia/projetos/${p.id}`} className="group rounded-2xl bg-superficie p-4 shadow-sm ring-1 ring-borda transition hover:-translate-y-0.5 hover:shadow-md hover:ring-roxo-500">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-bold text-roxo-600 dark:text-roxo-100">{p.codigo}</span>
                <Selo cor={COR_STATUS_PROJETO[p.status]}>{NOME_STATUS_PROJETO[p.status]}</Selo>
              </div>
              <div className="mt-2 line-clamp-2 font-semibold">{p.titulo}</div>
              <div className="mt-1 text-sm text-suave">{p.empresas?.nome_fantasia}</div>
              <div className="mt-3 text-xs text-suave">Aberto em {dataBR(p.criado_em)}{p.prazo && ` · prazo ${dataBR(p.prazo)}`}</div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
