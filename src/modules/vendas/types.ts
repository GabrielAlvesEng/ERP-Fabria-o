export interface Empresa {
  id: string;
  razao_social: string;
  nome_fantasia: string;
  cnpj: string | null;
  inscricao_estadual: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  telefones: string;
  emails: string;
  site: string;
  segmento_id: string | null;
  observacoes: string;
  ativo: boolean;
  criado_em: string;
}

export interface Contato {
  id: string;
  empresa_id: string;
  nome: string;
  cargo: string;
  departamento: string;
  email: string;
  telefone: string;
  whatsapp: string;
  unidade: string;
  classificacao: 'lead' | 'cliente';
  cliente_desde: string | null;
  observacoes: string;
  empresas?: { nome_fantasia: string } | null;
  contato_anos?: { ano: number; codigo_comercial: number }[];
}

export const STATUS = ['À enviar', 'Enviados', 'Follow-up', 'Aprovado', 'Reprovado', 'Finalizado', 'Emitido NF', 'Pago'] as const;
export type StatusProposta = (typeof STATUS)[number];

export interface Proposta {
  id: string;
  codigo: string;
  ano: number;
  empresa_id: string;
  contato_id: string;
  titulo: string;
  descricao: string;
  responsavel_id: string | null;
  valor: number;
  status: StatusProposta;
  revisao_atual: number;
  data_emissao: string;
  prazo_previsto: string;
  validade: string | null;
  condicoes_comerciais: string;
  proximo_followup: string | null;
  observacoes: string;
  ordem_kanban: number;
  empresas?: { nome_fantasia: string } | null;
  contatos?: { nome: string } | null;
  usuarios?: { nome: string } | null;
}

export interface Revisao {
  id: string;
  proposta_id: string;
  numero: number;
  status: 'rascunho' | 'enviada';
  enviada_em: string | null;
  valor: number | null;
  motivo: string;
  criado_em: string;
}

export interface Arquivo {
  id: string;
  revisao_id: string;
  tipo: 'tecnica' | 'comercial' | 'anexo' | 'documento_tecnico';
  caminho: string;
  nome: string;
  tamanho: number;
  criado_em: string;
}

export interface Evento {
  id: number;
  tipo: string;
  status_de: string | null;
  status_para: string | null;
  descricao: string;
  criado_em: string;
  usuarios?: { nome: string } | null;
}
