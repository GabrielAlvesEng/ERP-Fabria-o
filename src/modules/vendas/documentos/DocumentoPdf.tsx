import type { ReactNode } from 'react';
import { Circle, Document, Font, Image, Page, Path, Polygon, StyleSheet, Svg, Text, View, type Styles } from '@react-pdf/renderer';
import geist400 from '@fontsource/geist-sans/files/geist-sans-latin-400-normal.woff?url';
import geist500 from '@fontsource/geist-sans/files/geist-sans-latin-500-normal.woff?url';
import geist600 from '@fontsource/geist-sans/files/geist-sans-latin-600-normal.woff?url';
import geist700 from '@fontsource/geist-sans/files/geist-sans-latin-700-normal.woff?url';
import { moeda } from '@/shared/lib/formato';
import {
  aPartirDe, blocos, INICIO_PRAZO_PADRAO, CONFIDENCIALIDADE_COMERCIAL, CONFIDENCIALIDADE_TECNICA, GARANTIA_ATENDIMENTO, GARANTIA_COBRE, GARANTIA_NAO_SE_APLICA, marcadorCartao, numerar,
  resumoTecnica, sincronizarEscopo, substituir, VALIDADE_CONDICOES, type Cartao, type DadosEmpresaFabriaco, type Documento, type Etapa, type Secao, type Trecho, type Variaveis,
} from './modelo';
import { MAPA_SP } from './mapaSP';
import { dividirTexto, larguraTexto } from './fluxo';

// PDF da proposta (decisão 61; novo design na decisão 67). A prévia na tela e o arquivo gerado saem deste mesmo componente.
// Técnica: capa + páginas com as seções numeradas. Comercial: 4 páginas (capa, visão geral, valores e encerramento).

Font.register({ family: 'Geist', fonts: [
  { src: geist400, fontWeight: 400 }, { src: geist500, fontWeight: 500 }, { src: geist600, fontWeight: 600 }, { src: geist700, fontWeight: 700 },
] });
Font.registerHyphenationCallback((palavra) => [palavra]);

export interface PessoaContato { nome: string; telefone: string; email: string }
export interface DadosProposta {
  codigo: string; revisao: number; titulo: string; emissao: string; validadeDias: number;
  descricao?: string; // decisão 72: subtítulo da capa = descrição da aba Dados
  cliente: { nome: string; razao_social: string; cnpj: string; ie: string; endereco: string; bairro: string; cep_cidade: string; local: string };
  contato: PessoaContato;
  contatoTecnico?: PessoaContato | null; // a técnica vai A/C dele (decisão 67); sem ele, A/C do contato da proposta
  preparadoPor: string;
  vendedor?: (PessoaContato & { cargo: string }) | null;
  revisoes?: { numero: number; descricao: string; emissao: string }[];
  // id, manual e calculado servem ao editor (valor digitado na área Valores da comercial, decisão 71); o PDF usa só o valor.
  itens: { id?: string; letra: string; descricao: string; quantidade?: number; valor: number; manual?: boolean; calculado?: number; unitario?: number; calculadoUnitario?: number }[];
  // Decisão 70: frete da aba Dados (o local de entrega é sempre o endereço do cliente) e os anexos da revisão (aba Arquivos).
  frete?: 'CIF' | 'FOB';
  entrega?: string;
  anexos?: { tecnicos: ArquivoAnexo[]; comerciais: ArquivoAnexo[] };
}
export interface ArquivoAnexo { nome: string; tamanho: number }

const C = {
  navy: '#141a2e', navy2: '#1f2640', navy3: '#262d4d', teal: '#15303a', roxo: '#6e48d0', roxoMarca: '#410FA0', roxoClaro: '#9a78ea', lavanda: '#ece8fb', lavanda2: '#f5f2fd',
  texto: '#1f2433', suave: '#6b7280', borda: '#e5e7eb', fundo: '#f6f7fb', verde: '#0f766e', verdeFundo: '#d9f2ee', vermelho: '#b42318', vermelhoFundo: '#fde2e1',
};
const A4_ALTURA = 841.89;
const MARCA = `${import.meta.env.BASE_URL}marca/pdf/`;
// Cards de imagem ao lado do item (pt): 5 imagens por item cabem numa página.
const IMG = { largura: 178, altura: 104, espaco: 8, ligacao: 26, saida: 16, textoAoLado: 0 };
// Largura do texto no card ao lado das imagens: página (595,28) − margens (2 × 46) − ligação − imagens − padding (2 × 10) − marcador (32).
IMG.textoAoLado = 595.28 - 92 - IMG.ligacao - IMG.largura - 20 - 32;

const s = StyleSheet.create({
  pagina: { fontFamily: 'Geist', fontSize: 9.5, color: C.texto, paddingTop: 62, paddingBottom: 56, paddingHorizontal: 46, lineHeight: 1.45 },
  topo: { position: 'absolute', top: 22, left: 46, right: 46, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', fontSize: 7, letterSpacing: 1,
    borderBottomWidth: 0.5, borderBottomColor: C.borda, paddingBottom: 7 },
  // Rodapé pelo topo: com o número de página (render), o react-pdf refaz a página sem altura e "bottom" jogava o rodapé para o alto da folha.
  rodape: { position: 'absolute', top: A4_ALTURA - 24 - 16, left: 46, right: 46, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7, color: C.suave, borderTopWidth: 0.5, borderTopColor: C.borda, paddingTop: 6 },
  kicker: { fontSize: 7.5, fontWeight: 600, color: C.roxo, letterSpacing: 1.6, lineHeight: 1.3, marginBottom: 6 },
  h1: { fontSize: 22, fontWeight: 700, letterSpacing: -0.4, lineHeight: 1.25, marginBottom: 6 },
  sub: { fontSize: 9.5, color: C.suave, marginBottom: 14 },
  p: { marginBottom: 6, textAlign: 'justify' },
  item: { flexDirection: 'row', marginBottom: 4, paddingLeft: 6 },
  bolinha: { width: 10, color: C.roxo },
  cartaoRotulo: { fontSize: 6.5, color: C.suave, letterSpacing: 1, marginBottom: 4 },
  cartaoValor: { fontSize: 10, fontWeight: 600 },
  th: { fontSize: 7, fontWeight: 600, color: '#ffffff', letterSpacing: 0.6 },
  td: { fontSize: 8.5 },
  cartao: { borderWidth: 0.5, borderColor: C.borda, borderRadius: 8, backgroundColor: C.fundo, padding: 12 },
});

const dataExtenso = (iso: string) => {
  const d = iso ? new Date(`${iso.slice(0, 10)}T12:00:00`) : new Date();
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
};
const dataCurta = (iso: string) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00`) : new Date()).toLocaleDateString('pt-BR');
const somarDias = (iso: string, dias: number) => {
  const d = iso ? new Date(`${iso.slice(0, 10)}T12:00:00`) : new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
};
const qtd = (n: number) => (Number.isInteger(n) ? String(n) : n.toLocaleString('pt-BR', { maximumFractionDigits: 3 }));

function Rico({ trechos, estilo }: { trechos: Trecho[]; estilo?: Styles[string] }) {
  const estiloTrecho = (t: Trecho) => (t.negrito || t.sublinhado ? { ...(t.negrito ? { fontWeight: 600 } : {}), ...(t.sublinhado ? { textDecoration: 'underline' as const } : {}) } : undefined);
  return <Text style={estilo} wrap={false}>{trechos.map((t, i) => <Text key={i} style={estiloTrecho(t)}>{t.texto}</Text>)}</Text>;
}

// "topo" (título da seção) fica colado ao primeiro parágrafo ou item, para nunca sobrar sozinho no pé da página.
function TextoRico({ texto, v, topo, estilo }: { texto: string; v: Variaveis; topo?: ReactNode; estilo?: Styles[string] }) {
  const p = estilo ? [s.p, estilo] : s.p;
  const item = (it: Trecho[], j: number, numerada?: boolean) => (
    <View key={j} style={s.item} wrap={false}>
      <Text style={numerada ? [s.bolinha, { width: 14, fontWeight: 600, ...(estilo?.fontSize ? { fontSize: estilo.fontSize } : {}) }] : s.bolinha}>{numerada ? `${j + 1}.` : '•'}</Text>
      <Rico trechos={it} estilo={{ flex: 1, ...(estilo ?? {}) }} />
    </View>
  );
  const lista = blocos(substituir(texto, v));
  if (!lista.length) return topo ? <View wrap={false}>{topo}</View> : null;
  return (
    <>
      {lista.map((b, i) => {
        if (b.tipo === 'p') return i === 0 && topo ? <View key={i} wrap={false}>{topo}<Rico trechos={b.trechos} estilo={p as Styles[string]} /></View> : <Rico key={i} trechos={b.trechos} estilo={p as Styles[string]} />;
        return (
          <View key={i} style={{ marginBottom: 6 }}>
            {i === 0 && topo ? <View wrap={false}>{topo}{item(b.itens[0], 0, b.numerada)}</View> : item(b.itens[0], 0, b.numerada)}
            {b.itens.slice(1).map((it, j) => item(it, j + 1, b.numerada))}
          </View>
        );
      })}
    </>
  );
}

function Check({ cor = C.verde }: { cor?: string }) {
  return <Svg width={9} height={9} viewBox="0 0 24 24"><Path d="M4 12.5l5 5L20 6.5" stroke={cor} strokeWidth={3} fill="none" /></Svg>;
}
function Xis() {
  return <Svg width={8} height={8} viewBox="0 0 24 24"><Path d="M6 6l12 12M18 6L6 18" stroke={C.vermelho} strokeWidth={3} fill="none" /></Svg>;
}

function TituloSecao({ numero, titulo }: { numero?: string; titulo: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14, marginBottom: 10 }}>
      {numero ? (
        <View style={{ width: 40, height: 20, borderRadius: 4, backgroundColor: C.lavanda, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
          <Text style={{ fontSize: 8, fontWeight: 600, lineHeight: 1, color: C.roxo }}>{numero}</Text>
        </View>
      ) : <View style={{ width: 24, height: 3, borderRadius: 2, backgroundColor: C.roxo, marginRight: 10 }} />}
      <Text style={{ fontSize: 15, fontWeight: 700, letterSpacing: -0.3, lineHeight: 1.2, flex: 1 }}>{titulo}</Text>
    </View>
  );
}

// Título das páginas fixas da comercial (sem número): traço roxo, rótulo e título grande.
function TituloPagina({ rotulo, titulo, sub }: { rotulo: string; titulo: string; sub?: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        <View style={{ width: 22, height: 2.5, borderRadius: 2, backgroundColor: C.roxo, marginRight: 8 }} />
        <Text style={[s.kicker, { marginBottom: 0 }]}>{rotulo.toUpperCase()}</Text>
      </View>
      <Text style={s.h1}>{titulo}</Text>
      {sub ? <Text style={[s.sub, { marginBottom: 0 }]}>{sub}</Text> : null}
    </View>
  );
}

type Alinhar = 'left' | 'center' | 'right';
function Tabela({ cabecalho, linhas, larguras, topo, alinhar = [] }: { cabecalho: string[]; linhas: (string | JSX.Element)[][]; larguras: number[]; topo?: ReactNode; alinhar?: Alinhar[] }) {
  const flexo = (a?: Alinhar) => (a === 'right' ? 'flex-end' : a === 'center' ? 'center' : 'flex-start');
  const linha = (l: (string | JSX.Element)[], i: number) => (
    <View key={i} wrap={false} style={{ flexDirection: 'row', flexShrink: 0, alignItems: 'center', paddingVertical: 6, paddingHorizontal: 8, backgroundColor: i % 2 ? C.fundo : '#ffffff',
      borderWidth: 0.5, borderTopWidth: i ? 0 : 0.5, borderColor: C.borda, ...(i === linhas.length - 1 ? { borderBottomLeftRadius: 6, borderBottomRightRadius: 6 } : {}) }}>
      {l.map((c, j) => (
        <View key={j} style={{ flex: larguras[j], alignItems: flexo(alinhar[j]) }}>
          {typeof c === 'string' ? <Text style={[s.td, { textAlign: alinhar[j] ?? 'left' }]}>{c}</Text> : c}
        </View>
      ))}
    </View>
  );
  return (
    <View style={{ marginBottom: 8 }}>
      <View wrap={false}>
        {topo}
        <View style={{ flexDirection: 'row', flexShrink: 0, backgroundColor: C.navy, paddingVertical: 7, paddingHorizontal: 8, borderTopLeftRadius: 6, borderTopRightRadius: 6 }}>
          {cabecalho.map((c, i) => <Text key={i} style={[s.th, { flex: larguras[i], textAlign: alinhar[i] ?? 'left' }]}>{c.toUpperCase()}</Text>)}
        </View>
        {linhas.length > 0 && linha(linhas[0], 0)}
      </View>
      {linhas.slice(1).map((l, i) => linha(l, i + 1))}
    </View>
  );
}

function Selo({ valor }: { valor: string }) {
  const cor = valor === 'Sim' ? [C.verdeFundo, C.verde] : valor === 'Não' ? [C.vermelhoFundo, C.vermelho] : ['#eef0f3', C.suave];
  return <View style={{ backgroundColor: cor[0], borderRadius: 8, paddingVertical: 2, paddingHorizontal: 7 }}><Text style={{ fontSize: 7, fontWeight: 600, color: cor[1] }}>{valor}</Text></View>;
}

// Ícones simples (traço roxo) dos serviços em "Conheça a Fabriaço".
const ICONES_SERVICO = [
  'M7 5c0-1.5 2.2-2.5 5-2.5s5 1 5 2.5v12c0 1.5-2.2 2.5-5 2.5s-5-1-5-2.5zM7 5c0 1.5 2.2 2.5 5 2.5s5-1 5-2.5M8 19.5V22M16 19.5V22', // tanque
  'M3 4h18v16H3zM3 4l18 16M21 4L3 20', // estrutura
  'M4 8h14a3 3 0 0 1-3 3h-3v4h4v3H6v-3h4v-4H7a3 3 0 0 1-3-3z', // caldeiraria (bigorna)
  'M14.5 6.5a4 4 0 0 0 5 5l-9.5 9.5a2.1 2.1 0 0 1-3-3zM14.5 6.5l3-3', // instalação (chave)
  'M6 2.5h9l4 4V21.5H6zM15 2.5v4h4M9 11h7M9 14.5h7M9 18h5', // documentação
];

// "Conheça a Fabriaço" compacto, para dividir a página com os Dados da Empresa (decisão 70).
function SobreNos({ empresa, v }: { empresa: DadosEmpresaFabriaco; v: Variaveis }) {
  const sb = empresa.sobre;
  const m = MAPA_SP;
  const W = 150; const esc = W / m.largura; const H = m.altura * esc;
  return (
    <View wrap={false} style={{ marginBottom: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <View style={{ flex: 1, paddingRight: 12, paddingTop: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <View style={{ width: 24, height: 3, borderRadius: 2, backgroundColor: C.roxo, marginRight: 8 }} />
            <Text style={{ fontSize: 8, fontWeight: 600, color: C.roxo, letterSpacing: 1.4 }}>SOBRE NÓS</Text>
          </View>
          <Text style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5, lineHeight: 1.2 }}>{sb.titulo}</Text>
          <Text style={{ fontSize: 7.5, fontWeight: 600, color: '#4b5263', letterSpacing: 0.8, marginTop: 4 }}>{sb.subtitulo.toUpperCase()}</Text>
        </View>
        <View style={{ width: W + 30, alignItems: 'center' }}>
          <View style={{ width: W, height: H }}>
            <Svg width={W} height={H} viewBox={`0 0 ${m.largura} ${m.altura}`}>
              <Path d={m.caminho} fill={C.lavanda2} stroke={C.roxo} strokeWidth={1.1} />
              <Path d={`M${m.mococa[0]} ${m.mococa[1]} L${m.mococa[0] + 12} ${m.mococa[1] - 18} L${m.mococa[0] + 22} ${m.mococa[1] - 18}`} stroke={C.roxo} strokeWidth={1} fill="none" />
              <Circle cx={m.mococa[0]} cy={m.mococa[1]} r={3.6} fill={C.roxo} />
            </Svg>
            <Text style={{ position: 'absolute', left: (m.mococa[0] + 23) * esc, top: (m.mococa[1] - 25) * esc, fontSize: 8, fontWeight: 700, color: C.roxo }}>Mococa</Text>
          </View>
          <Text style={{ fontSize: 7, color: C.suave, marginTop: 2 }}>São Paulo • Brasil</Text>
        </View>
      </View>
      <TextoRico texto={sb.texto} v={v} estilo={{ fontSize: 9, color: '#374151', lineHeight: 1.45 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.lavanda2, borderRadius: 6, paddingVertical: 7, paddingHorizontal: 12, marginTop: 4, marginBottom: 12 }}>
        <Text style={{ width: 80, fontSize: 7, fontWeight: 600, color: C.roxo, letterSpacing: 1 }}>MATERIAIS</Text>
        <Text style={{ fontSize: 10, fontWeight: 600 }}>{sb.materiais}</Text>
      </View>
      <View style={{ flexDirection: 'row', marginBottom: 10 }}>
        {sb.servicos.slice(0, 5).map((sv, i) => (
          <View key={i} style={{ flex: 1, paddingRight: i < 4 ? 9 : 0 }}>
            <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: C.lavanda2, alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
              <Svg width={15} height={15} viewBox="0 0 24 24"><Path d={ICONES_SERVICO[i] ?? ICONES_SERVICO[4]} stroke={C.roxo} strokeWidth={1.6} fill="none" /></Svg>
            </View>
            <Text style={{ fontSize: 8.5, fontWeight: 700, marginBottom: 2 }}>{sv.titulo}</Text>
            <Text style={{ fontSize: 7.5, color: C.suave, lineHeight: 1.35 }}>{sv.texto}</Text>
          </View>
        ))}
      </View>
      <View style={{ borderTopWidth: 0.5, borderTopColor: C.borda, paddingTop: 8 }}>
        {[['Máquinas e processos', sb.maquinas], ['Setores', sb.setores]].map(([r, val]) => (
          <View key={r} style={{ flexDirection: 'row', marginBottom: 4 }}>
            <Text style={{ width: 120, fontSize: 7, fontWeight: 600, color: C.roxo, letterSpacing: 0.8 }}>{r.toUpperCase()}</Text>
            <Text style={{ flex: 1, fontSize: 8, color: '#374151' }}>{val}</Text>
          </View>
        ))}
      </View>
      <View style={{ backgroundColor: C.roxoMarca, borderRadius: 4, paddingVertical: 6, marginTop: 6, alignItems: 'center' }}>
        <Text style={{ fontSize: 8, fontWeight: 700, color: '#ffffff', letterSpacing: 1.4 }}>{sb.lema.toUpperCase()}</Text>
      </View>
    </View>
  );
}

// Card de arquivo anexo (decisão 70): ícone com a extensão, nome e tamanho.
const COR_EXTENSAO: Record<string, string> = { PDF: '#d92d20', DWG: '#1570ef', DXF: '#1570ef', STEP: '#1570ef', STP: '#1570ef', XLS: '#079455', XLSX: '#079455', CSV: '#079455', DOC: '#155eef', DOCX: '#155eef', JPG: '#7a5af8', JPEG: '#7a5af8', PNG: '#7a5af8', ZIP: '#475467', RAR: '#475467' };
const tamanhoArquivo = (b: number) => (b >= 1048576 ? `${(b / 1048576).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
function CardArquivo({ nome, tamanho, detalhe }: { nome: string; tamanho?: number; detalhe?: string }) {
  const ext = (nome.match(/\.([a-z0-9]{1,5})$/i)?.[1] ?? 'ARQ').toUpperCase();
  const cor = COR_EXTENSAO[ext] ?? C.roxo;
  return (
    <View wrap={false} style={{ width: '48.8%', flexDirection: 'row', alignItems: 'center', borderWidth: 0.5, borderColor: C.borda, borderRadius: 8, backgroundColor: '#ffffff', padding: 8, marginBottom: 7 }}>
      <View style={{ width: 26, height: 32, marginRight: 9 }}>
        <Svg width={26} height={32} viewBox="0 0 26 32">
          <Path d="M3 1h14l8 8v20a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2z" fill="#ffffff" stroke={C.borda} strokeWidth={1} />
          <Path d="M17 1v6a2 2 0 0 0 2 2h6" fill="none" stroke={C.borda} strokeWidth={1} />
        </Svg>
        <View style={{ position: 'absolute', left: -2, bottom: 5, backgroundColor: cor, borderRadius: 2, paddingHorizontal: 2.5, paddingVertical: 1 }}>
          <Text style={{ fontSize: 5.5, fontWeight: 700, color: '#ffffff', lineHeight: 1.1 }}>{ext.slice(0, 4)}</Text>
        </View>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 8, fontWeight: 600, lineHeight: 1.3 }}>{nome}</Text>
        <Text style={{ fontSize: 6.5, color: C.suave, marginTop: 1 }}>{[detalhe, tamanho ? tamanhoArquivo(tamanho) : ''].filter(Boolean).join(' · ')}</Text>
      </View>
    </View>
  );
}
function ListaAnexos({ arquivos }: { arquivos: { nome: string; tamanho?: number; detalhe?: string }[] }) {
  if (!arquivos.length) return <Text style={{ fontSize: 8.5, color: C.suave }}>Não contém.</Text>;
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>{arquivos.map((a, i) => <CardArquivo key={i} {...a} />)}</View>;
}

function Garantia({ meses, topo }: { meses: number; topo: ReactNode }) {
  return (
    <View wrap={false} style={{ marginBottom: 6 }}>
      {topo}
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: '28%', backgroundColor: C.roxoMarca, borderRadius: 8, padding: 14, alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
          <Text style={{ fontSize: 7, fontWeight: 600, color: '#d6cdf7', letterSpacing: 1.2 }}>GARANTIA</Text>
          <Text style={{ fontSize: 34, fontWeight: 700, color: '#ffffff', lineHeight: 1.15, marginTop: 4 }}>{meses}</Text>
          <Text style={{ fontSize: 10, fontWeight: 600, color: '#ffffff' }}>{meses === 1 ? 'mês' : 'meses'}</Text>
          <Text style={{ fontSize: 7.5, color: '#d6cdf7', marginTop: 6, textAlign: 'center' }}>após a emissão da NF</Text>
        </View>
        <View style={[s.cartao, { flex: 1, marginRight: 8 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}><Check /><Text style={{ fontSize: 8.5, fontWeight: 700, marginLeft: 5 }}>O que cobre</Text></View>
          <Text style={{ fontSize: 8, color: '#374151', marginBottom: 6 }}>{GARANTIA_COBRE}</Text>
          <Text style={{ fontSize: 7.5, color: C.suave }}>{GARANTIA_ATENDIMENTO}</Text>
        </View>
        <View style={[s.cartao, { flex: 1, backgroundColor: '#fff7f6', borderColor: '#f6d7d4' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}><Xis /><Text style={{ fontSize: 8.5, fontWeight: 700, marginLeft: 5 }}>Não se aplica</Text></View>
          {GARANTIA_NAO_SE_APLICA.map((t) => (
            <View key={t} style={{ flexDirection: 'row', marginBottom: 3 }}><Text style={{ width: 8, color: C.vermelho, fontSize: 8 }}>•</Text><Text style={{ flex: 1, fontSize: 7.5, color: '#374151' }}>{t}</Text></View>
          ))}
        </View>
      </View>
    </View>
  );
}

// Cronograma: cada etapa começa quando a anterior termina; dias contados após a aprovação da proposta.
function Cronograma({ etapas, inicio, topo }: { etapas: Etapa[]; inicio: string; topo: ReactNode }) {
  const lista = etapas.filter((e) => e.nome.trim() || e.dias);
  const total = lista.reduce((t, e) => t + (Number(e.dias) || 0), 0) || 1;
  let fim = 0;
  return (
    <View wrap={false} style={{ marginBottom: 6 }}>
      {topo}
      <Text style={[s.p, { color: '#374151' }]}>Prazos em dias corridos, contados a partir {aPartirDe(inicio)}.</Text>
      <View style={[s.cartao, { backgroundColor: '#ffffff', paddingVertical: 10 }]}>
        {lista.map((e, i) => {
          const dias = Number(e.dias) || 0;
          const de = fim; fim += dias;
          return (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: i < lista.length - 1 ? 7 : 0 }}>
              <View style={{ width: 150, paddingRight: 8 }}>
                <Text style={{ fontSize: 8.5, fontWeight: 600 }}>{e.nome}</Text>
                <Text style={{ fontSize: 7, color: C.suave }}>{dias} dia{dias === 1 ? '' : 's'} · dia {de + 1} ao {fim}</Text>
              </View>
              <View style={{ flex: 1, height: 12, backgroundColor: C.fundo, borderRadius: 6 }}>
                <View style={{ position: 'absolute', left: `${(de / total) * 100}%`, width: `${Math.max((dias / total) * 100, 1.5)}%`, top: 0, bottom: 0, borderRadius: 6, backgroundColor: i % 2 ? C.roxoClaro : C.roxo }} />
              </View>
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.navy, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14, marginTop: 8 }}>
        <Text style={{ fontSize: 7.5, fontWeight: 600, color: C.roxoClaro, letterSpacing: 1.2 }}>PRAZO TOTAL DE ENTREGA</Text>
        {/* Decisão 79: os dias em destaque e o marco de início embaixo, menor. */}
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 20, fontWeight: 700, color: '#ffffff', lineHeight: 1.1 }}>{fim} dias</Text>
          <Text style={{ fontSize: 8, color: '#c7cbe0', marginTop: 2 }}>após {inicio}</Text>
        </View>
      </View>
    </View>
  );
}

function Validade({ d, topo }: { d: DadosProposta; topo: ReactNode }) {
  const dias = d.validadeDias || 30;
  return (
    <View wrap={false} style={{ marginBottom: 6 }}>
      {topo}
      <View style={{ flexDirection: 'row' }}>
        <View style={[s.cartao, { width: '38%', marginRight: 8, borderLeftWidth: 3, borderLeftColor: C.roxo, backgroundColor: '#ffffff' }]}>
          <Text style={s.cartaoRotulo}>VALIDADE</Text>
          <Text style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.2, marginBottom: 2 }}>{dias} dias</Text>
          <Text style={{ fontSize: 8, color: C.suave }}>corridos, a partir da emissão</Text>
          <Text style={{ fontSize: 8, fontWeight: 600, color: C.roxo, marginTop: 6 }}>Válida até {dataCurta(somarDias(d.emissao, dias))}</Text>
        </View>
        <View style={[s.cartao, { flex: 1 }]}>
          {VALIDADE_CONDICOES.map((t) => (
            <View key={t} style={{ flexDirection: 'row', marginBottom: 4 }}><Text style={s.bolinha}>•</Text><Text style={{ flex: 1, fontSize: 8, color: '#374151' }}>{t}</Text></View>
          ))}
        </View>
      </View>
    </View>
  );
}

function Confidencialidade({ texto, v, topo }: { texto: string; v: Variaveis; topo?: ReactNode }) {
  return (
    <View wrap={false} style={{ marginBottom: 6 }}>
      {topo}
      <View style={[s.cartao, { backgroundColor: C.lavanda2, borderColor: '#ddd5f6' }]}>
        <TextoRico texto={texto} v={v} estilo={{ fontSize: 8.5, color: '#374151' }} />
      </View>
    </View>
  );
}

function ConteudoSecao({ secao, v, d, empresa, topo, imagens }: { secao: Secao; v: Variaveis; d: DadosProposta; empresa: DadosEmpresaFabriaco; topo: ReactNode; imagens: Record<string, string> }) {
  switch (secao.tipo) {
    case 'texto':
      // Anexos: cards dos arquivos anexados na aba Arquivos → Anexos técnicos (decisão 70).
      if (secao.id === 'anexo') return <View wrap={false} style={{ marginBottom: 6 }}>{topo}<ListaAnexos arquivos={d.anexos?.tecnicos ?? []} /></View>;
      return secao.texto.trim() ? <TextoRico texto={secao.texto} v={v} topo={topo} /> : <View wrap={false}>{topo}<Text style={{ color: C.suave }}>(seção a preencher)</Text></View>;
    case 'cartoes': {
      const comIntro = Boolean(secao.intro.trim());
      const comDestaque = Boolean(secao.destaque?.trim());
      const caixaCartao = { flexDirection: 'row' as const, borderWidth: 0.5, borderColor: C.borda, borderRadius: 6, backgroundColor: C.fundo, padding: 10 };
      const miolo = (c: Cartao, i: number, texto = substituir(c.texto, v)) => (
        <>
          <View style={{ width: 22, height: 22, borderRadius: 4, backgroundColor: C.lavanda, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
            <Text style={{ fontSize: 8.5, fontWeight: 700, lineHeight: 1, color: C.roxo }}>{marcadorCartao(secao.marcador, i)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 8.5, fontWeight: 700, marginBottom: 3 }}>{substituir(c.titulo, v).toUpperCase()}</Text>
            {texto ? <Text style={{ fontSize: 8, color: '#374151', lineHeight: 1.45 }}>{texto}</Text> : null}
          </View>
        </>
      );
      // Item com imagens: card do texto à esquerda, um card por imagem à direita e linhas ligando o item a cada imagem.
      const cartao = (c: Cartao, i: number) => {
        const figs = (c.imagens ?? []).filter((f) => imagens[f.caminho]);
        if (!figs.length) return <View key={i} wrap={false} style={{ ...caixaCartao, marginBottom: 7 }}>{miolo(c, i)}</View>;
        const coluna = figs.length * IMG.altura + (figs.length - 1) * IMG.espaco;
        const centros = figs.map((_, k) => k * (IMG.altura + IMG.espaco) + IMG.altura / 2);
        const ultimo = centros[centros.length - 1];
        const tronco = IMG.ligacao / 2;
        // Texto maior que a coluna de imagens: o que sobra continua numa faixa de largura total, por baixo das imagens.
        const titulo = substituir(c.titulo, v).toUpperCase();
        const linhasTitulo = Math.ceil(larguraTexto(titulo, 8.5) * 1.06 / IMG.textoAoLado) || 1;
        const maxLinhas = Math.floor((coluna + 8 - 10 - linhasTitulo * 8.5 * 1.45 - 3) / (8 * 1.45));
        const { antes, depois } = dividirTexto(substituir(c.texto, v), IMG.textoAoLado, 8, Math.max(maxLinhas, 0));
        const corpo = (
          <View style={{ flexDirection: 'row' }}>
            <View style={{ ...caixaCartao, flex: 1, minHeight: coluna, ...(depois ? { minHeight: coluna + 8, paddingBottom: 0, borderBottomWidth: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 } : {}) }}>{miolo(c, i, antes)}</View>
            <Svg width={IMG.ligacao} height={Math.max(coluna, IMG.saida + 1)} viewBox={`0 0 ${IMG.ligacao} ${Math.max(coluna, IMG.saida + 1)}`}>
              <Path d={`M0 ${IMG.saida} H${tronco} V${Math.max(ultimo, IMG.saida)}`} stroke={C.roxoClaro} strokeWidth={0.9} fill="none" />
              {centros.map((y, k) => <Path key={k} d={`M${tronco} ${y} H${IMG.ligacao - 2}`} stroke={C.roxoClaro} strokeWidth={0.9} fill="none" />)}
              <Circle cx={1.6} cy={IMG.saida} r={1.6} fill={C.roxo} />
              {centros.map((y, k) => <Circle key={k} cx={IMG.ligacao - 2} cy={y} r={1.6} fill={C.roxo} />)}
            </Svg>
            <View style={{ width: IMG.largura }}>
              {figs.map((f, k) => (
                <View key={k} style={{ height: IMG.altura, marginTop: k ? IMG.espaco : 0, borderWidth: 0.5, borderColor: C.borda, borderRadius: 6, backgroundColor: '#ffffff', padding: 5 }}>
                  <Image src={imagens[f.caminho]} style={{ flex: 1, objectFit: 'contain' }} />
                  {f.legenda.trim() ? <Text style={{ fontSize: 6.5, color: C.suave, marginTop: 3, textAlign: 'center', lineHeight: 1.2 }}>{f.legenda}</Text> : null}
                </View>
              ))}
            </View>
          </View>
        );
        if (!depois) return <View key={i} wrap={false} style={{ marginBottom: 10 }}>{corpo}</View>;
        return (
          <View key={i} style={{ marginBottom: 10 }}>
            <View wrap={false}>{corpo}</View>
            <View style={{ ...caixaCartao, borderTopWidth: 0, borderTopLeftRadius: 0, paddingTop: 0 }}>
              {/* Borda de cima só no trecho embaixo das imagens: o card vira um "L" */}
              <View style={{ position: 'absolute', top: 0, right: -0.5, width: IMG.ligacao + IMG.largura + 0.5, height: 6, borderTopWidth: 0.5, borderRightWidth: 0.5, borderColor: C.borda, borderTopRightRadius: 6 }} />
              <View style={{ width: 32 }} />
              <Text style={{ flex: 1, fontSize: 8, color: '#374151', lineHeight: 1.45, paddingTop: 3 }}>{depois}</Text>
            </View>
          </View>
        );
      };
      const destaque = comDestaque && (
        <View style={{ backgroundColor: C.lavanda, borderLeftWidth: 3, borderLeftColor: C.roxo, borderRadius: 4, padding: 10, marginBottom: 8 }}><TextoRico texto={secao.destaque!} v={v} /></View>
      );
      return (
        <View>
          {comIntro && <TextoRico texto={secao.intro} v={v} topo={topo} />}
          {comDestaque && (comIntro ? destaque : <View wrap={false}>{topo}{destaque}</View>)}
          {secao.cartoes.map((c, i) => (i === 0 && !comIntro && !comDestaque ? <View key={i} wrap={false}>{topo}{cartao(c, i)}</View> : cartao(c, i)))}
          {!comIntro && !comDestaque && !secao.cartoes.length && <View wrap={false}>{topo}</View>}
          {(secao.figuras ?? []).some((f) => imagens[f.caminho]) && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 2 }}>
              {(secao.figuras ?? []).filter((f) => imagens[f.caminho]).map((f, i) => (
                <View key={i} wrap={false} style={{ width: '48.5%', borderWidth: 0.5, borderColor: C.borda, borderRadius: 8, padding: 8, marginBottom: 8, alignItems: 'center' }}>
                  <Image src={imagens[f.caminho]} style={{ height: 150, objectFit: 'contain' }} />
                  {f.legenda.trim() ? <Text style={{ fontSize: 7, color: C.suave, marginTop: 5, textAlign: 'center' }}>{f.legenda}</Text> : null}
                </View>
              ))}
            </View>
          )}
          {secao.fecho.trim() && <TextoRico texto={secao.fecho} v={v} />}
        </View>
      );
    }
    case 'dados_empresas': {
      const ac = d.contatoTecnico?.nome ? d.contatoTecnico : d.contato;
      return (
        <Tabela topo={topo} cabecalho={['Dados', 'Fabriaço', d.cliente.nome || 'Cliente']} larguras={[1, 1.6, 1.6]} linhas={[
          ['Razão social', empresa.razao_social, d.cliente.razao_social], ['CNPJ', empresa.cnpj, d.cliente.cnpj], ['Inscrição estadual', empresa.ie, d.cliente.ie],
          ['Endereço', empresa.endereco, d.cliente.endereco], ['Bairro', empresa.bairro, d.cliente.bairro], ['CEP / Cidade', empresa.cep_cidade, d.cliente.cep_cidade],
          ['Responsável técnico', d.preparadoPor || empresa.responsavel, ac.nome], ['Telefone / WhatsApp', empresa.telefone, ac.telefone], ['E-mail', empresa.email, ac.email],
        ].map((l) => l.map((c) => c || '-'))} />
      );
    }
    case 'competencias':
      return <Tabela topo={topo} cabecalho={['Competência', 'Contemplado']} larguras={[4, 1]} alinhar={['left', 'right']}
        linhas={secao.itens.map((i) => [i.nome, <Selo key={i.nome} valor={i.valor} />])} />;
    case 'matriz':
    case 'responsabilidades': {
      const grupos = secao.tipo === 'responsabilidades' ? secao.grupos : [{ area: '', itens: secao.itens }];
      const marca = (sim: boolean) => (sim ? <Check /> : <Text style={[s.td, { color: '#c0c4cc' }]}>—</Text>);
      const cliente = (d.cliente.nome || 'Cliente').split(' ')[0];
      const linhaItem = (l: { texto: string; cliente: boolean; fabriaco: boolean }, k: number) => (
        <View key={k} wrap={false} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 5, paddingHorizontal: 8, borderWidth: 0.5, borderTopWidth: 0, borderColor: C.borda, backgroundColor: k % 2 ? C.fundo : '#ffffff' }}>
          <Text style={[s.td, { flex: 5 }]}>{substituir(l.texto, v)}</Text>
          <View style={{ flex: 1, alignItems: 'center' }}>{marca(l.cliente)}</View>
          <View style={{ flex: 1, alignItems: 'center' }}>{marca(l.fabriaco)}</View>
        </View>
      );
      const cabecalhoGrupo = (area: string) => area ? (
        <View style={{ flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 8, backgroundColor: C.lavanda, borderWidth: 0.5, borderTopWidth: 0, borderColor: '#ddd5f6' }}>
          <Text style={{ fontSize: 7.5, fontWeight: 700, color: C.roxo, letterSpacing: 1 }}>{area.toUpperCase()}</Text>
        </View>
      ) : null;
      const cab = (
        <View style={{ flexDirection: 'row', backgroundColor: C.navy, paddingVertical: 7, paddingHorizontal: 8, borderTopLeftRadius: 6, borderTopRightRadius: 6 }}>
          <Text style={[s.th, { flex: 5 }]}>RESPONSABILIDADE</Text>
          <Text style={[s.th, { flex: 1, textAlign: 'center' }]}>{cliente.toUpperCase()}</Text>
          <Text style={[s.th, { flex: 1, textAlign: 'center' }]}>FABRIAÇO</Text>
        </View>
      );
      return (
        <View style={{ marginBottom: 8 }}>
          {grupos.map((g, i) => (
            <View key={i}>
              <View wrap={false}>
                {i === 0 && <>{topo}{cab}</>}
                {cabecalhoGrupo(g.area)}
                {g.itens[0] && linhaItem(g.itens[0], 0)}
              </View>
              {g.itens.slice(1).map((l, k) => linhaItem(l, k + 1))}
            </View>
          ))}
        </View>
      );
    }
    case 'garantia':
      return <Garantia meses={secao.meses} topo={topo} />;
    case 'cronograma':
      return <Cronograma etapas={secao.etapas} inicio={secao.inicio?.trim() || INICIO_PRAZO_PADRAO} topo={topo} />;
    case 'validade':
      return <Validade d={d} topo={topo} />;
    case 'confidencialidade':
      return <Confidencialidade texto={CONFIDENCIALIDADE_TECNICA} v={v} topo={topo} />;
    default:
      return null; // "Sobre nós" e as seções da comercial têm páginas próprias
  }
}

// Cabeçalho e rodapé das páginas internas: ícone da marca em todas, menos na capa (decisão 67).
function Moldura({ d, comercial, empresa }: { d: DadosProposta; comercial: boolean; empresa: DadosEmpresaFabriaco }) {
  return (
    <>
      <View style={s.topo} fixed>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Image src={`${MARCA}icone.png`} style={{ width: 18, height: 18, marginRight: 7 }} />
          <Text style={{ color: C.suave, fontWeight: 600 }}>FABRIAÇO BRASIL</Text>
        </View>
        <Text style={{ color: C.roxo, fontWeight: 600 }}>{comercial ? 'PROPOSTA COMERCIAL' : 'PROPOSTA TÉCNICA'} · {d.codigo} / R{d.revisao}</Text>
      </View>
      <View style={s.rodape} fixed>
        <Text style={{ fontWeight: 600 }}>FABRIAÇO BRASIL · MOCOCA / SP</Text>
        <Text>{empresa.site}</Text>
        <Text style={{ color: C.roxo, fontWeight: 600 }} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
      </View>
    </>
  );
}

function Capa({ doc, d, empresa, imagens }: { doc: Documento; d: DadosProposta; empresa: DadosEmpresaFabriaco; imagens: Record<string, string> }) {
  const comercial = doc.tipo === 'comercial';
  // Fundo claro: economiza tinta na impressão (pedido do Gabriel); escuro é o visual dos modelos.
  const claro = doc.capa.fundo === 'claro';
  const T = claro
    ? { fundo: '#ffffff', forma: '#f1eefc', circulo: '#e6f3f1', texto: C.texto, suave: C.suave, linha: C.borda, cartao: C.fundo, cartaoBorda: C.borda, destaque: C.roxo, sub: '#4b5263', logo: 'logo.png', quadro: 'transparent', traco: C.roxo }
    : { fundo: C.navy, forma: C.navy2, circulo: C.teal, texto: '#ffffff', suave: '#aeb3c9', linha: '#2f3757', cartao: C.navy3, cartaoBorda: '#38406a', destaque: C.roxoClaro, sub: '#c7cbe0', logo: 'logo-escuro.png', quadro: '#ffffff', traco: C.roxoClaro };
  const ac = !comercial && d.contatoTecnico?.nome ? d.contatoTecnico.nome : d.contato.nome;
  const comImagem = Boolean(doc.capa.imagem && imagens[doc.capa.imagem]);
  return (
    <Page size="A4" style={{ fontFamily: 'Geist', backgroundColor: T.fundo, color: T.texto }}>
      <Svg style={{ position: 'absolute', top: 0, left: 0 }} width={595} height={841} viewBox="0 0 595 841">
        <Polygon points="300,0 595,0 595,200 270,60" fill={T.forma} />
        <Circle cx={10} cy={720} r={120} fill={T.circulo} />
      </Svg>
      <View style={{ position: 'absolute', top: 40, left: 46, right: 46, bottom: 46 }}>
        {/* Logo principal, maior e no centro do cabeçalho */}
        <View style={{ alignItems: 'center' }}>
          <Image src={`${MARCA}${T.logo}`} style={{ width: 150, height: 82 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
            <View style={{ width: 26, height: 0.8, backgroundColor: T.traco, marginRight: 7 }} />
            <Text style={{ fontSize: 6.5, fontWeight: 600, color: T.suave, letterSpacing: 1.8 }}>MONTAGENS INDUSTRIAIS E CALDEIRARIA</Text>
            <View style={{ width: 26, height: 0.8, backgroundColor: T.traco, marginLeft: 7 }} />
          </View>
        </View>
        <View style={{ height: 0.5, backgroundColor: T.linha, marginTop: 18, marginBottom: comImagem ? 26 : 60 }} />
        <Text style={{ fontSize: 7.5, fontWeight: 600, color: T.destaque, letterSpacing: 2, marginBottom: 12 }}>
          {comercial ? 'PROPOSTA COMERCIAL / CONDIÇÕES DE FORNECIMENTO' : 'PROPOSTA TÉCNICA / ENGENHARIA'} · R{d.revisao}
        </Text>
        <Text style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.8, lineHeight: 1.15 }}>{d.titulo}</Text>
        {doc.capa.linha2 ? <Text style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.8, lineHeight: 1.15, color: T.destaque }}>{doc.capa.linha2}</Text> : null}
        {/* Documento antigo sem descrição em Dados ainda mostra o subtítulo que tinha. */}
        {(d.descricao?.trim() || doc.capa.subtitulo) ? <Text style={{ fontSize: 10.5, color: T.sub, marginTop: 12, maxWidth: 420, lineHeight: 1.5 }}>{resumirTexto(d.descricao?.trim() || doc.capa.subtitulo, 280)}</Text> : null}
        <View style={{ flexDirection: 'row', marginTop: 20 }}>
          {[['Cliente', d.cliente.nome], ['A/C', ac], ['Unidade', d.cliente.local], ['Identificação', `${d.codigo} · R${d.revisao}`]].map(([r, val], i) => (
            <View key={r} style={{ flex: 1, backgroundColor: T.cartao, borderRadius: 8, borderWidth: 0.5, borderColor: T.cartaoBorda, padding: 10, marginLeft: i ? 7 : 0 }}>
              <Text style={{ fontSize: 6.5, color: T.suave, letterSpacing: 1.2, marginBottom: 5 }}>{r.toUpperCase()}</Text>
              <Text style={{ fontSize: 9, fontWeight: 600 }}>{val || '-'}</Text>
            </View>
          ))}
        </View>
        {comImagem ? (
          // Decisão 71: a imagem principal ocupa todo o espaço livre até o rodapé da capa. flexBasis 0 faz ela só usar a sobra,
          // sem encolher a logo, o título e os cartões.
          <View style={{ marginTop: 14, marginBottom: 46, flexGrow: 1, flexBasis: 0, minHeight: 0, backgroundColor: T.quadro, borderRadius: 10, padding: claro ? 0 : 8 }}>
            <Image src={imagens[doc.capa.imagem!]} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </View>
        ) : null}
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, borderTopWidth: 0.5, borderTopColor: T.linha, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between' }}>
          <View><Text style={{ fontSize: 9, fontWeight: 700 }}>FABRIAÇO BRASIL</Text><Text style={{ fontSize: 7.5, color: T.suave, marginTop: 2 }}>{empresa.cidade}</Text></View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 7.5, color: T.suave }}>{(comercial ? d.vendedor?.nome : '') || d.preparadoPor || empresa.responsavel} · {dataExtenso(d.emissao)}</Text>
            <Text style={{ fontSize: 7.5, color: T.suave, marginTop: 2 }}>{empresa.site}</Text>
          </View>
        </View>
      </View>
    </Page>
  );
}

function CartaoInfo({ rotulo, valor, detalhe, destaque }: { rotulo: string; valor: string; detalhe?: string; destaque?: boolean }) {
  return (
    <View style={[s.cartao, { flex: 1, backgroundColor: '#ffffff', borderLeftWidth: 3, borderLeftColor: destaque ? C.verde : C.roxo, padding: 10 }]}>
      <Text style={s.cartaoRotulo}>{rotulo.toUpperCase()}</Text>
      <Text style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.25 }}>{valor || '-'}</Text>
      {detalhe ? <Text style={{ fontSize: 7.5, color: C.suave, marginTop: 2 }}>{detalhe}</Text> : null}
    </View>
  );
}

// Proposta comercial em 4 páginas (decisão 67): capa, visão geral, valores e a última (anexos, sigilo e vendedor).
function PaginasComerciais({ doc, d, empresa, v, tecnica }: { doc: Documento; d: DadosProposta; empresa: DadosEmpresaFabriaco; v: Variaveis; tecnica?: Documento | null }) {
  const sec = <T extends Secao['tipo']>(tipo: T) => doc.secoes.find((x) => x.tipo === tipo && x.ativo) as Extract<Secao, { tipo: T }> | undefined;
  const visao = sec('visao_comercial');
  const impostos = sec('impostos');
  const pagamento = sec('pagamento');
  const valores = sec('valores');
  const anexo = doc.secoes.find((x) => x.id === 'anexo' && x.ativo && x.tipo === 'texto') as Extract<Secao, { tipo: 'texto' }> | undefined;
  const sigilo = sec('confidencialidade');
  const t = resumoTecnica(tecnica);
  const dias = d.validadeDias || 30;
  const total = d.itens.reduce((a, i) => a + i.valor, 0);
  const revisoes = d.revisoes?.length ? d.revisoes : [{ numero: d.revisao, descricao: d.revisao ? `Revisão ${d.revisao}` : 'Emissão inicial', emissao: d.emissao }];
  const vend = d.vendedor;
  // Decisão 73: as Informações finais vão na página dos Valores quando cabem inteiras; se não cabem,
  // o bloco (wrap={false}) passa inteiro para a página seguinte, que repete a moldura.
  const encerramento = (
    <View wrap={false} style={{ marginTop: valores ? 26 : 0 }}>
      <TituloPagina rotulo="Encerramento" titulo="Informações finais" />
      {anexo ? (
        <View wrap={false} style={{ marginBottom: 12 }}>
          <Text style={[s.kicker, { marginBottom: 5 }]}>{anexo.titulo.toUpperCase()}</Text>
          {/* Decisão 86: só os anexos comerciais da aba Arquivos → Anexos, em cards (a proposta técnica não entra). */}
          <ListaAnexos arquivos={d.anexos?.comerciais ?? []} />
        </View>
      ) : null}
      {sigilo ? (
        <View wrap={false} style={{ marginBottom: 12 }}>
          <Text style={[s.kicker, { marginBottom: 5 }]}>TERMO DE CONFIDENCIALIDADE</Text>
          <Confidencialidade texto={CONFIDENCIALIDADE_COMERCIAL} v={v} />
        </View>
      ) : null}
      <View wrap={false} style={{ backgroundColor: C.navy, borderRadius: 10, padding: 18, flexDirection: 'row', alignItems: 'center' }}>
        <Image src={`${MARCA}icone.png`} style={{ width: 40, height: 40, marginRight: 14 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 7, fontWeight: 600, color: C.roxoClaro, letterSpacing: 1.4, marginBottom: 4 }}>NEGOCIAÇÃO · VENDEDOR RESPONSÁVEL</Text>
          <Text style={{ fontSize: 15, fontWeight: 700, color: '#ffffff' }}>{vend?.nome || d.preparadoPor || empresa.responsavel}</Text>
          <Text style={{ fontSize: 8, color: '#c7cbe0', marginTop: 2 }}>{vend?.cargo || 'Comercial'} · Fabriaço Brasil</Text>
        </View>
        <View style={{ borderLeftWidth: 0.5, borderLeftColor: '#3a4263', paddingLeft: 14 }}>
          <Text style={{ fontSize: 8, color: '#ffffff', marginBottom: 3 }}>{vend?.telefone || empresa.telefone}</Text>
          <Text style={{ fontSize: 8, color: '#ffffff', marginBottom: 3 }}>{vend?.email || empresa.email}</Text>
          <Text style={{ fontSize: 8, color: '#c7cbe0' }}>{empresa.site}</Text>
        </View>
      </View>
    </View>
  );
  return (
    <>
      <Page size="A4" style={s.pagina}>
        <Moldura d={d} comercial empresa={empresa} />
        <TituloPagina rotulo="Visão geral" titulo="Proposta comercial" sub={d.descricao?.trim() ? resumirTexto(d.descricao, 180) : d.titulo} />
        <Text style={[s.kicker, { marginBottom: 5 }]}>REVISÕES</Text>
        <Tabela cabecalho={['Revisão', 'Descrição', 'Emissão']} larguras={[0.8, 4, 1.2]} alinhar={['left', 'left', 'right']}
          linhas={revisoes.map((r) => [`R${r.numero}`, r.descricao || '-', dataCurta(r.emissao)])} />
        <View style={{ flexDirection: 'row', marginTop: 4, marginBottom: 10 }}>
          <CartaoInfo rotulo="Validade" valor={`${dias} dias`} detalhe={`Até ${dataCurta(somarDias(d.emissao, dias))}`} />
          <View style={{ width: 7 }} />
          {visao ? <><CartaoInfo rotulo="Frete" valor={d.frete ?? substituir(visao.frete, v)}
            detalhe={d.frete ? `${d.frete === 'CIF' ? 'Frete incluso' : 'Frete por conta do cliente'} · Entrega: ${d.entrega || d.cliente.local}` : substituir(visao.frete_detalhe, v)} /><View style={{ width: 7 }} /></> : null}
          <CartaoInfo rotulo="Garantia" valor={`${t.meses} meses`} detalhe="Após a emissão da NF" />
          <View style={{ width: 7 }} />
          <CartaoInfo rotulo="Prazo de entrega" valor={`${t.dias} dias`} detalhe={`Após ${t.inicio}`} destaque />
        </View>
        <View style={{ flexDirection: 'row' }}>
          {impostos ? (
            <View style={{ width: '52%', marginRight: 10 }}>
              <Text style={[s.kicker, { marginBottom: 5 }]}>IMPOSTOS (INCLUSOS)</Text>
              <Tabela cabecalho={['Tributo', 'Percentual']} larguras={[1, 1]} alinhar={['left', 'right']}
                linhas={[['NCM', impostos.ncm || '-'], ...impostos.linhas.map((l) => [l.tributo, l.valor])]} />
              {impostos.intro.trim() ? <Text style={{ fontSize: 7, color: C.suave }}>{substituir(impostos.intro, v)}</Text> : null}
            </View>
          ) : null}
          {pagamento ? (
            <View style={{ flex: 1 }}>
              <Text style={[s.kicker, { marginBottom: 5 }]}>FORMA DE PAGAMENTO</Text>
              <View style={[s.cartao, { backgroundColor: '#ffffff', padding: 0 }]}>
                {[['Condição', pagamento.condicao], ['Forma', pagamento.forma], ['Pago no marco', pagamento.marco]].map(([r, val], i) => (
                  <View key={r} style={{ padding: 10, borderTopWidth: i ? 0.5 : 0, borderTopColor: C.borda }}>
                    <Text style={s.cartaoRotulo}>{r.toUpperCase()}</Text>
                    <Text style={{ fontSize: 9.5, fontWeight: 600 }}>{substituir(val, v) || '-'}</Text>
                  </View>
                ))}
              </View>
              {pagamento.texto.trim() ? <View style={{ marginTop: 6 }}><TextoRico texto={pagamento.texto} v={v} estilo={{ fontSize: 7.5, color: C.suave }} /></View> : null}
            </View>
          ) : null}
        </View>
      </Page>

      {valores ? (
        <Page size="A4" style={s.pagina}>
          <Moldura d={d} comercial empresa={empresa} />
          <TituloPagina rotulo="Valores" titulo={d.titulo} />
          {valores.intro.trim() ? <TextoRico texto={valores.intro} v={v} estilo={{ fontSize: 8.5, color: '#374151' }} /> : null}
          <Tabela cabecalho={['Item', 'Título', 'Qtd', 'Valor unitário', 'Valor total']} larguras={[0.5, 3.2, 0.6, 1.3, 1.3]} alinhar={['left', 'left', 'center', 'right', 'right']}
            linhas={d.itens.map((i) => {
              const q = i.quantidade && i.quantidade > 0 ? i.quantidade : 1;
              const desc = substituir(valores.descricoes[i.letra] ?? '', v);
              return [
                <Text key="l" style={[s.td, { fontWeight: 700, color: C.roxo }]}>{i.letra}</Text>,
                <View key="t"><Text style={[s.td, { fontWeight: 600 }]}>{i.descricao || '-'}</Text>{desc ? <Text style={{ fontSize: 7.5, color: C.suave, marginTop: 2 }}>{desc}</Text> : null}</View>,
                qtd(q), moeda(i.valor / q),
                <Text key="v" style={[s.td, { fontWeight: 600 }]}>{moeda(i.valor)}</Text>,
              ];
            })} />
          <View wrap={false} style={{ backgroundColor: C.navy, borderRadius: 8, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            <View>
              <Text style={{ fontSize: 7.5, fontWeight: 600, color: C.roxoClaro, letterSpacing: 1.4, marginBottom: 3 }}>INVESTIMENTO GLOBAL</Text>
              <Text style={{ fontSize: 8.5, color: '#c7cbe0' }}>Total com impostos inclusos</Text>
            </View>
            <Text style={{ fontSize: 20, fontWeight: 700, color: '#ffffff' }}>{moeda(total)}</Text>
          </View>
          {encerramento}
        </Page>
      ) : null}

      {valores ? null : (
        <Page size="A4" style={s.pagina}>
          <Moldura d={d} comercial empresa={empresa} />
          {encerramento}
        </Page>
      )}
    </>
  );
}

// Descrição da aba Dados como subtítulo: uma linha só, cortada no limite para não empurrar a capa.
const resumirTexto = (t: string, max: number) => { const l = t.replace(/\s+/g, ' ').trim(); return l.length > max ? `${l.slice(0, max - 1).trimEnd()}…` : l; };

// Sobre nós e Dados da Empresa são obrigatórios na técnica (decisão 71): saem sempre, sem card no editor.
const DADOS_EMPRESA: Secao = { id: 'dados', titulo: 'Dados da Empresa', ativo: true, tipo: 'dados_empresas' };

export function DocumentoPdf({ doc: original, dados: d, empresa, imagens = {}, tecnica }: {
  doc: Documento; dados: DadosProposta; empresa: DadosEmpresaFabriaco; imagens?: Record<string, string>; tecnica?: Documento | null;
}) {
  const doc = sincronizarEscopo(original, d.itens); // itens do Escopo = itens dos Custos (decisão 74)
  const comercial = doc.tipo === 'comercial';
  const v: Variaveis = { cliente: d.cliente.nome, local: d.cliente.local, validade_dias: String(d.validadeDias || 30), codigo: `${d.codigo}-R${d.revisao}` };
  return (
    <Document title={`${comercial ? 'Proposta Comercial' : 'Proposta Técnica'} ${d.codigo}-R${d.revisao}`} author="Fabriaço Brasil" language="pt-BR">
      <Capa doc={doc} d={d} empresa={empresa} imagens={imagens} />
      {/* Técnica (decisão 70): página de abertura com "Conheça a Fabriaço" e os Dados da Empresa, sem número;
          as seções numeradas começam em página nova, pelo Objetivo (01). */}
      {!comercial && (
        <Page size="A4" style={s.pagina}>
          <Moldura d={d} comercial={false} empresa={empresa} />
          <SobreNos empresa={empresa} v={v} />
          <ConteudoSecao secao={DADOS_EMPRESA} v={v} d={d} empresa={empresa} imagens={imagens} topo={<TituloSecao titulo={DADOS_EMPRESA.titulo} />} />
        </Page>
      )}
      {comercial ? <PaginasComerciais doc={doc} d={d} empresa={empresa} v={v} tecnica={tecnica} /> : (
        <Page size="A4" style={s.pagina}>
          <Moldura d={d} comercial={false} empresa={empresa} />
          {doc.secoes.filter((x) => x.ativo && x.tipo !== 'sobre' && x.tipo !== 'dados_empresas').map((secao) => {
            const numero = numerar(doc.secoes).find((n) => n.secao.id === secao.id)?.numero;
            return (
              <ConteudoSecao key={secao.id} secao={secao} v={v} d={d} empresa={empresa} imagens={imagens}
                topo={numero ? <TituloSecao numero={numero} titulo={secao.titulo} /> : null} />
            );
          })}
        </Page>
      )}
    </Document>
  );
}

