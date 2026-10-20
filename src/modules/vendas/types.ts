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
// Etapas contadas no Dashboard: todas, menos Follow-up (decisão 39). "Follow-up" continua aceito em propostas antigas.
export const STATUS_DASHBOARD = STATUS.filter((s) => s !== 'Follow-up');
// Colunas do Kanban (decisão 47): as etapas do Financeiro aparecem dentro de Aprovado, com selo.
export const STATUS_KANBAN: StatusProposta[] = ['À enviar', 'Enviados', 'Aprovado', 'Reprovado'];
export const ETAPAS_FINANCEIRO: StatusProposta[] = ['Finalizado', 'Emitido NF', 'Pago'];
// Coluna do Kanban em que a proposta aparece.
export function colunaKanban(s: StatusProposta): StatusProposta {
  if (s === 'Follow-up') return 'Enviados';
  return ETAPAS_FINANCEIRO.includes(s) ? 'Aprovado' : s;
}
// Situações em que a proposta aguarda retorno do cliente (data de follow-up no card).
export const AGUARDANDO_RETORNO: StatusProposta[] = ['Enviados', 'Follow-up'];

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
  validade_dias: number | null;
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
