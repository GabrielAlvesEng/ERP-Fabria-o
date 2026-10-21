import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { supabase } from '@/shared/lib/supabase';
import { moeda } from '@/shared/lib/formato';
import { Aviso, Botao, Caixa, Campo, CampoCelula, CampoEscolha, CampoNumero, Cartao, Entrada, Selecao, Vazio } from '@/shared/ui';
import {
  UNIDADES_SERVICO, atualizar, inserir, listarARevisar, listarFornecedores, listarItens, listarMateriaisBase, listarServicos, type Fornecedor, type ServicoFornecedor,
} from '@/modules/biblioteca/api';
import type { GrupoItem } from '@/modules/biblioteca/regras';
import { CHAVES, Tabela, linha, molduraNumero, td, th, useGravar } from './comum';

const UNIDADES_ITEM: Record<GrupoItem, string[]> = {
  Comerciais: ['un', 'pç', 'm', 'kg', 'cj'],
  Fixadores: ['un', 'cento', 'milheiro', 'kg', 'cx'],
  Consumíveis: ['un', 'lata', 'litro', 'kg', 'cx', 'rolo', 'galão'],
};
const EXEMPLO: Record<GrupoItem, string> = {
  Comerciais: 'Curva RL 90° Ø1" x 1,5', Fixadores: 'Parafuso Allen Cabeça Cilíndrica M12 x 40', Consumíveis: 'Disco de corte 7" x 1,6 mm',
};

// Itens comerciais, fixadores e consumíveis: descrição, material (opcional), unidade e valor.
export function ItensAba({ grupo }: { grupo: GrupoItem }) {
  const { erro, setErro, gravar } = useGravar();
  const { data: todos = [], isLoading } = useQuery({ queryKey: CHAVES.itens, queryFn: listarItens });
  const [busca, setBusca] = useState('');
  const [novo, setNovo] = useState({ descricao: '', material: '', unidade: UNIDADES_ITEM[grupo][0], valor: 0 });
  const itens = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return todos.filter((i) => i.grupo === grupo && (!t || `${i.descricao} ${i.material}`.toLowerCase().includes(t)));
  }, [todos, grupo, busca]);
  const unidades = UNIDADES_ITEM[grupo].map((u) => ({ valor: u }));

  async function adicionar() {
    if (novo.descricao.trim().length < 2) return setErro('Informe a descrição.');
    if (await gravar(() => inserir('bib_itens', { grupo, descricao: novo.descricao.trim(), material: novo.material.trim(), unidade: novo.unidade.trim() || 'un', valor: novo.valor })))
      setNovo({ descricao: '', material: '', unidade: UNIDADES_ITEM[grupo][0], valor: 0 });
  }
  const up = (id: string, d: Record<string, unknown>) => gravar(() => atualizar('bib_itens', { id }, d));

  return (
    <div className="space-y-4">
      {erro && <Aviso>{erro}</Aviso>}
      <Cartao>
        <div className="flex flex-wrap items-end gap-2">
          <Campo rotulo="Descrição" className="min-w-[260px] flex-1"><Entrada value={novo.descricao} onChange={(e) => setNovo({ ...novo, descricao: e.target.value })} placeholder={`Ex.: ${EXEMPLO[grupo]}`} /></Campo>
          <Campo rotulo="Material (opcional)" className="w-44"><Entrada value={novo.material} onChange={(e) => setNovo({ ...novo, material: e.target.value })} /></Campo>
          <Campo rotulo="Unidade" className="w-28"><CampoEscolha celula={false} valor={novo.unidade} opcoes={unidades} onConfirmar={(v) => setNovo({ ...novo, unidade: v })} /></Campo>
          <Campo rotulo="Valor" className="w-32"><div className={molduraNumero}><CampoNumero moeda valor={novo.valor} casas={4} className="py-1.5" onConfirmar={(n) => setNovo({ ...novo, valor: n })} /></div></Campo>
          <Botao onClick={adicionar}><Plus size={15} /> Adicionar</Botao>
        </div>
      </Cartao>
      <div className="flex items-center gap-3">
        <Entrada className="max-w-sm" placeholder="Buscar" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <span className="text-sm text-suave">{itens.length} item(ns)</span>
      </div>
      {isLoading ? <Vazio>Carregando…</Vazio> : (
        <Tabela cabecalho={<><th className={th}>Descrição</th><th className={`${th} w-44`}>Material</th><th className={`${th} w-28`}>Unidade</th><th className={`${th} w-36 text-right`}>Valor</th><th className={th}>Ativo</th></>}>
          {itens.length === 0 && <tr><td colSpan={5}><Vazio>Nenhum item cadastrado.</Vazio></td></tr>}
          {itens.map((i) => (
            <tr key={i.id} className={linha(i.ativo)}>
              <td className={td}><CampoCelula valor={i.descricao} onConfirmar={(v) => v.trim().length >= 2 && up(i.id, { descricao: v.trim() })} /></td>
              <td className={td}><CampoCelula valor={i.material} onConfirmar={(v) => up(i.id, { material: v.trim() })} /></td>
              <td className={td}><CampoEscolha valor={i.unidade} opcoes={unidades} onConfirmar={(v) => up(i.id, { unidade: v.trim() || 'un' })} /></td>
              <td className={td}><CampoNumero moeda valor={Number(i.valor)} casas={4} onConfirmar={(n) => up(i.id, { valor: n })} /></td>
              <td className="px-2"><Caixa marcado={i.ativo} onChange={(ativo) => up(i.id, { ativo })} /></td>
            </tr>
          ))}
        </Tabela>
      )}
    </div>
  );
}

// Materiais (catálogo COD_MAT): nome e densidade usada nos pesos. O código fica por trás.
export function MateriaisBaseAba() {
  const { erro, gravar } = useGravar();
  const { data: materiais = [], isLoading } = useQuery({ queryKey: CHAVES.materiais, queryFn: listarMateriaisBase });
  const [busca, setBusca] = useState('');
  const lista = materiais.filter((m) => !busca.trim() || `${m.nome} ${m.categoria}`.toLowerCase().includes(busca.trim().toLowerCase()));
  return (
    <div className="space-y-3">
      {erro && <Aviso>{erro}</Aviso>}
      <p className="text-sm text-suave">A densidade (g/cm³) calcula o peso de chapas e perfis. Inox austenítico 8,00 e carbono 7,85 (como a calculadora antiga); confira os demais.</p>
      <Entrada className="max-w-sm" placeholder="Buscar material" value={busca} onChange={(e) => setBusca(e.target.value)} />
      {isLoading ? <Vazio>Carregando…</Vazio> : (
        <Tabela cabecalho={<><th className={th}>Material</th><th className={th}>Categoria</th><th className={`${th} w-36 text-right`}>Densidade (g/cm³)</th><th className={th}>Ativo</th></>}>
          {lista.map((m) => (
            <tr key={m.cod_mat} className={linha(m.ativo)}>
              <td className="px-2 py-1">{m.nome}</td>
              <td className="px-2 text-xs text-suave">{m.categoria.replace(/^\d+ - /, '')}</td>
              <td className={td}><CampoNumero valor={Number(m.densidade ?? 0)} casas={3} onConfirmar={(n) => gravar(() => atualizar('catalogo_materiais', { cod_mat: m.cod_mat }, { densidade: n > 0 ? n : null }))} /></td>
              <td className="px-2"><Caixa marcado={m.ativo} onChange={(ativo) => gravar(() => atualizar('catalogo_materiais', { cod_mat: m.cod_mat }, { ativo }))} /></td>
            </tr>
          ))}
        </Tabela>
      )}
    </div>
  );
}

// Itens da lista de preços antiga que a carga não reconheceu: ficam aqui para cadastrar à mão na biblioteca.
export function RevisarAba() {
  const { data: itens = [], isLoading } = useQuery({ queryKey: CHAVES.revisar, queryFn: listarARevisar });
  return (
    <div className="space-y-3">
      <p className="text-sm text-suave">Itens da lista de preços antiga que não foram passados para a biblioteca automaticamente. Cadastre-os na aba certa; esta lista é só consulta.</p>
      {isLoading ? <Vazio>Carregando…</Vazio> : itens.length === 0 ? <Vazio>Nada a revisar.</Vazio> : (
        <Tabela cabecalho={<><th className={th}>Tipo</th><th className={th}>Descrição</th><th className={`${th} text-right`}>Preço</th></>}>
          {itens.map((i) => <tr key={i.id} className={linha()}><td className="px-2 py-1.5">{i.tipo}</td><td className="px-2">{i.descricao}</td><td className="px-2 text-right">{moeda(i.preco)}</td></tr>)}
        </Tabela>
      )}
    </div>
  );
}

const SERVICOS_SUGERIDOS = ['Galvanização a fogo', 'Pintura eletrostática', 'Zincagem', 'Corte laser', 'Dobra', 'Torno', 'Usinagem', 'Calandragem', 'Jateamento', 'Polimento', 'Frete'];

// Fornecedores e os serviços de cada um (decisão 49). Máquinas terceirizadas da proposta escolhem aqui.
export function FornecedoresAba() {
  const { erro, setErro, gravar } = useGravar();
  const { data: fornecedores = [], isLoading } = useQuery({ queryKey: CHAVES.fornecedores, queryFn: listarFornecedores });
  const { data: servicos = [] } = useQuery({ queryKey: CHAVES.servicos, queryFn: listarServicos });
  const [novo, setNovo] = useState('');
  return (
    <div className="space-y-4">
      {erro && <Aviso>{erro}</Aviso>}
      <Cartao>
        <form className="flex flex-wrap items-end gap-2" onSubmit={async (e) => {
          e.preventDefault();
          if (novo.trim().length < 2) return setErro('Informe o nome do fornecedor.');
          if (await gravar(() => inserir('fornecedores', { nome: novo.trim() }))) setNovo('');
        }}>
          <Campo rotulo="Novo fornecedor" className="min-w-[260px] flex-1"><Entrada value={novo} onChange={(e) => setNovo(e.target.value)} placeholder="Ex.: Galvanizadora XYZ" /></Campo>
          <Botao type="submit"><Plus size={15} /> Adicionar</Botao>
        </form>
      </Cartao>
      {isLoading ? <Vazio>Carregando…</Vazio> : fornecedores.map((f) => <CartaoFornecedor key={f.id} f={f} servicos={servicos.filter((s) => s.fornecedor_id === f.id)} gravar={gravar} setErro={setErro} />)}
    </div>
  );
}

function CartaoFornecedor({ f, servicos, gravar, setErro }: { f: Fornecedor; servicos: ServicoFornecedor[]; gravar: (fn: () => Promise<void>) => Promise<boolean>; setErro: (s: string) => void }) {
  const [novo, setNovo] = useState({ servico: '', unidade: 'hora' as ServicoFornecedor['unidade'], valor: 0 });
  const up = (d: Record<string, unknown>) => gravar(() => atualizar('fornecedores', { id: f.id }, d));
  const upS = (id: string, d: Record<string, unknown>) => gravar(() => atualizar('fornecedor_servicos', { id }, d));
  return (
    <Cartao className={f.ativo ? '' : 'opacity-60'}>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        {(['nome', 'cidade', 'contato', 'telefone', 'email'] as const).map((k) => (
          <Campo key={k} rotulo={k === 'email' ? 'E-mail' : k[0].toUpperCase() + k.slice(1)} className={k === 'nome' ? 'lg:col-span-2' : ''}>
            <div className="rounded-lg border border-borda"><CampoCelula valor={f[k]} onConfirmar={(v) => (k !== 'nome' || v.trim().length >= 2) && up({ [k]: v.trim() })} /></div>
          </Campo>
        ))}
      </div>
      <div className="mt-2"><Caixa marcado={f.ativo} onChange={(ativo) => up({ ativo })}>Fornecedor ativo</Caixa></div>
      <div className="mt-3">
        <Tabela cabecalho={<><th className={th}>Serviço</th><th className={`${th} w-32`}>Cobrança por</th><th className={`${th} w-36 text-right`}>Valor</th><th className={th}>Ativo</th></>}>
          {servicos.length === 0 && <tr><td colSpan={4}><Vazio>Sem serviços cadastrados.</Vazio></td></tr>}
          {servicos.map((s) => (
            <tr key={s.id} className={linha(s.ativo)}>
              <td className={td}><CampoCelula valor={s.servico} onConfirmar={(v) => v.trim().length >= 2 && upS(s.id, { servico: v.trim() })} /></td>
              <td className={td}>
                <select value={s.unidade} onChange={(e) => upS(s.id, { unidade: e.target.value })} className="w-full rounded-md border border-transparent bg-transparent px-1 py-1 text-sm hover:border-slate-300 dark:bg-marinho-800">
                  {UNIDADES_SERVICO.map((u) => <option key={u}>{u}</option>)}
                </select>
              </td>
              <td className={td}><CampoNumero moeda valor={Number(s.valor)} casas={4} onConfirmar={(n) => upS(s.id, { valor: n })} /></td>
              <td className="px-2"><Caixa marcado={s.ativo} onChange={(ativo) => upS(s.id, { ativo })} /></td>
            </tr>
          ))}
        </Tabela>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <Campo rotulo="Serviço" className="w-56"><CampoEscolha celula={false} valor={novo.servico} opcoes={SERVICOS_SUGERIDOS.map((v) => ({ valor: v }))} onConfirmar={(v) => setNovo({ ...novo, servico: v })} /></Campo>
          <Campo rotulo="Cobrança por" className="w-32">
            <Selecao value={novo.unidade} onChange={(e) => setNovo({ ...novo, unidade: e.target.value as ServicoFornecedor['unidade'] })}>
              {UNIDADES_SERVICO.map((u) => <option key={u}>{u}</option>)}
            </Selecao>
          </Campo>
          <Campo rotulo="Valor" className="w-32"><div className={molduraNumero}><CampoNumero moeda valor={novo.valor} casas={4} className="py-1.5" onConfirmar={(n) => setNovo({ ...novo, valor: n })} /></div></Campo>
          <Botao variante="secundario" onClick={async () => {
            if (novo.servico.trim().length < 2) return setErro('Informe o serviço.');
            if (await gravar(() => inserir('fornecedor_servicos', { fornecedor_id: f.id, servico: novo.servico.trim(), unidade: novo.unidade, valor: novo.valor })))
              setNovo({ servico: '', unidade: 'hora', valor: 0 });
          }}><Plus size={15} /> Adicionar serviço</Botao>
        </div>
      </div>
    </Cartao>
  );
}

export const GRUPOS_MAO_OBRA = ['Administrativo', 'Fabricação', 'Instalação'] as const;
interface MaoObra { id: string; etapa: string; funcao: string; valor_hora: number; ordem: number; ativo: boolean }
interface Maquina { id: string; nome: string; valor_hora: number; ordem: number; ativo: boolean }

// Mão de obra nos 3 grupos (decisão 42).
export function MaoObraAba() {
  const { erro, setErro, gravar } = useGravar();
  const { data: lista = [], isLoading } = useQuery({
    queryKey: CHAVES.maoObra,
    queryFn: async () => {
      const { data, error } = await supabase.from('ref_mao_obra').select('id, etapa, funcao, valor_hora, ordem, ativo').in('etapa', [...GRUPOS_MAO_OBRA]).order('ordem');
      if (error) throw error;
      return data as MaoObra[];
    },
  });
  const [novo, setNovo] = useState<Record<string, { funcao: string; valor: number }>>({});
  if (isLoading) return <Vazio>Carregando…</Vazio>;
  return (
    <div className="space-y-4">
      {erro && <Aviso>{erro}</Aviso>}
      <p className="text-sm text-suave">Valores-hora usados nos itens novos das propostas. Mudar aqui não altera propostas já lançadas.</p>
      <div className="grid gap-4 lg:grid-cols-3">
        {GRUPOS_MAO_OBRA.map((g) => {
          const n = novo[g] ?? { funcao: '', valor: 0 };
          return (
            <Cartao key={g}>
              <div className="mb-2 font-semibold">{g}</div>
              <Tabela cabecalho={<><th className={th}>Função</th><th className={`${th} w-28 text-right`}>R$/h</th><th className={th}>Ativa</th></>}>
                {lista.filter((m) => m.etapa === g).map((m) => (
                  <tr key={m.id} className={linha(m.ativo)}>
                    <td className={td}><CampoCelula valor={m.funcao} onConfirmar={(v) => v.trim().length >= 2 && gravar(() => atualizar('ref_mao_obra', { id: m.id }, { funcao: v.trim() }))} /></td>
                    <td className={td}><CampoNumero moeda valor={Number(m.valor_hora)} onConfirmar={(v) => gravar(() => atualizar('ref_mao_obra', { id: m.id }, { valor_hora: v }))} /></td>
                    <td className="px-2"><Caixa marcado={m.ativo} onChange={(ativo) => gravar(() => atualizar('ref_mao_obra', { id: m.id }, { ativo }))} /></td>
                  </tr>
                ))}
              </Tabela>
              <div className="mt-2 flex items-end gap-2">
                <Campo rotulo="Nova função" className="flex-1"><Entrada value={n.funcao} onChange={(e) => setNovo({ ...novo, [g]: { ...n, funcao: e.target.value } })} /></Campo>
                <Campo rotulo="R$/h" className="w-24"><div className={molduraNumero}><CampoNumero moeda valor={n.valor} className="py-1.5" onConfirmar={(v) => setNovo({ ...novo, [g]: { ...n, valor: v } })} /></div></Campo>
                <Botao variante="secundario" aria-label="Adicionar função" onClick={async () => {
                  if (n.funcao.trim().length < 2) return setErro('Informe a função.');
                  const ordem = Math.max(0, ...lista.map((m) => m.ordem)) + 1;
                  if (await gravar(() => inserir('ref_mao_obra', { etapa: g, funcao: n.funcao.trim(), valor_hora: n.valor, ordem }))) setNovo({ ...novo, [g]: { funcao: '', valor: 0 } });
                }}><Plus size={15} /></Botao>
              </div>
            </Cartao>
          );
        })}
      </div>
    </div>
  );
}

// Maquinário próprio (decisão 49). As terceirizadas ficam em Fornecedores.
export function MaquinarioAba() {
  const { erro, setErro, gravar } = useGravar();
  const { data: lista = [], isLoading } = useQuery({
    queryKey: CHAVES.maquinas,
    queryFn: async () => {
      const { data, error } = await supabase.from('ref_maquinas').select('id, nome, valor_hora, ordem, ativo').eq('terceirizada', false).order('ordem');
      if (error) throw error;
      return data as Maquina[];
    },
  });
  const [novo, setNovo] = useState({ nome: '', valor: 0 });
  return (
    <div className="max-w-2xl space-y-4">
      {erro && <Aviso>{erro}</Aviso>}
      <p className="text-sm text-suave">Máquinas próprias e o valor-hora. Serviço de máquina terceirizada (laser, dobra…) é cadastrado no fornecedor, em Fornecedores.</p>
      {isLoading ? <Vazio>Carregando…</Vazio> : (
        <Tabela cabecalho={<><th className={th}>Máquina</th><th className={`${th} w-32 text-right`}>R$/h</th><th className={th}>Ativa</th></>}>
          {lista.map((m) => (
            <tr key={m.id} className={linha(m.ativo)}>
              <td className={td}><CampoCelula valor={m.nome} onConfirmar={(v) => v.trim().length >= 2 && gravar(() => atualizar('ref_maquinas', { id: m.id }, { nome: v.trim() }))} /></td>
              <td className={td}><CampoNumero moeda valor={Number(m.valor_hora)} onConfirmar={(v) => gravar(() => atualizar('ref_maquinas', { id: m.id }, { valor_hora: v }))} /></td>
              <td className="px-2"><Caixa marcado={m.ativo} onChange={(ativo) => gravar(() => atualizar('ref_maquinas', { id: m.id }, { ativo }))} /></td>
            </tr>
          ))}
        </Tabela>
      )}
      <div className="flex items-end gap-2">
        <Campo rotulo="Nova máquina" className="flex-1"><Entrada value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} placeholder="Ex.: Guilhotina" /></Campo>
        <Campo rotulo="R$/h" className="w-28"><div className={molduraNumero}><CampoNumero moeda valor={novo.valor} className="py-1.5" onConfirmar={(v) => setNovo({ ...novo, valor: v })} /></div></Campo>
        <Botao onClick={async () => {
          if (novo.nome.trim().length < 2) return setErro('Informe o nome da máquina.');
          const ordem = Math.max(0, ...lista.map((m) => m.ordem)) + 1;
          if (await gravar(() => inserir('ref_maquinas', { nome: novo.nome.trim(), terceirizada: false, valor_hora: novo.valor, ordem }))) setNovo({ nome: '', valor: 0 });
        }}><Plus size={15} /> Adicionar</Botao>
      </div>
    </div>
  );
}

