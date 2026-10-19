// Consulta pública de CNPJ (dados da Receita Federal). Tenta três serviços gratuitos em sequência,
// porque cada um tem limite de uso e às vezes fica fora do ar. Só o CNPJ sai do navegador.
export interface DadosCNPJ {
  razao_social: string;
  nome_fantasia: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  telefones: string;
  emails: string;
  situacao: string;
}

class NaoEncontrado extends Error {}

function telefone(t: string | null | undefined): string {
  const d = (t ?? '').replace(/\D/g, '');
  if (d.length < 10) return '';
  return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
}

function titulo(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().replace(/(^|\s)\S/g, (l) => l.toUpperCase());
}

function cep(c: string | number | null | undefined): string {
  const d = String(c ?? '').replace(/\D/g, '');
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : '';
}

async function buscar(url: string): Promise<Record<string, any>> {
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (r.status === 404) throw new NaoEncontrado('CNPJ não encontrado na Receita.');
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function brasilApi(cnpj: string): Promise<DadosCNPJ> {
  const j = await buscar(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
  const tipo = j.descricao_tipo_de_logradouro ? `${titulo(j.descricao_tipo_de_logradouro)} ` : '';
  return {
    razao_social: j.razao_social ?? '',
    nome_fantasia: j.nome_fantasia ?? '',
    cep: cep(j.cep),
    logradouro: j.logradouro ? `${tipo}${titulo(j.logradouro)}` : '',
    numero: j.numero ?? '',
    complemento: titulo(j.complemento),
    bairro: titulo(j.bairro),
    cidade: titulo(j.municipio),
    uf: j.uf ?? '',
    telefones: [telefone(j.ddd_telefone_1), telefone(j.ddd_telefone_2)].filter(Boolean).join(' / '),
    emails: (j.email ?? '').toLowerCase(),
    situacao: j.descricao_situacao_cadastral ?? '',
  };
}

async function cnpjWs(cnpj: string): Promise<DadosCNPJ> {
  const j = await buscar(`https://publica.cnpj.ws/cnpj/${cnpj}`);
  const e = j.estabelecimento ?? {};
  return {
    razao_social: j.razao_social ?? '',
    nome_fantasia: e.nome_fantasia ?? '',
    cep: cep(e.cep),
    logradouro: e.logradouro ? `${e.tipo_logradouro ? `${titulo(e.tipo_logradouro)} ` : ''}${titulo(e.logradouro)}` : '',
    numero: e.numero ?? '',
    complemento: titulo(e.complemento),
    bairro: titulo(e.bairro),
    cidade: titulo(e.cidade?.nome),
    uf: e.estado?.sigla ?? '',
    telefones: [telefone(`${e.ddd1 ?? ''}${e.telefone1 ?? ''}`), telefone(`${e.ddd2 ?? ''}${e.telefone2 ?? ''}`)].filter(Boolean).join(' / '),
    emails: (e.email ?? '').toLowerCase(),
    situacao: e.situacao_cadastral ?? '',
  };
}

async function cnpja(cnpj: string): Promise<DadosCNPJ> {
  const j = await buscar(`https://open.cnpja.com/office/${cnpj}`);
  const a = j.address ?? {};
  return {
    razao_social: j.company?.name ?? '',
    nome_fantasia: j.alias ?? '',
    cep: cep(a.zip),
    logradouro: titulo(a.street),
    numero: a.number ?? '',
    complemento: titulo(a.details),
    bairro: titulo(a.district),
    cidade: titulo(a.city),
    uf: a.state ?? '',
    telefones: (j.phones ?? []).map((p: { area: string; number: string }) => telefone(`${p.area}${p.number}`)).filter(Boolean).join(' / '),
    emails: (j.emails ?? []).map((m: { address: string }) => m.address.toLowerCase()).join(', '),
    situacao: j.status?.text ?? '',
  };
}

export async function consultarCNPJ(cnpj: string): Promise<DadosCNPJ> {
  for (const fonte of [brasilApi, cnpjWs, cnpja]) {
    try {
      return await fonte(cnpj);
    } catch (e) {
      if (e instanceof NaoEncontrado) throw e;
      // serviço fora do ar, com limite ou bloqueado: tenta o próximo
    }
  }
  throw new Error('Não foi possível consultar o CNPJ agora (serviços públicos indisponíveis). Preencha manualmente ou tente de novo em instantes.');
}
