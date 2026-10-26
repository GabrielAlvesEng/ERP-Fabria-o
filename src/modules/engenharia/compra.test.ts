import { describe, expect, it } from 'vitest';
import { mudouDesde, planoEnvio, type Solicitacao } from './compra';
import type { LinhaImportada } from '@/modules/compras/regras';

const l = (descricao: string, quantidade: number, grupo: LinhaImportada['grupo'] = 'Chapas', unidade = 'kg'): LinhaImportada => ({ chave: descricao, grupo, descricao, quantidade, unidade, observacoes: '', bib_tipo: null, bib_id: null });
const s = (revisao: number, status: Solicitacao['status'], itens: LinhaImportada[]): Solicitacao => ({ id: String(revisao), codigo: `RC-26-00${revisao + 1}`, revisao, status, necessario_em: null, prioridade: 'normal', criado_em: '', solicitante: null, itens });

describe('solicitação de compra da Engenharia (decisão 103)', () => {
  it('primeiro envio: lista inteira, R0', () => {
    const p = planoEnvio([l('Chapa 6,35', 100), l('Parafuso', 8, 'Fixadores', 'un')], []);
    expect(p.itens.map((i) => i.quantidade)).toEqual([100, 8]);
    expect(p.proximaRevisao).toBe(0);
    expect(p.substitui).toEqual([]);
  });

  it('requisição ainda aberta é substituída pela lista inteira', () => {
    const p = planoEnvio([l('Chapa 6,35', 120)], [s(0, 'aberta', [l('Chapa 6,35', 100)])]);
    expect(p.itens[0].quantidade).toBe(120);
    expect(p.substitui.map((x) => x.codigo)).toEqual(['RC-26-001']);
    expect(p.proximaRevisao).toBe(1);
  });

  it('depois da compra vai só o que falta, e o que diminuiu vira aviso', () => {
    const feitas = [s(0, 'em_compra', [l('Chapa 6,35', 100), l('Parafuso', 8, 'Fixadores', 'un')]), s(1, 'cancelada', [l('X', 1)])];
    const p = planoEnvio([l('Chapa 6,35', 130), l('Parafuso', 4, 'Fixadores', 'un')], feitas);
    expect(p.itens.map((i) => [i.descricao, i.quantidade])).toEqual([['Chapa 6,35', 30]]);
    expect(p.reducoes).toEqual(['Parafuso: pedido 8 un, lista atual 4 un']);
    expect(p.proximaRevisao).toBe(2);
  });

  it('nova revisão descreve em cada item quanto era e quanto é agora', () => {
    const p = planoEnvio([l('Chapa 6,35', 120), l('Parafuso', 8, 'Fixadores', 'un')], [s(0, 'aberta', [l('Chapa 6,35', 100), l('Chapa 3,00', 40)])]);
    expect(p.itens.map((i) => [i.descricao, i.quantidade, i.observacoes])).toEqual([['Chapa 6,35', 120, 'era 100 kg, agora 120 kg'], ['Parafuso', 8, 'novo na R1']]);
    expect(p.saidas).toEqual(['Chapa 3,00 (era 40 kg)']);
    expect(p.comparacao.map((c) => [c.descricao, c.era, c.agora])).toEqual([['Chapa 6,35', 100, 120], ['Parafuso', null, 8]]);
  });

  it('complemento também mostra era e agora; item igual não ganha observação', () => {
    const p = planoEnvio([l('Chapa 6,35', 130), l('Chapa 3,00', 40)], [s(0, 'em_compra', [l('Chapa 6,35', 100), l('Chapa 3,00', 40)])]);
    expect(p.itens.map((i) => i.observacoes)).toEqual(['era 100 kg, agora 130 kg · complemento: já pedidos 100 kg']);
    expect(planoEnvio([l('Chapa 6,35', 100)], []).itens[0].observacoes).toBe('');
  });

  it('avisa quando a lista mudou desde o envio', () => {
    expect(mudouDesde([l('Chapa 6,35', 100)], [s(0, 'aberta', [l('Chapa 6,35', 100)])])).toBe(false);
    expect(mudouDesde([l('Chapa 6,35', 101)], [s(0, 'aberta', [l('Chapa 6,35', 100)])])).toBe(true);
    expect(mudouDesde([l('Chapa 6,35', 101)], [])).toBe(false);
  });
});
