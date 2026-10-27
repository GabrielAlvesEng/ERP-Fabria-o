import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { hojeISO } from '@/shared/lib/formato';
import { listarDecisoes, listarFeriados, listarJustificativas, listarMarcacoes, useConfigPonto, type Marcacao, type PessoaPonto } from './api';
import { calcularDia, diasDoMes, resumirMes, type ResultadoDia, type ResumoMes } from './calculo';

export interface MesPessoa { pessoa: PessoaPonto; dias: (ResultadoDia & { batidas: Marcacao[]; desconsideradas: Marcacao[] })[]; resumo: ResumoMes }

// Carrega e calcula um mês (AAAA-MM) para uma pessoa ou para todas as da lista.
export function useMesPonto(mes: string, pessoas: PessoaPonto[], funcionario?: string) {
  const dias = useMemo(() => diasDoMes(mes), [mes]);
  const de = dias[0], ate = dias[dias.length - 1];
  const chave = ['ponto', 'mes', mes, funcionario ?? 'todos'];
  const enabled = pessoas.length > 0;
  const config = useConfigPonto();
  const marc = useQuery({ queryKey: [...chave, 'marcacoes'], queryFn: () => listarMarcacoes(de, ate, funcionario), enabled });
  const just = useQuery({ queryKey: [...chave, 'justificativas'], queryFn: () => listarJustificativas(de, ate, funcionario), enabled });
  const dec = useQuery({ queryKey: [...chave, 'decisoes'], queryFn: () => listarDecisoes(de, ate, funcionario), enabled });
  const fer = useQuery({ queryKey: ['ponto', 'feriados'], queryFn: listarFeriados, staleTime: 5 * 60_000 });

  const resultado = useMemo<MesPessoa[]>(() => {
    if (!config.data || !marc.data || !just.data || !dec.data || !fer.data) return [];
    const hoje = hojeISO();
    const feriado = new Map(fer.data.filter((f) => f.ativo).map((f) => [f.data, f.nome]));
    return pessoas.filter((p) => !funcionario || p.id === funcionario).map((pessoa) => {
      const minhas = marc.data.filter((m) => m.funcionario_id === pessoa.id);
      const js = just.data.filter((j) => j.funcionario_id === pessoa.id);
      const ds = new Map(dec.data.filter((d) => d.funcionario_id === pessoa.id).map((d) => [d.dia, d]));
      const calc = dias.map((dia) => {
        const doDia = minhas.filter((m) => m.dia === dia);
        const batidas = doDia.filter((m) => !m.desconsiderada_em);
        const r = calcularDia({ dia, hoje, config: config.data!, batidas, justificativas: js, feriado: feriado.get(dia), decisao: ds.get(dia) ?? null, admissao: pessoa.admissao, desligamento: pessoa.desligamento });
        return { ...r, batidas, desconsideradas: doDia.filter((m) => m.desconsiderada_em) };
      });
      return { pessoa, dias: calc, resumo: resumirMes(calc) };
    });
  }, [config.data, marc.data, just.data, dec.data, fer.data, pessoas, funcionario, dias]);

  const erro = config.error ?? marc.error ?? just.error ?? dec.error ?? fer.error;
  const carregando = !erro && enabled && resultado.length === 0;
  return { resultado, erro, carregando, config: config.data, chave: ['ponto', 'mes', mes] };
}

export const mesAtual = () => hojeISO().slice(0, 7);
export function mudarMes(mes: string, delta: number): string {
  const [a, m] = mes.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
export const nomeMes = (mes: string) => {
  const [a, m] = mes.split('-').map(Number);
  const s = new Date(Date.UTC(a, m - 1, 15)).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};
