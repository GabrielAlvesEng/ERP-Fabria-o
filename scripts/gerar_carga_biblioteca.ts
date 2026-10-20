// Gera a migration de carga da Biblioteca de Materiais a partir da lista de preços antiga (ref_materiais).
// Uso: npx vite-node scripts/gerar_carga_biblioteca.ts <perfis_chapas.json> > supabase/migrations/<arquivo>.sql
// O JSON é a exportação de "select tipo, unidade, preco, cod_mat, kg_m, descricao from ref_materiais where tipo <> 'Comerciais'".
// Usa as mesmas regras de peso da tela (src/modules/biblioteca/regras.ts). O que não for reconhecido fica "a revisar".
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { descricaoPerfil, kgPorMetro, lerDescricaoAntiga, lerMedida, tuboSch, type Formato } from '../src/modules/biblioteca/regras';

const FORMATO: Record<string, Formato> = {
  'Tubo Quadrado': 'tubo_quadrado', 'Tubo Retangular': 'tubo_retangular', 'Tubo Redondo OD': 'tubo_od', 'Tubo Redondo SCH': 'tubo_sch',
  'Barra Redonda': 'barra_redonda', 'Barra Quadrada': 'barra_quadrada', 'Barra Chata': 'barra_chata', Cantoneira: 'cantoneira',
  'Perfil U': 'perfil_u', 'Perfil UDC': 'perfil_u', 'Perfil H': 'perfil_h', 'Perfil HP': 'perfil_h', 'Perfil W': 'tabela', 'Viga I': 'tabela', 'Viga U': 'tabela',
};
// Mesmos nomes e densidades da migration 0018.
const MATERIAL: Record<string, { nome: string; dens: number }> = {
  'IN-001': { nome: 'AISI 304', dens: 8 }, 'IN-003': { nome: 'AISI 316', dens: 8 }, 'IN-004': { nome: 'AISI 316L', dens: 8 },
  'AC-003': { nome: 'SAE 1020', dens: 7.85 }, 'AC-008': { nome: 'ASTM A36', dens: 7.85 }, 'AC-009': { nome: 'ASTM A572 Grau 50', dens: 7.85 },
};
// Chapas antigas = preço por kg por material + tipo.
const CHAPAS: Record<string, [string, string] | null> = {
  'Chapa Aço Inox 304 (Kg)': ['IN-001', 'Chapa Lisa'], 'Chapa Aço Inox 316L (Kg)': ['IN-004', 'Chapa Lisa'], 'Chapa Aço Carbono ASTM A36(Kg)': ['AC-008', 'Chapa Lisa'],
  'Chapa Xadrez ASTM A36(Kg)': ['AC-008', 'Chapa Xadrez'], 'Chapa Xadrez Inox 304(Kg)': ['IN-001', 'Chapa Xadrez'],
  'Tela Moeda ASTM A36(Kg)': ['AC-008', 'Tela Moeda'], 'Tela Moeda Inox 304(Kg)': ['IN-001', 'Tela Moeda'],
  'Chapa Expandida ASTM A36(Kg)': ['AC-008', 'Chapa Expandida'], 'Chapa Expandida Inox 304(Kg)': ['IN-001', 'Chapa Expandida'],
};

const q = (s: string | null) => (s == null ? 'null' : `'${s.replace(/'/g, "''")}'`);
// Chave curta da linha antiga (igual a left(md5(descricao), 10) no banco).
const chave = (d: string) => createHash('md5').update(d, 'utf8').digest('hex').slice(0, 10);
const n = (v: number | null) => (v == null ? 'null' : String(v));

const rows: { tipo: string; unidade: string; preco: string; descricao: string }[] = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const vistos = new Set<string>();
const revisar: string[] = [];
const perfis: string[] = [];
const chapas: string[] = [];

for (const r of rows.filter((x) => x.tipo === 'Chapas')) {
  const m = CHAPAS[r.descricao];
  if (!m) { revisar.push(r.descricao); continue; }
  chapas.push(`(${q(m[0])},${q(m[1])},${Number(r.preco)},${q(r.descricao)})`);
}

for (const r of rows.filter((x) => x.tipo === 'Perfis')) {
  const p = lerDescricaoAntiga(r.descricao);
  const mat = p && MATERIAL[p.material];
  if (!p || !mat) { revisar.push(r.descricao); continue; }
  const formato = FORMATO[p.tipo];
  let a = lerMedida(p.a), parede = lerMedida(p.parede);
  if (formato === 'tubo_sch') { const t = tuboSch(p.a, p.parede); a = t?.od ?? null; parede = t?.parede ?? null; }
  if (formato === 'tabela') a = null;
  const b = lerMedida(p.b), c = lerMedida(p.c);
  const kg = kgPorMetro(formato, { a, b, c, parede }, mat.dens);
  const parTxt = formato === 'tubo_sch' ? p.parede.replace(/^SCH\s*/i, '') : p.parede.replace(/\s*mm$/i, '');
  const desc = descricaoPerfil(p.tipo, formato, { a: p.a, b: p.b, c: p.c, parede: parTxt }, mat.nome);
  if (vistos.has(desc)) { revisar.push(`${r.descricao} (repetido: ${desc})`); continue; }
  vistos.add(desc);
  perfis.push(`(${q(p.material)},${q(p.tipo)},${q(p.a)},${q(p.b)},${q(p.c)},${q(parTxt)},${n(a)},${n(b)},${n(c)},${n(parede)},${n(kg)},${q(p.unidade)},${Number(r.preco)},${q(desc)},${q(chave(r.descricao))})`);
}

console.log(`-- Carga inicial da Biblioteca de Materiais (decisão 48), gerada por scripts/gerar_carga_biblioteca.ts a partir da lista de preços antiga.
-- Comerciais entram direto; chapas viram preço por kg por material + tipo; perfis são lidos pelo nome, com kg/m calculado.
-- Não reconhecidos (ficam "a revisar" em Predefinições, ref_materiais.migrado = false): ${revisar.length}
${revisar.map((d) => `--   ${d}`).join('\n')}

insert into public.bib_itens (grupo, descricao, material, unidade, valor, origem_ref)
select 'Comerciais', r.descricao, coalesce(c.nome, ''), 'un', r.preco, r.id
from public.ref_materiais r left join public.catalogo_materiais c on c.cod_mat = r.cod_mat
where r.tipo = 'Comerciais' and r.ativo;
update public.ref_materiais set migrado = true where tipo = 'Comerciais' and ativo;

create temporary table _chapas (cod_mat text, tipo text, valor numeric, antiga text) on commit drop;
insert into _chapas values
${chapas.join(',\n')};
insert into public.bib_chapa_precos (cod_mat, tipo_id, valor_kg)
select c.cod_mat, t.id, c.valor from _chapas c join public.bib_tipos t on t.grupo = 'Chapas' and t.nome = c.tipo;
update public.ref_materiais r set migrado = true from _chapas c where r.tipo = 'Chapas' and r.descricao = c.antiga;

create temporary table _perfis (cod_mat text, tipo text, a_txt text, b_txt text, c_txt text, parede_txt text,
  a_mm numeric, b_mm numeric, c_mm numeric, parede_mm numeric, kg_m numeric, preco_modo text, valor numeric, descricao text, chave text) on commit drop;
insert into _perfis values
${perfis.join(',\n')};
insert into public.bib_perfis (cod_mat, tipo_id, a_txt, b_txt, c_txt, parede_txt, a_mm, b_mm, c_mm, parede_mm, kg_m, preco_modo, valor, descricao, origem_ref)
select p.cod_mat, t.id, p.a_txt, p.b_txt, p.c_txt, p.parede_txt, p.a_mm, p.b_mm, p.c_mm, p.parede_mm, p.kg_m, p.preco_modo, p.valor, p.descricao, r.id
from _perfis p join public.bib_tipos t on t.grupo = 'Perfis' and t.nome = p.tipo join public.ref_materiais r on r.tipo = 'Perfis' and left(md5(r.descricao), 10) = p.chave;
update public.ref_materiais r set migrado = true from _perfis p where r.tipo = 'Perfis' and left(md5(r.descricao), 10) = p.chave;`);
