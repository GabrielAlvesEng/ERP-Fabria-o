// Reimportação de nova revisão do CAD (decisão 38, regras R1 a R8): compara o JSON novo com a árvore do ERP
// e monta as operações para a RPC atualizar_solidworks. O banco valida e aplica tudo numa transação.
import type { Conjunto, Peca, TipoConjunto } from './regras';
import { lerJsonMacro, type NoPlano, type PecaPlano } from './solidworks';

export type Acao = 'novo' | 'alterado' | 'restaurado' | 'removido' | 'igual';
export interface LinhaDiff { acao: Acao; tipo: TipoConjunto | 'peca'; codigo: string; nome: string; mudancas: string[] }
export interface PlanoAtualizacao {
  arquivo: string; macro: string; codigo_cad_raiz: string;
  projeto_dados: Record<string, unknown>; raiz_dados: Record<string, unknown>;
  novos_nos: (NoPlano & { pai_id: string | null })[];
  novas_pecas: (PecaPlano & { conjunto_id: string | null })[];
  alterar_conjuntos: { id: string; dados: Record<string, unknown> }[];
  alterar_pecas: { id: string; dados: Record<string, unknown> }[];
  remover_conjuntos: string[];
  remover_pecas: string[];
  resumo: Record<string, number>;
}
export interface ResultadoComparacao { plano: PlanoAtualizacao; linhas: LinhaDiff[]; avisos: string[]; resumo: Record<Acao, number> }

const fmt = (v: unknown) => (v == null || v === '' ? '—' : Array.isArray(v) ? (v.length ? v.join('/') : '—') : typeof v === 'number' ? v.toLocaleString('pt-BR') : String(v));
const arred = (v: number | null | undefined, casas: number) => (v == null ? null : Math.round(Number(v) * 10 ** casas) / 10 ** casas);
const vazio = (v: unknown) => v == null || v === '' || (Array.isArray(v) && v.length === 0);
const chave = (pai: string, k: string | null | undefined) => `${pai}|${(k ?? '').toLowerCase()}`;
const ROTULO: Record<string, string> = {
  nome: 'Nome', descricao: 'Descrição', quantidade: 'Quantidade', cod_op: 'COD_OP', cod_mat: 'COD_MAT',
  espessura: 'Espessura', peso_unit: 'Peso un.', comprimento: 'Comprimento',
};

export function compararRevisao(texto: string, projetoCodigo: string, conjuntos: Conjunto[], pecas: Peca[], arquivo = ''): ResultadoComparacao {
  const leitura = lerJsonMacro(texto, projetoCodigo);
  // Avisos que só valem na importação inicial ficam de fora (códigos em uso e "entram como pendente").
  const avisos = leitura.avisos.filter((a) => !a.includes('será recusada') && !a.includes('entram como "pendente'));
  const geral = conjuntos.find((c) => c.tipo === 'geral');
  if (!geral) throw new Error('O projeto não tem montagem geral.');
  // R7: só a mesma montagem.
  if ((geral.codigo_cad ?? '').toUpperCase() !== leitura.plano.raiz.codigo_cad.toUpperCase()) {
    throw new Error(`Este JSON é da montagem ${leitura.plano.raiz.codigo_cad || '(sem código)'}, mas o projeto foi importado de ${geral.codigo_cad || '(nenhuma)'}.`);
  }

  // R6: só itens que vieram do CAD participam da comparação.
  const conjCad = conjuntos.filter((c) => c.tipo !== 'geral' && c.chave_cad);
  const pecCad = pecas.filter((p) => p.chave_cad);
  const conjPorChave = new Map(conjCad.map((c) => [chave(c.pai_id ?? '', c.chave_cad), c]));
  const conjPorCodigo = new Map(conjCad.filter((c) => c.codigo_cad).map((c) => [chave(c.pai_id ?? '', c.codigo_cad), c]));
  const pecPorChave = new Map(pecCad.map((p) => [chave(p.conjunto_id, p.chave_cad), p]));
  const pecPorCodigo = new Map(pecCad.filter((p) => p.codigo_cad).map((p) => [chave(p.conjunto_id, p.codigo_cad), p]));
  const usadosConj = new Set<string>();
  const usadosPec = new Set<string>();

  const plano: PlanoAtualizacao = {
    arquivo, macro: String(leitura.plano.projeto_dados.macro ?? ''), codigo_cad_raiz: leitura.plano.raiz.codigo_cad,
    projeto_dados: leitura.plano.projeto_dados, raiz_dados: leitura.plano.raiz.dados_cad,
    novos_nos: [], novas_pecas: [], alterar_conjuntos: [], alterar_pecas: [], remover_conjuntos: [], remover_pecas: [], resumo: {},
  };
  const linhas: LinhaDiff[] = [];
  const idDoRef = new Map<string, string>(); // ref do JSON → id do conjunto existente
  const linhaDoRef = new Map<string, LinhaDiff>(); // ref do JSON → linha de nó novo (para preencher o código previsto)

  // Conjuntos, na ordem do JSON (pais antes dos filhos).
  for (const no of leitura.plano.nos) {
    const paiId = no.pai_ref ? idDoRef.get(no.pai_ref) : geral.id;
    let atual: Conjunto | undefined;
    if (paiId) {
      atual = conjPorChave.get(chave(paiId, no.chave_cad));
      if (!atual || usadosConj.has(atual.id)) atual = no.codigo_cad ? conjPorCodigo.get(chave(paiId, no.codigo_cad)) : undefined;
      if (atual && (usadosConj.has(atual.id) || atual.tipo !== no.tipo)) atual = undefined;
    }
    if (!atual) {
      // Pai já existe no ERP → pai_id; pai também é novo nesta revisão → pai_ref.
      plano.novos_nos.push({ ...no, pai_id: paiId ?? null, pai_ref: paiId ? null : no.pai_ref });
      const l: LinhaDiff = { acao: 'novo', tipo: no.tipo, codigo: '', nome: no.nome, mudancas: [] };
      linhas.push(l);
      linhaDoRef.set(no.ref, l);
      continue;
    }
    usadosConj.add(atual.id);
    idDoRef.set(no.ref, atual.id);
    const dados: Record<string, unknown> = {};
    const mudancas: string[] = [];
    if (no.nome && no.nome !== atual.nome) { dados.nome = no.nome; mudancas.push(`Nome: ${atual.nome} → ${no.nome}`); }
    if (arred(no.quantidade, 3) !== arred(atual.quantidade, 3)) { dados.quantidade = no.quantidade; mudancas.push(`Quantidade: ${fmt(Number(atual.quantidade))} → ${fmt(no.quantidade)}`); }
    const restaurar = Boolean(atual.removido_cad_em);
    const trocouChave = (atual.chave_cad ?? '') !== no.chave_cad || (atual.codigo_cad ?? '') !== no.codigo_cad;
    if (mudancas.length || restaurar || trocouChave) {
      Object.assign(dados, { codigo_cad: no.codigo_cad, arquivo_cad: no.arquivo_cad, chave_cad: no.chave_cad, dados_cad: no.dados_cad, ...(restaurar ? { restaurar: true } : {}) });
      plano.alterar_conjuntos.push({ id: atual.id, dados });
    }
    if (trocouChave && !mudancas.length && !restaurar) mudancas.push('Arquivo do CAD renomeado ou movido (reconhecido pelo código)');
    linhas.push({ acao: restaurar ? 'restaurado' : mudancas.length ? 'alterado' : 'igual', tipo: atual.tipo, codigo: atual.codigo, nome: atual.nome, mudancas: restaurar ? ['Voltou ao CAD', ...mudancas] : mudancas });
  }

  // Peças.
  const linhasPecasNovas: { linha: LinhaDiff; pc: PecaPlano; conjuntoId: string | null }[] = [];
  for (const pc of leitura.plano.pecas) {
    const conjId = pc.no_ref ? idDoRef.get(pc.no_ref) : geral.id;
    let atual: Peca | undefined;
    if (conjId) {
      atual = pecPorChave.get(chave(conjId, pc.chave_cad));
      if (!atual || usadosPec.has(atual.id)) atual = pc.codigo_cad ? pecPorCodigo.get(chave(conjId, pc.codigo_cad)) : undefined;
      if (atual && usadosPec.has(atual.id)) atual = undefined;
    }
    if (!atual) {
      plano.novas_pecas.push({ ...pc, conjunto_id: conjId ?? null, no_ref: conjId ? null : pc.no_ref });
      const l: LinhaDiff = { acao: 'novo', tipo: 'peca', codigo: '', nome: pc.descricao, mudancas: [] };
      linhas.push(l);
      linhasPecasNovas.push({ linha: l, pc, conjuntoId: conjId ?? null });
      continue;
    }
    usadosPec.add(atual.id);
    const dados: Record<string, unknown> = {};
    const mudancas: string[] = [];
    const comparar = (campo: keyof PecaPlano & keyof Peca, novo: unknown, antigo: unknown, igual: boolean) => {
      if (igual) return;
      // R2: o CAD vence quando traz valor; vazio no CAD mantém o valor do ERP.
      if (vazio(novo) && !vazio(antigo)) {
        if (campo !== 'descricao') avisos.push(`${atual!.codigo}: ${ROTULO[campo]} vazio no CAD; mantido o valor do ERP (${fmt(antigo)}).`);
        return;
      }
      dados[campo] = novo;
      mudancas.push(`${ROTULO[campo]}: ${fmt(antigo)} → ${fmt(novo)}`);
    };
    comparar('descricao', pc.descricao, atual.descricao, pc.descricao === atual.descricao);
    comparar('quantidade', pc.quantidade, Number(atual.quantidade), arred(pc.quantidade, 3) === arred(atual.quantidade, 3));
    comparar('cod_op', pc.cod_op, atual.cod_op, [...pc.cod_op].sort().join() === [...atual.cod_op].sort().join());
    comparar('cod_mat', pc.cod_mat, atual.cod_mat, (pc.cod_mat ?? '') === (atual.cod_mat ?? ''));
    comparar('espessura', pc.espessura, atual.espessura == null ? null : Number(atual.espessura), arred(pc.espessura, 2) === arred(atual.espessura, 2));
    comparar('peso_unit', pc.peso_unit, atual.peso_unit == null ? null : Number(atual.peso_unit), arred(pc.peso_unit, 3) === arred(atual.peso_unit, 3));
    comparar('comprimento', pc.comprimento, atual.comprimento == null ? null : Number(atual.comprimento), arred(pc.comprimento, 2) === arred(atual.comprimento, 2));
    if ('cod_mat' in dados) dados.material = pc.material;
    const restaurar = Boolean(atual.removido_cad_em);
    const trocouChave = (atual.chave_cad ?? '') !== pc.chave_cad || (atual.codigo_cad ?? '') !== pc.codigo_cad;
    if (mudancas.length || restaurar || trocouChave) {
      Object.assign(dados, { codigo_cad: pc.codigo_cad, arquivo_cad: pc.arquivo_cad, chave_cad: pc.chave_cad, dados_cad: pc.dados_cad, ...(restaurar ? { restaurar: true } : {}) });
      plano.alterar_pecas.push({ id: atual.id, dados });
    }
    if (trocouChave && !mudancas.length && !restaurar) mudancas.push('Arquivo do CAD renomeado ou movido (reconhecido pelo código)');
    linhas.push({ acao: restaurar ? 'restaurado' : mudancas.length ? 'alterado' : 'igual', tipo: 'peca', codigo: atual.codigo, nome: atual.descricao, mudancas: restaurar ? ['Voltou ao CAD', ...mudancas] : mudancas });
  }

  // R1: o que era do CAD e não veio mais fica marcado como removido.
  const chavesNovas = new Set([...plano.novos_nos.map((n) => n.chave_cad.toLowerCase()), ...plano.novas_pecas.map((p) => p.chave_cad.toLowerCase())]);
  for (const c of conjCad) {
    if (usadosConj.has(c.id) || c.removido_cad_em) continue;
    plano.remover_conjuntos.push(c.id);
    linhas.push({ acao: 'removido', tipo: c.tipo, codigo: c.codigo, nome: c.nome, mudancas: [] });
    if (chavesNovas.has((c.chave_cad ?? '').toLowerCase())) avisos.push(`${c.codigo} (${c.nome}) parece ter mudado de lugar no CAD: fica marcado como removido e entra como novo, com código novo.`);
  }
  for (const p of pecCad) {
    if (usadosPec.has(p.id) || p.removido_cad_em) continue;
    plano.remover_pecas.push(p.id);
    linhas.push({ acao: 'removido', tipo: 'peca', codigo: p.codigo, nome: p.descricao, mudancas: [] });
    if (chavesNovas.has((p.chave_cad ?? '').toLowerCase())) avisos.push(`${p.codigo} (${p.descricao}) parece ter mudado de lugar no CAD: fica marcado como removido e entra como novo, com código novo.`);
  }

  // Códigos previstos dos novos (R3), na mesma ordem do banco: nós primeiro, depois peças.
  const usados = new Set<string>([...conjuntos.map((c) => c.codigo), ...pecas.map((p) => p.codigo)]);
  const porId = new Map(conjuntos.map((c) => [c.id, c]));
  const codigoNo = new Map<string, { codigo: string; tipo: TipoConjunto }>();
  const proximoLivre = (base: string) => {
    for (let n = 1; n < 1000; n++) {
      const c = base.slice(0, -3) + String(n).padStart(3, '0');
      if (!usados.has(c)) return c;
    }
    return base;
  };
  for (const no of plano.novos_nos) {
    const pai = no.pai_id ? porId.get(no.pai_id) : undefined;
    const paiCodigo = pai?.codigo ?? codigoNo.get(no.pai_ref ?? '')?.codigo ?? '';
    let cod = no.sufixo ? `${projetoCodigo}-${no.sufixo}` : no.tipo === 'soldado' ? proximoLivre(paiCodigo) : '(automático)';
    if (no.sufixo && usados.has(cod)) { avisos.push(`O código ${cod} (de ${no.nome}) já existe neste projeto: a atualização será recusada.`); cod += ' (em uso)'; }
    usados.add(cod);
    codigoNo.set(no.ref, { codigo: cod, tipo: no.tipo });
    const l = linhaDoRef.get(no.ref);
    if (l) l.codigo = cod;
  }
  const seqSoldado = new Map<string, number>();
  for (const { linha, pc, conjuntoId } of linhasPecasNovas) {
    const pai = conjuntoId ? porId.get(conjuntoId) : undefined;
    const paiNovo = !pai && pc.no_ref ? codigoNo.get(pc.no_ref) : undefined;
    const base = pai?.codigo ?? paiNovo?.codigo ?? '';
    const ehSoldado = (pai?.tipo ?? paiNovo?.tipo) === 'soldado';
    if (ehSoldado) {
      if (!seqSoldado.has(base)) {
        const max = pecas.filter((p) => p.codigo.startsWith(base + '.')).reduce((m, p) => Math.max(m, Number(p.codigo.split('.').pop()) || 0), 0);
        seqSoldado.set(base, max);
      }
      const n = seqSoldado.get(base)! + 1;
      seqSoldado.set(base, n);
      linha.codigo = `${base}.${String(n).padStart(2, '0')}`;
    } else if (pc.sufixo) {
      linha.codigo = `${projetoCodigo}-${pc.sufixo}`;
      if (usados.has(linha.codigo)) avisos.push(`O código ${linha.codigo} (de ${pc.descricao}) já existe neste projeto: a atualização será recusada.`);
    } else {
      linha.codigo = proximoLivre(base);
    }
    usados.add(linha.codigo);
  }

  const resumo = { novo: 0, alterado: 0, restaurado: 0, removido: 0, igual: 0 } as Record<Acao, number>;
  linhas.forEach((l) => { resumo[l.acao] += 1; });
  plano.resumo = { ...resumo };
  return { plano, linhas, avisos, resumo };
}
