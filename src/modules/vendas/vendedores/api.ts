import { supabase } from '@/shared/lib/supabase';
import type { Proposta } from '@/modules/vendas/types';

// Vendedores (decisão 62): usuários do ERP cadastrados pelo RH. A proposta guarda o vendedor em responsavel_id.

function ok<T>(r: { data: T | null; error: unknown }): T {
  if (r.error) throw r.error;
  return r.data as T;
}

export interface Vendedor {
  usuario_id: string; nome: string; cargo: string; telefone: string; observacoes: string; ativo: boolean;
  removido_em?: string | null; // decisão 91: removido pelo RH (exclusão lógica)
  usuarios?: { nome: string; email: string; ativo: boolean; foto_caminho: string | null; foto_atualizada_em: string | null } | null;
}
export interface Usuario { id: string; nome: string; email: string; ativo: boolean }

export const listarVendedores = async (): Promise<Vendedor[]> =>
  ok(await supabase.from('vendedores').select('*, usuarios!vendedores_usuario_id_fkey(nome, email, ativo, foto_caminho, foto_atualizada_em)').order('nome'));

// Quem pode virar vendedor (decisão 91): funcionário com ficha no RH, login e não desligado.
export interface CandidatoVendedor { usuario_id: string; nome: string; telefone: string; email: string }
export async function listarCandidatosVendedor(): Promise<CandidatoVendedor[]> {
  const lista = ok(await supabase.from('funcionarios').select('nome, telefone, usuario_id, usuarios!funcionarios_usuario_id_fkey(email, ativo)')
    .not('usuario_id', 'is', null).neq('situacao', 'desligado').order('nome')) as unknown as
    { nome: string; telefone: string; usuario_id: string; usuarios: { email: string; ativo: boolean } | null }[];
  return lista.filter((f) => f.usuarios?.ativo).map((f) => ({ usuario_id: f.usuario_id, nome: f.nome, telefone: f.telefone, email: f.usuarios!.email }));
}

export async function salvarVendedor(v: Pick<Vendedor, 'usuario_id' | 'nome' | 'cargo' | 'telefone' | 'observacoes' | 'ativo'>, novo: boolean): Promise<void> {
  // Cadastrar de novo quem foi removido traz o cadastro de volta (mesma linha).
  ok(novo
    ? await supabase.from('vendedores').upsert({ ...v, removido_em: null, removido_por: null }, { onConflict: 'usuario_id' })
    : await supabase.from('vendedores').update(v).eq('usuario_id', v.usuario_id));
}

export async function removerVendedor(usuarioId: string): Promise<void> {
  ok(await supabase.rpc('remover_vendedor', { p_usuario: usuarioId }));
}

// Nome do vendedor para mostrar na proposta: o do cadastro de vendedor, senão o do usuário.
export function nomeVendedor(p: Pick<Proposta, 'usuarios'>): string {
  const u = p.usuarios as (Proposta['usuarios'] & { vendedores?: { nome: string } | { nome: string }[] | null }) | null | undefined;
  const v = Array.isArray(u?.vendedores) ? u?.vendedores[0] : u?.vendedores;
  return v?.nome || u?.nome || '';
}
