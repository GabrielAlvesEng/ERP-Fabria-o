import { supabase } from '@/shared/lib/supabase';
import type { Proposta } from '@/modules/vendas/types';

// Vendedores (decisão 62): usuários do ERP cadastrados pelo RH. A proposta guarda o vendedor em responsavel_id.

function ok<T>(r: { data: T | null; error: unknown }): T {
  if (r.error) throw r.error;
  return r.data as T;
}

export interface Vendedor {
  usuario_id: string; nome: string; cargo: string; telefone: string; observacoes: string; ativo: boolean;
  usuarios?: { nome: string; email: string; ativo: boolean; foto_caminho: string | null; foto_atualizada_em: string | null } | null;
}
export interface Usuario { id: string; nome: string; email: string; ativo: boolean }

export const listarVendedores = async (): Promise<Vendedor[]> =>
  ok(await supabase.from('vendedores').select('*, usuarios!vendedores_usuario_id_fkey(nome, email, ativo, foto_caminho, foto_atualizada_em)').order('nome'));

export const listarUsuarios = async (): Promise<Usuario[]> => ok(await supabase.from('usuarios').select('id, nome, email, ativo').order('nome'));

export async function salvarVendedor(v: Pick<Vendedor, 'usuario_id' | 'nome' | 'cargo' | 'telefone' | 'observacoes' | 'ativo'>, novo: boolean): Promise<void> {
  ok(novo ? await supabase.from('vendedores').insert(v) : await supabase.from('vendedores').update(v).eq('usuario_id', v.usuario_id));
}

// Nome do vendedor para mostrar na proposta: o do cadastro de vendedor, senão o do usuário.
export function nomeVendedor(p: Pick<Proposta, 'usuarios'>): string {
  const u = p.usuarios as (Proposta['usuarios'] & { vendedores?: { nome: string } | { nome: string }[] | null }) | null | undefined;
  const v = Array.isArray(u?.vendedores) ? u?.vendedores[0] : u?.vendedores;
  return v?.nome || u?.nome || '';
}
