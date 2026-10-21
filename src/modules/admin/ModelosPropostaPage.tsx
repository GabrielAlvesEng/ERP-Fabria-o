import { Suspense, lazy, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { mensagemErro } from '@/shared/lib/formato';
import { Aviso, Botao, Cabecalho, Campo, Cartao, Entrada, EsqueletoDetalhe, EsqueletoPagina } from '@/shared/ui';
import { lerPadroes, salvarPadrao, type Padroes } from '@/modules/vendas/documentos/api';
import { EditorDocumento } from '@/modules/vendas/documentos/EditorDocumento';
import { documentoPadrao, type DadosEmpresaFabriaco } from '@/modules/vendas/documentos/modelo';
import type { DadosProposta } from '@/modules/vendas/documentos/DocumentoPdf';

const Previa = lazy(() => import('@/modules/vendas/documentos/Previa'));

// Dados de exemplo só para a prévia desta página.
const EXEMPLO: DadosProposta = {
  codigo: '26-00-000', revisao: 0, titulo: 'Proposta de exemplo', emissao: new Date().toISOString().slice(0, 10), validadeDias: 30,
  cliente: { nome: 'Cliente Exemplo', razao_social: 'Cliente Exemplo Indústria Ltda', cnpj: '00.000.000/0001-00', ie: '000.000.000.000', endereco: 'Rua Exemplo, 100', bairro: 'Centro', cep_cidade: '13.700-000 / Cidade - SP', local: 'Cidade / SP' },
  contato: { nome: 'Fulano de Tal', telefone: '+55 (19) 90000-0000', email: 'fulano@cliente.com.br' },
  preparadoPor: '',
  itens: [{ letra: 'A', descricao: 'Fabricação', valor: 10000 }, { letra: 'B', descricao: 'Instalação', valor: 2500 }],
};

const CAMPOS_EMPRESA: [keyof DadosEmpresaFabriaco, string][] = [
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
            <Suspense fallback={<EsqueletoPagina />}><Previa doc={p[aba]} dados={{ ...EXEMPLO, preparadoPor: p.empresa.responsavel }} empresa={p.empresa} /></Suspense>
          </div>
        </div>
      )}
    </>
  );
}
