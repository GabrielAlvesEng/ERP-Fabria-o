import { supabase } from '@/shared/lib/supabase';
import { formatarCNPJ } from '@/shared/lib/formato';
import { listarItens, listarLinhas } from '@/modules/vendas/custos/api';
import { resumoItem } from '@/modules/vendas/custos/regras';
import { listarArquivos, listarRevisoes } from '@/modules/vendas/api';
import type { Contato, Empresa, Proposta } from '@/modules/vendas/types';
import { EMPRESA_PADRAO, SOBRE_PADRAO, completarDocumento, type DadosEmpresaFabriaco, type Documento, type TipoDocumento } from './modelo';
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
  const empresa = de<DadosEmpresaFabriaco>('empresa') ?? {};
  return {
    empresa: { ...EMPRESA_PADRAO, ...empresa, sobre: { ...SOBRE_PADRAO, ...(empresa.sobre ?? {}) } },
    tecnica: completarDocumento(de<Documento>('tecnica'), 'tecnica'),
    comercial: completarDocumento(de<Documento>('comercial'), 'comercial'),
  };
}

export async function salvarPadrao(chave: 'empresa' | TipoDocumento, conteudo: unknown): Promise<void> {
  ok(await supabase.from('documento_padroes').upsert({ chave, conteudo }, { onConflict: 'chave' }));
}

// Conteúdo como foi salvo; quem usa completa/converte com os padrões (completarDocumento) para a versão atual.
export async function lerDocumentos(revisaoId: string): Promise<Partial<Record<TipoDocumento, Partial<Documento>>>> {
  const linhas = ok(await supabase.from('proposta_documentos').select('tipo, conteudo').eq('revisao_id', revisaoId)) as { tipo: TipoDocumento; conteudo: Partial<Documento> }[];
  return Object.fromEntries(linhas.map((l) => [l.tipo, l.conteudo]));
}

export async function salvarDocumento(revisaoId: string, tipo: TipoDocumento, conteudo: Documento): Promise<void> {
  ok(await supabase.from('proposta_documentos').upsert({ revisao_id: revisaoId, tipo, conteudo }, { onConflict: 'revisao_id,tipo' }));
}

// Local de entrega (decisão 70): sempre o endereço da empresa cliente.
export const enderecoEntrega = (e: Pick<Empresa, 'logradouro' | 'numero' | 'bairro' | 'cidade' | 'uf'>) =>
  [[e.logradouro, e.numero].filter(Boolean).join(', '), e.bairro, [e.cidade, e.uf].filter(Boolean).join(' / ')].filter(Boolean).join(' – ');

const pessoa = (c: Contato | null | undefined) => (c ? { nome: c.nome, telefone: c.whatsapp || c.telefone, email: c.email } : null);

// Tudo o que o documento puxa do ERP: cliente, contatos, vendedor, código, revisões, datas e os valores dos Custos.
export async function dadosDaProposta(p: Proposta, revisaoId: string, preparadoPor: string): Promise<DadosProposta> {
  const [empresa, contato, tecnico, itens, revisoes, vendedor, arquivos] = await Promise.all([
    supabase.from('empresas').select('*').eq('id', p.empresa_id).single().then((r) => ok(r) as Empresa),
    supabase.from('contatos').select('*').eq('id', p.contato_id).single().then((r) => ok(r) as Contato),
    p.contato_tecnico_id ? supabase.from('contatos').select('*').eq('id', p.contato_tecnico_id).maybeSingle().then((r) => ok(r) as Contato | null) : Promise.resolve(null),
    listarItens(revisaoId),
    listarRevisoes(p.id),
    p.responsavel_id
      ? supabase.from('vendedores').select('nome, cargo, telefone, usuarios!vendedores_usuario_id_fkey(nome, email)').eq('usuario_id', p.responsavel_id).maybeSingle()
        .then((r) => ok(r) as unknown as { nome: string; cargo: string; telefone: string; usuarios: { nome: string; email: string } | null } | null)
      : Promise.resolve(null),
    listarArquivos([revisaoId]),
  ]);
  const linhas = itens.length ? await listarLinhas(itens.map((i) => i.id)) : [];
  const cep = (empresa.cep ?? '').replace(/\D/g, '');
  const cidadeUf = [empresa.cidade, empresa.uf].filter(Boolean).join(' - ');
  return {
    codigo: p.codigo, revisao: p.revisao_atual, titulo: p.titulo, descricao: p.descricao ?? '', emissao: p.data_emissao, validadeDias: p.validade_dias ?? 30,
    cliente: {
      nome: empresa.nome_fantasia || empresa.razao_social, razao_social: empresa.razao_social, cnpj: formatarCNPJ(empresa.cnpj), ie: empresa.inscricao_estadual,
      endereco: [empresa.logradouro, empresa.numero].filter(Boolean).join(', ') + (empresa.complemento ? ` - ${empresa.complemento}` : ''),
      bairro: empresa.bairro, cep_cidade: [cep.length === 8 ? `${cep.slice(0, 2)}.${cep.slice(2, 5)}-${cep.slice(5)}` : cep, cidadeUf].filter(Boolean).join(' / '),
      local: [empresa.cidade, empresa.uf].filter(Boolean).join(' / '),
    },
    contato: pessoa(contato)!,
    contatoTecnico: pessoa(tecnico),
    frete: p.frete ?? 'CIF',
    entrega: enderecoEntrega(empresa),
    anexos: {
      tecnicos: arquivos.filter((a) => a.tipo === 'documento_tecnico').map((a) => ({ nome: a.nome, tamanho: a.tamanho })),
      comerciais: arquivos.filter((a) => a.tipo === 'anexo').map((a) => ({ nome: a.nome, tamanho: a.tamanho })),
    },
    preparadoPor,
    vendedor: vendedor ? { nome: vendedor.nome || vendedor.usuarios?.nome || '', cargo: vendedor.cargo, telefone: vendedor.telefone, email: vendedor.usuarios?.email ?? '' } : null,
    // Tabela de revisões da comercial: até a atual, com o motivo de cada uma (R0 = emissão inicial).
    revisoes: revisoes.filter((r) => r.numero <= p.revisao_atual).sort((a, b) => a.numero - b.numero).map((r) => ({
      numero: r.numero,
      descricao: r.numero === 0 ? 'Emissão inicial' : (r.motivo?.trim() || `Revisão ${r.numero}`),
      emissao: r.enviada_em ?? (r.numero === p.revisao_atual ? p.data_emissao : r.criado_em.slice(0, 10)),
    })),
    itens: itens.map((it) => {
      const r = resumoItem(it, linhas.filter((l) => l.item_id === it.id));
      return { id: it.id, letra: it.letra, descricao: it.descricao, quantidade: Number(it.quantidade) || 1, valor: r.precoTotal, manual: r.manual, calculado: r.precoCalculado, unitario: r.precoUnitario, calculadoUnitario: r.precoCalculadoUnitario };
    }),
  };
}

// Imagens do documento (capa e escopo): reduzidas no navegador (até 1600 px, JPEG) para o PDF não ficar pesado,
// guardadas como arquivo da revisão (tipo imagem_documento) no espaço privado de Vendas.
async function reduzirImagem(arquivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo);
  const escala = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * escala); canvas.height = Math.round(bitmap.height * escala);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((ok, falha) => canvas.toBlob((b) => (b ? ok(b) : falha(new Error('Não foi possível ler a imagem.'))), 'image/jpeg', 0.85));
}

export async function enviarImagem(propostaId: string, revisaoId: string, arquivo: File): Promise<string> {
  if (!arquivo.type.startsWith('image/')) throw new Error('Escolha uma imagem (JPG, PNG ou WEBP).');
  const blob = await reduzirImagem(arquivo);
  const nome = arquivo.name.replace(/\.[^.]+$/, '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_').slice(0, 60);
  const caminho = `propostas/${propostaId}/${revisaoId}/imagem_${Date.now()}_${nome}.jpg`;
  ok(await supabase.storage.from('vendas').upload(caminho, blob, { contentType: 'image/jpeg' }));
  ok(await supabase.from('proposta_arquivos').insert({ revisao_id: revisaoId, tipo: 'imagem_documento', caminho, nome: `${nome}.jpg`, tamanho: blob.size }));
  return caminho;
}

// Baixa as imagens e devolve como data URL (o PDF é montado no navegador, sem depender de link temporário).
export async function carregarImagens(caminhos: string[]): Promise<Record<string, string>> {
  const pares = await Promise.all(caminhos.map(async (c) => {
    const { data, error } = await supabase.storage.from('vendas').download(c);
    if (error || !data) return [c, ''] as const;
    const url = await new Promise<string>((ok2) => { const r = new FileReader(); r.onload = () => ok2(String(r.result)); r.readAsDataURL(data); });
    return [c, url] as const;
  }));
  return Object.fromEntries(pares.filter(([, u]) => u));
}
