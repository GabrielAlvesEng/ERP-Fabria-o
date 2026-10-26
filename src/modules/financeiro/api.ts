import { supabase } from '@/shared/lib/supabase';
import { DIAS_AVISO, type CondicaoTipo, type FormaPagamento, type StatusConta, type TipoAnexo } from './regras';

// Financeiro, contas a pagar (decisão 105). Tudo que muda dinheiro passa pelas funções do banco (fin_*).

function ok<T>(r: { data: T | null; error: unknown }): T {
  if (r.error) throw r.error;
  return r.data as T;
}

export interface Parcela { id: string; conta_id: string; numero: number; vencimento: string | null; valor: number; pago: number; pago_em: string | null; ativa: boolean }
export interface Conta {
  id: string; origem: 'compra'; pedido_id: string | null; pedido_codigo: string; fornecedor_id: string | null; fornecedor_nome: string;
  projeto_codigo: string; projeto_titulo: string; descricao: string; valor_total: number; condicao_tipo: CondicaoTipo; condicao_dias: number[];
  emitida_em: string; entregue_em: string | null; status: StatusConta; cancelado_motivo: string; criado_em: string;
  fin_parcelas: Parcela[];
}
export interface Pagamento {
  id: string; parcela_id: string; data: string; valor: number; forma: FormaPagamento; comprovante_caminho: string | null; observacao: string;
  lancado_em: string; estornado_em: string | null; estorno_motivo: string;
  lancador?: { nome: string } | null;
}
export interface Anexo { id: string; tipo: TipoAnexo; bucket: 'financeiro' | 'compras'; caminho: string; nome: string; enviado_em: string; removido_em: string | null }
export interface Evento { id: string; tipo: string; descricao: string; criado_em: string; usuarios?: { nome: string } | null }
export interface DadosPagamentoFornecedor {
  fornecedor_id: string; banco: string; agencia: string; conta: string; titular: string; documento_titular: string; chave_pix: string;
  prazo_apos_recebimento: number; observacoes: string;
}

const CONTA = '*, fin_parcelas(*)';

// Quantos dias antes o aviso "vence em breve" aparece (decisão 109).
export async function obterDiasAviso(): Promise<number> {
  const r = ok<{ valor: unknown }>(await supabase.from('configuracoes').select('valor').eq('chave', 'financeiro_dias_aviso').maybeSingle());
  const n = Number(r?.valor);
  return Number.isInteger(n) && n > 0 ? n : DIAS_AVISO;
}

export async function definirDiasAviso(dias: number) {
  ok(await supabase.rpc('fin_definir_dias_aviso', { p_dias: dias }));
}
export const listarContas = async (): Promise<Conta[]> => ok(await supabase.from('fin_contas_pagar').select(CONTA).order('criado_em', { ascending: false }));
export const obterConta = async (id: string): Promise<Conta> => ok(await supabase.from('fin_contas_pagar').select(CONTA).eq('id', id).single());

export const listarPagamentos = async (conta: string): Promise<Pagamento[]> =>
  ok(await supabase.from('fin_pagamentos').select('*, lancador:usuarios!fin_pagamentos_lancado_por_fkey(nome)').eq('conta_id', conta).order('data'));
export const listarAnexos = async (conta: string): Promise<Anexo[]> =>
  ok(await supabase.from('fin_anexos').select('*').eq('conta_id', conta).is('removido_em', null).order('enviado_em'));
export const listarEventos = async (conta: string): Promise<Evento[]> =>
  ok(await supabase.from('fin_eventos').select('*, usuarios(nome)').eq('conta_id', conta).order('criado_em', { ascending: false }));

// ---------- Ações ----------
export async function definirParcelas(conta: string, parcelas: { vencimento: string | null; valor: number }[]): Promise<void> {
  ok(await supabase.rpc('fin_definir_parcelas', { p_conta: conta, p_parcelas: parcelas }));
}
export async function alterarVencimento(parcela: string, vencimento: string | null): Promise<void> {
  ok(await supabase.rpc('fin_alterar_vencimento', { p_parcela: parcela, p_vencimento: vencimento }));
}

// Arquivos ficam no bucket privado "financeiro", na pasta da conta.
async function enviarArquivo(conta: string, arquivo: File): Promise<string> {
  const limpo = arquivo.name.normalize('NFD').replace(/[^\w.-]+/g, '_').slice(-80);
  const caminho = `${conta}/${crypto.randomUUID()}-${limpo}`;
  ok(await supabase.storage.from('financeiro').upload(caminho, arquivo, { contentType: arquivo.type }));
  return caminho;
}

export async function registrarPagamento(conta: string, d: { parcela: string; data: string; valor: number; forma: FormaPagamento; observacao: string; comprovante: File | null }): Promise<void> {
  const caminho = d.comprovante ? await enviarArquivo(conta, d.comprovante) : null;
  ok(await supabase.rpc('fin_registrar_pagamento', {
    p_parcela: d.parcela, p_data: d.data, p_valor: d.valor, p_forma: d.forma, p_comprovante: caminho, p_observacao: d.observacao,
  }));
}
export async function estornarPagamento(pagamento: string, motivo: string): Promise<void> {
  ok(await supabase.rpc('fin_estornar_pagamento', { p_pagamento: pagamento, p_motivo: motivo }));
}
export async function anexar(conta: string, tipo: TipoAnexo, arquivo: File, nome: string): Promise<void> {
  const caminho = await enviarArquivo(conta, arquivo);
  ok(await supabase.rpc('fin_anexar', { p_conta: conta, p_tipo: tipo, p_caminho: caminho, p_nome: nome || arquivo.name }));
}
export async function removerAnexo(id: string): Promise<void> {
  ok(await supabase.rpc('fin_remover_anexo', { p_anexo: id }));
}
export async function abrirArquivo(bucket: 'financeiro' | 'compras', caminho: string): Promise<void> {
  const janela = window.open('', '_blank');
  try {
    const { signedUrl } = ok(await supabase.storage.from(bucket).createSignedUrl(caminho, 300));
    if (janela) janela.location.href = signedUrl; else window.location.href = signedUrl;
  } catch (e) {
    janela?.close();
    throw e;
  }
}

// ---------- Fornecedores (dados de pagamento) ----------
export const listarFornecedores = async (): Promise<{ id: string; nome: string; cnpj: string; condicao_pagamento: CondicaoTipo; ativo: boolean }[]> =>
  ok(await supabase.from('fornecedores').select('id, nome, cnpj, condicao_pagamento, ativo').order('nome'));
export const listarDadosPagamento = async (): Promise<DadosPagamentoFornecedor[]> => ok(await supabase.from('fornecedores_pagamento').select('*'));
export async function salvarDadosPagamento(d: DadosPagamentoFornecedor): Promise<void> {
  ok(await supabase.from('fornecedores_pagamento').upsert(d, { onConflict: 'fornecedor_id' }));
}
