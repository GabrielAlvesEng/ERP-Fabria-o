import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pencil, Plus, X } from 'lucide-react';
import { moeda } from '@/shared/lib/formato';
import { Aviso, Botao, Caixa, Campo, CampoEscolha, CampoNumero, Carregando, Cartao, Entrada, Selecao, Vazio } from '@/shared/ui';
import { atualizar, inserir, listarChapas, listarMateriaisBase, listarPrecosChapa, listarTipos, type Chapa } from '@/modules/biblioteca/api';
import { descricaoChapa, lerMedida, pesoChapa, valorTotalChapa } from '@/modules/biblioteca/regras';
import { CHAVES, Tabela, linha, molduraNumero, td, th, useGravar } from './comum';

interface Form { id?: string; material: string; tipo_id: string; esp: string; larg: number; comp: number; pesoManual: boolean; peso: number; valorKg: number | null }
const vazio: Form = { material: '', tipo_id: '', esp: '', larg: 1250, comp: 3000, pesoManual: false, peso: 0, valorKg: null };

// Biblioteca → Chapas (decisão 48): material, tipo, espessura (mm ou pol.), medidas, peso automático ou manual, valor/kg herdado ou próprio.
export function ChapasAba() {
  const { erro, setErro, gravar } = useGravar();
  const { data: materiais = [] } = useQuery({ queryKey: CHAVES.materiais, queryFn: listarMateriaisBase });
  const { data: tipos = [] } = useQuery({ queryKey: CHAVES.tipos, queryFn: listarTipos });
  const { data: precos = [] } = useQuery({ queryKey: CHAVES.precosChapa, queryFn: listarPrecosChapa });
  const { data: chapas = [], isLoading } = useQuery({ queryKey: CHAVES.chapas, queryFn: listarChapas });
  const [f, setF] = useState<Form>(vazio);
  const [busca, setBusca] = useState('');
  const [novoPreco, setNovoPreco] = useState({ material: '', tipo_id: '', valor: 0 });

  const tiposChapa = tipos.filter((t) => t.grupo === 'Chapas' && t.ativo);
  const nomeMat = (cod: string) => materiais.find((m) => m.cod_mat === cod)?.nome ?? cod;
  const porNome = (nome: string) => materiais.find((m) => m.nome.toLowerCase() === nome.trim().toLowerCase());
  const opcoesMat = materiais.filter((m) => m.ativo).map((m) => ({ valor: m.nome, detalhe: m.categoria.replace(/^\d+ - /, '') }));
  const herdado = (cod: string, tipo: string) => precos.find((p) => p.cod_mat === cod && p.tipo_id === tipo)?.valor_kg ?? null;

  // Cálculo do formulário.
  const mat = porNome(f.material);
  const tipo = tiposChapa.find((t) => t.id === f.tipo_id);
  const espMm = lerMedida(f.esp);
  const pesoAuto = tipo?.formato === 'chapa_lisa' && espMm ? pesoChapa(espMm, f.larg, f.comp, mat?.densidade) : null;
  const manual = f.pesoManual || pesoAuto == null;
  const peso = manual ? f.peso : pesoAuto!;
  const valorKg = f.valorKg ?? (mat && tipo ? herdado(mat.cod_mat, tipo.id) : null) ?? 0;
  const descricao = tipo && mat && f.esp ? descricaoChapa(tipo.nome, f.esp, f.larg, f.comp, mat.nome) : '';

  async function salvar() {
    setErro('');
    if (!mat) return setErro('Escolha um material da lista.');
    if (!tipo) return setErro('Escolha o tipo da chapa.');
    if (!espMm) return setErro('Espessura inválida. Use mm (2,00) ou polegada (1/4").');
    if (!(f.larg > 0 && f.comp > 0)) return setErro('Informe largura e comprimento.');
    if (!(peso > 0)) return setErro(tipo.formato === 'chapa_manual' ? 'Este tipo não tem peso automático: informe o peso.' : 'Informe o peso ou confira a densidade do material.');
    const dados = {
      cod_mat: mat.cod_mat, tipo_id: tipo.id, espessura_txt: f.esp.trim(), espessura_mm: espMm, largura_mm: f.larg, comprimento_mm: f.comp,
      peso_kg: peso, peso_manual: manual, valor_kg: f.valorKg, descricao,
    };
    if (await gravar(() => (f.id ? atualizar('bib_chapas', { id: f.id }, dados) : inserir('bib_chapas', dados)))) setF(vazio);
  }

  function editar(c: Chapa) {
    setF({ id: c.id, material: nomeMat(c.cod_mat), tipo_id: c.tipo_id, esp: c.espessura_txt, larg: Number(c.largura_mm), comp: Number(c.comprimento_mm),
      pesoManual: c.peso_manual, peso: Number(c.peso_kg), valorKg: c.valor_kg == null ? null : Number(c.valor_kg) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return chapas.filter((c) => !t || c.descricao.toLowerCase().includes(t));
  }, [chapas, busca]);

  return (
    <div className="space-y-4">
      {erro && <Aviso>{erro}</Aviso>}
      <Cartao>
        <div className="mb-3 flex items-center justify-between">
          <span className="font-semibold">{f.id ? 'Editar chapa' : 'Nova chapa'}</span>
          {f.id && <Botao variante="fantasma" onClick={() => setF(vazio)}><X size={14} /> Cancelar edição</Botao>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Campo rotulo="Material"><CampoEscolha celula={false} valor={f.material} opcoes={opcoesMat} placeholder="Ex.: AISI 304" onConfirmar={(v) => setF({ ...f, material: v })} /></Campo>
          <Campo rotulo="Tipo">
            <Selecao value={f.tipo_id} onChange={(e) => setF({ ...f, tipo_id: e.target.value })}>
              <option value="">Escolha…</option>
              {tiposChapa.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </Selecao>
          </Campo>
          <Campo rotulo={`Espessura (mm ou pol.)${espMm && /"|\//.test(f.esp) ? ` = ${espMm.toLocaleString('pt-BR')} mm` : ''}`}>
            <Entrada value={f.esp} onChange={(e) => setF({ ...f, esp: e.target.value })} placeholder='2,00 ou 1/4"' />
          </Campo>
          <div className="grid grid-cols-2 gap-2">
            <Campo rotulo="Largura (mm)"><div className={molduraNumero}><CampoNumero valor={f.larg} casas={1} className="py-1.5" onConfirmar={(n) => setF({ ...f, larg: n })} /></div></Campo>
            <Campo rotulo="Comprimento (mm)"><div className={molduraNumero}><CampoNumero valor={f.comp} casas={1} className="py-1.5" onConfirmar={(n) => setF({ ...f, comp: n })} /></div></Campo>
          </div>
          <Campo rotulo={manual ? 'Peso (kg), digitado' : `Peso (kg), automático${mat?.densidade ? ` (${Number(mat.densidade).toLocaleString('pt-BR')} g/cm³)` : ''}`}>
            <div className={molduraNumero}>
              <CampoNumero valor={peso} casas={3} className="py-1.5" disabled={!manual} onConfirmar={(n) => setF({ ...f, peso: n })} />
            </div>
          </Campo>
          <div className="flex items-end pb-2">
            {pesoAuto != null && <Caixa marcado={f.pesoManual} onChange={(v) => setF({ ...f, pesoManual: v, peso: v ? pesoAuto : f.peso })}>Digitar o peso</Caixa>}
            {tipo?.formato === 'chapa_manual' && <span className="text-xs text-suave">{tipo.nome}: peso digitado (o cálculo pelas medidas não vale)</span>}
          </div>
          <Campo rotulo={f.valorKg == null ? 'Valor/kg (herdado do material + tipo)' : 'Valor/kg (próprio desta chapa)'}>
            <div className="flex items-center gap-2">
              <div className={`${molduraNumero} flex-1`}>
                <CampoNumero moeda valor={valorKg} casas={4} className="py-1.5" onConfirmar={(n) => setF({ ...f, valorKg: n })} />
              </div>
              {f.valorKg != null && <button type="button" className="text-xs text-roxo-600 hover:underline" onClick={() => setF({ ...f, valorKg: null })}>herdar</button>}
            </div>
          </Campo>
          <div className="flex flex-col justify-end text-sm">
            <span className="text-xs text-suave">Valor total</span>
            <span className="text-lg font-bold tabular-nums">{moeda(valorTotalChapa(peso, valorKg))}</span>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-suave">{descricao || 'A descrição é montada pelo material, tipo e medidas.'}</span>
          <Botao onClick={salvar}><Plus size={15} /> {f.id ? 'Salvar alterações' : 'Cadastrar chapa'}</Botao>
        </div>
      </Cartao>

      <div className="flex items-center gap-3">
        <Entrada className="max-w-sm" placeholder="Buscar chapa" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <span className="text-sm text-suave">{filtradas.length} chapa(s)</span>
      </div>
      {isLoading ? <Carregando /> : (
        <Tabela cabecalho={<><th className={th}>Chapa</th><th className={`${th} text-right`}>Peso (kg)</th><th className={`${th} text-right`}>Valor/kg</th><th className={`${th} text-right`}>Valor total</th><th className={th}>Ativa</th><th /></>}>
          {filtradas.length === 0 && <tr><td colSpan={6}><Vazio>Nenhuma chapa cadastrada ainda.</Vazio></td></tr>}
          {filtradas.map((c) => {
            const vk = c.valor_kg ?? herdado(c.cod_mat, c.tipo_id) ?? 0;
            return (
              <tr key={c.id} className={linha(c.ativo)}>
                <td className="px-2 py-1.5">{c.descricao}</td>
                <td className="px-2 text-right tabular-nums">{Number(c.peso_kg).toLocaleString('pt-BR')}{c.peso_manual && <span className="ml-1 text-[10px] text-slate-400">manual</span>}</td>
                <td className={`px-2 text-right tabular-nums ${c.valor_kg == null ? 'text-slate-400' : ''}`} title={c.valor_kg == null ? 'Herdado do material + tipo' : 'Valor próprio'}>{moeda(vk)}</td>
                <td className="px-2 text-right font-medium tabular-nums">{moeda(valorTotalChapa(Number(c.peso_kg), Number(vk)))}</td>
                <td className="px-2"><Caixa marcado={c.ativo} onChange={(ativo) => gravar(() => atualizar('bib_chapas', { id: c.id }, { ativo }))} /></td>
                <td className="px-1"><button onClick={() => editar(c)} className="rounded p-1 text-slate-400 hover:text-roxo-600" aria-label="Editar"><Pencil size={14} /></button></td>
              </tr>
            );
          })}
        </Tabela>
      )}

      <Cartao>
        <div className="mb-1 font-semibold">Preço por kg (material + tipo)</div>
        <p className="mb-3 text-sm text-suave">As chapas sem valor próprio usam este preço. Mude aqui quando o preço do material mudar.</p>
        <Tabela cabecalho={<><th className={th}>Material</th><th className={th}>Tipo</th><th className={`${th} w-40 text-right`}>R$/kg</th></>}>
          {precos.map((p) => (
            <tr key={p.id} className={linha()}>
              <td className="px-2 py-1">{nomeMat(p.cod_mat)}</td>
              <td className="px-2">{tipos.find((t) => t.id === p.tipo_id)?.nome}</td>
              <td className={td}><CampoNumero moeda valor={Number(p.valor_kg)} casas={4} onConfirmar={(n) => gravar(() => atualizar('bib_chapa_precos', { id: p.id }, { valor_kg: n }))} /></td>
            </tr>
          ))}
        </Tabela>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <Campo rotulo="Material" className="w-56"><CampoEscolha celula={false} valor={novoPreco.material} opcoes={opcoesMat} onConfirmar={(v) => setNovoPreco({ ...novoPreco, material: v })} /></Campo>
          <Campo rotulo="Tipo" className="w-48">
            <Selecao value={novoPreco.tipo_id} onChange={(e) => setNovoPreco({ ...novoPreco, tipo_id: e.target.value })}>
              <option value="">Escolha…</option>
              {tiposChapa.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </Selecao>
          </Campo>
          <Campo rotulo="R$/kg" className="w-32"><div className={molduraNumero}><CampoNumero moeda valor={novoPreco.valor} casas={4} className="py-1.5" onConfirmar={(n) => setNovoPreco({ ...novoPreco, valor: n })} /></div></Campo>
          <Botao variante="secundario" onClick={async () => {
            const m = porNome(novoPreco.material);
            if (!m || !novoPreco.tipo_id) return setErro('Escolha material e tipo para o preço.');
            if (await gravar(() => inserir('bib_chapa_precos', { cod_mat: m.cod_mat, tipo_id: novoPreco.tipo_id, valor_kg: novoPreco.valor }))) setNovoPreco({ material: '', tipo_id: '', valor: 0 });
          }}><Plus size={15} /> Adicionar preço</Botao>
        </div>
      </Cartao>
    </div>
  );
}
