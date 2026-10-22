import { dataBR, formatarCNPJ, moeda } from '@/shared/lib/formato';
import type { Cotacao, Fornecedor, ItemRequisicao, Pedido, Requisicao } from './api';
import { ROTULO_PAGAMENTO } from './regras';

const esc = (s: string | null | undefined) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const num = (n: number) => Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 3 });

// Ordem de compra em PDF (fluxograma: "Ordem de compra em PDF"): abre a versão para imprimir e o navegador salva em PDF.
export function imprimirOrdem(p: Pedido, r: Requisicao, itens: ItemRequisicao[], c: Cotacao, f: Fornecedor | undefined) {
  const preco = new Map(c.compras_cotacao_precos.map((x) => [x.item_id, Number(x.valor_unit)]));
  const linhas = itens.map((i, n) => {
    const v = preco.get(i.id) ?? 0;
    return `<tr><td>${n + 1}</td><td>${esc(i.descricao)}${i.observacoes ? `<div class="obs">${esc(i.observacoes)}</div>` : ''}</td><td class="d">${num(i.quantidade)}</td><td>${esc(i.unidade)}</td><td class="d">${moeda(v)}</td><td class="d">${moeda(Math.round(i.quantidade * v * 100) / 100)}</td></tr>`;
  }).join('');
  const logo = `${location.origin}${import.meta.env.BASE_URL}marca/fabriaco-logo-cor.svg`;
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(p.codigo)} · ${esc(f?.nome)}</title>
<style>
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
  .totais { margin-left: auto; width: 260px; margin-top: 10px; }
  .totais td { border: 0; padding: 3px 6px; }
  .totais tr:last-child td { font-weight: bold; font-size: 13px; border-top: 2px solid #1e2235; }
  .ass { margin-top: 50px; display: flex; gap: 40px; }
  .ass div { flex: 1; border-top: 1px solid #1e2235; text-align: center; padding-top: 4px; }
  footer { margin-top: 24px; color: #777; font-size: 9px; text-align: center; }
</style></head><body>
<header><img src="${logo}" alt="Fabriaço"><div><h1>ORDEM DE COMPRA ${esc(p.codigo)}</h1><div class="sub">Emitida em ${dataBR(p.emitido_em)} · Requisição ${esc(r.codigo)}</div></div></header>
<div class="blocos">
  <div class="bloco"><b>Fornecedor</b>${esc(f?.nome)}${f?.razao_social && f.razao_social !== f.nome ? `<br>${esc(f.razao_social)}` : ''}${f?.cnpj ? `<br>CNPJ ${esc(formatarCNPJ(f.cnpj))}` : ''}${f?.contato ? `<br>A/C ${esc(f.contato)}` : ''}${f?.telefone ? `<br>${esc(f.telefone)}` : ''}${f?.email ? `<br>${esc(f.email)}` : ''}${f?.endereco ? `<br>${esc(f.endereco)}` : ''}${f?.cidade ? `<br>${esc(f.cidade)}` : ''}</div>
  <div class="bloco"><b>Comprador</b>Fabriaço Brasil · Montagens Industriais e Caldeiraria<br>Mococa/SP${r.projeto_codigo ? `<br>Projeto ${esc(r.projeto_codigo)} · ${esc(r.projeto_titulo)}` : `<br>Setor: ${esc(r.setor)}`}</div>
</div>
<table><thead><tr><th>#</th><th>Descrição</th><th class="d">Qtd.</th><th>Un.</th><th class="d">Unitário</th><th class="d">Total</th></tr></thead><tbody>${linhas}</tbody></table>
<table class="totais"><tr><td>Itens</td><td class="d">${moeda(p.valor_itens)}</td></tr><tr><td>Frete</td><td class="d">${moeda(p.frete)}</td></tr><tr><td>Total</td><td class="d">${moeda(p.valor_total)}</td></tr></table>
<div class="blocos">
  <div class="bloco"><b>Entrega</b>Previsão: ${dataBR(p.previsao_entrega)}${c.prazo_dias != null ? ` (prazo de ${c.prazo_dias} dia(s))` : ''}</div>
  <div class="bloco"><b>Pagamento</b>${esc(c.condicao_pagamento || (f ? ROTULO_PAGAMENTO[f.condicao_pagamento] : ''))}</div>
</div>
${p.observacoes || c.observacoes ? `<div class="bloco"><b>Observações</b>${esc([p.observacoes, c.observacoes].filter(Boolean).join(' · '))}</div>` : ''}
<div class="ass"><div>Compras · Fabriaço</div><div>Aceite do fornecedor</div></div>
<footer>Informar o número ${esc(p.codigo)} na nota fiscal. Compra aprovada pelo Financeiro.</footer>
<script>window.onload = () => setTimeout(() => window.print(), 300);</script>
</body></html>`;
  const w = window.open('', '_blank');
  if (!w) { alert('Libere as janelas pop-up para imprimir a ordem de compra.'); return; }
  w.document.open(); w.document.write(html); w.document.close();
}
