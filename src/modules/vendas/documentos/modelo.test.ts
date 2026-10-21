import { describe, expect, it } from 'vitest';
import { aplicarTextosIA, blocos, completarDocumento, documentoPadrao, marcadorCartao, nomeArquivo, numerar, substituir, trechos } from './modelo';

describe('documentos da proposta', () => {
  it('lê negrito', () => {
    expect(trechos('A garantia de **18 meses** vale.')).toEqual([
      { texto: 'A garantia de ', negrito: false }, { texto: '18 meses', negrito: true }, { texto: ' vale.', negrito: false },
    ]);
  });
  it('separa parágrafos e listas', () => {
    const b = blocos('Primeiro parágrafo\ncontinua.\n\nNão se aplica a:\n- Mau uso;\n- Alterações.\n\nFim.');
    expect(b.map((x) => x.tipo)).toEqual(['p', 'p', 'lista', 'p']);
    expect(b[0]).toEqual({ tipo: 'p', trechos: [{ texto: 'Primeiro parágrafo continua.', negrito: false }] });
    expect(b[2].tipo === 'lista' && b[2].itens.length).toBe(2);
  });
  it('troca as variáveis e mantém as que faltam visíveis', () => {
    expect(substituir('Para a {cliente} – {local}, {validade_dias} dias.', { cliente: 'Symrise Pet Food', local: 'Descalvado/SP', validade_dias: '30' }))
      .toBe('Para a Symrise Pet Food – Descalvado/SP, 30 dias.');
    expect(substituir('{cliente}', { cliente: '', local: '', validade_dias: '' })).toBe('{cliente}');
  });
  it('numera só as seções ativas', () => {
    const d = documentoPadrao('tecnica');
    expect(d.secoes).toHaveLength(16);
    expect(numerar(d.secoes).at(-1)?.numero).toBe('16');
    d.secoes[0].ativo = false;
    expect(numerar(d.secoes)[0]).toMatchObject({ numero: '01', secao: { id: 'dados' } });
    expect(documentoPadrao('comercial').secoes).toHaveLength(11);
  });
  it('marcadores dos cartões', () => {
    expect([marcadorCartao('letra', 0), marcadorCartao('letra', 3), marcadorCartao('numero', 0), marcadorCartao('numero', 9)]).toEqual(['A', 'D', '01', '10']);
  });
  it('completa documento salvo sem apagar o que existe', () => {
    const d = completarDocumento({ capa: { linha1: 'Vedação', linha2: '', subtitulo: '' } } as never, 'comercial');
    expect(d.capa.linha1).toBe('Vedação');
    expect(d.secoes).toHaveLength(11);
    expect(d.abertura).toMatch(/condições comerciais/);
  });
  it('nome do arquivo', () => {
    expect(nomeArquivo('26-01-019', 0, 'Vedação Pneumática / Rosca MP', 'tecnica')).toBe('Proposta 26-01-019-R0 FABRIAÇO - Vedação Pneumática Rosca MP - Técnica.pdf');
  });
  it('encaixa os textos da IA sem mexer no resto', () => {
    const t = aplicarTextosIA(documentoPadrao('tecnica'), {
      capa: { linha1: 'Vedação Pneumática', linha2: 'Rosca MP', subtitulo: 'Novo cabeçote.' }, objetivo: 'Objetivo da IA.', aplicacao: '  ',
      competencias: { Mecânica: 'Sim', Pneumática: 'Sim' }, escopo_intro: 'Etapas:', escopo: [{ titulo: 'ENGENHARIA', texto: 'Projeto.' }, { titulo: ' ', texto: 'vazio' }],
    });
    expect(t.capa.linha2).toBe('Rosca MP');
    const sec = (id: string) => t.secoes.find((s) => s.id === id)!;
    expect(sec('objetivo')).toMatchObject({ texto: 'Objetivo da IA.' });
    expect(sec('aplicacao')).toMatchObject({ texto: '' });
    const gar = sec('garantia');
    expect(gar.tipo === 'texto' ? gar.texto : '').toMatch(/18 meses/);
    const comp = sec('competencias');
    expect(comp.tipo === 'competencias' && comp.itens.filter((i) => i.valor === 'Sim').map((i) => i.nome)).toEqual(['Mecânica', 'Pneumática']);
    const esc = sec('escopo');
    expect(esc.tipo === 'cartoes' && [esc.intro, esc.cartoes.length]).toEqual(['Etapas:', 1]);
    const c = aplicarTextosIA(documentoPadrao('comercial'), { abertura: 'Olá.', descricoes: [{ letra: 'A', texto: 'Fabricação do cabeçote.' }] });
    const val = c.secoes.find((s) => s.id === 'valores')!;
    expect(c.abertura).toBe('Olá.');
    expect(val.tipo === 'valores' && val.descricoes.A).toBe('Fabricação do cabeçote.');
  });
});
