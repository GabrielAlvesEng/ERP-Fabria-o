import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Aviso, Botao, Campo, CampoEscolha, CampoNumero, Entrada, EsqueletoTabela, Modal, Selecao } from '@/shared/ui';
import { atualizar, inserir, listarChapas, listarFixadores, listarItens, listarPerfis, type ItemBiblioteca } from '@/modules/biblioteca/api';
import { CHAVES, SubAbas, molduraNumero, useGravar } from '@/modules/admin/predefinicoes/comum';
import { FormChapa, PrecosChapa } from '@/modules/admin/predefinicoes/FormChapa';
import { FormPerfil, PesosPerfil } from '@/modules/admin/predefinicoes/FormPerfil';
import { FixadoresAba } from '@/modules/admin/predefinicoes/FixadoresAba';
import { EXEMPLO, UNIDADES_ITEM } from '@/modules/admin/predefinicoes/OutrasAbas';
import type { BibTipo } from './regras';

// Compras → Produtos → "Cadastrar produto" (decisão 114): escolhe o tipo e o formulário muda conforme o produto.
export const TIPOS_CADASTRO = ['Chapa', 'Perfil', 'Item comercial', 'Fixador', 'Consumível'] as const;
export type TipoCadastro = (typeof TIPOS_CADASTRO)[number];
const GRUPO_ITEM: Record<'Item comercial' | 'Fixador' | 'Consumível', ItemBiblioteca['grupo']> = { 'Item comercial': 'Comerciais', Fixador: 'Fixadores', Consumível: 'Consumíveis' };

export function tipoDoCadastro(tipo: BibTipo, grupo: string): TipoCadastro {
  if (tipo === 'chapa') return 'Chapa';
  if (tipo === 'perfil') return 'Perfil';
  return grupo === 'Fixadores' ? 'Fixador' : grupo === 'Consumíveis' ? 'Consumível' : 'Item comercial';
}

export function CadastroProdutoModal({ editar, onFechar, onSalvo }: {
  editar?: { tipo: BibTipo; id: string; grupo: string } | null; onFechar: () => void; onSalvo: (descricao: string) => void;
}) {
  const [tipo, setTipo] = useState<TipoCadastro>(editar ? tipoDoCadastro(editar.tipo, editar.grupo) : 'Chapa');
  // O cadastro completo do produto em edição (as listas são as mesmas da Biblioteca, em cache).
  const chapas = useQuery({ queryKey: CHAVES.chapas, queryFn: listarChapas, enabled: editar?.tipo === 'chapa' });
  const perfis = useQuery({ queryKey: CHAVES.perfis, queryFn: listarPerfis, enabled: editar?.tipo === 'perfil' });
  const itens = useQuery({ queryKey: CHAVES.itens, queryFn: listarItens, enabled: editar?.tipo === 'item' });
  const chapa = editar?.tipo === 'chapa' ? chapas.data?.find((c) => c.id === editar.id) : null;
  const perfil = editar?.tipo === 'perfil' ? perfis.data?.find((c) => c.id === editar.id) : null;
  const item = editar?.tipo === 'item' ? itens.data?.find((c) => c.id === editar.id) : null;
  const carregando = !!editar && !(chapa || perfil || item) && (chapas.isLoading || perfis.isLoading || itens.isLoading);
  const salvo = (d: string) => { onSalvo(d); onFechar(); };

  return (
    <Modal aberto titulo={editar ? 'Editar produto' : 'Cadastrar produto'} onFechar={onFechar} largura="max-w-4xl">
      {!editar && (
        <div className="mb-4 flex flex-wrap gap-2">
          {TIPOS_CADASTRO.map((t) => (
            <button key={t} type="button" onClick={() => setTipo(t)}
              className={`rounded-full px-3 py-1.5 text-sm ring-1 transition ${tipo === t ? 'bg-roxo-600 text-white ring-roxo-600' : 'bg-superficie text-texto ring-borda hover:ring-roxo-300'}`}>{t}</button>
          ))}
        </div>
      )}
      {carregando ? <EsqueletoTabela linhas={3} colunas={4} /> : (
        <div key={tipo}>
          {tipo === 'Chapa' && <FormChapa inicial={chapa} onSalvo={salvo} />}
          {tipo === 'Perfil' && <FormPerfil inicial={perfil} onSalvo={salvo} />}
          {tipo === 'Fixador' && <FormFixador inicial={item} onSalvo={salvo} />}
          {(tipo === 'Item comercial' || tipo === 'Consumível') && <FormItem grupo={GRUPO_ITEM[tipo]} inicial={item} onSalvo={salvo} />}
        </div>
      )}
    </Modal>
  );
}

// Item comercial ou consumível: descrição, material (opcional), unidade e valor de referência.
function FormItem({ grupo, inicial, onSalvo }: { grupo: ItemBiblioteca['grupo']; inicial?: ItemBiblioteca | null; onSalvo: (d: string) => void }) {
  const { erro, setErro, gravar } = useGravar();
  const [d, setD] = useState({ descricao: inicial?.descricao ?? '', material: inicial?.material ?? '', unidade: inicial?.unidade ?? UNIDADES_ITEM[grupo][0], valor: Number(inicial?.valor ?? 0) });
  async function salvar() {
    if (d.descricao.trim().length < 2) return setErro('Informe a descrição.');
    const dados = { descricao: d.descricao.trim(), material: d.material.trim(), unidade: d.unidade.trim() || 'un', valor: d.valor };
    if (await gravar(() => (inicial ? atualizar('bib_itens', { id: inicial.id }, dados) : inserir('bib_itens', { ...dados, grupo })))) onSalvo(dados.descricao);
  }
  return (
    <div className="space-y-3">
      {erro && <Aviso>{erro}</Aviso>}
      <div className="grid gap-3 sm:grid-cols-[1fr_180px_120px_140px]">
        <Campo rotulo="Descrição"><Entrada value={d.descricao} onChange={(e) => setD({ ...d, descricao: e.target.value })} placeholder={`Ex.: ${EXEMPLO[grupo]}`} autoFocus /></Campo>
        <Campo rotulo="Material (opcional)"><Entrada value={d.material} onChange={(e) => setD({ ...d, material: e.target.value })} /></Campo>
        <Campo rotulo="Unidade"><CampoEscolha celula={false} valor={d.unidade} opcoes={UNIDADES_ITEM[grupo].map((u) => ({ valor: u }))} onConfirmar={(v) => setD({ ...d, unidade: v })} /></Campo>
        <Campo rotulo="Valor de referência"><div className={molduraNumero}><CampoNumero moeda valor={d.valor} casas={4} className="py-1.5" onConfirmar={(n) => setD({ ...d, valor: n })} /></div></Campo>
      </div>
      <div className="flex justify-end"><Botao onClick={salvar}><Plus size={15} /> {inicial ? 'Salvar alterações' : 'Cadastrar'}</Botao></div>
    </div>
  );
}

// Fixador (decisão 58): tipo, material e tamanho; a descrição é montada pelo banco.
function FormFixador({ inicial, onSalvo }: { inicial?: ItemBiblioteca | null; onSalvo: (d: string) => void }) {
  const { erro, setErro, gravar } = useGravar();
  const { data: base } = useQuery({ queryKey: CHAVES.fixadores, queryFn: listarFixadores });
  const [d, setD] = useState({ tipo: inicial?.fixador_tipo_id ?? '', material: inicial?.fixador_material_id ?? '', medida: inicial?.medida ?? '', comprimento: inicial?.comprimento ?? '', valor: Number(inicial?.valor ?? 0) });
  const tipos = (base?.tipos ?? []).filter((t) => t.ativo);
  const tipo = tipos.find((t) => t.id === d.tipo);
  const materiais = (base?.pastas ?? []).filter((p) => p.tipo_id === d.tipo && p.ativo)
    .map((p) => base?.materiais.find((m) => m.id === p.material_id)).filter((m) => m?.ativo).sort((a, b) => a!.ordem - b!.ordem);
  async function salvar() {
    if (!tipo) return setErro('Escolha o tipo do fixador.');
    if (!d.material) return setErro('Escolha o material.');
    if (!d.medida.trim()) return setErro(`Informe ${tipo.rotulo_a.toLowerCase()}.`);
    if (tipo.rotulo_b && !d.comprimento.trim()) return setErro(`Informe ${tipo.rotulo_b.toLowerCase()}.`);
    const dados = { fixador_tipo_id: tipo.id, fixador_material_id: d.material, medida: d.medida.trim(), comprimento: tipo.rotulo_b ? d.comprimento.trim() : '', valor: d.valor };
    if (await gravar(() => (inicial ? atualizar('bib_itens', { id: inicial.id }, dados) : inserir('bib_itens', { ...dados, grupo: 'Fixadores', descricao: '-', unidade: 'pç' }))))
      onSalvo(`${tipo.nome} ${dados.medida}${dados.comprimento ? ` x ${dados.comprimento}` : ''}`);
  }
  return (
    <div className="space-y-3">
      {erro && <Aviso>{erro}</Aviso>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Campo rotulo="Tipo">
          <Selecao value={d.tipo} onChange={(e) => setD({ ...d, tipo: e.target.value, material: '' })}>
            <option value="">Escolha…</option>
            {tipos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </Selecao>
        </Campo>
        <Campo rotulo="Material">
          <Selecao value={d.material} onChange={(e) => setD({ ...d, material: e.target.value })} disabled={!tipo}>
            <option value="">{tipo ? 'Escolha…' : 'Escolha o tipo'}</option>
            {materiais.map((m) => <option key={m!.id} value={m!.id}>{m!.nome}</option>)}
          </Selecao>
        </Campo>
        <Campo rotulo={tipo?.rotulo_a ?? 'Medida'}><Entrada value={d.medida} onChange={(e) => setD({ ...d, medida: e.target.value })} placeholder="M12" /></Campo>
        {(!tipo || tipo.rotulo_b) && <Campo rotulo={tipo?.rotulo_b ?? 'Comprimento'}><Entrada value={d.comprimento} onChange={(e) => setD({ ...d, comprimento: e.target.value })} placeholder="40" disabled={!tipo} /></Campo>}
        <Campo rotulo="Valor por peça"><div className={molduraNumero}><CampoNumero moeda valor={d.valor} casas={4} className="py-1.5" onConfirmar={(n) => setD({ ...d, valor: n })} /></div></Campo>
      </div>
      {tipo && !materiais.length && <p className="text-xs text-amber-600">Este tipo ainda não tem materiais. Ligue os materiais em "Tabelas de apoio" → Tipos de fixador.</p>}
      <div className="flex justify-end"><Botao onClick={salvar}><Plus size={15} /> {inicial ? 'Salvar alterações' : 'Cadastrar'}</Botao></div>
    </div>
  );
}

// Tabelas que apoiam o cadastro: preço por kg das chapas, pesos dos perfis de catálogo e tipos/materiais de fixador.
const APOIO = ['Preço por kg das chapas', 'Pesos de perfis', 'Tipos de fixador'] as const;
export function TabelasApoioModal({ onFechar }: { onFechar: () => void }) {
  const [aba, setAba] = useState<(typeof APOIO)[number]>(APOIO[0]);
  return (
    <Modal aberto titulo="Tabelas de apoio do cadastro" onFechar={onFechar} largura="max-w-5xl">
      <SubAbas abas={APOIO} ativa={aba} onTrocar={setAba} />
      {aba === 'Preço por kg das chapas' && <PrecosChapa />}
      {aba === 'Pesos de perfis' && <PesosPerfil />}
      {aba === 'Tipos de fixador' && <FixadoresAba />}
    </Modal>
  );
}
