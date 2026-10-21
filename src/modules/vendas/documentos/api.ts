import { supabase } from '@/shared/lib/supabase';
import { formatarCNPJ } from '@/shared/lib/formato';
import { listarItens, listarLinhas } from '@/modules/vendas/custos/api';
import { resumoItem } from '@/modules/vendas/custos/regras';
import type { Contato, Empresa, Proposta } from '@/modules/vendas/types';
import { EMPRESA_PADRAO, completarDocumento, type DadosEmpresaFabriaco, type Documento, type TipoDocumento } from './modelo';
import type { DadosProposta } from './DocumentoPdf';

function ok<T>(r: { data: T | null; error: unknown }): T {
  if (r.error) throw r.error;
  return r.data as T;
}

export interface Padroes { empresa: DadosEmpresaFabriaco; tecnica: Documento; comercial: Documento }

// Textos padrão (Administração → Modelos de proposta). Sem registro no banco, valem os dos modelos enviados pelo Gabriel.
export async function lerPadroes(): Promise<Padroes> {
  const linhas = ok(await supabase.from('documento_padroes').select('chave, conteudo')) as { chave: string; conteudo: unknown }[];
  const de = <T,>(c: string) => linhas.find((l) => l.chave === c)?.conteudo as Partial<T> | undefined;
  return {
    empresa: { ...EMPRESA_PADRAO, ...(de<DadosEmpresaFabriaco>('empresa') ?? {}) },
    tecnica: completarDocumento(de<Documento>('tecnica'), 'tecnica'),
    comercial: completarDocumento(de<Documento>('comercial'), 'comercial'),
  };
}

export async function salvarPadrao(chave: 'empresa' | TipoDocumento, conteudo: unknown): Promise<void> {
  ok(await supabase.from('documento_padroes').upsert({ chave, conteudo }, { onConflict: 'chave' }));
}

export async function lerDocumentos(revisaoId: string): Promise<Partial<Record<TipoDocumento, Documento>>> {
  const linhas = ok(await supabase.from('proposta_documentos').select('tipo, conteudo').eq('revisao_id', revisaoId)) as { tipo: TipoDocumento; conteudo: Documento }[];
  return Object.fromEntries(linhas.map((l) => [l.tipo, completarDocumento(l.conteudo, l.tipo)]));
}

export async function salvarDocumento(revisaoId: string, tipo: TipoDocumento, conteudo: Documento): Promise<void> {
  ok(await supabase.from('proposta_documentos').upsert({ revisao_id: revisaoId, tipo, conteudo }, { onConflict: 'revisao_id,tipo' }));
}

// Tudo o que o documento puxa do ERP: cliente, contato, código, revisão, datas e os valores dos Custos.
export async function dadosDaProposta(p: Proposta, revisaoId: string, preparadoPor: string): Promise<DadosProposta> {
  const [empresa, contato, itens] = await Promise.all([
    supabase.from('empresas').select('*').eq('id', p.empresa_id).single().then((r) => ok(r) as Empresa),
    supabase.from('contatos').select('*').eq('id', p.contato_id).single().then((r) => ok(r) as Contato),
    listarItens(revisaoId),
  ]);
  const linhas = itens.length ? await listarLinhas(itens.map((i) => i.id)) : [];
  const cep = (empresa.cep ?? '').replace(/\D/g, '');
  const cidadeUf = [empresa.cidade, empresa.uf].filter(Boolean).join(' - ');
  return {
    codigo: p.codigo, revisao: p.revisao_atual, titulo: p.titulo, emissao: p.data_emissao, validadeDias: p.validade_dias ?? 30,
    cliente: {
      nome: empresa.nome_fantasia || empresa.razao_social, razao_social: empresa.razao_social, cnpj: formatarCNPJ(empresa.cnpj), ie: empresa.inscricao_estadual,
      endereco: [empresa.logradouro, empresa.numero].filter(Boolean).join(', ') + (empresa.complemento ? ` - ${empresa.complemento}` : ''),
      bairro: empresa.bairro, cep_cidade: [cep.length === 8 ? `${cep.slice(0, 2)}.${cep.slice(2, 5)}-${cep.slice(5)}` : cep, cidadeUf].filter(Boolean).join(' / '),
      local: [empresa.cidade, empresa.uf].filter(Boolean).join(' / '),
    },
    contato: { nome: contato.nome, telefone: contato.whatsapp || contato.telefone, email: contato.email },
    preparadoPor,
    itens: itens.map((it) => ({ letra: it.letra, descricao: it.descricao, valor: resumoItem(it, linhas.filter((l) => l.item_id === it.id)).precoTotal })),
  };
}
