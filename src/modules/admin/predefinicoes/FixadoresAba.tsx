import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Folder, Layers, Plus, Settings2 } from 'lucide-react';
import { Aviso, AreaTexto, Botao, Caixa, Campo, CampoCelula, CampoNumero, Cartao, Entrada, Modal, Vazio } from '@/shared/ui';
import { atualizar, inserir, listarFixadores, listarItens, type FixadorMaterial, type FixadorTipo, type ItemBiblioteca } from '@/modules/biblioteca/api';
import { combinacoesNovas, compararTamanho, lerLista } from '@/modules/biblioteca/fixadores';
import { CHAVES, Tabela, linha, molduraNumero, td, th, useGravar } from './comum';

// Fixadores em pastas (decisão 58): tipo → material → tamanhos, valor por peça.
// A descrição ("Parafuso Allen Cab. Cilíndrica M8 x 20 Inox 304") é montada pelo banco.
export function FixadoresAba() {
  const { erro, setErro, gravar } = useGravar();
  const { data: base, isLoading } = useQuery({ queryKey: CHAVES.fixadores, queryFn: listarFixadores });
  const { data: todos = [] } = useQuery({ queryKey: CHAVES.itens, queryFn: listarItens });
  const [tipoId, setTipoId] = useState<string | null>(null);
  const [materialId, setMaterialId] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [config, setConfig] = useState<'tipo' | 'novoTipo' | null>(null);

  const itens = useMemo(() => todos.filter((i) => i.grupo === 'Fixadores'), [todos]);
  const tipos = base?.tipos ?? [];
  const materiais = base?.materiais ?? [];
  const tipo = tipos.find((t) => t.id === tipoId) ?? null;
  const material = materiais.find((m) => m.id === materialId) ?? null;
  const contar = (f: (i: ItemBiblioteca) => boolean) => {
    const l = itens.filter((i) => i.ativo && f(i));
    return { total: l.length, comPreco: l.filter((i) => Number(i.valor) > 0).length };
  };
  const abrirTipo = (id: string | null) => { setTipoId(id); setMaterialId(null); setBusca(''); };

  const termo = busca.trim().toLowerCase().split(/\s+/).filter(Boolean);
  // Ordem de catálogo: tipo, material e tamanho.
  const ordemTipo = (id?: string | null) => tipos.find((t) => t.id === id)?.ordem ?? 999;
  const ordemMat = (id?: string | null) => materiais.find((m) => m.id === id)?.ordem ?? 999;
  const achados = termo.length ? itens.filter((i) => termo.every((p) => i.descricao.toLowerCase().includes(p)))
    .sort((a, b) => ordemTipo(a.fixador_tipo_id) - ordemTipo(b.fixador_tipo_id) || ordemMat(a.fixador_material_id) - ordemMat(b.fixador_material_id)
      || compararTamanho({ medida: a.medida ?? '', comprimento: a.comprimento ?? '' }, { medida: b.medida ?? '', comprimento: b.comprimento ?? '' }))
    .slice(0, 200) : [];

  if (isLoading || !base) return <Vazio>Carregando…</Vazio>;
  return (
    <div className="space-y-4">
      {erro && <Aviso>{erro}</Aviso>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          <button type="button" onClick={() => abrirTipo(null)} className={`rounded px-1.5 py-0.5 hover:bg-roxo-50 dark:hover:bg-marinho-700 ${tipo ? 'text-roxo-600 dark:text-roxo-100' : 'font-semibold'}`}>Fixadores</button>
          {tipo && <><ChevronRight size={14} className="text-suave" />
            <button type="button" onClick={() => setMaterialId(null)} className={`rounded px-1.5 py-0.5 hover:bg-roxo-50 dark:hover:bg-marinho-700 ${material ? 'text-roxo-600 dark:text-roxo-100' : 'font-semibold'}`}>{tipo.nome}</button></>}
          {material && <><ChevronRight size={14} className="text-suave" /><span className="px-1.5 font-semibold">{material.nome}</span></>}
        </nav>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Entrada className="w-full sm:w-64" placeholder="Buscar em todas as pastas" value={busca} onChange={(e) => setBusca(e.target.value)} />
          {!tipo && <Botao variante="secundario" className="whitespace-nowrap" onClick={() => setConfig('novoTipo')}><Plus size={15} /> Novo tipo</Botao>}
          {tipo && !material && <Botao variante="secundario" className="whitespace-nowrap" onClick={() => setConfig('tipo')}><Settings2 size={15} /> Tipo e materiais</Botao>}
        </div>
      </div>

      {termo.length > 0 ? (
        <Tabela cabecalho={<><th className={th}>Fixador</th><th className={`${th} w-36 text-right`}>Valor por peça</th><th className={th}>Ativo</th></>}>
          {achados.length === 0 && <tr><td colSpan={3}><Vazio>Nada encontrado.</Vazio></td></tr>}
          {achados.map((i) => (
            <tr key={i.id} className={linha(i.ativo)}>
              <td className="px-2 py-1.5">{i.descricao}</td>
              <td className={td}><CampoNumero moeda valor={Number(i.valor)} casas={4} onConfirmar={(n) => gravar(() => atualizar('bib_itens', { id: i.id }, { valor: n }))} /></td>
              <td className="px-2"><Caixa marcado={i.ativo} onChange={(ativo) => gravar(() => atualizar('bib_itens', { id: i.id }, { ativo }))} /></td>
            </tr>
          ))}
        </Tabela>
      ) : !tipo ? (
        <Pastas itens={tipos.filter((t) => t.ativo).map((t) => ({ id: t.id, nome: t.nome, ...contar((i) => i.fixador_tipo_id === t.id) }))} onAbrir={abrirTipo}
          inativas={tipos.filter((t) => !t.ativo).map((t) => t.nome)} />
      ) : !material ? (
        <Pastas itens={base.pastas.filter((p) => p.tipo_id === tipo.id && p.ativo).map((p) => materiais.find((m) => m.id === p.material_id)).filter((m): m is FixadorMaterial => Boolean(m?.ativo))
          .sort((a, b) => a.ordem - b.ordem).map((m) => ({ id: m.id, nome: m.nome, ...contar((i) => i.fixador_tipo_id === tipo.id && i.fixador_material_id === m.id) }))}
          onAbrir={setMaterialId} vazio="Este tipo ainda não tem materiais. Use “Tipo e materiais”." />
      ) : (
        <Tamanhos tipo={tipo} material={material} itens={itens.filter((i) => i.fixador_tipo_id === tipo.id && i.fixador_material_id === material.id)} gravar={gravar} setErro={setErro} />
      )}

      {config === 'novoTipo' && <EditarTipo tipo={null} materiais={materiais} pastas={[]} gravar={gravar} onFechar={() => setConfig(null)} />}
      {config === 'tipo' && tipo && <EditarTipo tipo={tipo} materiais={materiais} pastas={base.pastas.filter((p) => p.tipo_id === tipo.id)} gravar={gravar} onFechar={() => setConfig(null)} />}
    </div>
  );
}

function Pastas({ itens, onAbrir, vazio, inativas = [] }: { itens: { id: string; nome: string; total: number; comPreco: number }[]; onAbrir: (id: string) => void; vazio?: string; inativas?: string[] }) {
  if (!itens.length) return <Vazio>{vazio ?? 'Nenhuma pasta.'}</Vazio>;
  return (
    <>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {itens.map((p) => (
          <button key={p.id} type="button" onClick={() => onAbrir(p.id)}
            className="flex items-center gap-3 rounded-xl bg-superficie px-3 py-3 text-left shadow-sm ring-1 ring-borda transition-[box-shadow,transform] duration-150 hover:-translate-y-px hover:shadow-md hover:ring-roxo-300">
            <Folder size={26} className="shrink-0 fill-amber-300 text-amber-400" />
            <div className="min-w-0">
              <div className="truncate font-medium">{p.nome}</div>
              <div className="text-xs text-suave">{p.total} tamanho(s) · {p.comPreco} com preço</div>
            </div>
          </button>
        ))}
      </div>
      {inativas.length > 0 && <p className="text-xs text-suave">Tipos desativados: {inativas.join(', ')}.</p>}
    </>
  );
}

function Tamanhos({ tipo, material, itens, gravar, setErro }: {
  tipo: FixadorTipo; material: FixadorMaterial; itens: ItemBiblioteca[]; gravar: (fn: () => Promise<void>) => Promise<boolean>; setErro: (s: string) => void;
}) {
  const [novo, setNovo] = useState({ medida: '', comprimento: '', valor: 0 });
  const [gerar, setGerar] = useState(false);
  const lista = useMemo(() => [...itens].sort((a, b) => compararTamanho({ medida: a.medida ?? '', comprimento: a.comprimento ?? '' }, { medida: b.medida ?? '', comprimento: b.comprimento ?? '' })), [itens]);
  const temB = Boolean(tipo.rotulo_b);
  const item = (medida: string, comprimento: string, valor = 0) =>
    ({ grupo: 'Fixadores', descricao: '-', unidade: 'pç', valor, fixador_tipo_id: tipo.id, fixador_material_id: material.id, medida, comprimento: temB ? comprimento : '' });

  async function adicionar() {
    if (!novo.medida.trim()) return setErro(`Informe ${tipo.rotulo_a.toLowerCase()}.`);
    if (temB && !novo.comprimento.trim()) return setErro(`Informe ${tipo.rotulo_b!.toLowerCase()}.`);
    if (await gravar(() => inserir('bib_itens', item(novo.medida.trim(), novo.comprimento.trim(), novo.valor)))) setNovo({ medida: '', comprimento: '', valor: 0 });
  }
  const up = (id: string, d: Record<string, unknown>) => gravar(() => atualizar('bib_itens', { id }, d));

  return (
    <div className="space-y-3">
      <Cartao>
        <div className="flex flex-wrap items-end gap-2">
          <Campo rotulo={tipo.rotulo_a} className="w-32"><Entrada value={novo.medida} onChange={(e) => setNovo({ ...novo, medida: e.target.value })} placeholder={'M8 ou 1/4"'} /></Campo>
          {temB && <Campo rotulo={tipo.rotulo_b!} className="w-32"><Entrada value={novo.comprimento} onChange={(e) => setNovo({ ...novo, comprimento: e.target.value })} placeholder={'20 ou 1"'} /></Campo>}
          <Campo rotulo="Valor por peça" className="w-36"><div className={molduraNumero}><CampoNumero moeda valor={novo.valor} casas={4} className="py-1.5" onConfirmar={(n) => setNovo({ ...novo, valor: n })} /></div></Campo>
          <Botao onClick={adicionar}><Plus size={15} /> Adicionar</Botao>
          <Botao variante="secundario" onClick={() => setGerar(true)}><Layers size={15} /> Gerar vários</Botao>
        </div>
      </Cartao>
      <div className="text-sm text-suave">{lista.length} tamanho(s) · {lista.filter((i) => Number(i.valor) > 0).length} com preço. Itens sem preço aparecem nas propostas com valor R$ 0,00.</div>
      <Tabela cabecalho={<><th className={th}>Descrição</th><th className={`${th} w-28`}>{tipo.rotulo_a}</th>{temB && <th className={`${th} w-28`}>{tipo.rotulo_b}</th>}<th className={`${th} w-36 text-right`}>Valor por peça</th><th className={th}>Ativo</th></>}>
        {lista.length === 0 && <tr><td colSpan={5}><Vazio>Nenhum tamanho nesta pasta.</Vazio></td></tr>}
        {lista.map((i) => (
          <tr key={i.id} className={linha(i.ativo)}>
            <td className="px-2 py-1 text-suave">{i.descricao}</td>
            <td className={td}><CampoCelula valor={i.medida ?? ''} onConfirmar={(v) => v.trim() && up(i.id, { medida: v.trim() })} /></td>
            {temB && <td className={td}><CampoCelula valor={i.comprimento ?? ''} onConfirmar={(v) => v.trim() && up(i.id, { comprimento: v.trim() })} /></td>}
            <td className={td}><CampoNumero moeda valor={Number(i.valor)} casas={4} onConfirmar={(n) => up(i.id, { valor: n })} /></td>
            <td className="px-2"><Caixa marcado={i.ativo} onChange={(ativo) => up(i.id, { ativo })} /></td>
          </tr>
        ))}
      </Tabela>
      {gerar && <GerarVarios tipo={tipo} material={material} existentes={itens.map((i) => ({ medida: i.medida ?? '', comprimento: i.comprimento ?? '' }))}
        onGerar={async (combs) => { if (await gravar(() => inserir('bib_itens', combs.map((c) => item(c.medida, c.comprimento))))) setGerar(false); }} onFechar={() => setGerar(false)} />}
    </div>
  );
}

function GerarVarios({ tipo, material, existentes, onGerar, onFechar }: {
  tipo: FixadorTipo; material: FixadorMaterial; existentes: { medida: string; comprimento: string }[];
  onGerar: (c: { medida: string; comprimento: string }[]) => void; onFechar: () => void;
}) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const novas = combinacoesNovas(lerLista(a), tipo.rotulo_b ? lerLista(b) : [], existentes);
  const faltaB = Boolean(tipo.rotulo_b) && !lerLista(b).length;
  return (
    <Modal aberto titulo={`Gerar vários · ${tipo.nome} · ${material.nome}`} onFechar={onFechar} largura="max-w-lg">
      <div className="space-y-3">
        <p className="text-sm text-suave">Separe por vírgula. O ERP cria todas as combinações que ainda não existem, sem preço.</p>
        <Campo rotulo={`${tipo.rotulo_a} (ex.: M6, M8, M10 ou 1/4", 3/8")`}><AreaTexto value={a} onChange={(e) => setA(e.target.value)} /></Campo>
        {tipo.rotulo_b && <Campo rotulo={`${tipo.rotulo_b} (ex.: 16, 20, 25 ou 1", 1.1/2")`}><AreaTexto value={b} onChange={(e) => setB(e.target.value)} /></Campo>}
        <div className="text-sm">{novas.length > 0 ? <>Serão criados <b>{novas.length}</b> tamanho(s).</> : <span className="text-suave">Nenhum tamanho novo.</span>}</div>
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao disabled={!novas.length || faltaB || novas.length > 500} onClick={() => onGerar(novas)}>Gerar</Botao>
        </div>
      </div>
    </Modal>
  );
}

// Novo tipo, ou renomear/desativar um tipo e escolher quais materiais (pastas) ele tem.
function EditarTipo({ tipo, materiais, pastas, gravar, onFechar }: {
  tipo: FixadorTipo | null; materiais: FixadorMaterial[]; pastas: { material_id: string; ativo: boolean }[];
  gravar: (fn: () => Promise<void>) => Promise<boolean>; onFechar: () => void;
}) {
  const [f, setF] = useState({ nome: tipo?.nome ?? '', rotulo_a: tipo?.rotulo_a ?? 'Rosca', rotulo_b: tipo?.rotulo_b ?? 'Comprimento', temB: tipo ? Boolean(tipo.rotulo_b) : true, ativo: tipo?.ativo ?? true });
  const [novoMaterial, setNovoMaterial] = useState('');
  const temPasta = (id: string) => pastas.some((p) => p.material_id === id && p.ativo);

  async function salvar() {
    const dados = { nome: f.nome.trim(), rotulo_a: f.rotulo_a.trim() || 'Rosca', rotulo_b: f.temB ? f.rotulo_b.trim() || 'Comprimento' : null, ativo: f.ativo };
    if (dados.nome.length < 2) return;
    const ok = tipo ? await gravar(() => atualizar('bib_fixador_tipos', { id: tipo.id }, dados)) : await gravar(() => inserir('bib_fixador_tipos', { ...dados, ordem: 100 }));
    if (ok && !tipo) onFechar();
  }
  async function alternar(m: FixadorMaterial, ligar: boolean) {
    if (!tipo) return;
    const existe = pastas.some((p) => p.material_id === m.id);
    await gravar(() => existe ? atualizar('bib_fixador_tipo_materiais', { tipo_id: tipo.id, material_id: m.id }, { ativo: ligar }) : inserir('bib_fixador_tipo_materiais', { tipo_id: tipo.id, material_id: m.id }));
  }
  async function criarMaterial() {
    if (novoMaterial.trim().length < 2) return;
    if (await gravar(() => inserir('bib_fixador_materiais', { nome: novoMaterial.trim(), ordem: 100 }))) setNovoMaterial('');
  }

  return (
    <Modal aberto titulo={tipo ? `Tipo · ${tipo.nome}` : 'Novo tipo de fixador'} onFechar={onFechar} largura="max-w-lg">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Nome do tipo" className="sm:col-span-2"><Entrada value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="ex.: Barra Roscada" /></Campo>
          <Campo rotulo="1ª medida"><Entrada value={f.rotulo_a} onChange={(e) => setF({ ...f, rotulo_a: e.target.value })} /></Campo>
          <Campo rotulo="2ª medida">
            <div className="flex items-center gap-2">
              <Caixa marcado={f.temB} onChange={(temB) => setF({ ...f, temB })} />
              <Entrada value={f.rotulo_b} disabled={!f.temB} onChange={(e) => setF({ ...f, rotulo_b: e.target.value })} />
            </div>
          </Campo>
          {tipo && <div className="sm:col-span-2"><Caixa marcado={f.ativo} onChange={(ativo) => setF({ ...f, ativo })}>Tipo ativo</Caixa></div>}
        </div>
        <div className="flex justify-end"><Botao onClick={salvar}>{tipo ? 'Salvar tipo' : 'Criar tipo'}</Botao></div>
        {tipo && (
          <div className="border-t border-borda pt-3">
            <div className="mb-2 text-sm font-semibold">Materiais deste tipo (pastas)</div>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {materiais.filter((m) => m.ativo).map((m) => <Caixa key={m.id} marcado={temPasta(m.id)} onChange={(v) => alternar(m, v)}>{m.nome}</Caixa>)}
            </div>
            <div className="mt-3 flex items-end gap-2">
              <Campo rotulo="Novo material" className="flex-1"><Entrada value={novoMaterial} onChange={(e) => setNovoMaterial(e.target.value)} placeholder="ex.: Inox 316" /></Campo>
              <Botao variante="secundario" onClick={criarMaterial}><Plus size={15} /> Criar</Botao>
            </div>
            <p className="mt-2 text-xs text-suave">Desmarcar esconde a pasta; os tamanhos e preços ficam guardados.</p>
          </div>
        )}
        {!tipo && <p className="text-xs text-suave">Depois de criar, abra o tipo e escolha os materiais em “Tipo e materiais”.</p>}
      </div>
    </Modal>
  );
}
