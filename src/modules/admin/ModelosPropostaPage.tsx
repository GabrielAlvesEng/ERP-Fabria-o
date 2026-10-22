import { Suspense, lazy, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { mensagemErro } from '@/shared/lib/formato';
import { AreaTexto, Aviso, Botao, Cabecalho, Campo, Cartao, Entrada, EsqueletoDetalhe, EsqueletoPagina } from '@/shared/ui';
import { lerPadroes, salvarPadrao, type Padroes } from '@/modules/vendas/documentos/api';
import { EditorDocumento } from '@/modules/vendas/documentos/EditorDocumento';
import { documentoPadrao, SOBRE_PADRAO, type DadosEmpresaFabriaco, type SobreNos } from '@/modules/vendas/documentos/modelo';
import type { DadosProposta } from '@/modules/vendas/documentos/DocumentoPdf';

const Previa = lazy(() => import('@/modules/vendas/documentos/Previa'));

// Dados de exemplo só para a prévia desta página.
const EXEMPLO: DadosProposta = {
  codigo: '26-00-000', revisao: 0, titulo: 'Proposta de exemplo', emissao: new Date().toISOString().slice(0, 10), validadeDias: 30,
  cliente: { nome: 'Cliente Exemplo', razao_social: 'Cliente Exemplo Indústria Ltda', cnpj: '00.000.000/0001-00', ie: '000.000.000.000', endereco: 'Rua Exemplo, 100', bairro: 'Centro', cep_cidade: '13.700-000 / Cidade - SP', local: 'Cidade / SP' },
  contato: { nome: 'Fulano de Tal', telefone: '+55 (19) 90000-0000', email: 'fulano@cliente.com.br' },
  contatoTecnico: { nome: 'Beltrano Engenheiro', telefone: '+55 (19) 90000-0001', email: 'engenharia@cliente.com.br' },
  preparadoPor: '',
  vendedor: { nome: 'Vendedor Exemplo', cargo: 'Comercial', telefone: '+55 (19) 90000-0002', email: 'vendas@fabriacobrasil.com.br' },
  revisoes: [{ numero: 0, descricao: 'Emissão inicial', emissao: new Date().toISOString().slice(0, 10) }],
  itens: [{ letra: 'A', descricao: 'Fabricação', quantidade: 2, valor: 10000 }, { letra: 'B', descricao: 'Instalação', quantidade: 1, valor: 2500 }],
};

const CAMPOS_EMPRESA: [Exclude<keyof DadosEmpresaFabriaco, 'sobre'>, string][] = [
  ['razao_social', 'Razão social'], ['cnpj', 'CNPJ'], ['ie', 'Inscrição estadual'], ['endereco', 'Endereço'], ['bairro', 'Bairro'],
  ['cep_cidade', 'CEP / Cidade'], ['cidade', 'Cidade (capa)'], ['responsavel', 'Responsável técnico / preparado por'], ['telefone', 'Telefone / WhatsApp'],
  ['email', 'E-mail'], ['site', 'Site'],
];

// Administração → Modelos de proposta (decisão 61): dados da Fabriaço e textos padrão das propostas técnica e comercial.
export function ModelosPropostaPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['documento_padroes'], queryFn: lerPadroes });
  const [aba, setAba] = useState<'empresa' | 'tecnica' | 'comercial'>('empresa');
  const [p, setP] = useState<Padroes | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { if (data) setP(data); }, [data]);

  async function salvar() {
    if (!p) return;
    setSalvando(true); setMsg(null);
    try {
      await salvarPadrao(aba, aba === 'empresa' ? p.empresa : p[aba]);
      await qc.invalidateQueries({ queryKey: ['documento_padroes'] });
      setMsg({ ok: true, texto: 'Salvo. Vale para as propostas que ainda não têm documento; as já editadas não mudam.' });
    } catch (e) { setMsg({ ok: false, texto: mensagemErro(e) }); }
    setSalvando(false);
  }

  if (isLoading || !p) return <EsqueletoDetalhe />;
  return (
    <>
      <Cabecalho titulo="Modelos de proposta" subtitulo="Dados da Fabriaço e textos padrão das propostas técnica e comercial. Cada proposta começa com estes textos e pode ser ajustada na aba Documentos."
        acoes={<Botao onClick={salvar} disabled={salvando}><Save size={15} /> {salvando ? 'Salvando…' : 'Salvar'}</Botao>} />
      <div className="mb-3 flex rounded-lg bg-pagina p-0.5 ring-1 ring-borda sm:inline-flex">
        {([['empresa', 'Dados da Fabriaço'], ['tecnica', 'Proposta técnica'], ['comercial', 'Proposta comercial']] as const).map(([k, r]) => (
          <button key={k} type="button" onClick={() => { setAba(k); setMsg(null); }}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm ${aba === k ? 'bg-superficie font-semibold text-roxo-600 shadow-sm dark:text-roxo-100' : 'text-suave'}`}>{r}</button>
        ))}
      </div>
      {msg && <div className="mb-3"><Aviso tipo={msg.ok ? 'info' : undefined}>{msg.texto}</Aviso></div>}
      {aba === 'empresa' ? (
        <Cartao className="max-w-3xl">
          <div className="grid gap-3 sm:grid-cols-2">
            {CAMPOS_EMPRESA.map(([k, r]) => (
              <Campo key={k} rotulo={r}><Entrada value={p.empresa[k]} onChange={(e) => setP({ ...p, empresa: { ...p.empresa, [k]: e.target.value } })} /></Campo>
            ))}
          </div>
          <EditorSobre sobre={p.empresa.sobre} onChange={(sobre) => setP({ ...p, empresa: { ...p.empresa, sobre } })} />
        </Cartao>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-2">
            <div className="flex justify-end">
              <Botao variante="secundario" tamanho="sm" onClick={() => confirm('Voltar aos textos dos modelos originais?') && setP({ ...p, [aba]: documentoPadrao(aba) })}>Voltar aos textos originais</Botao>
            </div>
            <EditorDocumento doc={p[aba]} onChange={(d) => setP({ ...p, [aba]: d })} editavel itens={EXEMPLO.itens} />
          </div>
          <div className="lg:sticky lg:top-2 lg:h-[calc(100dvh-6rem)]">
            <Suspense fallback={<EsqueletoPagina />}><Previa doc={p[aba]} dados={{ ...EXEMPLO, preparadoPor: p.empresa.responsavel }} empresa={p.empresa} tecnica={aba === 'comercial' ? p.tecnica : null} /></Suspense>
          </div>
        </div>
      )}
    </>
  );
}

// "Conheça a Fabriaço" (decisão 67): layout fixo no PDF; aqui só os textos.
function EditorSobre({ sobre, onChange }: { sobre: SobreNos; onChange: (s: SobreNos) => void }) {
  const campo = (k: Exclude<keyof SobreNos, 'servicos' | 'texto'>, rotulo: string) => (
    <Campo rotulo={rotulo}><Entrada value={sobre[k]} onChange={(e) => onChange({ ...sobre, [k]: e.target.value })} /></Campo>
  );
  return (
    <div className="mt-5 border-t border-borda pt-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-sm font-semibold">Sobre nós · “Conheça a Fabriaço” (proposta técnica)</div>
        <Botao variante="secundario" tamanho="sm" onClick={() => confirm('Voltar ao texto original do “Sobre nós”?') && onChange(SOBRE_PADRAO)}>Texto original</Botao>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {campo('titulo', 'Título')}
        {campo('subtitulo', 'Subtítulo')}
        <Campo rotulo="Texto (linha em branco separa parágrafos; **negrito**)" className="sm:col-span-2"><AreaTexto rows={5} value={sobre.texto} onChange={(e) => onChange({ ...sobre, texto: e.target.value })} /></Campo>
        {campo('materiais', 'Materiais')}
        {campo('lema', 'Faixa roxa (rodapé)')}
        {campo('maquinas', 'Máquinas e processos')}
        {campo('setores', 'Setores')}
      </div>
      <div className="mt-3 text-xs font-medium text-suave">Serviços (5, com ícone)</div>
      <div className="mt-1 grid gap-2">
        {sobre.servicos.map((sv, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)]">
            <Entrada value={sv.titulo} onChange={(e) => onChange({ ...sobre, servicos: sobre.servicos.map((x, j) => (j === i ? { ...x, titulo: e.target.value } : x)) })} />
            <Entrada value={sv.texto} onChange={(e) => onChange({ ...sobre, servicos: sobre.servicos.map((x, j) => (j === i ? { ...x, texto: e.target.value } : x)) })} />
          </div>
        ))}
      </div>
    </div>
  );
}
