import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { moeda } from '@/shared/lib/formato';
import { Aviso, Botao, Caixa, Campo, CampoEscolha, CampoNumero, Entrada, Selecao } from '@/shared/ui';
import { atualizar, inserir, listarMateriaisBase, listarPesosPerfil, listarTipos, type MaterialBase, type Perfil } from '@/modules/biblioteca/api';
import {
  FORMATOS, NPS, SCHS, descricaoPerfil, kgPorMetro, kgPorMetroTabela, lerMedida, precosPerfil, tuboSch, type Formato, type ModoPreco,
} from '@/modules/biblioteca/regras';
import { CHAVES, Tabela, linha, molduraNumero, td, th, useGravar } from './comum';

interface Form { id?: string; material: string; tipo_id: string; a: string; b: string; c: string; parede: string; kgManual: boolean; kg: number; modo: ModoPreco; valor: number }
const vazio: Form = { material: '', tipo_id: '', a: '', b: '', c: '', parede: '', kgManual: false, kg: 0, modo: 'm', valor: 0 };

// kg/m automático do formulário: fórmula (tubos, barras, cantoneiras, U e H), tabela SCH, ou base de pesos (W, I, U laminado).
function kgAuto(formato: Formato | undefined, f: Form, dens: number | null | undefined, basePeso: number | null): number | null {
  if (!formato) return null;
  if (formato === 'tabela') return basePeso != null ? kgPorMetroTabela(basePeso, dens) : null;
  if (formato === 'tubo_sch') {
    const t = tuboSch(f.a, f.parede);
    return t ? kgPorMetro(formato, { a: t.od, parede: t.parede }, dens) : null;
  }
  return kgPorMetro(formato, { a: lerMedida(f.a), b: lerMedida(f.b), c: lerMedida(f.c), parede: lerMedida(f.parede) }, dens);
}

const doCadastro = (p: Perfil, materiais: MaterialBase[]): Form => ({
  id: p.id, material: materiais.find((m) => m.cod_mat === p.cod_mat)?.nome ?? p.cod_mat ?? '', tipo_id: p.tipo_id, a: p.a_txt, b: p.b_txt, c: p.c_txt, parede: p.parede_txt,
  kgManual: p.kg_m_manual, kg: Number(p.kg_m ?? 0), modo: p.preco_modo, valor: Number(p.valor),
});

// Cadastro de perfil (decisão 48; em Compras → Produtos desde a decisão 114): tipo e medidas, kg/m automático
// (fórmula, tabela SCH ou base de pesos) ou digitado, preço por metro ou por kg.
export function FormPerfil({ inicial, onSalvo }: { inicial?: Perfil | null; onSalvo: (descricao: string) => void }) {
  const { erro, setErro, gravar } = useGravar();
  const { data: materiais = [] } = useQuery({ queryKey: CHAVES.materiais, queryFn: listarMateriaisBase });
  const { data: tipos = [] } = useQuery({ queryKey: CHAVES.tipos, queryFn: listarTipos });
  const { data: pesos = [] } = useQuery({ queryKey: CHAVES.pesos, queryFn: listarPesosPerfil });
  const [f, setF] = useState<Form>(inicial ? doCadastro(inicial, materiais) : vazio);

  const tiposPerfil = tipos.filter((t) => t.grupo === 'Perfis' && t.ativo);
  const porNome = (nome: string) => materiais.find((m) => m.nome.toLowerCase() === nome.trim().toLowerCase() || m.cod_mat === nome.trim());
  const opcoesMat = materiais.filter((m) => m.ativo).map((m) => ({ valor: m.nome, detalhe: m.categoria.replace(/^\d+ - /, '') }));

  const mat = porNome(f.material);
  const tipo = tiposPerfil.find((t) => t.id === f.tipo_id);
  const formato = tipo?.formato as Formato | undefined;
  const def = formato && formato in FORMATOS ? FORMATOS[formato as keyof typeof FORMATOS] : undefined;
  const basePeso = formato === 'tabela' ? pesos.find((p) => p.tipo_id === f.tipo_id && p.bitola === f.a)?.kg_m ?? null : null;
  const auto = kgAuto(formato, f, mat?.densidade, basePeso == null ? null : Number(basePeso));
  const manual = f.kgManual || auto == null;
  const kg = manual ? f.kg : auto!;
  const precos = precosPerfil(f.modo, f.valor, kg > 0 ? kg : null);
  const descricao = tipo && mat && f.a ? descricaoPerfil(tipo.nome, formato!, { a: f.a, b: f.b, c: f.c, parede: f.parede }, mat.nome) : '';

  async function salvar() {
    setErro('');
    if (!mat) return setErro('Escolha um material da lista.');
    if (!tipo || !formato) return setErro('Escolha o tipo do perfil.');
    if (!f.a.trim()) return setErro(`Informe ${def?.a?.toLowerCase() ?? 'o tamanho'}.`);
    if (formato === 'tubo_sch' && !tuboSch(f.a, f.parede)) return setErro('Bitola e SCH sem parede na tabela ASME. Confira a combinação.');
    const sch = formato === 'tubo_sch' ? tuboSch(f.a, f.parede) : null;
    const dados = {
      cod_mat: mat.cod_mat, tipo_id: tipo.id, a_txt: f.a.trim(), b_txt: f.b.trim(), c_txt: f.c.trim(), parede_txt: f.parede.trim(),
      a_mm: sch ? sch.od : formato === 'tabela' ? null : lerMedida(f.a), b_mm: lerMedida(f.b), c_mm: lerMedida(f.c), parede_mm: sch ? sch.parede : lerMedida(f.parede),
      kg_m: kg > 0 ? kg : null, kg_m_manual: manual && kg > 0, preco_modo: f.modo, valor: f.valor, descricao,
    };
    if (await gravar(() => (f.id ? atualizar('bib_perfis', { id: f.id }, dados) : inserir('bib_perfis', dados)))) onSalvo(descricao);
  }

  return (
    <div className="space-y-3">
      {erro && <Aviso>{erro}</Aviso>}
      <div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Campo rotulo="Material"><CampoEscolha celula={false} valor={f.material} opcoes={opcoesMat} placeholder="Ex.: AISI 304" onConfirmar={(v) => setF({ ...f, material: v })} /></Campo>
          <Campo rotulo="Tipo">
            <Selecao value={f.tipo_id} onChange={(e) => setF({ ...vazio, id: f.id, material: f.material, modo: f.modo, valor: f.valor, tipo_id: e.target.value })}>
              <option value="">Escolha…</option>
              {tiposPerfil.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </Selecao>
          </Campo>
          {formato === 'tubo_sch' ? (
            <>
              <Campo rotulo="Bitola (NPS)">
                <Selecao value={f.a} onChange={(e) => setF({ ...f, a: e.target.value })}>
                  <option value="">Escolha…</option>
                  {NPS.map((n) => <option key={n.nps} value={n.nps}>{n.nps} (Ø {n.od.toLocaleString('pt-BR')} mm)</option>)}
                </Selecao>
              </Campo>
              <Campo rotulo="Parede (SCH)">
                <Selecao value={f.parede} onChange={(e) => setF({ ...f, parede: e.target.value })}>
                  <option value="">Escolha…</option>
                  {SCHS.map((s) => <option key={s} value={s.replace('SCH ', '')}>{s}</option>)}
                </Selecao>
              </Campo>
            </>
          ) : formato === 'tabela' ? (
            <Campo rotulo="Bitola (base de pesos)" className="lg:col-span-2">
              <CampoEscolha celula={false} valor={f.a} placeholder="Escolha ou digite a bitola"
                opcoes={pesos.filter((p) => p.tipo_id === f.tipo_id && p.ativo).map((p) => ({ valor: p.bitola, detalhe: `${Number(p.kg_m).toLocaleString('pt-BR')} kg/m` }))}
                onConfirmar={(v) => setF({ ...f, a: v })} />
            </Campo>
          ) : def ? (
            <>
              <Campo rotulo={`${def.a} (mm ou pol.)`}><Entrada value={f.a} onChange={(e) => setF({ ...f, a: e.target.value })} placeholder='50 ou 2"' /></Campo>
              {def.b && <Campo rotulo={`${def.b}${def.bOpcional ? ' (se diferente)' : ''}`}><Entrada value={f.b} onChange={(e) => setF({ ...f, b: e.target.value })} /></Campo>}
              {def.parede && <Campo rotulo={formato === 'perfil_h' ? 'Alma (mm)' : formato === 'cantoneira' ? 'Espessura (mm ou pol.)' : 'Parede (mm)'}><Entrada value={f.parede} onChange={(e) => setF({ ...f, parede: e.target.value })} placeholder="2,0" /></Campo>}
              {def.c && <Campo rotulo={def.c}><Entrada value={f.c} onChange={(e) => setF({ ...f, c: e.target.value })} /></Campo>}
            </>
          ) : <div className="text-sm text-suave sm:col-span-2">Escolha o tipo para ver as medidas.</div>}
          <Campo rotulo={manual ? 'Peso (kg/m), digitado' : 'Peso (kg/m), automático'}>
            <div className={molduraNumero}><CampoNumero valor={kg} casas={4} className="py-1.5" disabled={!manual} onConfirmar={(n) => setF({ ...f, kg: n })} /></div>
          </Campo>
          <div className="flex items-end pb-2">
            {auto != null && <Caixa marcado={f.kgManual} onChange={(v) => setF({ ...f, kgManual: v, kg: v ? auto : f.kg })}>Digitar o kg/m</Caixa>}
            {auto == null && formato && <span className="text-xs text-suave">{formato === 'tabela' ? 'Bitola fora da base de pesos: digite o kg/m.' : 'Complete as medidas (ou a densidade do material).'}</span>}
          </div>
          <Campo rotulo="Tipo de preço">
            <Selecao value={f.modo} onChange={(e) => setF({ ...f, modo: e.target.value as ModoPreco })}>
              <option value="m">Valor por metro (tubos e perfis vazados)</option>
              <option value="kg">Valor por kg (barras maciças e vigas)</option>
            </Selecao>
          </Campo>
          <Campo rotulo={f.modo === 'm' ? 'Valor/m' : 'Valor/kg'}>
            <div className={molduraNumero}><CampoNumero moeda valor={f.valor} casas={4} className="py-1.5" onConfirmar={(n) => setF({ ...f, valor: n })} /></div>
          </Campo>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-suave">
            {descricao || 'A descrição é montada pelo tipo, medidas e material.'}
            {f.valor > 0 && <> · {precos.porMetro != null && `${moeda(precos.porMetro)}/m`}{precos.porKg != null && ` · ${moeda(precos.porKg)}/kg`}</>}
          </span>
          <Botao onClick={salvar}><Plus size={15} /> {f.id ? 'Salvar alterações' : 'Cadastrar perfil'}</Botao>
        </div>
      </div>

    </div>
  );
}

// Base de pesos dos perfis de catálogo (W, I, U laminados).
export function PesosPerfil() {
  const { erro, setErro, gravar } = useGravar();
  const { data: tipos = [] } = useQuery({ queryKey: CHAVES.tipos, queryFn: listarTipos });
  const { data: pesos = [] } = useQuery({ queryKey: CHAVES.pesos, queryFn: listarPesosPerfil });
  const [novoPeso, setNovoPeso] = useState({ tipo_id: '', bitola: '', kg: 0 });
  const tiposTabela = tipos.filter((t) => t.grupo === 'Perfis' && t.ativo && t.formato === 'tabela');
  return (
    <div className="space-y-3">
      {erro && <Aviso>{erro}</Aviso>}
      <div>
        <div className="mb-1 font-semibold">Base de pesos dos perfis de catálogo</div>
        <p className="mb-3 text-sm text-suave">kg/m em aço carbono (W, I e U laminados). Para outro material o ERP corrige pela densidade. Valores de mercado: confira antes de usar.</p>
        <Tabela cabecalho={<><th className={th}>Tipo</th><th className={th}>Bitola</th><th className={`${th} w-32 text-right`}>kg/m</th><th className={th}>Fonte</th><th className={th}>Ativo</th></>}>
          {pesos.map((p) => (
            <tr key={p.id} className={linha(p.ativo)}>
              <td className="px-2 py-1">{tipos.find((t) => t.id === p.tipo_id)?.nome}</td>
              <td className="px-2">{p.bitola}</td>
              <td className={td}><CampoNumero valor={Number(p.kg_m)} casas={3} onConfirmar={(n) => n > 0 && gravar(() => atualizar('bib_pesos_perfil', { id: p.id }, { kg_m: n }))} /></td>
              <td className="px-2 text-xs text-suave">{p.fonte}</td>
              <td className="px-2"><Caixa marcado={p.ativo} onChange={(ativo) => gravar(() => atualizar('bib_pesos_perfil', { id: p.id }, { ativo }))} /></td>
            </tr>
          ))}
        </Tabela>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <Campo rotulo="Tipo" className="w-44">
            <Selecao value={novoPeso.tipo_id} onChange={(e) => setNovoPeso({ ...novoPeso, tipo_id: e.target.value })}>
              <option value="">Escolha…</option>
              {tiposTabela.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </Selecao>
          </Campo>
          <Campo rotulo="Bitola" className="w-44"><Entrada value={novoPeso.bitola} onChange={(e) => setNovoPeso({ ...novoPeso, bitola: e.target.value })} placeholder="W 200 x 26,6" /></Campo>
          <Campo rotulo="kg/m" className="w-28"><div className={molduraNumero}><CampoNumero valor={novoPeso.kg} casas={3} className="py-1.5" onConfirmar={(n) => setNovoPeso({ ...novoPeso, kg: n })} /></div></Campo>
          <Botao variante="secundario" onClick={async () => {
            if (!novoPeso.tipo_id || !novoPeso.bitola.trim() || !(novoPeso.kg > 0)) return setErro('Informe tipo, bitola e kg/m.');
            if (await gravar(() => inserir('bib_pesos_perfil', { tipo_id: novoPeso.tipo_id, bitola: novoPeso.bitola.trim(), kg_m: novoPeso.kg, fonte: 'Cadastrado no ERP' }))) setNovoPeso({ tipo_id: '', bitola: '', kg: 0 });
          }}><Plus size={15} /> Adicionar bitola</Botao>
        </div>
      </div>
    </div>
  );
}
