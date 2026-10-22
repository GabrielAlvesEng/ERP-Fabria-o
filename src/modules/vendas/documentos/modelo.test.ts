import { describe, expect, it } from 'vitest';
import { aplicarTextosIA, blocos, completarDocumento, documentoPadrao, imagensDoDocumento, marcadorCartao, resumoTecnica, VERSAO_DOCUMENTO, nomeArquivo, numerar, fixarSecoesDoModelo, pendencias, aplicarTextosIASecao, explicacaoParaSecao, sincronizarEscopo, substituir, trechos } from './modelo';

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
    expect(d.secoes).toHaveLength(14);
    expect(numerar(d.secoes).at(-1)?.numero).toBe('12');
    // Decisão 70: Conheça a Fabriaço e Dados da Empresa ficam sem número; o 01 é o Objetivo.
    expect(numerar(d.secoes)[0]).toMatchObject({ numero: '01', secao: { id: 'objetivo' } });
    d.secoes[2].ativo = false;
    expect(numerar(d.secoes)[0]).toMatchObject({ numero: '01', secao: { id: 'aplicacao' } });
    expect(documentoPadrao('comercial').secoes).toHaveLength(6);
  });
  it('lê sublinhado e lista numerada', () => {
    expect(trechos('Ver __item 3__ e **nota**.')).toEqual([
      { texto: 'Ver ', negrito: false }, { texto: 'item 3', negrito: false, sublinhado: true }, { texto: ' e ', negrito: false }, { texto: 'nota', negrito: true }, { texto: '.', negrito: false },
    ]);
    const b = blocos('Etapas:\n1. Projeto\n2. Fabricação\n- Observação');
    expect(b.map((x) => (x.tipo === 'lista' ? `lista${x.numerada ? '-num' : ''}:${x.itens.length}` : 'p'))).toEqual(['p', 'lista-num:2', 'lista:1']);
  });
  it('marcadores dos cartões', () => {
    expect([marcadorCartao('letra', 0), marcadorCartao('letra', 3), marcadorCartao('numero', 0), marcadorCartao('numero', 9)]).toEqual(['A', 'D', '01', '10']);
  });
  it('completa documento salvo sem apagar o que existe', () => {
    const d = completarDocumento({ capa: { linha1: 'Vedação', linha2: '', subtitulo: '' } } as never, 'comercial');
    expect(d.capa.linha1).toBe('Vedação');
    expect(d.secoes).toHaveLength(6);
    expect(d.versao).toBe(VERSAO_DOCUMENTO);
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
    expect(sec('garantia')).toMatchObject({ tipo: 'garantia', meses: 18 });
    const comp = sec('competencias');
    expect(comp.tipo === 'competencias' && comp.itens.filter((i) => i.valor === 'Sim').map((i) => i.nome)).toEqual(['Mecânica', 'Pneumática']);
    const esc = sec('escopo');
    expect(esc.tipo === 'cartoes' && [esc.intro, esc.cartoes.length]).toEqual(['Etapas:', 1]);
    const c = aplicarTextosIA(documentoPadrao('comercial'), { abertura: 'Olá.', descricoes: [{ letra: 'A', texto: 'Fabricação do cabeçote.' }] });
    const val = c.secoes.find((s) => s.id === 'valores')!;
    expect(c.abertura).toBe('Olá.');
    expect(val.tipo === 'valores' && val.descricoes.A).toBe('Fabricação do cabeçote.');
  });
  it('imagens dos itens do escopo: entram no PDF e sobrevivem à IA', () => {
    const d = documentoPadrao('tecnica');
    const esc = d.secoes.find((s) => s.id === 'escopo')!;
    if (esc.tipo !== 'cartoes') throw new Error('escopo');
    expect(esc.marcador).toBe('letra');
    esc.cartoes = [{ titulo: 'A', texto: '', imagens: [{ caminho: 'x/1.jpg', legenda: '' }, { caminho: 'x/2.jpg', legenda: 'Vista' }] }, { titulo: 'B', texto: '' }];
    d.capa.imagem = 'x/capa.jpg';
    expect(imagensDoDocumento(d)).toEqual(['x/capa.jpg', 'x/1.jpg', 'x/2.jpg']);
    const t = aplicarTextosIA(d, { escopo: [{ titulo: 'ENGENHARIA', texto: 'Projeto.' }, { titulo: 'FABRICAÇÃO', texto: '' }, { titulo: 'MONTAGEM', texto: '' }] });
    const novo = t.secoes.find((s) => s.id === 'escopo')!;
    expect(novo.tipo === 'cartoes' && novo.cartoes.map((c) => c.imagens?.length ?? 0)).toEqual([2, 0, 0]);
    expect(novo.tipo === 'cartoes' && novo.cartoes[0].titulo).toBe('ENGENHARIA');
  });
  it('converte documento da versão 3 sem perder o que foi escrito', () => {
    const v3 = {
      tipo: 'tecnica', capa: { linha1: 'Vedação', linha2: 'Rosca MP', subtitulo: '' }, visao: { objeto: 'Cabeçote', solucao: '', unidade: '' }, abertura: '',
      secoes: [
        { id: 'sobre', titulo: 'Sobre nós', ativo: true, tipo: 'texto', texto: 'antigo' },
        { id: 'objetivo', titulo: 'Objetivo', ativo: true, tipo: 'texto', texto: 'Objetivo escrito.' },
        { id: 'escopo', titulo: 'Escopo', ativo: true, tipo: 'cartoes', marcador: 'letra', intro: 'Etapas', fecho: '', cartoes: [{ titulo: 'A', texto: 'x', imagens: [{ caminho: 'i.jpg', legenda: '' }] }] },
        { id: 'responsabilidades', titulo: 'Responsabilidades', ativo: true, tipo: 'matriz', itens: [] },
        { id: 'documentacoes', titulo: 'Documentações', ativo: true, tipo: 'matriz', itens: [] },
        { id: 'gestao', titulo: 'Gestão do Projeto', ativo: true, tipo: 'cartoes', marcador: 'letra', intro: '', fecho: '', cartoes: [] },
        { id: 'garantia', titulo: 'Garantia', ativo: false, tipo: 'texto', texto: '18 meses' },
      ],
    } as never;
    const d = completarDocumento(v3, 'tecnica');
    const sec = (id: string) => d.secoes.find((s) => s.id === id);
    expect(d.versao).toBe(VERSAO_DOCUMENTO);
    expect(d.capa.linha2).toBe('Rosca MP');
    expect(sec('objetivo')).toMatchObject({ tipo: 'texto', texto: 'Objetivo escrito.' });
    expect(sec('escopo')).toMatchObject({ intro: 'Etapas', cartoes: [{ imagens: [{ caminho: 'i.jpg' }] }] });
    expect(sec('sobre')?.tipo).toBe('sobre');
    expect(sec('responsabilidades')?.tipo).toBe('responsabilidades');
    expect(sec('garantia')).toMatchObject({ tipo: 'garantia', meses: 18 });
    expect(sec('documentacoes')).toBeUndefined();
    expect(sec('gestao')).toBeUndefined();
    expect(d.secoes.map((s) => s.id)).toEqual(documentoPadrao('tecnica').secoes.map((s) => s.id));
  });
  it('comercial pega garantia e prazo da técnica', () => {
    expect(resumoTecnica(null)).toMatchObject({ meses: 18, dias: 65 });
    const t = documentoPadrao('tecnica');
    t.secoes = t.secoes.map((s) => (s.tipo === 'garantia' ? { ...s, meses: 12 } : s.tipo === 'cronograma' ? { ...s, etapas: [{ nome: 'Tudo', dias: 40 }] } : s));
    expect(resumoTecnica(t)).toMatchObject({ meses: 12, dias: 40 });
  });
  it('troca o código nos textos', () => {
    expect(substituir('- Proposta técnica {codigo}', { cliente: '', local: '', validade_dias: '', codigo: '26-07-001' })).toBe('- Proposta técnica 26-07-001');
  });
});

describe('sincronizarEscopo (decisão 74)', () => {
  it('usa os nomes e a ordem dos itens dos Custos, mantendo texto e imagens da posição', () => {
    const doc = documentoPadrao('tecnica');
    const esc = doc.secoes.find((s) => s.id === 'escopo')!;
    if (esc.tipo === 'cartoes') esc.cartoes = [{ titulo: 'Antigo', texto: 'Texto A', imagens: [{ caminho: 'x.png', legenda: '' }] }, { titulo: 'Sobra', texto: 'Texto sobra' }, { titulo: 'Outra', texto: '' }];
    const r = sincronizarEscopo(doc, [{ descricao: 'Plataforma' }, { descricao: 'Escada' }]).secoes.find((s) => s.id === 'escopo')!;
    expect(r.tipo === 'cartoes' && r.cartoes).toEqual([{ titulo: 'Plataforma', texto: 'Texto A', imagens: [{ caminho: 'x.png', legenda: '' }] }, { titulo: 'Escada', texto: 'Texto sobra' }]);
    expect(sincronizarEscopo(doc, [])).toBe(doc);
  });
});

describe('fixarSecoesDoModelo (decisão 75)', () => {
  it('validade, confidencialidade e anexo vêm do modelo e sempre saem', () => {
    const modelo = documentoPadrao('tecnica');
    const anexoModelo = modelo.secoes.find((s) => s.id === 'anexo')!;
    if (anexoModelo.tipo === 'texto') anexoModelo.texto = 'Texto do modelo';
    const doc = documentoPadrao('tecnica');
    doc.secoes = doc.secoes.map((s) => (s.id === 'anexo' && s.tipo === 'texto' ? { ...s, texto: 'Texto antigo', ativo: false } : s.id === 'validade' ? { ...s, ativo: false } : s));
    const r = fixarSecoesDoModelo(doc, modelo);
    const anexo = r.secoes.find((s) => s.id === 'anexo')!;
    expect(anexo.ativo && anexo.tipo === 'texto' && anexo.texto).toBe('Texto do modelo');
    expect(r.secoes.find((s) => s.id === 'validade')!.ativo).toBe(true);
    const sem = { ...doc, secoes: doc.secoes.filter((s) => s.id !== 'confidencialidade') };
    expect(fixarSecoesDoModelo(sem, modelo).secoes.some((s) => s.id === 'confidencialidade' && s.ativo)).toBe(true);
  });
});

describe('fixarSecoesDoModelo na comercial (decisão 76)', () => {
  it('visão geral, impostos, anexo e confidencialidade vêm do modelo; pagamento e valores continuam da proposta', () => {
    const modelo = documentoPadrao('comercial');
    const imp = modelo.secoes.find((s) => s.id === 'impostos')!;
    if (imp.tipo === 'impostos') imp.ncm = '7308.90.10';
    const doc = documentoPadrao('comercial');
    doc.secoes = doc.secoes.map((s) => (s.id === 'impostos' ? { ...s, ativo: false } : s.tipo === 'pagamento' ? { ...s, condicao: '30 DDL' } : s));
    const r = fixarSecoesDoModelo(doc, modelo);
    const i = r.secoes.find((s) => s.id === 'impostos')!;
    expect(i.ativo && i.tipo === 'impostos' && i.ncm).toBe('7308.90.10');
    const p = r.secoes.find((s) => s.tipo === 'pagamento')!;
    expect(p.tipo === 'pagamento' && p.condicao).toBe('30 DDL');
  });
});

describe('pendencias (decisão 77)', () => {
  it('aponta o que falta e fica vazio quando está completo', () => {
    const doc = documentoPadrao('tecnica');
    const obj = doc.secoes.find((s) => s.id === 'objetivo')!;
    expect(pendencias(obj)).toEqual(['Texto']);
    expect(pendencias({ ...obj, tipo: 'texto', texto: 'Ok' } as typeof obj)).toEqual([]);
    const esc = sincronizarEscopo(doc, [{ descricao: 'Plataforma' }]).secoes.find((s) => s.id === 'escopo')!;
    expect(pendencias(esc, [{ letra: 'A', valor: 10 }])).toEqual(['Descrição do item A']);
    const val = documentoPadrao('comercial').secoes.find((s) => s.tipo === 'valores')!;
    expect(pendencias(val, [])).toEqual(['Itens na aba Custos']);
    expect(pendencias(val, [{ letra: 'A', valor: 0 }, { letra: 'B', valor: 5 }])).toEqual(['Valor do item A']);
    const garantia = doc.secoes.find((s) => s.tipo === 'garantia')!;
    expect(pendencias(garantia)).toEqual([]);
  });
});

describe('IA em uma seção só (decisão 81)', () => {
  it('troca só a seção pedida e leva o texto atual e o pedido na explicação', () => {
    const doc = documentoPadrao('tecnica');
    doc.secoes = doc.secoes.map((s) => (s.tipo === 'texto' && (s.id === 'objetivo' || s.id === 'aplicacao') ? { ...s, texto: `Antigo ${s.id}` } : s));
    const r = aplicarTextosIASecao(doc, { objetivo: 'Novo objetivo', aplicacao: 'Nova aplicação' }, 'aplicacao');
    const txt = (id: string) => { const s = r.secoes.find((x) => x.id === id)!; return s.tipo === 'texto' ? s.texto : ''; };
    expect(txt('aplicacao')).toBe('Nova aplicação');
    expect(txt('objetivo')).toBe('Antigo objetivo');
    const e = explicacaoParaSecao('Troca de corrimãos', doc.secoes.find((x) => x.id === 'objetivo')!, 'mais curto');
    expect(e).toContain('Antigo objetivo');
    expect(e.startsWith('PEDIDO PARA A SEÇÃO "Objetivo" (prioridade): mais curto')).toBe(true);
    // Texto longo não empurra o pedido para fora do limite da Edge Function.
    const longa = explicacaoParaSecao('x'.repeat(9000), { id: 'fora', titulo: 'Fora do Escopo', ativo: true, tipo: 'texto', texto: 'y'.repeat(9000) }, 'tire o item de pintura');
    expect(longa.length).toBeLessThanOrEqual(6000);
    expect(longa).toContain('tire o item de pintura');
  });
});

