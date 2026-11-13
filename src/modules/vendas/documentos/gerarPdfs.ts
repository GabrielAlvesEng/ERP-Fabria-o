import { enviarArquivoRevisao } from '@/modules/vendas/api';
import type { Proposta } from '@/modules/vendas/types';
import { carregarImagens, dadosDaProposta, lerDocumentos, lerPadroes } from './api';
import { completarDocumento, fixarSecoesDoModelo, imagensDoDocumento, nomeArquivo, type TipoDocumento } from './modelo';

// Decisão 124: ao enviar a proposta, o sistema gera os PDFs da técnica e da comercial da revisão atual
// (do jeito que estão na aba Documentos) e anexa em Arquivos. Documento que ainda não foi salvo fica de fora.
export async function gerarEAnexarPdfs(p: Proposta, revisaoId: string): Promise<{ tipo: TipoDocumento; arquivo: File }[]> {
  const [padroes, salvos] = await Promise.all([lerPadroes(), lerDocumentos(revisaoId)]);
  const tipos = (['tecnica', 'comercial'] as const).filter((t) => salvos[t]);
  if (!tipos.length) return [];
  const docs = Object.fromEntries(tipos.map((t) => [t, fixarSecoesDoModelo(completarDocumento(salvos[t], t, padroes[t]), padroes[t])]));
  const [dados, imagens, { gerarBlob }] = await Promise.all([
    dadosDaProposta(p, revisaoId, padroes.empresa.responsavel ?? ''),
    carregarImagens([...new Set(Object.values(docs).flatMap(imagensDoDocumento))]),
    import('./Previa'),
  ]);
  const feitos: { tipo: TipoDocumento; arquivo: File }[] = [];
  for (const t of tipos) {
    const blob = await gerarBlob(docs[t], dados, padroes.empresa, imagens, docs.tecnica);
    const arquivo = new File([blob], nomeArquivo(p.codigo, p.revisao_atual, p.titulo, t), { type: 'application/pdf' });
    await enviarArquivoRevisao(p.id, revisaoId, t, arquivo);
    feitos.push({ tipo: t, arquivo });
  }
  return feitos;
}
