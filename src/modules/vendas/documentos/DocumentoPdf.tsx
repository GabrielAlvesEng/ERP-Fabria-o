import type { ReactNode } from 'react';
import { Document, Font, Image, Page, Path, Polygon, Circle, StyleSheet, Svg, Text, View, type Styles } from '@react-pdf/renderer';
import geist400 from '@fontsource/geist-sans/files/geist-sans-latin-400-normal.woff?url';
import geist500 from '@fontsource/geist-sans/files/geist-sans-latin-500-normal.woff?url';
import geist600 from '@fontsource/geist-sans/files/geist-sans-latin-600-normal.woff?url';
import geist700 from '@fontsource/geist-sans/files/geist-sans-latin-700-normal.woff?url';
import { moeda } from '@/shared/lib/formato';
import {
  blocos, marcadorCartao, numerar, substituir, type Cartao, type DadosEmpresaFabriaco, type Documento, type Secao, type Trecho, type Variaveis,
} from './modelo';

// PDF da proposta (decisão 61), no visual dos modelos técnico e comercial enviados pelo Gabriel.
// A prévia na tela e o arquivo gerado saem deste mesmo componente.

Font.register({ family: 'Geist', fonts: [
  { src: geist400, fontWeight: 400 }, { src: geist500, fontWeight: 500 }, { src: geist600, fontWeight: 600 }, { src: geist700, fontWeight: 700 },
] });
Font.registerHyphenationCallback((palavra) => [palavra]);

export interface DadosProposta {
  codigo: string; revisao: number; titulo: string; emissao: string; validadeDias: number;
  cliente: { nome: string; razao_social: string; cnpj: string; ie: string; endereco: string; bairro: string; cep_cidade: string; local: string };
  contato: { nome: string; telefone: string; email: string };
  preparadoPor: string;
  itens: { letra: string; descricao: string; valor: number }[];
}

const C = {
  navy: '#141a2e', navy2: '#1f2640', navy3: '#262d4d', teal: '#15303a', roxo: '#6e48d0', roxoClaro: '#9a78ea', lavanda: '#ece8fb',
  texto: '#1f2433', suave: '#6b7280', borda: '#e5e7eb', fundo: '#f6f7fb', verde: '#0f766e', verdeFundo: '#d9f2ee', vermelho: '#b42318', vermelhoFundo: '#fde2e1',
};
const MARCA = `${import.meta.env.BASE_URL}marca/pdf/`;
// Cards de imagem ao lado do item (pt): 5 imagens por item cabem numa página.
const IMG = { largura: 178, altura: 104, espaco: 8, ligacao: 26, saida: 16 };

const s = StyleSheet.create({
  pagina: { fontFamily: 'Geist', fontSize: 9.5, color: C.texto, paddingTop: 54, paddingBottom: 56, paddingHorizontal: 46, lineHeight: 1.45 },
  topo: { position: 'absolute', top: 24, left: 46, right: 46, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7, letterSpacing: 1 },
  rodape: { position: 'absolute', bottom: 24, left: 46, right: 46, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7, color: C.suave, borderTopWidth: 0.5, borderTopColor: C.borda, paddingTop: 6 },
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
});

function Rico({ trechos, estilo }: { trechos: Trecho[]; estilo?: Styles[string] }) {
  return <Text style={estilo}>{trechos.map((t, i) => <Text key={i} style={t.negrito ? { fontWeight: 600 } : undefined}>{t.texto}</Text>)}</Text>;
}

// "topo" (título da seção) fica colado ao primeiro parágrafo ou item, para nunca sobrar sozinho no pé da página.
function TextoRico({ texto, v, topo }: { texto: string; v: Variaveis; topo?: ReactNode }) {
  const item = (it: Trecho[], j: number) => <View key={j} style={s.item} wrap={false}><Text style={s.bolinha}>•</Text><Rico trechos={it} estilo={{ flex: 1 }} /></View>;
  const lista = blocos(substituir(texto, v));
  if (!lista.length) return topo ? <View wrap={false}>{topo}</View> : null;
  return (
    <View>
      {lista.map((b, i) => {
        if (b.tipo === 'p') return i === 0 && topo ? <View key={i} wrap={false}>{topo}<Rico trechos={b.trechos} estilo={s.p} /></View> : <Rico key={i} trechos={b.trechos} estilo={s.p} />;
        return (
          <View key={i} style={{ marginBottom: 6 }}>
            {i === 0 && topo ? <View wrap={false}>{topo}{item(b.itens[0], 0)}</View> : item(b.itens[0], 0)}
            {b.itens.slice(1).map((it, j) => item(it, j + 1))}
          </View>
        );
      })}
    </View>
  );
}

function Check() {
  return <Svg width={9} height={9} viewBox="0 0 24 24"><Path d="M4 12.5l5 5L20 6.5" stroke={C.verde} strokeWidth={3} fill="none" /></Svg>;
}

function TituloSecao({ numero, titulo, comercial }: { numero: string; titulo: string; comercial: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14, marginBottom: 10, paddingBottom: comercial ? 8 : 0, borderBottomWidth: comercial ? 0.5 : 0, borderBottomColor: C.borda }}>
      <View style={{ width: 40, height: 20, borderRadius: 4, backgroundColor: comercial ? C.roxo : C.lavanda, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
        <Text style={{ fontSize: 8, fontWeight: 600, lineHeight: 1, color: comercial ? '#ffffff' : C.roxo }}>{numero}</Text>
      </View>
      <Text style={{ fontSize: 15, fontWeight: 700, letterSpacing: -0.3, lineHeight: 1.2, flex: 1 }}>{titulo}</Text>
      {comercial && <View style={{ width: 22, height: 2.5, borderRadius: 2, backgroundColor: C.roxo }} />}
    </View>
  );
}

function Tabela({ cabecalho, linhas, larguras, topo }: { cabecalho: string[]; linhas: (string | JSX.Element)[][]; larguras: number[]; topo?: ReactNode }) {
  const linha = (l: (string | JSX.Element)[], i: number) => (
    <View key={i} wrap={false} style={{ flexDirection: 'row', flexShrink: 0, paddingVertical: 6, paddingHorizontal: 8, backgroundColor: i % 2 ? C.fundo : '#ffffff',
      borderWidth: 0.5, borderTopWidth: i ? 0 : 0.5, borderColor: C.borda, ...(i === linhas.length - 1 ? { borderBottomLeftRadius: 6, borderBottomRightRadius: 6 } : {}) }}>
      {l.map((c, j) => <View key={j} style={{ flex: larguras[j] }}>{typeof c === 'string' ? <Text style={s.td}>{c}</Text> : c}</View>)}
    </View>
  );
  return (
    <View style={{ marginBottom: 8 }}>
      <View wrap={false}>
        {topo}
        <View style={{ flexDirection: 'row', flexShrink: 0, backgroundColor: C.navy, paddingVertical: 7, paddingHorizontal: 8, borderTopLeftRadius: 6, borderTopRightRadius: 6 }}>
          {cabecalho.map((c, i) => <Text key={i} style={[s.th, { flex: larguras[i] }]}>{c.toUpperCase()}</Text>)}
        </View>
        {linhas.length > 0 && linha(linhas[0], 0)}
      </View>
      {linhas.slice(1).map((l, i) => linha(l, i + 1))}
    </View>
  );
}

function Selo({ valor }: { valor: string }) {
  const cor = valor === 'Sim' ? [C.verdeFundo, C.verde] : valor === 'Não' ? [C.vermelhoFundo, C.vermelho] : ['#eef0f3', C.suave];
  return <View style={{ alignSelf: 'flex-start', backgroundColor: cor[0], borderRadius: 8, paddingVertical: 2, paddingHorizontal: 7 }}><Text style={{ fontSize: 7, fontWeight: 600, color: cor[1] }}>{valor}</Text></View>;
}

function ConteudoSecao({ secao, v, d, empresa, comercial, topo, imagens }: { secao: Secao; v: Variaveis; d: DadosProposta; empresa: DadosEmpresaFabriaco; comercial: boolean; topo: ReactNode; imagens: Record<string, string> }) {
  switch (secao.tipo) {
    case 'texto':
      return secao.texto.trim() ? <TextoRico texto={secao.texto} v={v} topo={topo} /> : <View wrap={false}>{topo}<Text style={{ color: C.suave }}>(seção a preencher)</Text></View>;
    case 'cartoes': {
      const comIntro = Boolean(secao.intro.trim());
      const comDestaque = Boolean(secao.destaque?.trim());
      const caixaCartao = { flexDirection: 'row' as const, borderWidth: 0.5, borderColor: C.borda, borderLeftWidth: comercial ? 3 : 0.5, borderLeftColor: comercial ? C.roxo : C.borda, borderRadius: 6, backgroundColor: comercial ? '#ffffff' : C.fundo, padding: 10 };
      const miolo = (c: Cartao, i: number) => (
        <>
          <View style={{ width: 22, height: 22, borderRadius: 4, backgroundColor: C.lavanda, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
            <Text style={{ fontSize: 8.5, fontWeight: 700, lineHeight: 1, color: C.roxo }}>{marcadorCartao(secao.marcador, i)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 8.5, fontWeight: 700, marginBottom: 3 }}>{substituir(c.titulo, v).toUpperCase()}</Text>
            <Text style={{ fontSize: 8, color: '#374151', lineHeight: 1.45 }}>{substituir(c.texto, v)}</Text>
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
        return (
          <View key={i} wrap={false} style={{ flexDirection: 'row', marginBottom: 10 }}>
            <View style={{ ...caixaCartao, flex: 1, minHeight: coluna }}>{miolo(c, i)}</View>
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
    case 'dados_empresas':
      return (
        <Tabela topo={topo} cabecalho={['Dados', 'Fabriaço', d.cliente.nome || 'Cliente']} larguras={[1, 1.6, 1.6]} linhas={[
          ['Razão social', empresa.razao_social, d.cliente.razao_social], ['CNPJ', empresa.cnpj, d.cliente.cnpj], ['Inscrição estadual', empresa.ie, d.cliente.ie],
          ['Endereço', empresa.endereco, d.cliente.endereco], ['Bairro', empresa.bairro, d.cliente.bairro], ['CEP / Cidade', empresa.cep_cidade, d.cliente.cep_cidade],
          ['Responsável técnico', d.preparadoPor || empresa.responsavel, d.contato.nome], ['Telefone / WhatsApp', empresa.telefone, d.contato.telefone], ['E-mail', empresa.email, d.contato.email],
        ].map((l) => l.map((c) => c || '-'))} />
      );
    case 'competencias':
      return <Tabela topo={topo} cabecalho={['Competência', 'Contemplado']} larguras={[1, 1]} linhas={secao.itens.map((i) => [i.nome, <Selo key={i.nome} valor={i.valor} />])} />;
    case 'matriz': {
      const marca = (sim: boolean) => (sim ? <View style={{ alignItems: 'center' }}><Check /></View> : <Text style={[s.td, { textAlign: 'center', color: '#c0c4cc' }]}>—</Text>);
      return <Tabela topo={topo} cabecalho={['Responsabilidade', (d.cliente.nome || 'Cliente').split(' ')[0], 'Fabriaço']} larguras={[5, 1, 1]}
        linhas={secao.itens.map((i) => [substituir(i.texto, v), marca(i.cliente), marca(i.fabriaco)])} />;
    }
    case 'impostos':
      return (
        <View wrap={false}>
          {topo}
          {secao.intro.trim() && <TextoRico texto={secao.intro} v={v} />}
          <View style={{ width: '75%' }}>
            <Tabela cabecalho={['Tributo / classificação', 'Informação da proposta']} larguras={[1, 1]}
              linhas={[['NCM', secao.ncm || '-'], ...secao.linhas.map((l) => [l.tributo, l.valor])]} />
          </View>
        </View>
      );
    case 'valores': {
      const total = d.itens.reduce((a, i) => a + i.valor, 0);
      return (
        <View>
          {secao.intro.trim()
            ? <TextoRico texto={secao.intro} v={v} topo={<>{topo}<Text style={s.kicker}>{d.titulo.toUpperCase()}</Text></>} />
            : <View wrap={false}>{topo}<Text style={s.kicker}>{d.titulo.toUpperCase()}</Text></View>}
          <Tabela cabecalho={['Item', 'Descrição do fornecimento', 'Valor total']} larguras={[1.3, 2.6, 0.9]} linhas={d.itens.map((i) => [
            <Text key="a" style={[s.td, { fontWeight: 600 }]}>{i.letra} — {i.descricao}</Text>,
            <Text key="b" style={[s.td, { color: '#374151' }]}>{substituir(secao.descricoes[i.letra] ?? '', v) || '-'}</Text>,
            <Text key="c" style={[s.td, { fontWeight: 600, textAlign: 'right' }]}>{moeda(i.valor)}</Text>,
          ])} />
          <View wrap={false} style={{ backgroundColor: C.navy, borderRadius: 8, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ fontSize: 7.5, fontWeight: 600, color: C.roxoClaro, letterSpacing: 1.4, marginBottom: 3 }}>INVESTIMENTO GLOBAL</Text>
              <Text style={{ fontSize: 8.5, color: '#c7cbe0' }}>Total com impostos inclusos</Text>
            </View>
            <Text style={{ fontSize: 20, fontWeight: 700, color: '#ffffff' }}>{moeda(total)}</Text>
          </View>
        </View>
      );
    }
    case 'pagamento':
      return (
        <View>
          <View wrap={false}>{topo}<Text style={s.p}>{substituir('A forma de pagamento seguirá a política comercial da {cliente}, conforme descrito abaixo:', v)}</Text></View>
          <View wrap={false} style={{ flexDirection: 'row', borderWidth: 0.5, borderColor: C.borda, borderRadius: 6, marginBottom: 8 }}>
            {[['Condição', secao.condicao], ['Marco', secao.marco], ['Forma', secao.forma]].map(([r, val], i) => (
              <View key={r} style={{ flex: 1, padding: 10, borderLeftWidth: i ? 0.5 : 0, borderLeftColor: C.borda }}>
                <Text style={s.cartaoRotulo}>{r.toUpperCase()}</Text><Text style={[s.cartaoValor, { fontSize: 9 }]}>{val || '-'}</Text>
              </View>
            ))}
          </View>
          <TextoRico texto={secao.texto} v={v} />
        </View>
      );
  }
}

const dataExtenso = (iso: string) => {
  const d = iso ? new Date(`${iso.slice(0, 10)}T12:00:00`) : new Date();
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
};
const dataCurta = (iso: string) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00`) : new Date()).toLocaleDateString('pt-BR');

function Capa({ doc, d, empresa, imagens }: { doc: Documento; d: DadosProposta; empresa: DadosEmpresaFabriaco; imagens: Record<string, string> }) {
  const comercial = doc.tipo === 'comercial';
  // Fundo claro: economiza tinta na impressão (pedido do Gabriel); escuro é o visual dos modelos.
  const claro = doc.capa.fundo === 'claro';
  const T = claro
    ? { fundo: '#ffffff', forma: '#f1eefc', circulo: '#e6f3f1', texto: C.texto, suave: C.suave, linha: C.borda, cartao: C.fundo, cartaoBorda: C.borda, pilula: '#cfc5f2', pilulaTexto: C.roxo, destaque: C.roxo, sub: '#4b5263', simbolo: 'simbolo.png', letreiro: 'letreiro.png', quadro: '#ffffff' }
    : { fundo: C.navy, forma: C.navy2, circulo: C.teal, texto: '#ffffff', suave: '#aeb3c9', linha: '#2f3757', cartao: C.navy3, cartaoBorda: '#38406a', pilula: '#6c5aa8', pilulaTexto: '#d6cdf7', destaque: C.roxoClaro, sub: '#c7cbe0', simbolo: 'simbolo-escuro.png', letreiro: 'letreiro-escuro.png', quadro: '#ffffff' };
  return (
    <Page size="A4" style={{ fontFamily: 'Geist', backgroundColor: T.fundo, color: T.texto }}>
      <Svg style={{ position: 'absolute', top: 0, left: 0 }} width={595} height={841} viewBox="0 0 595 841">
        <Polygon points="230,0 595,0 595,235 200,70" fill={T.forma} />
        <Circle cx={10} cy={690} r={120} fill={T.circulo} />
      </Svg>
      <View style={{ position: 'absolute', top: 46, left: 46, right: 46, bottom: 46 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Image src={`${MARCA}${T.simbolo}`} style={{ width: 22, height: 24, marginRight: 8 }} />
            <Image src={`${MARCA}${T.letreiro}`} style={{ width: 96, height: 15 }} />
          </View>
          <Text style={{ fontSize: 6.5, color: T.suave, letterSpacing: 1.6, marginTop: 6 }}>MONTAGENS INDUSTRIAIS E CALDEIRARIA</Text>
        </View>
        <View style={{ borderWidth: 1, borderColor: T.pilula, borderRadius: 14, paddingVertical: 6, paddingHorizontal: 12 }}>
          <Text style={{ fontSize: 7, fontWeight: 600, letterSpacing: 1.4, color: T.pilulaTexto }}>{comercial ? 'PROPOSTA COMERCIAL' : 'PROPOSTA TÉCNICA'} · R{d.revisao}</Text>
        </View>
      </View>
      <View style={{ height: 0.5, backgroundColor: T.linha, marginTop: 26, marginBottom: 56 }} />
      <Text style={{ fontSize: 7.5, fontWeight: 600, color: T.destaque, letterSpacing: 2, marginBottom: 14 }}>{comercial ? 'PROPOSTA COMERCIAL / CONDIÇÕES DE FORNECIMENTO' : 'PROPOSTA TÉCNICA / ENGENHARIA'}</Text>
      <Text style={{ fontSize: 31, fontWeight: 700, letterSpacing: -0.8, lineHeight: 1.15 }}>{doc.capa.linha1 || d.titulo}</Text>
      {doc.capa.linha2 ? <Text style={{ fontSize: 31, fontWeight: 700, letterSpacing: -0.8, lineHeight: 1.15, color: T.destaque }}>{doc.capa.linha2}</Text> : null}
      {doc.capa.subtitulo ? <Text style={{ fontSize: 10.5, color: T.sub, marginTop: 14, maxWidth: 400, lineHeight: 1.5 }}>{doc.capa.subtitulo}</Text> : null}
      <View style={{ flexDirection: 'row', marginTop: 24 }}>
        {[['Cliente', d.cliente.nome], ['Unidade', d.cliente.local], ['Identificação', `${d.codigo} · R${d.revisao}`]].map(([r, val], i) => (
          <View key={r} style={{ flex: 1, backgroundColor: T.cartao, borderRadius: 8, borderWidth: 0.5, borderColor: T.cartaoBorda, padding: 11, marginLeft: i ? 8 : 0 }}>
            <Text style={{ fontSize: 6.5, color: T.suave, letterSpacing: 1.2, marginBottom: 5 }}>{r.toUpperCase()}</Text>
            <Text style={{ fontSize: 9.5, fontWeight: 600 }}>{val || '-'}</Text>
          </View>
        ))}
      </View>
      {doc.capa.imagem && imagens[doc.capa.imagem] ? (
        <View style={{ marginTop: 18, height: 250, backgroundColor: T.quadro, borderRadius: 10, borderWidth: claro ? 0.5 : 0, borderColor: C.borda, padding: 10, alignItems: 'center', justifyContent: 'center' }}>
          <Image src={imagens[doc.capa.imagem]} style={{ maxHeight: 230, maxWidth: '100%', objectFit: 'contain' }} />
        </View>
      ) : null}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, borderTopWidth: 0.5, borderTopColor: T.linha, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between' }}>
        <View><Text style={{ fontSize: 9, fontWeight: 700 }}>FABRIAÇO BRASIL</Text><Text style={{ fontSize: 7.5, color: T.suave, marginTop: 2 }}>{empresa.cidade}</Text></View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 7.5, color: T.suave }}>{d.preparadoPor || empresa.responsavel} · {dataExtenso(d.emissao)}</Text>
          <Text style={{ fontSize: 7.5, color: T.suave, marginTop: 2 }}>{empresa.site}</Text>
        </View>
      </View>
      </View>
    </Page>
  );
}

export function DocumentoPdf({ doc, dados: d, empresa, imagens = {} }: { doc: Documento; dados: DadosProposta; empresa: DadosEmpresaFabriaco; imagens?: Record<string, string> }) {
  const comercial = doc.tipo === 'comercial';
  const v: Variaveis = { cliente: d.cliente.nome, local: d.cliente.local, validade_dias: String(d.validadeDias || 30) };
  const total = d.itens.reduce((a, i) => a + i.valor, 0);
  const rotuloRev = d.revisao === 0 ? 'R0 · Inicial' : `R${d.revisao}`;
  return (
    <Document title={`${comercial ? 'Proposta Comercial' : 'Proposta Técnica'} ${d.codigo}-R${d.revisao}`} author="Fabriaço Brasil" language="pt-BR">
      <Capa doc={doc} d={d} empresa={empresa} imagens={imagens} />
      <Page size="A4" style={s.pagina}>
        {!comercial && (
          <View style={s.topo} fixed>
            <Text style={{ color: C.suave }}>FABRIAÇO / ENGENHARIA INDUSTRIAL</Text>
            <Text style={{ color: C.roxo, fontWeight: 600 }}>PROPOSTA TÉCNICA · {d.codigo} / R{d.revisao}</Text>
          </View>
        )}
        <View style={s.rodape} fixed>
          <Text style={{ fontWeight: 600 }}>FABRIAÇO BRASIL · MOCOCA / SP</Text>
          <Text>{empresa.site}</Text>
          <Text style={{ color: C.roxo, fontWeight: 600 }} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>

        {comercial ? (
          <View>
            <Text style={s.kicker}>APRESENTAÇÃO COMERCIAL</Text>
            <Text style={s.h1}>Proposta comercial · Visão geral</Text>
            {doc.capa.subtitulo ? <Text style={s.sub}>{doc.capa.subtitulo}</Text> : null}
            <View wrap={false} style={{ flexDirection: 'row', backgroundColor: '#f1eefc', borderWidth: 0.5, borderColor: '#ddd5f6', borderRadius: 8, padding: 14, marginBottom: 10 }}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ fontSize: 12, fontWeight: 700, marginBottom: 5 }}>Olá, {d.contato.nome || 'cliente'}.</Text>
                <Text style={{ fontSize: 8.5, color: '#4b5263' }}>{substituir(doc.abertura, v)}</Text>
              </View>
              <View style={{ width: 150, borderLeftWidth: 0.5, borderLeftColor: '#cfc5f2', paddingLeft: 12 }}>
                <Text style={[s.kicker, { fontSize: 6.5 }]}>PREPARADO POR</Text>
                <Text style={{ fontSize: 10, fontWeight: 700 }}>{d.preparadoPor || empresa.responsavel}</Text>
                <Text style={{ fontSize: 7.5, color: C.suave, marginTop: 2 }}>Fabriaço Brasil</Text>
                <Text style={{ fontSize: 7.5, color: C.suave }}>Mococa / SP</Text>
              </View>
            </View>
            <View wrap={false} style={{ flexDirection: 'row', borderWidth: 0.5, borderColor: C.borda, borderRadius: 8, marginBottom: 10 }}>
              {[['Emissão', dataCurta(d.emissao)], ['Validade', `${d.validadeDias || 30} dias`], ['Revisão', rotuloRev], ['Local', d.cliente.local]].map(([r, val], i) => (
                <View key={r} style={{ flex: 1, padding: 11, borderLeftWidth: i ? 0.5 : 0, borderLeftColor: C.borda }}>
                  <Text style={s.cartaoRotulo}>{r.toUpperCase()}</Text><Text style={s.cartaoValor}>{val || '-'}</Text>
                </View>
              ))}
            </View>
            <View wrap={false} style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {[...d.itens.map((i) => [i.descricao, i.valor] as const), ['Total com impostos', total] as const].map(([r, val], i) => (
                <View key={i} style={{ width: '32%', marginRight: i % 3 === 2 ? 0 : '2%', marginBottom: 8, borderWidth: 0.5, borderColor: C.borda, borderLeftWidth: 3, borderLeftColor: C.roxo, borderRadius: 6, padding: 11, backgroundColor: C.fundo }}>
                  <Text style={s.cartaoRotulo}>{String(r).toUpperCase()}</Text><Text style={s.cartaoValor}>{moeda(Number(val))}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View>
            <Text style={s.kicker}>VISÃO DO DOCUMENTO</Text>
            <Text style={s.h1}>Especificação técnica</Text>
            {doc.capa.subtitulo ? <Text style={s.sub}>{doc.capa.subtitulo}</Text> : null}
            <View wrap={false} style={{ flexDirection: 'row', marginBottom: 6 }}>
              {[['Objeto', doc.visao.objeto], ['Solução', doc.visao.solucao], ['Unidade', doc.visao.unidade || `${d.cliente.nome.split(' ')[0]} · ${d.cliente.local}`]].map(([r, val], i) => (
                <View key={r} style={{ flex: 1, backgroundColor: C.fundo, borderWidth: 0.5, borderColor: C.borda, borderRadius: 8, padding: 12, marginLeft: i ? 8 : 0 }}>
                  <Text style={s.cartaoRotulo}>{r.toUpperCase()}</Text><Text style={s.cartaoValor}>{val || '-'}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {numerar(doc.secoes).map(({ secao, numero }) => (
          <ConteudoSecao key={secao.id} secao={secao} v={v} d={d} empresa={empresa} comercial={comercial} imagens={imagens}
            topo={<TituloSecao numero={numero} titulo={secao.titulo} comercial={comercial} />} />
        ))}

        {comercial && (
          <View wrap={false} style={{ backgroundColor: C.navy, borderRadius: 8, padding: 16, marginTop: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ fontSize: 7, fontWeight: 600, color: C.roxoClaro, letterSpacing: 1.4, marginBottom: 5 }}>CONTATO COMERCIAL E TÉCNICO</Text>
              <Text style={{ fontSize: 14, fontWeight: 700, color: '#ffffff' }}>Fabriaço Brasil</Text>
              <Text style={{ fontSize: 8, color: '#c7cbe0', marginTop: 3 }}>Engenharia · Fabricação · Montagens Industriais</Text>
            </View>
            <View style={{ borderLeftWidth: 0.5, borderLeftColor: '#3a4263', paddingLeft: 12 }}>
              <Text style={{ fontSize: 7.5, color: '#c7cbe0' }}>{empresa.email}</Text>
              <Text style={{ fontSize: 7.5, color: '#c7cbe0' }}>{empresa.site}</Text>
            </View>
          </View>
        )}
      </Page>
    </Document>
  );
}
