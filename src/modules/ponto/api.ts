import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import { useAuth } from '@/shared/auth/AuthProvider';
import { CONFIG_PADRAO, type ConfigPonto, type JustificativaCalc } from './calculo';

// Ponto eletrônico (decisão 115). Bater o ponto e pedir ajuste: o próprio funcionário (funções no banco).
// O resto: só o RH (rh.ler / rh.editar). Cada funcionário lê só os seus registros (RLS).

function ok<T>(r: { data: T | null; error: unknown }): T {
  if (r.error) throw r.error;
  return r.data as T;
}

export interface LocalPonto {
  id: string; nome: string; latitude: number; longitude: number; raio_m: number; inicio: string | null; fim: string | null; ativo: boolean; observacoes: string;
}
export interface Marcacao {
  id: string; funcionario_id: string; momento: string; dia: string; origem: 'app' | 'ajuste' | 'rh'; local_id: string | null;
  precisao_m: number | null; distancia_m: number | null; aparelho: string; motivo: string;
  desconsiderada_em: string | null; desconsiderada_motivo: string;
}
export interface Ajuste {
  id: string; funcionario_id: string; dia: string; hora: string; motivo: string; situacao: 'pendente' | 'aprovado' | 'recusado';
  resposta: string; criado_em: string; decidido_em: string | null;
}
export interface Justificativa extends JustificativaCalc {
  id: string; funcionario_id: string; observacao: string; criado_em: string; excluido_em: string | null;
}
export interface Feriado { data: string; nome: string; abrangencia: string; ativo: boolean }
export interface Decisao { id: string; funcionario_id: string; dia: string; decisao: 'aprovado' | 'abonado'; observacao: string; decidido_em: string }
export interface PessoaPonto { id: string; nome: string; usuario_id: string | null; bate_ponto: boolean; situacao: string; admissao: string | null; desligamento: string | null; funcao_id: string | null }

export const TIPOS_JUSTIFICATIVA = ['Atestado médico', 'Férias', 'Folga', 'Afastamento', 'Compensação de horas', 'Falta justificada', 'Serviço externo', 'Outro'] as const;

export async function obterConfig(): Promise<ConfigPonto> {
  const r = ok(await supabase.from('configuracoes').select('valor').eq('chave', 'ponto').maybeSingle<{ valor: ConfigPonto }>());
  return { ...CONFIG_PADRAO, ...(r?.valor ?? {}) };
}
export const useConfigPonto = () => useQuery({ queryKey: ['ponto', 'config'], queryFn: obterConfig, staleTime: 5 * 60_000 });
export const salvarConfig = async (c: ConfigPonto) => { ok(await supabase.rpc('ponto_salvar_config', { p_config: c })); };

export const listarLocais = async (): Promise<LocalPonto[]> => ok(await supabase.from('ponto_locais').select('*').order('ativo', { ascending: false }).order('nome'));
export async function salvarLocal(l: Omit<LocalPonto, 'id'> & { id?: string }): Promise<void> {
  const { id, ...dados } = l;
  ok(id ? await supabase.from('ponto_locais').update(dados).eq('id', id) : await supabase.from('ponto_locais').insert(dados));
}

export const listarFeriados = async (): Promise<Feriado[]> => ok(await supabase.from('feriados').select('*').order('data'));
export async function salvarFeriado(f: Feriado, novo: boolean): Promise<void> {
  ok(novo ? await supabase.from('feriados').insert(f) : await supabase.from('feriados').update({ nome: f.nome, abrangencia: f.abrangencia, ativo: f.ativo }).eq('data', f.data));
}

// Eu: a ficha ligada ao meu login.
export async function obterMinhaPessoa(usuarioId: string): Promise<PessoaPonto | null> {
  return ok(await supabase.from('funcionarios').select('id, nome, usuario_id, bate_ponto, situacao, admissao, desligamento, funcao_id').eq('usuario_id', usuarioId).maybeSingle<PessoaPonto>());
}
export const listarPessoas = async (): Promise<PessoaPonto[]> =>
  ok(await supabase.from('funcionarios').select('id, nome, usuario_id, bate_ponto, situacao, admissao, desligamento, funcao_id').order('nome'));
export const definirBatePonto = async (id: string, bate: boolean) => { ok(await supabase.from('funcionarios').update({ bate_ponto: bate }).eq('id', id)); };

// Registros de um período (de um funcionário ou de todos).
function porFuncionario<T>(q: T & { eq: (c: string, v: string) => T }, funcionario?: string): T {
  return funcionario ? q.eq('funcionario_id', funcionario) : q;
}
export async function listarMarcacoes(de: string, ate: string, funcionario?: string): Promise<Marcacao[]> {
  const q = supabase.from('ponto_marcacoes').select('id, funcionario_id, momento, dia, origem, local_id, precisao_m, distancia_m, aparelho, motivo, desconsiderada_em, desconsiderada_motivo')
    .gte('dia', de).lte('dia', ate).order('momento');
  return ok(await porFuncionario(q, funcionario));
}
export async function listarJustificativas(de: string, ate: string, funcionario?: string): Promise<Justificativa[]> {
  const q = supabase.from('ponto_justificativas').select('*').is('excluido_em', null).lte('inicio', ate).gte('fim', de).order('inicio');
  return ok(await porFuncionario(q, funcionario));
}
export async function listarDecisoes(de: string, ate: string, funcionario?: string): Promise<Decisao[]> {
  const q = supabase.from('ponto_decisoes').select('id, funcionario_id, dia, decisao, observacao, decidido_em').is('substituida_em', null).gte('dia', de).lte('dia', ate);
  return ok(await porFuncionario(q, funcionario));
}
export async function listarAjustes(filtro: { funcionario?: string; pendentes?: boolean }): Promise<Ajuste[]> {
  let q = supabase.from('ponto_ajustes').select('*').order('criado_em', { ascending: false }).limit(200);
  if (filtro.pendentes) q = q.eq('situacao', 'pendente');
  return ok(await porFuncionario(q, filtro.funcionario));
}

export interface ResultadoBatida { id: string; momento: string; local: string; distancia?: number; ordem?: number; repetida: boolean }
export const baterPonto = async (p: { latitude: number; longitude: number; precisao: number }): Promise<ResultadoBatida> =>
  ok(await supabase.rpc('ponto_bater', { p_latitude: p.latitude, p_longitude: p.longitude, p_precisao: p.precisao, p_aparelho: navigator.userAgent }));
export const pedirAjuste = async (dia: string, hora: string, motivo: string) => { ok(await supabase.rpc('ponto_pedir_ajuste', { p_dia: dia, p_hora: hora, p_motivo: motivo })); };
export const decidirAjuste = async (id: string, aprovar: boolean, resposta = '') => { ok(await supabase.rpc('ponto_decidir_ajuste', { p_ajuste: id, p_aprovar: aprovar, p_resposta: resposta })); };
export const lancarBatida = async (funcionario: string, dia: string, hora: string, motivo: string) => {
  ok(await supabase.rpc('ponto_lancar_batida', { p_funcionario: funcionario, p_dia: dia, p_hora: hora, p_motivo: motivo }));
};
export const desconsiderarBatida = async (id: string, motivo: string) => { ok(await supabase.rpc('ponto_desconsiderar', { p_marcacao: id, p_motivo: motivo })); };
export const decidirDia = async (funcionario: string, dia: string, decisao: 'aprovado' | 'abonado' | 'desfazer', observacao = '') => {
  ok(await supabase.rpc('ponto_decidir_dia', { p_funcionario: funcionario, p_dia: dia, p_decisao: decisao, p_observacao: observacao }));
};
export async function salvarJustificativa(j: { funcionario_id: string; inicio: string; fim: string; periodo: string; tipo: string; observacao: string }): Promise<void> {
  ok(await supabase.from('ponto_justificativas').insert(j));
}
export async function excluirJustificativa(id: string, usuario: string): Promise<void> {
  ok(await supabase.from('ponto_justificativas').update({ excluido_em: new Date().toISOString(), excluido_por: usuario }).eq('id', id));
}

// Lê a localização do aparelho, pedindo alta precisão (GPS).
export function lerLocalizacao(): Promise<GeolocationPosition> {
  return new Promise((resolver, rejeitar) => {
    if (!('geolocation' in navigator)) { rejeitar(new Error('Este navegador não informa a localização.')); return; }
    navigator.geolocation.getCurrentPosition(resolver, (e) => {
      rejeitar(new Error(e.code === e.PERMISSION_DENIED
        ? 'A localização está bloqueada. Libere a localização para o ERP nas configurações do navegador e tente de novo.'
        : e.code === e.TIMEOUT ? 'A localização demorou para responder. Tente de novo.' : 'Não foi possível ler a sua localização.'));
    }, { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 });
  });
}

// Se o usuário logado bate ponto (undefined enquanto carrega; false se der erro, para não travar a entrada).
export function useBatePonto(): boolean | undefined {
  const { session } = useAuth();
  const id = session?.user.id;
  const q = useQuery({ queryKey: ['ponto', 'eu', id], queryFn: () => obterMinhaPessoa(id!), enabled: Boolean(id), staleTime: 5 * 60_000, retry: false });
  if (q.isError) return false;
  if (q.isPending) return undefined;
  return Boolean(q.data?.bate_ponto && q.data.situacao === 'ativo');
}
