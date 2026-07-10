export const STATUSES = [
  "aguardando_informacoes",
  "novas",
  "em_decisao",
  "pendente_negativa",
  "negativada",
  "pendente_agendar_visita",
  "pendente_agendar_gravacao",
  "gaveta",
] as const;

export type Status = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<Status, string> = {
  aguardando_informacoes: "Aguardando informações",
  novas: "Novas",
  em_decisao: "Decisão: aprovar/reprovar",
  pendente_negativa: "Pendente de negativa",
  negativada: "Negativada",
  pendente_agendar_visita: "Pendente agendar visita",
  pendente_agendar_gravacao: "Pendente agendar gravação",
  gaveta: "Gaveta",
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
};

export type Decisao = "aprovada" | "reprovada";

export const DECISAO_LABEL: Record<Decisao, string> = {
  aprovada: "Aprovada",
  reprovada: "Reprovada",
};

/** Critérios de ordenação dentro de cada coluna. */
export type Ordenacao = "manual" | "recentes" | "antigas" | "valor_desc" | "valor_asc" | "paradas";

export const ORDENACAO_LABEL: Record<Ordenacao, string> = {
  manual: "Ordem manual",
  recentes: "Mais recentes",
  antigas: "Mais antigas",
  valor_desc: "Maior valor",
  valor_asc: "Menor valor",
  paradas: "Paradas há mais tempo",
};

/** Filtros estruturados aplicados além da busca por texto. */
export interface Criterios {
  valorMin: number | null;
  valorMax: number | null;
  quartosMin: number | null;
  soParadas: boolean;
}

export const CRITERIOS_VAZIO: Criterios = {
  valorMin: null,
  valorMax: null,
  quartosMin: null,
  soParadas: false,
};

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
  gravacao_concluida: boolean;
  gravacao_data: string | null;
  capa_path: string | null;
  imovel_id: string | null;
  imovel_codigo: string | null;
  cadastrado_em: string | null;
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
