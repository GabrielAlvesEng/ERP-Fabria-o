import { dataBR, formatarCNPJ, moeda } from '@/shared/lib/formato';
import type { Fornecedor, ItemComSolicitacao, Pacote, Pedido } from './api';
import { descreverCondicao, valorComIpi } from './regras';

const esc = (s: string | null | undefined) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const num = (n: number) => Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 3 });

const ESTILO = `
  @page { size: A4; margin: 16mm 14mm; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1e2235; font-size: 11px; margin: 0; }
  header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #5b32d6; padding-bottom: 10px; }
  header img { height: 54px; }
  h1 { font-size: 20px; margin: 0; color: #5b32d6; text-align: right; }
  .sub { text-align: right; color: #555; margin-top: 4px; }
  .blocos { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 14px 0; }
  .bloco { border: 1px solid #d8dbe6; border-radius: 6px; padding: 8px 10px; }
  .bloco b { display: block; font-size: 10px; text-transform: uppercase; color: #5b32d6; margin-bottom: 4px; letter-spacing: .04em; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f1effb; text-align: left; font-size: 10px; text-transform: uppercase; padding: 6px; }
  td { padding: 6px; border-bottom: 1px solid #e5e7ef; vertical-align: top; }
  .d { text-align: right; white-space: nowrap; }
  .obs { color: #666; font-size: 10px; }
  .branco { min-width: 80px; }
  .totais { margin-left: auto; width: 260px; margin-top: 10px; }
  .totais td { border: 0; padding: 3px 6px; }
  .totais tr:last-child td { font-weight: bold; font-size: 13px; border-top: 2px solid #1e2235; }
  .ass { margin-top: 50px; display: flex; gap: 40px; }
  .ass div { flex: 1; border-top: 1px solid #1e2235; text-align: center; padding-top: 4px; }
  footer { margin-top: 24px; color: #777; font-size: 9px; text-align: center; }`;

function abrir(titulo: string, corpo: string, oque: string) {
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>${ESTILO}</style></head><body>
${corpo}
<script>window.onload = () => setTimeout(() => window.print(), 300);</script>
</body></html>`;
  const w = window.open('', '_blank');
  if (!w) { alert(`Libere as janelas pop-up para imprimir ${oque}.`); return; }
  w.document.open(); w.document.write(html); w.document.close();
}

const logo = () => `${location.origin}${import.meta.env.BASE_URL}marca/fabriaco-logo-cor.svg`;
const blocoFornecedor = (f: Fornecedor | undefined) => f
  ? `${esc(f.nome)}${f.razao_social && f.razao_social !== f.nome ? `<br>${esc(f.razao_social)}` : ''}${f.cnpj ? `<br>CNPJ ${esc(formatarCNPJ(f.cnpj))}` : ''}${f.contato ? `<br>A/C ${esc(f.contato)}` : ''}${f.telefone ? `<br>${esc(f.telefone)}` : ''}${f.email ? `<br>${esc(f.email)}` : ''}${f.endereco ? `<br>${esc(f.endereco)}` : ''}${f.cidade ? `<br>${esc(f.cidade)}` : ''}`
  : '<br><br>';

// Para onde vão os itens: projetos (pedidos) e setores das solicitações.
function destinos(itens: ItemComSolicitacao[]): string {
  const projetos = [...new Map(itens.filter((i) => i.compras_requisicoes.projeto_codigo).map((i) => [i.compras_requisicoes.projeto_codigo, i.compras_requisicoes.projeto_titulo])).entries()];
  const setores = [...new Set(itens.filter((i) => !i.compras_requisicoes.projeto_codigo).map((i) => (i.compras_requisicoes.origem === 'almoxarifado' ? 'Estoque' : i.compras_requisicoes.setor)))];
  return [...projetos.map(([c, t]) => `Projeto ${esc(c)} · ${esc(t)}`), ...setores.map((s) => esc(s))].join('<br>');
}

// Ordem de compra em PDF (fluxograma: "Ordem de compra em PDF"): abre a versão para imprimir e o navegador salva em PDF.
// Itens e preços vêm da própria OC (compras_pedido_itens); a OC de um pacote pode juntar várias solicitações (decisão 111).
export function imprimirOrdem(p: Pedido, itens: ItemComSolicitacao[], f: Fornecedor | undefined) {
  const porId = new Map(itens.map((i) => [i.id, i]));
  const linhas = (p.compras_pedido_itens ?? []).map((x, n) => {
    const i = porId.get(x.item_id);
    const q = Number(x.quantidade);
    const v = Number(x.valor_unit);
    const ipi = Number(x.ipi ?? 0);
    return `<tr><td>${n + 1}</td><td>${esc(i?.descricao)}${i?.observacoes ? `<div class="obs">${esc(i.observacoes)}</div>` : ''}</td><td class="d">${num(q)}</td><td>${esc(i?.unidade)}</td><td class="d">${moeda(v)}</td><td class="d">${ipi ? `${num(ipi)}%` : '—'}</td><td class="d">${moeda(valorComIpi(q, v, ipi))}</td></tr>`;
  }).join('');
  // Itens sem IPI e o IPI (decisão 113); o total da OC já tem o IPI.
  const semIpi = (p.compras_pedido_itens ?? []).reduce((s, x) => s + Math.round(Number(x.quantidade) * Number(x.valor_unit) * 100) / 100, 0);
  const ipiTotal = Math.round((Number(p.valor_itens) - semIpi) * 100) / 100;
  const usados = (p.compras_pedido_itens ?? []).map((x) => porId.get(x.item_id)).filter((i): i is ItemComSolicitacao => !!i);
  const ref = p.compras_pacotes ? `Cotação ${esc(p.compras_pacotes.codigo)}` : p.compras_requisicoes ? `Requisição ${esc(p.compras_requisicoes.codigo)}` : '';
  abrir(`${p.codigo} · ${f?.nome ?? ''}`, `
<header><img src="${logo()}" alt="Fabriaço"><div><h1>ORDEM DE COMPRA ${esc(p.codigo)}</h1><div class="sub">Emitida em ${dataBR(p.emitido_em)}${ref ? ` · ${ref}` : ''}</div></div></header>
<div class="blocos">
  <div class="bloco"><b>Fornecedor</b>${blocoFornecedor(f)}</div>
  <div class="bloco"><b>Comprador</b>Fabriaço Brasil · Montagens Industriais e Caldeiraria<br>Mococa/SP${usados.length ? `<br>${destinos(usados)}` : ''}</div>
</div>
<table><thead><tr><th>#</th><th>Descrição</th><th class="d">Qtd.</th><th>Un.</th><th class="d">Unitário</th><th class="d">IPI</th><th class="d">Total</th></tr></thead><tbody>${linhas}</tbody></table>
<table class="totais"><tr><td>Itens</td><td class="d">${moeda(ipiTotal > 0 ? semIpi : p.valor_itens)}</td></tr>${ipiTotal > 0 ? `<tr><td>IPI</td><td class="d">${moeda(ipiTotal)}</td></tr>` : ''}<tr><td>Frete</td><td class="d">${moeda(p.frete)}</td></tr><tr><td>Total</td><td class="d">${moeda(p.valor_total)}</td></tr></table>
<div class="blocos">
  <div class="bloco"><b>Entrega</b>Previsão: ${dataBR(p.previsao_entrega)}</div>
  <div class="bloco"><b>Pagamento</b>${esc(descreverCondicao(p.condicao_tipo, p.condicao_dias ?? []))}${p.condicao_texto ? `<br>${esc(p.condicao_texto)}` : ''}</div>
</div>
${p.observacoes ? `<div class="bloco"><b>Observações</b>${esc(p.observacoes)}</div>` : ''}
<div class="ass"><div>Compras · Fabriaço</div><div>Aceite do fornecedor</div></div>
<footer>Informar o número ${esc(p.codigo)} na nota fiscal.</footer>`, 'a ordem de compra');
}

// Pedido de cotação do pacote (decisão 111): a lista dos itens, sem preços, para o comprador mandar aos fornecedores.
export function imprimirPedidoCotacao(pacote: Pacote, itens: ItemComSolicitacao[], f: Fornecedor | undefined) {
  const linhas = itens.map((i, n) => `<tr><td>${n + 1}</td><td>${esc(i.descricao)}${i.observacoes ? `<div class="obs">${esc(i.observacoes)}</div>` : ''}</td><td class="d">${num(Number(i.quantidade))}</td><td>${esc(i.unidade)}</td><td class="branco"></td><td class="branco"></td><td class="branco"></td></tr>`).join('');
  const hoje = new Date().toISOString().slice(0, 10);
  abrir(`Cotação ${pacote.codigo}${f ? ` · ${f.nome}` : ''}`, `
<header><img src="${logo()}" alt="Fabriaço"><div><h1>PEDIDO DE COTAÇÃO ${esc(pacote.codigo)}</h1><div class="sub">${dataBR(hoje)} · ${esc(pacote.titulo)}</div></div></header>
<div class="blocos">
  <div class="bloco"><b>Fornecedor</b>${blocoFornecedor(f)}</div>
  <div class="bloco"><b>Solicitante</b>Fabriaço Brasil · Montagens Industriais e Caldeiraria<br>Mococa/SP<br>Setor de Compras</div>
</div>
<table><thead><tr><th>#</th><th>Descrição</th><th class="d">Qtd.</th><th>Un.</th><th class="d">Preço unitário</th><th class="d">IPI %</th><th class="d">Total</th></tr></thead><tbody>${linhas}</tbody></table>
<div class="blocos">
  <div class="bloco"><b>Informar no orçamento</b>Preço unitário de cada item, IPI (%) separado, frete, prazo de entrega, condição de pagamento e validade da proposta.</div>
  <div class="bloco"><b>Observações</b>${esc(pacote.observacoes) || '<br><br>'}</div>
</div>
<footer>Responder citando o pedido de cotação ${esc(pacote.codigo)}.</footer>`, 'o pedido de cotação');
}
