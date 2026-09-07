export const STATUSES = [
  "aguardando_informacoes",
  "novas",
  "em_decisao",
  "pendente_negativa",
  "negativada",
  "pendente_agendar_visita",
  "pendente_agendar_gravacao",
  "gaveta",
  "selecao_especial",
  "publicada",
] as const;

export type Status = (typeof STATUSES)[number];

/**
 * Status ativos exibidos como colunas/pills no quadro. Exclui os terminais
 * "ocultos" (hoje só 'publicada'), que ficam fora do fluxo do dia a dia e são
 * consultados por telas próprias (aba "Publicadas").
 */
export const BOARD_STATUSES: Status[] = STATUSES.filter((s) => s !== "publicada");

export const STATUS_LABEL: Record<Status, string> = {
  aguardando_informacoes: "Aguardando informações",
  novas: "Novas",
  em_decisao: "Decisão: aprovar/reprovar",
  pendente_negativa: "Pendente de negativa",
  negativada: "Negativada",
  pendente_agendar_visita: "Pendente agendar visita",
  pendente_agendar_gravacao: "Pendente agendar gravação",
  gaveta: "Gaveta",
  selecao_especial: "Seleção Especial",
  publicada: "Publicada",
};

/** Cor de destaque por coluna (mapa da seção 5 do PRD). */
export const STATUS_TONE: Record<Status, string> = {
  aguardando_informacoes: "muted",
  novas: "primary",
  em_decisao: "secondary",
  pendente_negativa: "destructive",
  negativada: "destructive",
  pendente_agendar_visita: "positive",
  pendente_agendar_gravacao: "positive",
  gaveta: "muted",
  selecao_especial: "primary",
  publicada: "positive",
};

export type Decisao = "aprovada" | "reprovada";

export const DECISAO_LABEL: Record<Decisao, string> = {
  aprovada: "Aprovada",
  reprovada: "Reprovada",
};

/**
 * Etapa: onde a captação está no fluxo. Exatamente UMA por captação, derivada
 * do `status` (ver lib/etapa.ts). É o eixo das abas.
 *
 * Não confundir com Lista, que é como a equipe organiza — várias por captação.
 */
export type Etapa = "decidir" | "aprovada" | "negativada" | "publicada";

export const ETAPA_LABEL: Record<Etapa, string> = {
  decidir: "Decidir",
  aprovada: "Aprovadas",
  negativada: "Negativadas",
  publicada: "Publicadas",
};

/**
 * Critérios de ordenação da lista. "sequencia" é a ordem manual — e é ela
 * que define a sequência de gravação dentro da lista aberta.
 */
export type Ordenacao = "sequencia" | "recentes" | "antigas" | "valor_desc" | "valor_asc" | "paradas";

export const ORDENACAO_LABEL: Record<Ordenacao, string> = {
  sequencia: "Sequência (manual)",
  recentes: "Mais recentes",
  antigas: "Mais antigas",
  valor_desc: "Maior valor",
  valor_asc: "Menor valor",
  paradas: "Paradas há mais tempo",
};

/** Recortes de situação do painel de filtros (seleção múltipla, OU entre eles). */
export const SITUACOES = [
  "sem_agendamento",
  "visita_agendada",
  "gravacao_agendada",
  "gravada",
  "nao_gravada",
  "no_sistema",
  "paradas",
] as const;

export type Situacao = (typeof SITUACOES)[number];

export const SITUACAO_LABEL: Record<Situacao, string> = {
  sem_agendamento: "Sem agendamento",
  visita_agendada: "Com visita agendada",
  gravacao_agendada: "Com gravação agendada",
  gravada: "Já gravada",
  nao_gravada: "Não gravada",
  no_sistema: "Já cadastrada no sistema",
  paradas: "Paradas há 3+ dias",
};

/** Filtros estruturados aplicados além da busca por texto. */
export interface Criterios {
  listas: string[];
  bairros: string[];
  valorMin: number | null;
  valorMax: number | null;
  metragemMin: number | null;
  metragemMax: number | null;
  quartosMin: number | null;
  suitesMin: number | null;
  vagasMin: number | null;
  entradaDe: string | null;
  entradaAte: string | null;
  situacoes: Situacao[];
}

export const CRITERIOS_VAZIO: Criterios = {
  listas: [],
  bairros: [],
  valorMin: null,
  valorMax: null,
  metragemMin: null,
  metragemMax: null,
  quartosMin: null,
  suitesMin: null,
  vagasMin: null,
  entradaDe: null,
  entradaAte: null,
  situacoes: [],
};

/** Paleta das listas — as seis do app de atendimento, no olive/gold daqui. */
export const CORES_LISTA = ["cinza", "azul", "verde", "ambar", "rosa", "violeta"] as const;

export type CorLista = (typeof CORES_LISTA)[number];

export interface Lista {
  id: string;
  nome: string;
  cor: CorLista;
  /** Aparece sempre na barra; as de migração ficam recolhidas. */
  permanente: boolean;
  ordem: number;
  criado_por: string | null;
  criado_em: string;
  atualizado_em: string;
}

/** Vínculo captação ↔ lista. `ordem` é a sequência de gravação DENTRO da lista. */
export interface CaptacaoLista {
  captacao_id: string;
  lista_id: string;
  ordem: number;
  criado_em: string;
}

export interface Captacao {
  id: string;
  status: Status;
  ordem: number;
  endereco: string;
  unidade: string | null;
  bairro: string | null;
  andar: number | null;
  quartos: number | null;
  suites: number | null;
  banheiros: number | null;
  vagas: number | null;
  metragem: number | null;
  valor_condominio: number | null;
  valor_iptu: number | null;
  valor_venda: number | null;
  valor_aluguel: number | null;
  tipo_portaria: string | null;
  proprietario_nome: string | null;
  whatsapp: string | null;
  anuncio_url: string | null;
  observacoes: string | null;
  pendencias: string | null;
  decisao: Decisao | null;
  decisao_autor: string | null;
  decisao_em: string | null;
  em_decisao_desde: string | null;
  gaveta_motivo: string | null;
  gaveta_revisao_em: string | null;
  visita_concluida: boolean;
  visita_data: string | null;
  /** Data e hora da visita (v2). Nulo em agendamento antigo — cair em `visita_data`. */
  visita_em: string | null;
  visita_duracao_min: number;
  visita_google_event_id: string | null;
  gravacao_concluida: boolean;
  gravacao_data: string | null;
  gravacao_em: string | null;
  gravacao_duracao_min: number;
  gravacao_google_event_id: string | null;
  /** Motivo da reprovação: é o que vai ser dito ao proprietário no retorno. */
  decisao_motivo: string | null;
  retorno_responsavel: string | null;
  retorno_prazo: string | null;
  retorno_feito: boolean;
  retorno_feito_em: string | null;
  retorno_feito_por: string | null;
  capa_path: string | null;
  share_token: string | null;
  imovel_id: string | null;
  imovel_codigo: string | null;
  cadastrado_em: string | null;
  publicada_em: string | null;
  arquivado_em: string | null;
  excluido_em: string | null;
  criado_por: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface Perfil {
  user_id: string;
  nome: string;
  atualizado_em: string;
}

export interface Opiniao {
  id: string;
  captacao_id: string;
  autor: string;
  texto: string;
  criado_em: string;
}

/** Contadores de opiniões por captação (badge do quadro). */
export interface OpinioesResumo {
  total: number;
  naoLidas: number;
}

export interface Midia {
  id: string;
  captacao_id: string;
  tipo: "foto" | "video";
  storage_path: string | null;
  thumb_path: string | null;
  url_externa: string | null;
  ordem: number;
  criado_em: string;
}

export interface Documento {
  id: string;
  captacao_id: string;
  storage_path: string;
  nome_original: string | null;
  mime_type: string | null;
  tamanho_bytes: number | null;
  criado_em: string;
}

/**
 * Cartão da raia "Pauta de gravação": uma lista ordenada do que vai ser
 * gravado. Fica fora do enum de status — não é uma captação, é uma agenda.
 */
export interface Pauta {
  id: string;
  titulo: string;
  descricao: string | null;
  data_alvo: string | null;
  ordem: number;
  concluida: boolean;
  excluido_em: string | null;
  criado_por: string | null;
  criado_em: string;
  atualizado_em: string;
}

/** Linha da pauta: texto livre, opcionalmente ligada a uma captação. */
export interface PautaItem {
  id: string;
  pauta_id: string;
  texto: string;
  captacao_id: string | null;
  concluido: boolean;
  ordem: number;
  criado_por: string | null;
  criado_em: string;
  atualizado_em: string;
}

/** Rótulo/tom da raia da pauta (não é um Status, mas aparece ao lado deles). */
export const PAUTA_LABEL = "Pauta de gravação";
